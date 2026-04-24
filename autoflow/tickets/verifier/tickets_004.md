# Ticket

## Ticket

- ID: tickets_004
- Project Key: project_001
- Plan Candidate: Update doctor/status checks to report runner/wiki scaffold health in machine-readable output.
- Title: Report runner and wiki scaffold health
- Stage: blocked
- Owner: verify-1
- Claimed By: todo-1
- Execution Owner: unassigned
- Verifier Owner: verify-1
- Last Updated: 2026-04-25T07:57:00+09:00

## Goal

- 이번 작업의 목표: `autoflow doctor` and any relevant status output make missing runner/wiki harness scaffold visible without changing queue lifecycle behavior.

## References

- Project Spec: tickets/done/project_001/project_001.md
- Feature Spec:
- Plan Source: tickets/inprogress/plan_001.md

## Obsidian Links

- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_004]]

## Allowed Paths

- scripts/cli/doctor-project.sh
- scripts/cli/doctor-project.ps1
- scripts/cli/status-project.sh
- scripts/cli/status-project.ps1
- README.md

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_004_local`
- Branch: codex/autoflow-tickets-004
- Base Commit: 30f9b3a872bbadf4c3047b1e693a4906122d19b8
- Worktree Commit:
- Integration Status: blocked_dirty_project_root

## Done When

- [x] Doctor reports runner scaffold presence or absence with stable key=value output.
- [x] Doctor reports wiki scaffold presence or absence with stable key=value output.
- [x] Status output is updated only if it is the right place for lightweight counts or presence values.
- [x] Missing scaffold produces an actionable diagnostic but does not break existing initialized boards.
- [x] Bash and PowerShell output keys remain aligned.

## Next Action
- Next: clear or isolate existing non-board dirty files in `PROJECT_ROOT`, then rerun verifier so the worktree can be integrated without mixing unrelated changes.

## Resume Context
- Current state: implementation checks passed, but verifier pass integration is blocked by existing non-board dirty files in `PROJECT_ROOT`.
- Last runtime action: `integrate-worktree.sh tickets/verifier/tickets_004.md` refused to integrate because the central project root is dirty outside `autoflow/`.
- Next reader: verifier should retry after the central dirty files are committed, stashed, or otherwise isolated.

## Notes

- Keep output machine-readable because the desktop app consumes key=value status snapshots.

- Claimed by todo-1 at 2026-04-24T22:54:23Z; execution=unassigned; verifier=unassigned; worktree=/Users/demoon/Documents/project/autoflow
- Worktree corrected to `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_004_local` on branch `codex/autoflow-tickets-004` after fixed branch name was already used by another worktree.
- Added lightweight `runner_scaffold_present` and `wiki_scaffold_present` status keys.
- Added doctor `check.runner_scaffold` and `check.wiki_scaffold`; missing scaffold is warning-only and keeps `status=ok` when there are no errors.
- Verification run from worktree: `git diff --check` passed.
- Verification run from worktree: `bash -n scripts/cli/status-project.sh scripts/cli/doctor-project.sh` passed.
- Smoke without scaffold: status reported both scaffold keys as `false`; doctor reported warning checks and `status=ok`.
- Smoke with synthetic scaffold: status reported both scaffold keys as `true`; doctor reported both checks `ok` and `warning_count=0`.
- PowerShell runtime is not installed in this environment, so `.ps1` behavior was aligned by mirrored edits but not executed.
- Handed off to verifier at 2026-04-24T22:56:04Z via scripts/handoff-todo.*
- Verifier prepared by verify-1 via scripts/start-verifier.sh at 2026-04-24T22:56:08Z
- Worktree integration blocked at 2026-04-24T22:56:18Z: PROJECT_ROOT has non-board dirty files. Commit/stash unrelated changes before integrating this ticket.
- Verifier evidence: `git diff --check` passed; shell syntax check passed; smoke checks cover scaffold absent and present states; changed files are within allowed paths. Pass is blocked only by central dirty-root protection.
## Verification
- Run file: `tickets/inprogress/verify_004.md`
- Log file: pending
- Result: blocked_dirty_project_root

## Result

- Summary: Doctor and status now expose runner/wiki scaffold health with stable machine-readable keys.
- Remaining risk: PowerShell path was not executed locally because `pwsh`/`powershell` is unavailable in this environment. Ticket 004 cannot be integrated until central non-board dirty files are isolated.
