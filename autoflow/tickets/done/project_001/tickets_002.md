# Ticket

## Ticket

- ID: tickets_002
- Project Key: project_001
- Plan Candidate: Update init/package-board logic so fresh boards include the new runner/wiki scaffold without overwriting existing state.
- Title: Include runner and wiki scaffold in fresh board init
- Stage: done
- Owner: verify-1
- Claimed By: todo-1
- Execution Owner: unassigned
- Verifier Owner: verify-1
- Last Updated: 2026-04-24T23:14:20Z

## Goal

- 이번 작업의 목표: `autoflow init` creates fresh boards with the new runner/wiki harness scaffold while preserving the existing no-overwrite behavior for generated state.

## References

- Project Spec: tickets/done/project_001/project_001.md
- Feature Spec:
- Plan Source: tickets/inprogress/plan_001.md

## Obsidian Links

- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_002]]

## Allowed Paths

- scripts/cli/scaffold-project.sh
- scripts/cli/scaffold-project.ps1
- scripts/cli/package-board-common.sh
- scripts/cli/package-board-common.ps1
- templates/board/
- README.md

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_002_local`
- Branch: codex/autoflow-tickets-002
- Base Commit: 30f9b3a872bbadf4c3047b1e693a4906122d19b8
- Worktree Commit: 35e61b7738f22e1bd4bd67366168ba8504d734c2
- Integration Status: integrated

## Done When

- [x] `./bin/autoflow init <project>` creates the new runner/wiki scaffold for a fresh smoke project.
- [x] Existing board state files are not overwritten by init.
- [x] Bash and PowerShell scaffold/package paths remain aligned.
- [x] Init output remains machine-readable and compatible with current desktop/status usage.
- [x] The change can be verified without running any real coding-agent CLI.

## Next Action
- Complete. No further action for this ticket.

## Resume Context
- Current state: verifier passed after resolving scaffold template overlap with tickets_001.
- Last runtime action: `integrate-worktree.sh tickets/verifier/tickets_002.md` produced worktree commit `35e61b7738f22e1bd4bd67366168ba8504d734c2`; cherry-pick conflicts were resolved in `PROJECT_ROOT`.
- Next reader: use the linked verification record and completion log for evidence.

## Notes

- If template files are not present yet, coordinate with `tickets_001` rather than inventing a conflicting structure.

- Claimed by todo-1 at 2026-04-24T22:48:44Z; execution=unassigned; verifier=unassigned; worktree=/Users/demoon/Documents/project/autoflow
- Worktree corrected to `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_002_local` on branch `codex/autoflow-tickets-002` after fixed branch name was already used by another worktree.
- Added runner/wiki/metrics/conversations/adapters/wiki-rule template files under `templates/board/`.
- Updated `scripts/cli/package-board-common.sh` and `.ps1` so fresh init copies the new scaffold assets and creates the new directories.
- Updated README and generated board README to mention the fresh scaffold.
- Verification run from worktree: `git diff --check` passed.
- Verification run from worktree: `bash -n scripts/cli/package-board-common.sh scripts/cli/scaffold-project.sh` passed.
- Smoke init created the new scaffold under `/tmp/autoflow-init-smoke.em8sMS/autoflow`.
- Re-running init on that smoke project returned `status=already_initialized`.
- PowerShell runtime is not installed in this environment, so `.ps1` behavior was aligned by editing the mirrored entry lists but not executed.
- Handed off to verifier at 2026-04-24T22:51:56Z via scripts/handoff-todo.*
- Verifier prepared by verify-1 via scripts/start-verifier.sh at 2026-04-24T22:52:01Z
- Worktree integration blocked at 2026-04-24T22:52:17Z: PROJECT_ROOT has non-board dirty files. Commit/stash unrelated changes before integrating this ticket.
- Verifier evidence: `git diff --check` passed; shell syntax check passed; fresh init smoke created the new scaffold; re-running init returned `status=already_initialized`; changed files are within allowed paths. Pass is blocked only by central dirty-root protection.
- Worktree integration hit a cherry-pick conflict at 2026-04-24T23:13:08Z: 35e61b7738f22e1bd4bd67366168ba8504d734c2. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying.
- 2026-04-24T23:14:20Z: Resolved scaffold template overlap from tickets_001, reran shell syntax and fresh init smoke, confirmed idempotent init, and marked integration as passed.
- Worktree integration hit a cherry-pick conflict at 2026-04-24T23:13:08Z: 35e61b7738f22e1bd4bd67366168ba8504d734c2. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying.
## Verification
- Run file: `tickets/done/project_001/verify_002.md`
- Log file: `logs/verifier_002_20260424_231442Z_pass.md`
- Result: passed

## Result

- Summary: Fresh init now includes runner, wiki, metrics, conversations, adapter, and wiki-rule scaffold files through package-board common asset and directory lists.
- Remaining risk: PowerShell path was not executed locally because `pwsh`/`powershell` is unavailable in this environment.
