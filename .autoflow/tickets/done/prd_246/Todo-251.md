# Ticket

## Ticket

- ID: Todo-251
- PRD Key: prd_246
- Plan Candidate: Plan AI handoff from tickets/done/prd_246/prd_246.md
- Title: fs.watch runner wakeup smoke verification
- Priority: low
- Change Type: docs
- Stage: executing
- AI: 019e112a-bf56-7703-bd37-1623ccd3bcce
- Claimed By: 019e112a-bf56-7703-bd37-1623ccd3bcce
- Execution AI: 019e112a-bf56-7703-bd37-1623ccd3bcce
- Verifier AI:
- Last Updated: 2026-05-10T09:18:29Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_246.

## References

- PRD: tickets/done/prd_246/prd_246.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_246]]
- Plan Note:
- Ticket Note: [[Todo-251]]

## Allowed Paths

- `.autoflow/scripts/watch-board.sh`
- `packages/cli/runners-project.sh`
- `tests/smoke/planner-realtime-wakeup-smoke.sh`
- `tests/smoke/runner-tick-backoff-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_251`
- Branch: autoflow/tickets_251
- Base Commit: 6c7df4df975ebeca2dd5d4d1cef0dfdb57ebf110
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-10T09:18:31Z
- Started Epoch: 1778404711
- Updated At: 2026-05-10T09:18:31Z
- Tick Count: 1
- Time Used Seconds: 0
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: todo
- Last Progress Fingerprint: 3051197596

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `bash tests/smoke/planner-realtime-wakeup-smoke.sh`가 성공(`exit 0`)한다.
- [ ] `bash tests/smoke/runner-tick-backoff-smoke.sh`가 성공(`exit 0`)한다.
- [ ] `order_test_fswatch_1778390423.md`는 PRD 처리 소스(`Conversation Handoff Source`)와 일치하고, planner 실행 로그에서 fs.watch 기반 wakeup 처리 흔적을 확인할 수 있다.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by 019e1107-331c-7bb0-8157-6037a0de44e1 (Plan AI) from tickets/done/prd_246/prd_246.md at 2026-05-10T08:37:25Z.

- Runtime hydrated worktree dependency at 2026-05-10T09:18:30Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T09:18:30Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI 019e112a-bf56-7703-bd37-1623ccd3bcce prepared todo at 2026-05-10T09:18:29Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_251
## Verification
- Result: pending ticket-owner by 019e112a-bf56-7703-bd37-1623ccd3bcce

## Result

- Summary:
- Remaining risk:
