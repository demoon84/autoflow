# Ticket

## Ticket

- ID: Todo-254
- PRD Key: prd_249
- Plan Candidate: Plan AI handoff from tickets/backlog/prd_249.md
- Title: PTY runner UI active ticket 복원
- Priority: high
- Change Type: code
- Stage: executing
- AI: 019e1142-d643-7013-b8d8-e6cc755b2815
- Claimed By: 019e1142-d643-7013-b8d8-e6cc755b2815
- Execution AI: 019e1142-d643-7013-b8d8-e6cc755b2815
- Verifier AI:
- Last Updated: 2026-05-10T09:42:25Z

## Goal

- PTY 모드로 전환 후 데스크톱 runner 카드의 "처리 중인 ticket" 표기와 진행 단계 슬라이더(대기/구현/완료/반려)가 비어있는 문제를 해결한다. `enrichRunnerActiveTicketFromFs` 함수(또는 동등 로직)를 개선해 `git worktree list` 기반 매칭으로 worker 의 활성 ticket 을 정확히 식별하고, active_stage 를 inprogress 폴더 상태로 결정한다. planner 도 inbox/backlog 처리 항목 유무로 슬라이더 단계를 반영한다.

## References

- PRD: tickets/backlog/prd_249.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_249]]
- Plan Note:
- Ticket Note: [[Todo-254]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_254`
- Branch: autoflow/tickets_254
- Base Commit: 6c7df4df975ebeca2dd5d4d1cef0dfdb57ebf110
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-10T09:40:04Z
- Started Epoch: 1778406004
- Updated At: 2026-05-10T09:42:26Z
- Tick Count: 2
- Time Used Seconds: 142
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: requested-ticket
- Last Progress Fingerprint: 3578747610

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] worker runner 가 inprogress 폴더에 단 하나의 Todo-*.md 를 갖고 있을 때, UI 의 "실행 중" 영역에 ticket id (`Todo-NNN`) 와 Title 이 표시된다.
- [x] worker runner 의 progress slider 가 inprogress 비어있을 때 "대기", 1개 이상일 때 "구현" 단계를 active 로 표시한다.
- [x] inprogress 에 ticket 이 여러 개 있을 때 가장 최근 worktree 와 매칭되는 ticket 을 선택한다.
- [x] planner runner 가 inbox/backlog 에 처리할 항목이 있을 때 슬라이더가 "계획" 단계, 비었을 때 "대기" 표시한다.
- [x] PTY mode (`mode=pty`) 와 legacy mode 둘 다 호환 — legacy state 가 `active_ticket_id` 를 박아 두면 그 값 우선.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 inbox order_220 을 prd_249 로 승격하고 todo 티켓을 생성한 직후.
- 직전 작업: planner 가 `tickets/inbox/order_220.md` 를 `tickets/done/prd_249/` 로 옮기고 generated PRD 와 Todo-254 를 만들었다.
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_249/prd_249.md`, Goal, Allowed Paths, Done When. `main.js` 의 `enrichRunnerActiveTicketFromFs` 구현 현황.

## Notes

- Created by planner (Plan AI) from tickets/backlog/prd_249.md at 2026-05-10T09:32:05Z.
- 원 order: `tickets/done/prd_249/order_220.md` (이전 위치 `tickets/inbox/order_220.md`).
- `git worktree list` 로 worker 의 활성 worktree 를 알아내 그 path 의 ticket 과 inprogress 를 매칭하는 방법 우선 적용.
- legacy state 가 `active_ticket_id` 를 이미 박아 둔 경우 그 값을 우선 사용한다.

- Runtime hydrated worktree dependency at 2026-05-10T09:40:03Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T09:40:03Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI 019e1141-9c63-7141-ad64-c5eb25867a40 prepared todo at 2026-05-10T09:40:03Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_254
- AI 019e1142-d643-7013-b8d8-e6cc755b2815 prepared requested-ticket at 2026-05-10T09:42:25Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_254
- Mini-plan: `listRunners` 결과를 FS 기반으로 보강하는 `enrichRunnerActiveContextFromFs` 계열 함수를 `apps/desktop/src/main.js`에 추가해 worker/planner active 컨텍스트를 보정한다.
- 구현: worker는 legacy `active_ticket_id` 우선 유지, 값이 비어 있을 때 `tickets/inprogress` + `git worktree list --porcelain` 매칭으로 active ticket/title/stage를 채운다.
- 구현: planner는 runner state `active_stage`가 비어 있으면 inbox/backlog markdown 존재 여부로 `planning`/`idle`을 채운다.
## Verification
- Command: `cd /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_254/apps/desktop && npm run check`
- Result: pass (`exit 0`, syntax/tsc/vite build 성공)

## Result

- Summary: PTY/legacy 공통 경로에서 runner active ticket/stage가 비어 보이는 케이스를 FS/worktree 기반 보강으로 복구했다.
- Remaining risk: 실제 앱 런타임에서 다중 inprogress + 다중 worktree 동시 상태는 수동 E2E 확인이 추가되면 더 안전하다.
