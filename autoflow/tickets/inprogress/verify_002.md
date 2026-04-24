# Verification Template

## Meta

- Project Key: project_001
- Ticket ID: 002
- Target: tickets_002.md
- Status: blocked
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_002_local

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_002]]
- Verification Note: [[verify_002]]

## Checks

- [x] spec reference confirmed
- [x] allowed paths respected
- [x] implementation completed
- [ ] manual or automated verification passed

## Findings

- blocker: Worktree implementation satisfies the ticket checks, but pass integration is blocked because `PROJECT_ROOT` has dirty files outside `autoflow/`.
- warning: PowerShell command execution was unavailable locally, so `.ps1` parity was checked by mirrored edits rather than by running PowerShell.

## Next Fix Hint

- Commit, stash, or otherwise isolate the existing non-board dirty files in `PROJECT_ROOT`, then rerun verifier for `tickets_002`.

## Evidence

- Worktree root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_002_local`.
- `git diff --check` passed in the ticket worktree.
- `bash -n scripts/cli/package-board-common.sh scripts/cli/scaffold-project.sh` passed.
- Smoke init created 25 new scaffold files under `/tmp/autoflow-init-smoke.em8sMS/autoflow`.
- Re-running init on the smoke project returned `status=already_initialized`.
- Worktree changed only allowed paths: `scripts/cli/package-board-common.sh`, `scripts/cli/package-board-common.ps1`, `templates/board/`, and `README.md`.
- `integrate-worktree.sh tickets/verifier/tickets_002.md` returned `blocked_dirty_project_root`.

## Notes

- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 으로 적는다.
