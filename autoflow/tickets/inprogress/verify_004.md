# Verification Template

## Meta

- Project Key: project_001
- Ticket ID: 004
- Target: tickets_004.md
- Status: blocked
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_004_local

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_004]]
- Verification Note: [[verify_004]]

## Checks

- [x] spec reference confirmed
- [x] allowed paths respected
- [x] implementation completed
- [ ] manual or automated verification passed

## Findings

- blocker: Worktree implementation satisfies the ticket checks, but pass integration is blocked because `PROJECT_ROOT` has dirty files outside `autoflow/`.
- warning: PowerShell command execution was unavailable locally, so `.ps1` parity was checked by mirrored edits rather than by running PowerShell.

## Next Fix Hint

- Commit, stash, or otherwise isolate the existing non-board dirty files in `PROJECT_ROOT`, then rerun verifier for `tickets_004`.

## Evidence

- Worktree root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_004_local`.
- `git diff --check` passed in the ticket worktree.
- `bash -n scripts/cli/status-project.sh scripts/cli/doctor-project.sh` passed.
- Smoke without scaffold: status reported both scaffold keys as `false`; doctor reported warning checks and `status=ok`.
- Smoke with synthetic scaffold: status reported both scaffold keys as `true`; doctor reported both checks `ok` and `warning_count=0`.
- Worktree changed only allowed paths: `scripts/cli/doctor-project.sh`, `scripts/cli/doctor-project.ps1`, `scripts/cli/status-project.sh`, and `scripts/cli/status-project.ps1`.
- `integrate-worktree.sh tickets/verifier/tickets_004.md` returned `blocked_dirty_project_root`.

## Notes

- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 으로 적는다.
