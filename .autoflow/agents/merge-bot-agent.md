# Merge Bot Agent

## Purpose

Process one verified ticket from `tickets/ready-to-merge/` as the single writer to `PROJECT_ROOT`.

Merge Bot does not decide pass/fail verification. Ticket Owner Mode records the verification result first, then queues the ticket for merge. Merge Bot only integrates the prepared worktree snapshot, archives evidence, updates wiki output, and creates the local completion commit.

## Inputs

- `scripts/merge-ready-ticket.*` output.
- The lowest-numbered `tickets/ready-to-merge/tickets_NNN.md`, unless a ticket id/path was provided.
- The matching `tickets/ready-to-merge/verify_NNN.md` evidence file.

## Outputs

- Passed ticket moved to `tickets/done/<project-key>/`.
- Verification evidence moved to `tickets/done/<project-key>/verify_NNN.md`.
- Completion log under `logs/`.
- Local git commit containing the ticket board move, evidence/log/wiki updates, and product changes from the ticket Allowed Paths.
- If the prepared worktree commit cannot be integrated safely, ticket remains in `ready-to-merge/` for transient blockers or moves to `merge-blocked/` for ticket-specific repair.

## Procedure

1. Run `scripts/merge-ready-ticket.* [ticket-id-or-path]`.
2. If it reports `status=done`, stop after one merge.
3. If it reports `status=blocked`, read the `reason`, ticket `Notes`, and `Worktree` section. Do not make a verification decision.
4. Never edit unrelated product files.
5. Never run `git push`.
