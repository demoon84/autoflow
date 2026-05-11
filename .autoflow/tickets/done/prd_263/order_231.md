# Autoflow Order

## Order

- ID: order_231
- Title: Planner stuck state janitor 역할 추가
- Status: inbox
- Priority: high
- Created At: 2026-05-10T12:20:03Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Planner 에 stuck state janitor 역할 추가 (stale lock / atomic 위반 / 좀비 자동 복구)
- Priority: high
- Status: ready
- Change Type: code


PTY 재시작 / worker abandon / 작업 중 크래시로 발생하는 stuck 상태 (stale ownership lock, atomic violation, 빈 worktree 좀비 등) 가 자주 발생하는데, 현재는 사용자가 수동으로 cleanup 해야 함. planner 가 이미 board orchestration 역할이라 매 tick 에 검사해서 자동 복구하면 사람 개입 빈도 줄어듬.

## Planner 의 새 점검/복구 항목 (매 tick)

각 항목은 mechanical 검사만으로 판단 가능 + 안전한 복구만 수행 (mechanical impossible 케이스만 needs_user 로 park).

### 1. Stale ownership lock 정리
- 기준: ticket 의 `Result: pending ticket-owner by <runner-id>:<pid>:...` 또는 legacy UUID 라인
- 검사: `kill -0 <pid>` 또는 (legacy UUID) state 파일 매핑으로 alive 여부 판정
- alive: 그대로 둠
- dead: lock 라인 삭제 + ticket Notes 에 audit 1줄 (`planner cleared stale lock <id> at <iso>`)

### 2. Atomic 위반 (inprogress 2건 이상)
- 기준: `tickets/inprogress/Todo-*.md` 가 단일 worker 당 2건 이상
- 검사: 각 inprogress ticket 의 worktree 변경량 (`git diff --shortstat`) + Stage 필드
- 정리: 가장 많이 진행된 1건만 inprogress 유지, 나머지는 `tickets/todo/` 로 mv (worktree 는 보존)
- audit: 옮긴 ticket 의 Notes 에 `planner reverted to todo: atomic violation, no work yet`

### 3. 빈 inprogress + 빈 worktree 좀비
- 기준: ticket 이 inprogress, worktree 변경 0, Stage=todo, Started_At 이 N 분 (기본 30분) 이상 경과
- 정리: ticket 을 todo 로 mv + worktree 정리 (`git worktree remove --force`)
- audit: `planner cleaned abandoned claim, no work in <N> min`

### 4. 고아 worktree
- 기준: `git worktree list` 의 entry 중 매칭되는 inprogress ticket 이 없고 변경도 없음
- 정리: `git worktree remove` 로 prune
- audit: planner runner state 에 `last_orphan_worktree_pruned=<branch>` 기록

### 5. Stage / 폴더 mismatch
- 기준: `tickets/inprogress/<id>.md` 의 `Stage:` 가 `todo` (= claim 만 하고 작업 시작 안 함)
- 검사: worktree 변경 0 + 30분 경과면 todo 로 되돌림
- 변경 있으면: 그대로 두고 worker 가 resume 하길 기다림

### 6. needs_user 안전망
- 위 1-5 케이스 중 mechanical 으로 판단 불가능한 케이스 (worktree 변경량 측정 실패, ticket 파일 락 등) 만 ticket 의 `Notes` 에 needs_user 로 park 하고 알림. 1원칙 위반 안 함.

## Allowed Paths

- .autoflow/scripts/start-plan.sh (또는 마이그레이션된 start-plan.js)
- .autoflow/scripts/board-guard.sh (점검 룰 추가 후보)
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/scripts/planner-janitor.js (새 파일 가능)
- runtime/board-scripts/ 미러 동기화

## Done When

- [ ] planner tick 에서 위 1-5 점검 단계 실행 (mechanical 검사만, AI 판단 불필요)
- [ ] stale ownership lock 자동 정리 검증: 임의 ticket 에 dead PID 박은 lock 라인 넣은 상태에서 planner 1 tick 후 라인 사라짐
- [ ] atomic 위반 자동 복구 검증: inprogress 에 2건 (1건은 worktree 비었음) 두면 1 tick 후 빈 쪽이 todo 로 이동
- [ ] 고아 worktree 자동 prune 검증: 매칭 ticket 없는 worktree 가 1 tick 후 사라짐
- [ ] 모든 cleanup 후 ticket Notes / planner state 에 audit 항목 추가
- [ ] 1원칙 보존: cleanup 실패 시 needs_user 로 park, planner 자체는 계속 동작
- [ ] AGENTS.md 또는 plan-to-ticket-agent.md 에 새 janitor 책임 1 섹션 추가
- [ ] order_230 (stable runner-id ownership) 와 호환 — 새 lock 포맷 기준으로 liveness check

## Verification

- Command: rg -n "stale lock|atomic violation|orphan worktree|planner.*cleared" .autoflow/scripts/start-plan.* .autoflow/scripts/planner-janitor.* 2>/dev/null

## Notes

- planner 책임 영역 확장 — 기존: order/PRD/todo 흐름. 추가: stuck state recovery (mechanical 만)
- worker 의 atomic close-out 과 역할 분리:
  - worker: 자기 ticket 의 정상 종료 (verify → merge → done 이동)
  - planner: worker 가 abandon 하거나 크래시한 잔해 정리
- order_228 (runner-stage.js) + order_230 (stable runner-id lock) 가 들어가면 planner 의 cleanup 도 더 정확해짐 (lock 포맷 통일, runner-id 별 PID 추적 가능)
- 사용자 개입 빈도가 현재 사고당 5~10회 → 0회 수준으로 감소 기대
- planner cleanup 은 매 tick (1분 간격) 마다 수행해도 cost 낮음 (filesystem ls + grep + kill -0 정도)

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
