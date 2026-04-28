# Learning: Manual Recovery and Worktree Consolidation (2026-04-27)

## Context
On April 27, 2026, the Autoflow board reached a state where several high-priority UI tickets were stuck in the `verifying` or `merging` stages. While the AI agents had successfully implemented and verified the changes in isolated worktrees, integration into the `PROJECT_ROOT` was blocked by "dirty scope conflicts"—unrelated changes or artifacts present in the main project directory that overlapped with the files modified by the tickets.

## The Problem: Integration Gridlock
Multiple runners were attempting to merge changes into the same set of files (`apps/desktop/src/renderer/main.tsx` and `styles.css`):
- `tickets_021`: Workflow UI overhaul and progress wrapping.
- `tickets_025`: AI progress stage audit and dot alignment.
- `tickets_016`: 3-runner layout optimization.
- `tickets_012`: Stale runner ID rename (superseded).

The automated `finish-ticket-owner` script safely aborted merges when it detected dirty files in the project root to prevent accidental inclusion of untracked or unrelated edits.

## Resolution: Manual Worktree Consolidation
A manual consolidation pass was performed (logged in `logs/manual_worktree_merge_20260427_160756Z.md`) to resolve the gridlock:

1. **Strategic Selection**: Identified which worktrees contained the most complete and up-to-date versions of the code.
2. **Cherry-picking & Patching**: Manually applied the verified patches from the worktrees to the project root.
3. **Conflict Resolution**: Handled overlapping changes between `prd_021` (UI Overhaul) and `prd_025` (Stage Audit) to ensure both features coexisted correctly.
4. **Superseding Stale Work**: Decided to preserve the current agent topology (`planner-1`, `owner-1`, `wiki-1`) and skip the `tickets_012` rename, as it conflicted with the active configuration in `AGENTS.md`.
5. **Root Verification**: Ran comprehensive build and syntax checks (`tsc`, `npm run check`) directly in the project root after the manual merge.

## Key Learnings

### 1. The "Already Applied" State
When a manual merge or a prior partial merge has already placed the ticket's changes in the root, subsequent `finish` attempts might fail or report conflicts. The agent must recognize when its goal is already achieved in the target branch.

### 2. Guarding Allowed Paths
The `dirty_scope_conflict` is a critical safety feature. It prevents the AI from "vacuuming" unrelated human or system edits into a ticket's final commit.

### 3. Workflow Card Cohesion
UI features like "Progress Wrap" (`prd_021`) and "Dot Alignment" (`prd_025`) are interdependent. When modifying shared layout components, it is more efficient to merge them sequentially or combine them into a single recovery pass than to let multiple runners fight over the same file.

## Citations
- `logs/manual_worktree_merge_20260427_160756Z.md`
- `tickets/done/prd_021/tickets_021.md`
- `tickets/done/prd_025/tickets_025.md`
- `tickets/done/prd_012/tickets_012.md`
- [[features/ai-workflow-board]]
