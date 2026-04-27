# Manual Resolution Policy

## Decision
When an Autoflow ticket reaches its maximum retry count (default 10) due to environment blockers or persistent integration conflicts, the scope may be resolved manually in the `PROJECT_ROOT` to unblock the board.

## Rationale
- **Avoid Infinite Loops**: Prevent runners from wasting tokens and time on unsolvable environment-specific issues.
- **Unblock Board**: Allow the project to proceed to subsequent PRDs that might depend on the blocked scope.
- **Traceability**: Manual resolutions must be documented in the ticket's `Result` and `Note` sections, and the ticket should be moved to `done` with a record of the manual steps taken.

## Context
- Established after `tickets_003` (`prd_003`) reached 10 retries due to worktree/root overlap and was resolved manually by implementing the Wiki preview flow directly.

## Source
- `tickets/done/prd_003/reject_003.md` (2026-04-26).
