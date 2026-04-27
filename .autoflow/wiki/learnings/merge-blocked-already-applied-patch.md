# Merge Blocked by an Already-Applied Patch

## Context
`tickets_023` passed verification and produced worktree commit `64d346d7f6e5f132f3e97cd104434da3c673f9ab`, but inline merge repeatedly stopped with `dirty_scope_conflict` on `apps/desktop/src/renderer/styles.css`.

The ticket patch removed AI workflow card left-border color accents and workflow pin left-border tint. During later UI work, the same patch was already applied directly in `PROJECT_ROOT`, while unrelated dirty edits remained in the same `styles.css` file.

## Symptom
- Ticket stayed in the in-progress board instead of reaching `tickets/done/prd_023/tickets_023.md`.
- `Stage` moved through `ready_to_merge`, `merge_blocked`, and `blocked`.
- Runner output repeated:
  - `reason=dirty_scope_conflict`
  - `conflicting_path=apps/desktop/src/renderer/styles.css`
  - `source=auto_resumed_finish_pass`
- The owner loop kept retrying `finish-ticket-owner pass` because verification had already passed, even after merge escalation.

## Root Cause
The merge runtime compared the whole dirty file against the ticket worktree. Since `PROJECT_ROOT` had unrelated edits in the same file, `project_root_path_matches_worktree` returned false and the runtime treated the file as a conflict.

That missed the important case: the ticket commit's actual patch was already present in `PROJECT_ROOT`, even though the full file was not identical to the worktree file.

## Diagnosis
Use a reverse apply check to determine whether the worktree commit patch is already present in `PROJECT_ROOT`:

```bash
git diff <worktree_commit>^ <worktree_commit> -- <allowed_path> |
  git apply --check --reverse -
```

For `tickets_023`, this returned success:

```bash
git diff 64d346d7f6e5f132f3e97cd104434da3c673f9ab^ \
  64d346d7f6e5f132f3e97cd104434da3c673f9ab \
  -- apps/desktop/src/renderer/styles.css |
  git apply --check --reverse -
```

Success means the patch is already present. The remaining dirty file content belongs to other work, not this ticket.

## Resolution Pattern
When the patch is already present:

1. Stage only the ticket patch if it should be included in the completion commit:

```bash
git diff <worktree_commit>^ <worktree_commit> -- <allowed_path> |
  git apply --cached -
```

2. Run merge completion for the ticket:

```bash
AUTOFLOW_ROLE=merge \
AUTOFLOW_WORKER_ID=owner-1 \
AUTOFLOW_BOARD_ROOT="$PWD/.autoflow" \
AUTOFLOW_PROJECT_ROOT="$PWD" \
  .autoflow/scripts/merge-ready-ticket.sh 023
```

3. Confirm expected output:
   - `status=done`
   - `status=already_in_project_root`
   - `already_applied_path=<allowed_path>`
   - `commit_status=committed`

4. Confirm cleanup:

```bash
git branch --list 'autoflow/tickets_023'
git worktree list --porcelain | rg 'autoflow/tickets_023'
test ! -f .autoflow/tickets/inprogress/tickets_023.md
test -f .autoflow/tickets/done/prd_023/tickets_023.md
```

## Runtime Improvement
`merge-ready-ticket.sh` now checks dirty commit paths with patch-level detection:

- If a dirty `PROJECT_ROOT` path differs from the worktree file but the ticket commit patch is already present, the path is not treated as a conflict.
- If all commit paths are already applied, the integration status becomes `already_in_project_root`, cherry-pick is skipped, and normal done/archive/cleanup continues.

`recover_passed_inprogress_ticket` now pauses on merge blockers instead of repeatedly invoking finish-pass after a persistent merge conflict.

## Source
- `tickets/done/prd_023/tickets_023.md`
- `tickets/done/prd_023/verify_023.md`
- `logs/verifier_023_20260427_150558Z_pass.md`
- Completion commit: `7f23bc9`
