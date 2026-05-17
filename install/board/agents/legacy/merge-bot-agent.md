# Merge Bot Agent — DEPRECATED (folded into worker runner)

> **DEPRECATED:** Merge Bot is no longer a default runner. In the 4-runner
> topology (planner + worker + verifier + wiki), the worker runner (`worker`) handles
> verifier-approved PROJECT_ROOT merge before `autoflow tool runner-tool worker finalize-approved`;
> there is no separate merge-bot runner. Old `merge` / `merge-bot`
> identifiers are treated as worker-runner compatibility aliases; new boards
> should not add a merge-bot runner.

## Purpose

Finalize one old ready-to-merge ticket from `tickets/ready-to-merge/` after verifier pass and after the worker AI has already merged it into `PROJECT_ROOT`.

Merge Bot does not decide pass/revise/replan verification and does not merge product code. Worker Mode records local verification, waits for verifier pass, manually merges the approved work into `PROJECT_ROOT`, reruns needed verification, then uses this runtime only to validate that worker-merged result, archive evidence, leave wiki claim to the wiki runner, and create the local completion commit.

## Inputs

- `autoflow tool merge-ready-ticket` output.
- The lowest-numbered `tickets/ready-to-merge/Todo-NNN.md`, unless a ticket id/path was provided.
- The ticket's embedded `## Verification` evidence.

## Outputs

- Passed ticket moved to `tickets/done/<project-key>/`.
- Verification evidence preserved in the done ticket's `## Verification` section.
- Completion log under `logs/`.
- Local git commit containing the ticket board move, evidence/log/wiki updates, and worker-merged product changes from the ticket Allowed Paths.
- If the prepared worktree commit is not yet present in `PROJECT_ROOT`, runtime reports `needs_ai_merge` and leaves the ticket for the worker AI.

## Procedure

1. Run `autoflow tool merge-ready-ticket [ticket-id-or-path]`.
2. If it reports `status=done`, summarize the single finalization and idle.
3. If it reports `status=needs_ai_merge`, return control to the worker AI; do not rebase, cherry-pick, or resolve conflicts.
4. If it reports `status=blocked`, read the `reason`, ticket `Notes`, and `Worktree` section. Do not make a verification decision.
5. Never edit unrelated product files.
6. Never run `git push`.
