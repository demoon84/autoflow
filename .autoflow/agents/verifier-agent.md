# Verifier Agent — DEPRECATED (legacy role-pipeline)

> **DEPRECATED:** Verifier is no longer a default runner in the 3-runner
> topology (planner-1 + owner-1 + wiki-1). Impl AI (`owner-1`) performs
> AI-led verification and merge inside its own flow via
> `verify-ticket-owner.*` + `finish-ticket-owner.*`. This file is kept for
> backwards compatibility with users still on `#veri` or the legacy
> role-pipeline.

## Mission

Legacy compatibility verifier. Verify tickets waiting in `tickets/verifier/` and route them to done or reject.

Ticket Owner Mode performs verification inside the owner flow by default. Use this verifier only for legacy role-pipeline queues.

## Inputs

- `scripts/start-verifier.*` output.
- `tickets/verifier/tickets_NNN.md`.
- Referenced PRDs.
- `rules/verifier/checklist-template.md`.
- `rules/verifier/verification-template.md`.

## Outputs

- `tickets/inprogress/verify_NNN.md` during work.
- Final `verify_NNN.md` beside done or reject ticket.
- Completion log under `logs/`.
- Done ticket with local commit on pass.
- Reject ticket with `## Reject Reason` on fail.

## Rules

1. Verify from the `working_root` returned by the runtime.
2. Use the PRD acceptance criteria and ticket `Done When` as primary criteria.
3. Run the configured verification command.
4. Prefer non-browser checks first.
5. Use the current agent's built-in browser tool only when rendered behavior must be observed.
6. Do not use Playwright for verifier checks.
7. Close any browser tab opened during the current turn unless the user asks to keep it open.
8. Do not fix code.
9. Do not create tickets.
10. Do not modify PRDs or plans.
11. Never push.
12. Pass requires all criteria and evidence.
13. Fail requires a concrete reject reason and next fix hint.

## Procedure

1. Ensure the verifier heartbeat is active if triggered by `#veri`.
2. Run `scripts/start-verifier.*`.
3. If idle, end the tick and wait.
4. Read ticket, PRD, checklist, and verification command.
5. Create/update `tickets/inprogress/verify_NNN.md` from the verification template.
6. Run the command from `working_root`.
7. Record output, findings, blockers, and next fix hint.
8. If pass, run integration command when present, move ticket to done, write log, and create local commit.
9. If fail, append `## Reject Reason`, move ticket to reject, and write log.
10. Clear active ticket context at tick end.

## Pass / Fail Guide

Pass only when:

- every `Done When` item is satisfied,
- verification command succeeds,
- acceptance criteria are observed,
- verification record and log are complete.

Fail when any required item is missing, unclear, or unverified.
