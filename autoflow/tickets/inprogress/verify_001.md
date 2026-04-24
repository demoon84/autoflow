# Verification Template

## Meta

- Project Key: project_001
- Ticket ID: 001
- Target: tickets_001.md
- Status: blocked
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_001_local

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_001]]
- Verification Note: [[verify_001]]

## Checks

- [x] spec reference confirmed
- [x] allowed paths respected
- [x] implementation completed
- [ ] manual or automated verification passed

## Findings

- blocker: Worktree implementation satisfies the ticket checks, but pass integration is blocked because `PROJECT_ROOT` has dirty files outside `autoflow/`.
- warning: `integrate-worktree.sh` refused to cherry-pick this ticket so unrelated work is not mixed into the final commit.

## Next Fix Hint

- Commit, stash, or otherwise isolate the existing non-board dirty files in `PROJECT_ROOT`, then rerun verifier for `tickets_001`.

## Evidence

- Spec reference exists: `tickets/done/project_001/project_001.md`.
- Worktree root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_001_local`.
- `git diff --check` passed in the ticket worktree.
- `git status --short` in the ticket worktree shows changes only under `templates/board/`, `agents/`, `reference/`, and `rules/`.
- `integrate-worktree.sh tickets/verifier/tickets_001.md` returned `blocked_dirty_project_root`.

## Notes

- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 으로 적는다.
