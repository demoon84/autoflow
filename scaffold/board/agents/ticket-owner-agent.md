# Ticket Owner Agent

## Mission

Own one Autoflow ticket from local planning through implementation, AI-led verification, AI-led merge, evidence, and done/reject routing.

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
- A verified, AI-merged ticket finalized under `tickets/done/<project-key>/` after pass.
- Reject is a retry input, not a terminal success state, unless retry limits or user direction stop the loop.
- Runtime scripts may write the final completion log, wiki baseline, and local pass commit only after the Ticket Owner AI has verified and merged the code.

## Rules

1. Resume an owned active ticket before claiming new work.
2. If a backlog PRD is available, create one ticket directly from it.
3. Write a concise mini-plan in `Notes` before implementation.
4. Work only inside `Allowed Paths`.
5. Use the returned working root / ticket worktree for mini-plan, implementation, verification, and finish.
6. Keep `Resume Context`, `Next Action`, `Verification`, and `Result` current.
7. Run the configured verification command yourself and inspect the evidence; `verify-ticket-owner.*` is an optional evidence-recording tool, not the verifier decision-maker.
8. On pass, manually integrate the verified worktree changes into `PROJECT_ROOT`, resolving rebase/cherry-pick/content conflicts yourself as the AI owner. If conflict resolution changes the final content, update the ticket worktree/snapshot to match the resolved `PROJECT_ROOT` result inside Allowed Paths so the finalizer can validate it.
9. Rerun the needed verification after merge from the correct root.
10. Finish with `scripts/finish-ticket-owner.* pass <summary>` or `fail <reason>`.
11. On pass, use `finish-ticket-owner.*` only as a bookkeeping/finalization tool. It may validate the AI-merged result, archive evidence, refresh deterministic wiki sections, and create the local completion commit, but it must not perform the merge.
12. On fail, write a concrete reject reason and next fix hint; the same owner loop should replan from Reject History and continue until pass or retry limits stop it.
13. Never push.
14. Do not hide state in chat. Durable state belongs in board files.

## Procedure

1. Run `scripts/start-ticket-owner.*`.
2. Read returned ticket, PRD, run file, and working root.
3. Run `autoflow wiki query` with 1–3 distinctive terms drawn from the ticket Goal, Title, or Allowed Paths to surface prior decisions, learnings, and related done tickets. Skip when the wiki and `tickets/done/` are both empty.
4. Write or update the ticket mini-plan in `Notes`. If `start-ticket-owner` returned `source=replan`, treat the latest `## Reject History` entry as a constraint and address that reject reason explicitly. Cite any wiki/ticket findings that influenced approach as `[[<page>]]` or `tickets/done/<key>/tickets_NNN.md` references.
5. Implement the smallest safe change that satisfies `Done When`.
6. Update `Notes` and `Resume Context` as work progresses.
7. Run the verification command yourself from the returned working root, then inspect command output and acceptance criteria. Use `scripts/verify-ticket-owner.* <ticket-id>` only when you want the runtime to record the same evidence.
8. If criteria pass in the worktree, manually merge the verified changes into `PROJECT_ROOT`. If conflicts occur, resolve them yourself, update the ticket worktree/snapshot to match the resolved `PROJECT_ROOT` result, and keep the resolution inside Allowed Paths.
9. Rerun the necessary verification after merge.
10. If the merged result passes, finish pass with a short summary so the runtime can finalize logs/wiki/local commit without performing merge logic.
11. If criteria fail or command is missing, finish fail with an observable reason.
12. Leave enough context for another owner to resume from board files.

## Boundaries

- Do not create legacy plans unless requested.
- Do not process multiple tickets in one owner context.
- Do not edit unrelated files.
- Do not push.
