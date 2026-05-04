---
title: Planner 실시간 trigger — 이벤트 기반 wakeup + polling 안전망 하이브리드
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

오케스트레이터(planner) 가 현재 60초 polling 으로만 동작 → 사용자가 새 order / backlog PRD 추가해도 최대 1분 지연. 이벤트 기반 trigger (보드 파일 변경 감지) + polling 안전망 하이브리드 적용해 **실시간 응답성 + 토큰 비용 동시 절감**.

## 검토 결과

### 옵션 비교

| 방식 | 호출 빈도 | 응답성 | 토큰 비용 | 평가 |
|---|---|---|---|---|
| 현재 (60s polling) | 시간당 60회 (변경 없어도) | 평균 30초 지연 | 매 tick idle skip 부담 | 비효율 |
| 짧은 polling (1s) | 시간당 3600회 | 즉시 | 60x 토큰 폭증 | 불가 |
| **이벤트 기반 (`fs.watch`)** | 변경 시만 | 1~3초 (debounce) | 변경 없으면 0 | 효율 |
| **하이브리드 (이벤트 + 안전망)** | 이벤트 + 가끔 (5~30분 polling) | 즉시 + 안전 | 가장 적음 | **권장** |

### Planner 깨어나야 할 이벤트

| # | Trigger | 실시간 가치 |
|---|---|---|
| 1 | `tickets/inbox/order_*.md` 추가 | **높음** — 사용자 직접 입력 즉시 처리 |
| 2 | `tickets/backlog/prd_*.md` 추가 | **높음** — 새 PRD 즉시 todo 변환 |
| 3 | `tickets/reject/` 이동 | 중 — 1분 지연 무방하지만 즉시도 OK |
| 4 | PROJECT_ROOT dirty 감지 (blocked-dirty) | 중 |
| 5 | `inprogress/` 의 ticket needs_user 전환 | 낮음 — 사람 개입 필요 |

→ #1, #2 가 가장 효과적 (사용자 즉시 반응).

## Scope (hint) — 권장 설계

### 1. 이벤트 기반 trigger
- `apps/desktop/src/main.js` 또는 별도 `.autoflow/scripts/planner-watcher.sh` 가 `fs.watch` (Node) 또는 `fswatch`/`inotifywait` (CLI) 로 감시:
  - `.autoflow/tickets/inbox/`
  - `.autoflow/tickets/backlog/`
  - `.autoflow/tickets/reject/`
- 변경 감지 시:
  1. **Debounce 2초** — 짧은 시간 burst 변경을 1회 trigger 로 통합
  2. planner runner 의 trigger file (예: `.autoflow/runners/state/planner.wakeup`) 생성
  3. planner 가 다음 sleep 사이에 이 trigger file 감지 시 즉시 wakeup (interval 무관)

### 2. Planner runtime 변경 (`packages/cli/run-role.sh` 또는 `.autoflow/scripts/start-plan.sh`)
- sleep loop 가 단순 `sleep N` 이 아닌 `wait_for_trigger_or_timeout(N)`:
  - trigger file 존재 시 즉시 깨어남
  - timeout (interval_seconds) 도달 시 polling 도 계속
- 깨어난 직후 trigger file 삭제 (consumed mark)

### 3. Burst / fork-bomb 가드
- **inflight lock**: planner tick 진행 중 새 trigger 들어와도 큐에 1개만 보관, 직전 tick 끝나면 즉시 다음 tick (max 1 pending)
- order_139 (자원 방어) 의 PID cap 정책 정합 — 절대 동시 spawn 안 됨

### 4. Polling 안전망
- 이벤트 기반 trigger 가 OS 이슈 (inotify limit, FSEvents 누락) 로 누락되면 안전망 polling 으로 회복
- 현재 60초 polling 을 5~30분으로 늘림 (이벤트가 주, polling 은 backup)
- 환경변수: `AUTOFLOW_PLANNER_REALTIME_ENABLED` (기본 0, opt-in), `AUTOFLOW_PLANNER_FALLBACK_INTERVAL_SECONDS` (기본 1800 = 30분)

