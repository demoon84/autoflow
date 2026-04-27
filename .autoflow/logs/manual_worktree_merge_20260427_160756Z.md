# Manual Worktree Merge Log

## Meta

- Timestamp: 2026-04-27T16:07:56Z
- Actor: Codex
- Target Branch: main
- Worktrees considered: autoflow/tickets_012, autoflow/tickets_016, autoflow/tickets_021, autoflow/tickets_025_rebased

## Merge Decisions

- tickets_016: merged the 3-runner workflow board layout into current `main`.
- tickets_021: merged the remaining workflow-card restart control and progress wrapping behavior into current `main`; most ticket behavior was already present.
- tickets_025_rebased: no additional change applied because ticket 025 is already represented by completed `main` commit `239eb4d`.
- tickets_012: preserved current `planner-1` / `owner-1` / `wiki-1` topology because the stale dirty worktree rename conflicts with current AGENTS and live config.

## Verification

- `cd apps/desktop && npx tsc --noEmit`: exit 0.
- `npm --prefix apps/desktop run check`: exit 0.
- `git diff --check`: exit 0.

## Result

- Status: passed
- Summary: Remaining worktree changes were resolved into `main` without reverting later ticket 025/026 work.
