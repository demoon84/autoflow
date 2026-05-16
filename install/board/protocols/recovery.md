# Recovery Protocol

## Purpose

Recovery is AI-led. The planner runner diagnoses board and runner failure modes, then repairs markdown state or gives the worker runner a precise resume instruction. Shell helpers provide atomic checks and git/worktree safety only, and their stable inventory is exposed via `autoflow tool list`.

## Recovery State Section

Tickets may contain:

```md
## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Worker Resume Instruction:
- Last Recovery At:
```

`Status` values:

- `healthy`
- `stalled`
- `blocked`
- `repairing`
- `requeued`
- `resolved`
- `needs_user`

## Failure Classes

Use one of these when possible:

- `adapter_no_progress`
- `stale_todo_worktree`
- `missing_worktree`
- `dirty_root`
- `dirty_root_cleared`
- `dirty_project_root_conflict`
- `allowed_path_conflict`
- `shared_head_conflict`
- `verification_failed`
- `merge_conflict`
- `ambiguous_scope`
- `oversized_ticket`
- `tooling_failure`
- `retry_limit`
- `needs_user_decision`
- `leftover_worktree`
- `vague_completion_promise`
- `iteration_no_progress`

## Planner Recovery Actions

The planner runner may:

- mark a ticket `blocked` in `Recovery State` while leaving its board folder unchanged,
- clarify `Next Action` for the next worker tick,
- narrow `Allowed Paths`,
- refine `Done When` and `Verification`,
- split one broad ticket into smaller todo tickets,
- requeue a recoverable ticket with a fresh attempt note,
- archive consumed retry/recovery records under `tickets/done/<project-key>/`,
- request user input only when the board cannot make a safe decision.

The planner runner must not delete evidence of failure. Keep the old reason in `Recovery State`, `Retry History`, or `Notes`.

When the planner runner sets `Status: needs_user` on a `Stage: blocked` ticket, the ticket is parked rather than abandoned. The evidence stays in `tickets/inprogress/`, explicit runs for that ticket still surface the blocker, and worker runtime may claim the next `tickets/todo/` item so the queue does not stall on a human/integration-boundary decision. Planner loop runners also treat `needs_user` + `needs_user_decision` as an idle waiting state and must not wake the adapter repeatedly until a human or later recovery edit changes the ticket state.

## Runtime-Signaled Failures

Shell helpers may stop a tick to protect product files or git state. Treat these helper signals as evidence for AI recovery, not as final workflow decisions.

| Runtime signal | Recovery class | Meaning | Next AI action |
| --- | --- | --- | --- |
| `blocked_worktree_setup_failed` | `tooling_failure` | The worker could not create or attach the ticket worktree. | Inspect `Evidence`, fix configuration such as `AUTOFLOW_WORKTREE_ROOT`, or leave a precise worker resume instruction. Do not continue in `PROJECT_ROOT` silently. |
| `blocked_recovery_missing_worktree` | `missing_worktree` | The ticket claimed a ready worktree, but the path is gone or is not a git worktree. | Recreate the worktree or direct worker to rerun after worktree repair; preserve the missing path in `Evidence`. |
| `blocked_stale_todo_worktree` | `stale_todo_worktree` | A todo ticket still has worktree metadata or unmerged state from an earlier attempt. | Decide whether to requeue, archive, or instruct worker to salvage changes. Do not discard unmerged work without explicit evidence. |
| `blocked_dirty_scope_conflict` | `dirty_root` | Product root has dirty changes overlapping the ticket scope. | Record the dirty-root evidence in `Recovery State`, decide whether the worker can safely resolve within `Allowed Paths`, or park as `needs_user` when the boundary is ambiguous. The planner runner must not stage, stash, commit, or clean PROJECT_ROOT. |
| `shared_allowed_path_conflict` | `allowed_path_conflict` | Another active ticket owns overlapping fallback paths. | Wait or split/reorder tickets so only one worker touches those paths. |
| `shared_nonbase_head_conflict` | `shared_head_conflict` | Multiple active tickets point at the same non-base worktree commit. | Restore isolated worktree snapshots before allowing verification or finish. |
| `vague-done-when` | `vague_completion_promise` | The PRD's `## Done When` or `## Global Acceptance Criteria` failed `autoflow tool lint-ticket` (criteria_count<3, vague-term matches, or zero concrete signals such as commands/paths/exit codes). The runtime emits `lint_status`, `lint_vagueness_score`, and `lint_vague_terms` so spec-author-agent can rework the section. | Hand the PRD back to spec-author-agent with the lint output. Add concrete signals (commands, file extensions, `exit 0`, numeric metrics) and remove non-measurable phrases (`잘 동작`, `정상 작동`, `올바르게`, `properly`, `works correctly`). Override the gate only after review with `AUTOFLOW_LINT_TICKET=off`. |
| `iteration-no-progress` | `iteration_no_progress` | A retry order carries the same Failure Class / Replan Reason as the most recent retry for the same PRD key, so consuming another retry slot would burn budget without progress. | Park the retry as `Recovery State.Status: needs_user`. The planner runner must address the root cause (narrow Allowed Paths, replace verification command, split the dependent PRD, or escalate the architectural blocker) before another retry. Override the gate only after review with `AUTOFLOW_ITERATION_FINGERPRINT=off`. |