### 5. PRD-155 (idle skip) 와 정합
- 이벤트 trigger 로 깨어났지만 매니페스트 hash 가 안 바뀐 경우 (이벤트는 발생했지만 의미 있는 변경 아님) → LLM 호출 skip
- 즉 "trigger 깨어남 ≠ LLM 호출". 두 단계 분리.

### 6. 다른 runner 적용 여부
- worker: ✅ 부분 적용 가능 — todo 추가 시 즉시 claim. 단 worker 가 이미 실시간 가까움 (1분 tick + claim 즉시).
- verifier: ✅ 적합 — verify 큐 추가 시 즉시 검증.
- wiki: ❌ 불필요 — 이미 debounce + idle skip 으로 효율적.
- 본 order 는 **planner 우선 적용**, 다른 runner 는 동일 패턴으로 후속 PRD.

## Allowed Paths (hint)

- `.autoflow/scripts/start-plan.sh` (sleep → wait_for_trigger_or_timeout)
- `.autoflow/scripts/planner-watcher.sh` (신설 — `fs.watch` 또는 `inotifywait` wrapper)
- `packages/cli/run-role.sh` (planner role 의 tick scheduler)
- `apps/desktop/src/main.js` (선택 — 데스크톱이 직접 fs.watch 해서 trigger file 만들 수도)
- `.autoflow/runners/config.toml` (planner mode 변경 또는 새 옵션 `realtime = true`)
- `.autoflow/runners/state/planner.wakeup` (trigger file)
- `AGENTS.md` (실시간 정책 명시)

## Verification (hint)

- 시뮬레이션 — `tickets/inbox/` 에 order 파일 추가 → 2초 안에 planner tick 시작 확인 (현재는 최대 60초).
- Burst — 동시 5개 파일 추가 → debounce 후 1회 trigger (5회 X).
- Idle skip 정합 — 이벤트 trigger 후 매니페스트 hash 동일 → LLM 호출 skip.
- Polling fallback — 이벤트 trigger 시스템 disable 후에도 30분 안에 polling 으로 회복.
- 회귀 — `AUTOFLOW_PLANNER_REALTIME_ENABLED=0` 으로 끄면 기존 60초 polling 동작.
- 자원 — 24h 운영 후 호스트 process 수 baseline 대비 변화 없음 (fork-bomb 없음).
- `npm run desktop:check` 통과.

## Notes

- **연관:**
  - **PRD-155** (idle skip) — 이벤트 trigger 이후 LLM 호출 skip 로 토큰 절감 시너지.
  - **PRD-156** (tick interval 동적 backoff) — polling 안전망의 자연 backoff 와 정합. 이벤트 활성 환경에서 polling interval 자동 확장.
  - **order_139** (자원 방어) — burst / fork-bomb 가드와 정합.
  - **order_136** (listRunners fork-bomb) — 동일 위험 인지, debounce + inflight lock 으로 회피.
- **위험:**
  - `fs.watch` 의 OS 차이 — linux inotify limit (default ~8192 watches), macOS FSEvents 차이. 안전망 polling 으로 완화.
  - 큰 보드 (수만 파일) 에서 watch 부담 — `tickets/inbox|backlog|reject` 만 감시, 다른 폴더 무시.
  - debounce 너무 짧으면 burst 폭증 위험. 2초 권장.
- **1원칙 정합:**
  - 자율 흐름 정합. 이벤트 기반은 자율 흐름의 응답성 향상 (멈춤 아닌 가속).
  - polling 안전망으로 이벤트 누락에도 자율 흐름 보장.
- **추가 검토 (Plan AI 결정):**
  - `fs.watch` Node vs `inotifywait` shell 중 어느 쪽이 안정적인지
  - debounce 2초가 적절한지 (1~5초 범위)
  - polling 안전망 cap (5분 vs 30분)
  - 데스크톱 main process vs 별도 watcher process — 어느 쪽이 책임 owner
