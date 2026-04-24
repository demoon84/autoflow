# Verification Template

## Meta

- Project Key: project_001
- Ticket ID: 005
- Target: tickets_005.md
- Status: blocked
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005_local

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_005]]
- Verification Note: [[verify_005]]

## Checks

- [x] spec reference confirmed
- [x] allowed paths respected
- [x] implementation completed
- [ ] manual or automated verification passed

## Findings

- blocker: Worktree documentation satisfies the ticket checks, but pass integration is blocked because `PROJECT_ROOT` has dirty files outside `autoflow/`.
- warning: This ticket only documents `#autoflow` as a planned spec handoff alias; runtime alias and local runner execution remain future work.

## Next Fix Hint

- Commit, stash, or otherwise isolate the existing non-board dirty files in `PROJECT_ROOT`, then rerun verifier for `tickets_005`.

## Evidence

- Worktree root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005_local`.
- `git diff --check` passed in the ticket worktree.
- Grep confirmed `#autoflow`, board ledger, wiki map, runner future-phase wording across README, generated board README, host AGENTS, spec-author agent, and reference README.
- Worktree changed only allowed paths: `README.md`, `agents/spec-author-agent.md`, `reference/README.md`, `templates/board/README.md`, and `templates/host-AGENTS.md`.
- `integrate-worktree.sh tickets/verifier/tickets_005.md` returned `blocked_dirty_project_root`.

## Notes

- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 으로 적는다.
