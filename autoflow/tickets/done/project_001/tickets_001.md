# Ticket

## Ticket

- ID: tickets_001
- Project Key: project_001
- Plan Candidate: Add runner, wiki, metrics, conversations, adapter, and wiki-rule template files to the generated board scaffold.
- Title: Add runner and wiki scaffold templates
- Stage: done
- Owner: verify-1
- Claimed By: todo-1
- Execution Owner: unassigned
- Verifier Owner: verify-1
- Last Updated: 2026-04-24T23:12:41Z

## Goal

- 이번 작업의 목표: fresh generated boards have the minimal files and folders needed to represent runner state, wiki knowledge, metrics, conversations, agent adapters, and wiki rules before any execution logic is added.

## References

- Project Spec: tickets/done/project_001/project_001.md
- Feature Spec:
- Plan Source: tickets/inprogress/plan_001.md

## Obsidian Links

- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_001]]

## Allowed Paths

- templates/board/
- agents/
- reference/
- rules/

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_001_local`
- Branch: codex/autoflow-tickets-001
- Base Commit: 30f9b3a872bbadf4c3047b1e693a4906122d19b8
- Worktree Commit: 0660e582bb7606e145161d88c2566c4451412dff
- Integration Status: integrated

## Done When

- [x] Template scaffold includes directories or placeholder files for `runners/state`, `runners/logs`, `wiki`, `metrics`, `conversations`, `agents/adapters`, and `rules/wiki`.
- [x] Each new scaffold area has a short README or placeholder explaining what belongs there.
- [x] Adapter docs include at least shell, Codex CLI, Claude CLI, OpenCode, and Gemini CLI placeholders.
- [x] Wiki docs explain that board files are the ledger and wiki files are derived knowledge.
- [x] No planner/todo/verifier lifecycle scripts are changed by this ticket.

## Next Action
- Complete. No further action for this ticket.

## Resume Context
- Current state: verifier passed and the worktree commit was integrated into `PROJECT_ROOT`.
- Last runtime action: `integrate-worktree.sh tickets/verifier/tickets_001.md` integrated worktree commit `0660e582bb7606e145161d88c2566c4451412dff`.
- Next reader: use the linked verification record and completion log for evidence.

## Notes

- Keep this ticket limited to generated board file content. CLI init/upgrade behavior is handled by later tickets.

- Claimed by todo-1 at 2026-04-24T22:42:50Z; execution=unassigned; verifier=unassigned; worktree=/Users/demoon/Documents/project/autoflow
- Worktree corrected to `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_001_local` on branch `codex/autoflow-tickets-001` after fixed branch name was already used by another worktree.
- Added adapter docs under `agents/adapters/` for shell, Codex CLI, Claude Code, OpenCode, and Gemini CLI.
- Added wiki rules under `rules/wiki/`.
- Added board template scaffold under `templates/board/runners`, `templates/board/wiki`, `templates/board/metrics`, and `templates/board/conversations`.
- Added `reference/runner-harness.md` and `reference/wiki.md`.
- Updated template/reference/rules README files to mention runner and wiki scaffold.
- Verification run from worktree: `git diff --check` passed.
- Handed off to verifier at 2026-04-24T22:45:02Z via scripts/handoff-todo.*
- Verifier prepared by verify-1 via scripts/start-verifier.sh at 2026-04-24T22:45:18Z
- Worktree integration blocked at 2026-04-24T22:45:57Z: PROJECT_ROOT has non-board dirty files. Commit/stash unrelated changes before integrating this ticket.
- Verifier evidence: spec exists, allowed paths are respected, `git diff --check` passed in the ticket worktree, and implementation files are present. Pass is blocked only by central dirty-root protection.
- 2026-04-24T23:12:41Z: Re-ran verifier after local checkpoint isolated the dirty project root; integration succeeded and `git diff --check` passed in `PROJECT_ROOT`.
- Integrated worktree commit 0660e582bb7606e145161d88c2566c4451412dff into PROJECT_ROOT without committing at 2026-04-24T23:12:12Z; verifier should now include board + code changes in one local commit.
## Verification
- Run file: `tickets/done/project_001/verify_001.md`
- Log file: `logs/verifier_001_20260424_231257Z_pass.md`
- Result: passed

## Result

- Summary: Added Phase 1 runner/wiki scaffold template and adapter documentation in the ticket worktree.
- Remaining risk: Ticket 002 still needs to wire these files into fresh board init/package copying.
