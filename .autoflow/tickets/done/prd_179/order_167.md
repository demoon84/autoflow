---
title: 🚨 worker last_result=token_budget_exceeded 의심 (token-cache stale 상태에서 발동)
priority: critical
created_at: 2026-05-04T22:35Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #10
---

## Request

🚨 critical — worker state 의 `last_result=token_budget_exceeded` 가 갱신됨. 그러나 token-cache 가 24시간 stale (order_162) 인 상태에서 어떤 데이터로 budget 초과를 판정했는지 의심. 두 가지 가능성:
1. token budget 정책이 stale 데이터로 잘못 trigger (false positive)
2. 진짜 token budget 초과 (별도 측정 source 존재)

확인 + 회복 / 정책 정비.

## 검출 증거

검출 시각: 2026-05-04T22:35:19Z (실시간 감시 tick #10)

```
worker.state:
  active_ticket_id=Todo-177
  active_ticket_title=adapter-running state heartbeat   (= order_165 → PRD-179)
  active_recovery_status=healthy
  last_event_at=2026-05-04T22:35:02Z
  last_result=token_budget_exceeded   ← 직전 호출이 budget 초과로 실패
```

**모순:**
- token-cache.tsv 가 24시간 stale (order_162 검출) → token 누계 측정 불가
- 그런데 budget 초과 판정 trigger 됨
- active_recovery_status=healthy + active 진행 중 → state 가 inconsistent (실패했는데 계속 활성?)

## 분석 가능성

### A. False positive — stale 데이터로 잘못 측정
- order_139 (자원 방어) 의 token budget 정책이 token-cache 를 source 로 사용
- stale 데이터 (24h 전) 가 누계 큰 값 (worker=582K) 으로 보여 매번 budget 초과 판정
- 새 ticket 마다 last_result=token_budget_exceeded 가 발동 → 정상 호출도 fail 로 분류
- **PRD-129 regression (order_162) 의 2차 부작용**

### B. 별도 budget source — telemetry-runs.jsonl 또는 다른 곳
- token-cache 외 다른 source 로 budget 측정 가능
- 호출당 input/output 직접 측정 (CLI flag 또는 어댑터 응답 parse)
- 진짜 budget 초과 → worker 의 호출이 큰 prompt + 큰 응답으로 cap 초과

### C. 정책 자체 미적용 (label 만 잘못)
- last_result=token_budget_exceeded 가 코드 정의는 있지만 실제 budget 정책 미구현
- 어떤 다른 fail 케이스가 잘못 이 label 로 기록

## 영향

1. **worker 작업 차단 가능** — last_result=token_budget_exceeded 후 추가 retry 안 하거나 차단되면 ticket 진행 멈춤
2. **사용자 가시성 저하** — UI / monitoring 에서 token_budget_exceeded 라벨이 false positive 면 혼란
3. **PRD-179 (adapter-running heartbeat) 처리 영향** — 이 PRD 가 끝나야 state 신뢰성 회복 — budget 차단으로 처리 못 하면 cycle
4. **다른 runner 도 영향 가능** — 같은 정책이 planner/verifier 에도 적용되면 모두 false trigger
5. **자원 방어 (order_139) 와 정합 깨짐** — budget 정책의 정확성이 깨지면 자원 방어 의미 무력화

## Suggested Fix

### Phase A — 즉시 진단
- `grep -rn "token_budget_exceeded" packages/cli/ apps/desktop/src/` 로 정확히 어디서 trigger 되는지 확인
- 해당 코드의 source data 확인 (token-cache.tsv vs telemetry-runs.jsonl vs 다른 곳)
- worker 의 직전 호출 stdout 분석:
  ```bash
  ls -t .autoflow/runners/logs/worker_2026-05-04T22-3*_stdout.log | head -3
  ```
- 호출이 실제로 budget 임계 초과했는지 확인

### Phase B — Stale 데이터 가드
- token budget 정책이 token-cache 를 사용하는 경우, **데이터 freshness 검증** 추가:
  - token-cache 마지막 row 가 N (기본 1시간) 이상 오래되면 → budget 검사 skip + 경고
  - stale 상태에서는 budget 정책 비활성 (fail-safe)
- 환경변수: `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS` (기본 3600)

### Phase C — Recovery
- worker 가 token_budget_exceeded 후에도 자율적으로 회복하는지 확인
- 회복 안 되면: state reset + 다음 tick 정상 진행

## Allowed Paths

- `packages/cli/run-role.sh` (token_budget_exceeded trigger 코드)
- `packages/cli/runners-project.sh` (budget 정책 적용)
- `packages/cli/metrics-project.sh` (budget 측정 source)
- `apps/desktop/src/main.js` (UI 노출 영향 시)

## Verification

```bash
# Phase A
grep -rn "token_budget_exceeded" packages/cli/ apps/desktop/src/

# 직전 호출 stdout 확인
LATEST=$(ls -t .autoflow/runners/logs/worker_*_stdout.log 2>/dev/null | head -1)
[ -n "$LATEST" ] && tail -50 "$LATEST"

# Phase B 후
# token-cache stale 환경에서 budget 검사 skip 됨 확인
# state 의 last_result 가 "budget_skipped_stale_data" 또는 정상 결과로 변화

# Phase C 후
# worker 가 다음 tick 에서 정상 호출 진행 (last_result=adapter_exit_0)
```

## Notes

- **연관:**
  - **order_162** (token-cache stale) — 본 issue 의 root cause 일 가능성 매우 높음
  - **order_165** (state.last_event_at 갱신) — worker 가 처리 중인 PRD-179
  - **order_139** (자원 방어 — token budget 정책) — 본 issue 가 그 정책의 정확성 문제
  - PRD-129 (token 집계 fix, regression 발생) — 가장 큰 회복 의존
- **위험:**
  - false positive 면 정상 worker 가 매번 차단 → 자율 흐름 멈춤
  - 진짜 초과면 budget 정책 동작 정상이지만, stale 데이터로 판정한 경우 측정값 신뢰성 0
- **1원칙 정합:**
  - 자율 흐름이 budget 정책 false trigger 로 멈추면 1원칙 위배
  - stale 데이터 상태에서는 fail-safe (budget 검사 skip + 경고) 필수