## Planner-Derived Wake Signals

Planner runner preflight may also wake the adapter when normal prd/retry input is idle but ticket metadata shows recovery work:

| Wake reason | Recovery status | Recovery class | Meaning | Auto-recovery policy |
| --- | --- | --- | --- | --- |
| `stale_todo_worktree_metadata` | `blocked` | `stale_todo_worktree` | A `tickets/todo/` file still has worktree metadata or non-pending integration status, so planner should decide whether to salvage, requeue, or cleanly reissue the work. | No automatic cleanup. Leave evidence for planner/worker recovery. |
| `goal_runtime_no_progress` | `stalled` | `adapter_no_progress` | The worker adapter exited without durable ticket progress and continuation was suppressed. | No automatic cleanup. Planner should inspect ticket state first. |
| `resolved_ticket_worktree_leftover` | `needs_user` | `leftover_worktree` | A replanned or done ticket still has a clean ticket worktree. | If `AUTOFLOW_RECOVERY_AUTO` is not `off`, runtime/planner may discard the clean leftover worktree automatically. Otherwise, record the cleanup candidate and wait for explicit decision. |
| `resolved_ticket_worktree_dirty` | `needs_user` | `leftover_worktree` | A replanned or done ticket still has a dirty ticket worktree. | If `AUTOFLOW_RECOVERY_AUTO` is not `off` and the dirty state is agent-only (no post-base commits, no staged changes, no branch divergence, and every dirty path stays inside `Allowed Paths`), save a diff backup to `.autoflow/runners/state/recovery-discarded/<ticket>-<timestamp>.diff` and discard the worktree automatically. Otherwise, preserve the dirty path as evidence and request user decision. |

## Auto-Recovery Policies

When `AUTOFLOW_RECOVERY_AUTO` is not `off` (default `on`), the following policies apply:

1. **Agent-only dirty worktree auto-discard**: Leftover worktrees from `done` or replanned tickets that contain only agent-generated changes (based on `Allowed Paths`, commit history, and staged status) are automatically backed up as a diff and discarded. This prevents `needs_user` stalls for clean-up tasks that the AI can safely handle.
2. **Same-scope allowed path conflict auto-expansion**: If a ticket is replanned because of an unmet `Allowed Path` (i.e., the AI modified a file outside its current scope), and that unmet path is in the same scope as current `Allowed Paths` (same parent directory or sibling relationship, e.g., `install/board/reference/*` vs `install/board/*`), the planner automatically expands `Allowed Paths` in the retry ticket.
3. **Blocked-dirty orchestration removed (refactor 2026-05-07)**: single live worker + `.gitignore` separation means autoflow does not generate dirty PROJECT_ROOT itself, so the planner no longer auto-integrates dirty paths. If the user edits PROJECT_ROOT externally and a worker conflict cannot be resolved in scope, the worker records blocker evidence and uses the verifier/planner replan path instead of silently merging. `git push` remains forbidden in every mode.

## Worker Recovery Actions

The worker runner may:

- repair its own implementation after failed verification,
- resolve merge conflicts inside `Allowed Paths`,
- rerun verification,
- update `Recovery State` to `healthy` after the blocker is resolved,
- request replan with concrete evidence when planner re-orchestration is needed.

The worker runner must not silently requeue its own ticket or create broad replacement work without planner direction.

## Escalation

Escalate to `needs_user` only when:

- requirements conflict,
- multiple destructive interpretations are possible,
- recovery would require deleting unmerged product changes,
- retry limits are exhausted,
- the requested action is outside `Allowed Paths` or Autoflow's no-push policy.

## Evidence Requirements

Every recovery decision should name:

- the ticket id,
- current board folder,
- relevant runner id if known,
- command or log evidence,
- selected next action,
- reason safer alternatives were not chosen.
