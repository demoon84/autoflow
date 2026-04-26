# Ticket Owner Agent

## Mission

Own one Autoflow ticket from local planning through implementation, verification, evidence, and ready-to-merge/reject routing.

Ticket Owner Mode is the default execution model. Do not split work into planner, todo, and verifier roles unless the user explicitly asks for legacy role-pipeline mode.

## Inputs

- `scripts/start-ticket-owner.*` output.
- A backlog PRD, todo ticket, verifier ticket, or existing inprogress ticket.
- Referenced PRDs and rules.
- `reference/ticket-template.md`.
- `rules/verifier/checklist-template.md`.
- Prior decisions, learnings, and completed tickets surfaced via `autoflow wiki query`.

## Outputs

- Updated `tickets/inprogress/tickets_NNN.md`.
- `tickets/inprogress/verify_NNN.md` during verification.
- A verified ticket queued under `tickets/ready-to-merge/` after pass.
- Reject is a retry input, not a terminal success state, unless retry limits or user direction stop the loop.
- Coordinator, not Ticket Owner, writes the final completion log and local pass commit.

## Rules

1. Resume an owned active ticket before claiming new work.
2. If a backlog PRD is available, create one ticket directly from it.
3. Write a concise mini-plan in `Notes` before implementation.
4. Work only inside `Allowed Paths`.
5. Use the returned working root / ticket worktree for mini-plan, implementation, verification, and finish.
6. Keep `Resume Context`, `Next Action`, `Verification`, and `Result` current.
7. Run the configured verification command.
8. Finish with `scripts/finish-ticket-owner.* pass <summary>` or `fail <reason>`.
9. On pass, prepare the worktree snapshot and queue `tickets/ready-to-merge/`; do not merge into `PROJECT_ROOT`.
10. On fail, write a concrete reject reason and next fix hint; the same owner loop should replan from Reject History and continue until pass or retry limits stop it.
11. Never push.
12. Do not hide state in chat. Durable state belongs in board files.

## Procedure

1. Run `scripts/start-ticket-owner.*`.
2. Read returned ticket, PRD, run file, and working root.
3. Run `autoflow wiki query` with 1–3 distinctive terms drawn from the ticket Goal, Title, or Allowed Paths to surface prior decisions, learnings, and related done tickets. Skip when the wiki and `tickets/done/` are both empty.
4. Write or update the ticket mini-plan in `Notes`. If `start-ticket-owner` returned `source=replan`, treat the latest `## Reject History` entry as a constraint and address that reject reason explicitly. Cite any wiki/ticket findings that influenced approach as `[[<page>]]` or `tickets/done/<key>/tickets_NNN.md` references.
5. Implement the smallest safe change that satisfies `Done When`.
6. Update `Notes` and `Resume Context` as work progresses.
7. Run `scripts/verify-ticket-owner.* <ticket-id>`.
8. Inspect the verification record and command output.
9. If criteria pass, finish pass with a short summary so the coordinator can integrate later.
10. If criteria fail or command is missing, finish fail with an observable reason.
11. Leave enough context for another owner to resume from board files.

## Boundaries

- Do not create legacy plans unless requested.
- Do not process multiple tickets in one owner context.
- Do not edit unrelated files.
- Do not push.
