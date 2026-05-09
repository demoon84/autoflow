---
title: 🚨 runner state.last_event_at 가 어댑터 호출 진행 중 갱신 안 됨 — stuck 진단 신뢰성 깨짐
priority: critical
created_at: 2026-05-04T22:21Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #5
---

## Request

🚨 critical — runner state 의 `last_event_at` 가 LLM 어댑터 호출 **시작 시각으로만 고정**되고 호출 진행 중에는 갱신 안 됨. 결과: 활성 호출 중인 runner 가 "stuck" 처럼 보여 진단 신뢰성 완전 깨짐. 데스크톱 "응답 지연" 라벨, runnerHeartbeatStale, monitoring 도구 모두 영향.

## 검출 증거

검출 시각: 2026-05-04T22:21:21Z (실시간 감시 tick #5)

**worker 사례 (현재 세션):**
```
worker state:
  status=running
  active_ticket_id=Todo-174  (order_160 → PRD-175 처리 중)
  last_event_at=2026-05-04T22:07:05Z  ← 14분 16초 stale 처럼 보임

worker stdout (live):
  파일: worker_2026-05-04T22-07-05Z_live_stdout.log
  사이즈: 66320 lines, 1.5MB
  마지막 timestamp: 2026-05-04T22:21:36Z  ← 14분 후에도 codex 가 활성
  내용: codex_core_plugins / skills loader WARN 다수 + diff 출력 진행 중
```

→ **runner 는 정상 활성. state.last_event_at 만 14분+ 갱신 누락.** 단순 stuck 으로 오진할 수 있는 patterns.

**verifier / wiki 와 비교 (동일 시각):**
- verifier: last_event_at=22:21:16Z (5초 전, 정상 갱신) — verifier 호출은 짧아서 (~30초~1분) tick 마다 끝나서 갱신
- wiki: last_event_at=22:18:43Z (2분 38초 전, 정상)
- planner: last_event_at=22:15:43Z (5분 38초 전, 정상)

→ **호출이 긴 worker 만 갱신 누락**. 짧은 호출 runner 는 영향 없음.

## 영향

1. **데스크톱 "응답 지연" 라벨 (order_159)** — 활성 worker 가 항상 "응답 지연" 표시 → false alarm 의 근본 원인
2. **runnerHeartbeatStale (`apps/desktop/src/renderer/main.tsx:5721-5729`)** — 활성 호출 중 매번 stale 판정 → 신뢰성 0
3. **monitoring 도구 (본 세션의 tick) 진단 불가** — stuck vs 활성 구분 못함. tick #4 의 worker stuck 의심도 사실은 정상이었음
4. **PRD-129 (token 집계) 와 합쳐 더 큰 문제** — token-cache 도 stale, state 도 stale → metrics 전체 신뢰성 깨짐
5. **AI 진행 현황 카드의 progress 표시 부정확** — 카드가 활성인데 "5분 전 마지막 이벤트" 표시
6. **자동 회복 (planner blocked-auto-recover) 오작동 가능** — stale 판정으로 잘못 회복 시도

## Root Cause 후보 (검증 필요)

1. **runner tick 의 state write 가 호출 시작/종료 시에만 발생** — 진행 중에는 update 안 함. (현재 동작)
2. **PRD-135 (stop reason marker) 후속 회귀** — state write 위치 변경 시 부작용
3. **어댑터 streaming chunk 가 state 와 연결 안 됨** — codex/claude streaming 응답 chunk 마다 state 갱신해야 함 (order_159 의 옵션 C 참조)

## Suggested Fix

### Phase A — 즉시: Heartbeat 갱신 추가 (간단)
- runner tick 의 어댑터 호출 직전 sub-process 또는 별도 thread 가 N (기본 30) 초마다 state.last_event_at 만 갱신:
  ```bash
  # run-role.sh 의 어댑터 호출 wrapper 에 추가
  (
    while true; do
      sleep 30
      runner_write_state_partial "$runner_id" "last_event_at=$(runner_now_iso)" "active_stage=adapter_running"
    done
  ) &
  HEARTBEAT_PID=$!
  
  run_with_timeout ... <adapter call>
  
  kill $HEARTBEAT_PID 2>/dev/null
  ```
- 30초 마다 heartbeat → "응답 지연" 5분 임계 (또는 order_159 의 10분) 안에 항상 갱신
- 호출 진행 중 명시 표시 (`active_stage=adapter_running`)

### Phase B — Streaming chunk 기반 정확 갱신 (정확)
- `packages/cli/run-role.sh` 의 어댑터 호출이 streaming output 모니터링:
  - codex stdout 새 chunk 도착 시 마다 state.last_adapter_chunk_at 갱신
  - claude streaming 응답 동일
- runnerHeartbeatStale 검사 시 last_event_at 외에 last_adapter_chunk_at 도 참조 (둘 중 최근값)
- order_159 의 옵션 C 와 통합

### Phase C — UI 보강 (order_159 정합)
- `apps/desktop/src/renderer/main.tsx:5721` `runnerHeartbeatStale` 가 `active_stage=adapter_running` 인 경우 stale 판정 안 함 (호출 진행 중 명시)
- 라벨 단계화 (order_159) 와 결합: "LLM 응답 대기 중 (Nm 경과)" 표시

## Allowed Paths

- `packages/cli/run-role.sh` (heartbeat sub-process / streaming chunk 모니터링)
- `packages/cli/runners-project.sh` (`runner_write_state_partial` 헬퍼)
- `apps/desktop/src/renderer/main.tsx` (`runnerHeartbeatStale` 보강)
- `.autoflow/runners/state/<runner>.state` (스키마 — `active_stage`, `last_adapter_chunk_at`)

## Verification

```bash
# Phase A 후
# worker 가 5분+ 호출 중일 때
grep last_event_at .autoflow/runners/state/worker.state
# → 30초 이내 timestamp (heartbeat 갱신)
grep active_stage .autoflow/runners/state/worker.state
# → adapter_running

# Phase B 후
grep last_adapter_chunk_at .autoflow/runners/state/worker.state
# → stdout 마지막 chunk 시각

# 데스크톱 회귀
# 활성 worker 카드에서 "응답 지연" 사라짐, "LLM 응답 대기 중 (Nm)" 표시
```

## Notes

- **연관:**
  - order_159 (응답 지연 단계화) — 본 order 의 root fix 후 단계화 의미 회복
  - order_162 (token-cache stale) — 비슷한 metrics 신뢰성 문제
  - PRD-135 (stop reason marker) — state write 변경의 회귀 가능성 검증
  - order_147/148/158 (transition state) — 모두 state 신뢰성 문제 family
- **위험:**
  - heartbeat sub-process 가 leak 되면 runner crash 후 stale heartbeat 만 남음. parent kill 시 child kill 보장 (trap).
  - state 동시 write race condition — atomic write 필수.
- **1원칙 정합:**
  - state 신뢰성 회복 = monitoring 신뢰성 회복 = 자율 흐름 진단 능력 회복.
  - 자율 흐름 자체는 영향 없음 (state 만 수정).
- **검출 방법:** 실시간 감시 중 worker 14분 stuck 의심 → stdout 활성 확인 → state 갱신 누락 발견.
