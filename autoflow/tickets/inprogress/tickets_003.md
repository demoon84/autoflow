# Ticket

## Ticket

- ID: tickets_003
- Project Key: project_001
- Plan Candidate: Update upgrade logic so existing boards receive missing runner/wiki scaffold files and directories safely.
- Title: Upgrade existing boards with runner and wiki scaffold
- Stage: blocked
- Owner: todo-1
- Claimed By: todo-1
- Execution Owner: todo-1
- Verifier Owner: unassigned
- Last Updated: 2026-04-24T23:04:52Z

## Goal

- 이번 작업의 목표: `autoflow upgrade` safely adds missing runner/wiki harness scaffold to existing boards without changing live tickets, logs, runner state, or user-authored files.

## References

- Project Spec: tickets/done/project_001/project_001.md
- Feature Spec:
- Plan Source: tickets/inprogress/plan_001.md

## Obsidian Links

- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_003]]

## Allowed Paths

- scripts/cli/upgrade-project.sh
- scripts/cli/upgrade-project.ps1
- scripts/cli/package-board-common.sh
- scripts/cli/package-board-common.ps1
- templates/board/
- README.md

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local`
- Branch: codex/autoflow-tickets-003
- Base Commit: 30f9b3a872bbadf4c3047b1e693a4906122d19b8
- Worktree Commit:
- Integration Status: blocked_dependency

## Done When

- [ ] `./bin/autoflow upgrade <project>` adds missing runner/wiki scaffold directories and docs to an existing board.
- [ ] Existing ticket, log, automation state, wiki, metric, conversation, and runner files are preserved.
- [ ] Upgrade output says what was added or already present in machine-readable form.
- [ ] Bash and PowerShell upgrade behavior stays aligned.
- [ ] Running upgrade twice is idempotent.

## Next Action
- 다음에 바로 이어서 할 일: tickets_002 의 package-board/template scaffold 변경이 중앙 PROJECT_ROOT 에 통합된 뒤 이 티켓을 재개한다. 그 전에는 upgrade 로직을 구현하지 않는다.

## Resume Context
- 현재 상태 요약: todo 에서 점유되어 inprogress 로 이동했지만, tickets_002 의 scaffold 패키징 변경이 verifier 에서 dirty PROJECT_ROOT 때문에 통합 대기 중이라 구현을 보류했다.
- 직전 작업: scripts/start-todo.sh 로 claim 완료 후 고유 worktree 를 만들고, tickets_002 통합 전 구현 시 중복/충돌 위험이 있음을 확인했다.
- 재개 시 먼저 볼 것: Worktree, Goal, Allowed Paths, Done When, Notes 의 진행 로그
- 구현 작업 루트: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local`

## Notes

- Treat user board files as live state. Prefer create-if-missing over replacement unless the current upgrade contract already says otherwise.

- Claimed by todo-1 at 2026-04-24T23:03:16Z; execution=todo-1; verifier=unassigned; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local

- 2026-04-24T23:04:52Z: Corrected worktree context to `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local` on branch `codex/autoflow-tickets-003`.
- 2026-04-24T23:04:52Z: Blocked before implementation because this ticket depends on tickets_002 package-board/template scaffold changes being integrated into central PROJECT_ROOT. Implementing now would duplicate or conflict with pending tickets_002 changes.
## Verification

- Run file:
- Log file:
- Result: blocked_dependency

## Result

- Summary: Blocked until tickets_002 is integrated and central dirty-root state is cleaned.
- Remaining risk: Upgrade behavior may duplicate or conflict with pending scaffold package changes if implemented before tickets_002 lands.
