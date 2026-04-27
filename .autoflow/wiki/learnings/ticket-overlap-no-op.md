# Ticket Overlap and No-op Worktrees

## Context
When multiple tickets claim the same set of "Allowed Paths," the Autoflow runner may enter a state where a worktree contains no isolated diff from the base commit, while the `PROJECT_ROOT` remains "dirty" with unrelated edits in those same paths.

## Observation
In the case of `tickets_003` (`prd_003`), the runner attempted 10 retries. Each time:
1. The automated verification passed (because the code in the worktree matched the base commit which was already passing).
2. The worktree integration was blocked because the `PROJECT_ROOT` had uncommitted, divergent edits on the same files (`apps/desktop/src/renderer/main.tsx`).
3. The AI was unable to differentiate between "passing verification because of the ticket's change" and "passing verification because the change is already in base but not in this worktree."

## Learning
- **Isolation is Key**: If a ticket worktree has a zero diff for its allowed paths while verification passes, it indicates the ticket might be a duplicate or its scope is already satisfied by other means.
- **Overlapping Ownership**: When `PROJECT_ROOT` is dirty with changes from lower-number tickets that haven't been integrated yet, higher-number tickets targeting the same paths will be consistently blocked or fail to produce a clean patch.
- **Manual Resolution**: In scenarios where retry limits are reached due to such overlaps, manual intervention to merge the divergent state or re-ticket the remaining scope is often more efficient than automated retries.

## Source
- `tickets/done/prd_003/reject_003.md` (2026-04-26).
