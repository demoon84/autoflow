# Autoflow Order

## Order

- ID: order_198
- Title: 러너 AI 모델/에이전트 변경 적용 latency 단축
- Status: inbox
- Priority: high
- Created At: 2026-05-09T10:27:23Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 러너 AI 모델/에이전트 변경 적용 latency 단축
- Priority: high
- Status: ready


ai 모델 변경에 시간이 너무 오래 걸림. 카드의 dropdown 으로 agent/model 바꾸고 저장 누르면 새 모델이 실제로 다음 tick 에 사용되기까지 10~20초 걸리는 느낌.

## Notes

### 현재 흐름 (`apps/desktop/src/renderer/main.tsx` line ~2156 `saveRunnerConfig`)
1. dropdown 변경 → 저장 버튼.
2. `setRunnerAction(runner.id, "config_applying")` UI lock.
3. `window.autoflow.configureRunner({...})` IPC → `bin/autoflow runners set` CLI → `config.toml` 갱신. (~1-2s)
4. 응답 받으면 `loadBoard()` 호출 → 보드 전체 snapshot 다시 fetch. (~1-2s)
5. (옵션) runner 재시작 — kill + respawn + adapter cold start. (~5-10s)

총 latency 5~15s. 사용자 인지 "오래 걸림".

### 단축 방향 (planner/worker 가 결정)

- **A. 재시작 없이 next-tick pickup**: config.toml 만 갱신하고 runner 재시작 안 함. 다음 tick 시작 시 runner-common.sh 가 config 다시 읽어 새 model/agent 로 spawn. UI 는 즉시 새 값 표시 (optimistic). 사용자 체감 latency: < 1s.
  - 단점: 현재 진행 중인 tick 의 adapter 호출은 이전 모델로 끝나야 함 (도중 swap 불가).
  - 권장: 가장 효과 큰 변경.

- **B. configureRunner IPC 응답 → loadBoard 우회**: `loadBoard()` 가 무거운 board snapshot fetch 인데, 모델 변경 후엔 단일 runner config 만 갱신하면 충분. 해당 runner row 만 local state 로 업데이트.
  - 단점: 다른 board 변화가 같은 시점에 있으면 stale UI.
  - 적용 시 latency 약 1~2s 단축.

- **C. agent CLI spawn warm-up cache**: claude/codex/gemini CLI 의 cold start 비용을 미리 데우는 방법. 실제로는 외부 프로세스라 제어 어려움. 권장 안 함.

- **D. UI optimistic 즉시 반영**: configureRunner IPC 응답 이전에 dropdown 값을 그대로 카드에 반영 (실패 시 롤백). 사용자가 "변경됐다" 감지하는 시간 0초.
  - A/B 와 조합 시 가장 자연스러움.

### 권장 조합
**A + D**: config.toml 만 갱신 (재시작 X), UI 는 즉시 새 값 노출. 다음 tick 부터 새 모델 사용. 체감 latency ~0초. 진행 중 tick 은 이전 모델로 끝남 — 정상 동작.

### 후보 위치
- `apps/desktop/src/renderer/main.tsx` line 2156 `saveRunnerConfig` — IPC 응답 처리 단순화.
- `apps/desktop/src/main.js` line ~3571 `configureRunner` — `runners set` 후 자동 재시작 트리거 제거 (현재 트리거하는지 확인).
- `packages/cli/runners-project.sh` 또는 `runtime/board-scripts/runners-project.sh` — `runners set` 명령이 자동 재시작하지 않게.
- `runtime/board-scripts/run-role.sh` 의 tick 진입점 — 매 tick 시작 시 config.toml 다시 read.

### 회귀 가드
- 사용자가 "재시작" 명시 액션 (저장 버튼 옆 별도 버튼) 누를 때만 즉시 재시작. 일반 저장은 next-tick pickup.
- realtime 모드 (`AUTOFLOW_RUNNER_REALTIME_ENABLED=1`) 에서도 동일 동작.
- agent 변경 같은 큰 변화 (claude → gemini) 도 동일 처리. tick 경계에서 자연스럽게 swap.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/run-role.sh`
- `.autoflow/scripts/run-role.sh`

## Done When

- [ ] dropdown 으로 agent/model 변경 후 저장 시 UI 가 즉시 (< 1s) 새 값 반영.
- [ ] 다음 runner tick (interval_seconds 안) 부터 새 model/agent 로 adapter 호출 — telemetry 의 model 필드로 검증.
- [ ] 변경 시 자동 runner 재시작 없음 (사용자가 별도 액션 안 한 한).
- [ ] 진행 중 tick 은 이전 모델로 정상 종료.
- [ ] `npm run desktop:check` 통과.
- [ ] 기존 별도 "재시작" 액션 (이미 있다면 유지). 사용자 의도된 force-restart 흐름 보존.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조 시나리오: dropdown 으로 model 변경 → 저장 → UI 즉시 새 모델 표시 → 다음 tick 의 telemetry 에서 새 model 확인.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
