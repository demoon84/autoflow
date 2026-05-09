---
title: 🚨 worker `token_budget_exceeded` 3회 연속 stuck — circuit breaker / 자동 회복 정책 부재
priority: critical
created_at: 2026-05-04T22:41Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #12
---

## Request

🚨 critical — worker 가 `last_result=token_budget_exceeded` 로 **3 tick 연속 같은 실패** 반복 (감시 #2 임계 도달). active_ticket_id=Todo-177 (PRD-179 = order_165 의 state heartbeat) 처리 못 끝내고 cycle. 회복 정책 / circuit breaker 부재로 stuck. 1원칙(멈추지 않음) 위배 추세.

## 검출 증거

```
Tick #10 (22:35:19Z): worker last_result=token_budget_exceeded
Tick #11 (22:39:18Z): worker last_result=token_budget_exceeded
Tick #12 (22:41:17Z): worker last_result=token_budget_exceeded
                      ↑ 3회 연속 같은 fail
                      
worker.state:
  active_ticket_id=Todo-177  (변화 없음, 6분+ 같은 ticket)
  active_recovery_status=healthy  ← 모순 (실패인데 healthy)
  last_event_at=2026-05-04T22:40:03Z (state 갱신은 됨)
  last_result=token_budget_exceeded
```

## 영향

1. **PRD-179 (order_165 state heartbeat) 처리 차단** — 회복하려는 PRD 자체가 차단되니 cycle.
2. **worker 가 다른 ticket 처리 못 함** — Todo-177 에 묶여 다음 todo 못 claim.
3. **1원칙 위배** — 자율 흐름이 자기 보호 정책 (token budget) 으로 인해 stuck. order_139 의 의도와 반대 결과.
4. **active_recovery_status=healthy 와 last_result=fail 의 모순** — recovery 트리거가 budget_exceeded 를 인식 안 함.

## Root Cause 후보

- **Circuit breaker 미구현** — order_139 의 "연속 N회 token cap 초과 시 runner 자동 halt" 정책이 도입 안 됐거나 발동 안 됨.
- **Token budget 정책이 retry 무한 trigger** — fail 후 자동 재시도하는데 또 같은 fail.
- **order_167 (false positive 의심) 와 합쳐진 cycle** — false trigger → retry → 또 false trigger.

## Suggested Fix

### Phase A — 즉시 stuck 회복 (수동)
```bash
# worker 강제 reset (graceful 또는 force)
bash bin/autoflow runners stop worker /Users/demoon2016/Documents/project/autoflow .autoflow --force
# 또는 ticket reclaim
mv .autoflow/tickets/inprogress/Todo-177.md .autoflow/tickets/todo/Todo-177.md
bash bin/autoflow runners start worker /Users/demoon2016/Documents/project/autoflow .autoflow
```

### Phase B — Circuit breaker 즉시 도입 (order_139 일부 즉시 구현)
- runner state 에 `consecutive_fail_count`, `consecutive_fail_result` 필드 추가
- 같은 last_result fail 이 N (기본 3) 회 연속 → runner 자동 halt + check_NNN.md 생성 (order_135)
- runner state `last_result=circuit_breaker_tripped`
- 사람 확인 전까지 재시작 안 됨 (또는 cooldown 후 재시작)

### Phase C — token_budget_exceeded 의 retry 정책 명확화
- token_budget_exceeded 후 즉시 retry 금지 (다음 tick 도 같은 결과)
- 다음 tick 에 ticket reclaim → 다른 ticket 진행
- 같은 ticket 이 token cap 초과면 ticket 자체 skip + reject 또는 needs_user

### Phase D — order_167 (false positive) 와 통합 진단
- token-cache stale 일 때 budget 검사 skip (fail-safe)
- 본 issue 가 stale 데이터 false trigger 면 즉시 회복

## Allowed Paths

- `packages/cli/run-role.sh` (circuit breaker 적용)
- `packages/cli/runners-project.sh` (state schema 확장)
- `.autoflow/runners/state/<runner>.state` (consecutive_fail_count 필드)
- `.autoflow/scripts/finish-ticket-owner.sh` (token_budget_exceeded 후 reclaim 정책)

## Verification

```bash
# Phase B 후
# 시뮬레이션: worker 가 같은 fail 3회 → state.last_result=circuit_breaker_tripped + halt
grep -E "consecutive_fail_count|last_result" .autoflow/runners/state/worker.state

# 회복 후 정상
grep last_result .autoflow/runners/state/worker.state
# → adapter_exit_0 (정상 호출 끝)
```

## Notes

- **연관:**
  - **order_167** (token_budget false positive 의심) — 본 order 의 root cause 공유
  - **order_139** (자원 방어 — circuit breaker 정책) — 본 order 가 그 일부 즉시 구현 요청
  - **order_165** (state heartbeat) — 본 worker 가 처리 중인 PRD-179, 차단 대상
  - **order_135** (check_NNN.md) — circuit breaker 발동 시 자동 기록
- **위험:**
  - circuit breaker 너무 보수적 → 정상 retry 도 차단. N=3 정도 적정.
  - 수동 회복 (Phase A) 만으로는 같은 cycle 재발. Phase B/C 필수.
- **1원칙 정합:**
  - 자기 보호 정책 (token budget) 이 자율 흐름을 무한 차단하면 1원칙 위배.
  - circuit breaker 가 발동되면 사람 알림 + 다음 ticket 으로 진행 → 자율 흐름 유지.
