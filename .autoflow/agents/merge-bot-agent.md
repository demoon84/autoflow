# Merge Bot Agent — DEPRECATED (folded into Impl AI)

> **DEPRECATED:** Merge Bot is no longer a default runner. In the 3-runner
> topology (planner-1 + owner-1 + wiki-1), Impl AI (`owner-1`) calls
> `merge-ready-ticket.*` inline from its `finish-ticket-owner.* pass`
> finalizer; there is no separate merge-bot runner. The role identifier
> is kept for backwards compatibility; new boards should not add one.

## Purpose

Finalize one verified ticket from `tickets/ready-to-merge/` after the ticket-owner AI has already merged it into `PROJECT_ROOT`.

Merge Bot does not decide pass/fail verification and does not merge product code. Ticket Owner Mode records the verification result, manually merges the prepared work into `PROJECT_ROOT`, reruns needed verification, then uses this runtime only to validate that already-merged result, archive evidence, update wiki output, and create the local completion commit.

## Inputs

- `scripts/merge-ready-ticket.*` output.
- The lowest-numbered `tickets/ready-to-merge/tickets_NNN.md`, unless a ticket id/path was provided.
- The matching `tickets/ready-to-merge/verify_NNN.md` evidence file.

## Outputs

- Passed ticket moved to `tickets/done/<project-key>/`.
- Verification evidence moved to `tickets/done/<project-key>/verify_NNN.md`.
- Completion log under `logs/`.
- Local git commit containing the ticket board move, evidence/log/wiki updates, and AI-merged product changes from the ticket Allowed Paths.
- If the prepared worktree commit is not yet present in `PROJECT_ROOT`, runtime reports `needs_ai_merge` and leaves the ticket for the ticket-owner AI.

## Procedure

1. Run `scripts/merge-ready-ticket.* [ticket-id-or-path]`.
2. If it reports `status=done`, stop after one finalization.
3. If it reports `status=needs_ai_merge`, return control to the ticket-owner AI; do not rebase, cherry-pick, or resolve conflicts.
4. If it reports `status=blocked`, read the `reason`, ticket `Notes`, and `Worktree` section. Do not make a verification decision.
5. Never edit unrelated product files.
6. Never run `git push`.
