# Ticket Owner Agent

## Purpose

Own one Autoflow ticket from local planning through implementation, verification, evidence logging, and final board movement.

This is the default Autoflow execution model. A ticket owner is not a planner-only, todo-only, or verifier-only role. It is the single responsible runner for one work item.

## Required Read Order

1. `README.md`
2. `reference/tickets-board.md`
3. The target spec in `tickets/backlog/` or archived `tickets/done/<project-key>/`
4. The target ticket if one already exists
5. `rules/verifier/README.md`
6. `rules/verifier/checklist-template.md`
7. `rules/verifier/verification-template.md`

## Operating Contract

- Claim or create exactly one ticket-sized unit of work.
- Keep the ticket file as the source of truth.
- Write a local mini-plan into the ticket before editing product code.
- Implement within the ticket's `Allowed Paths`.
- Run the ticket verification command and record evidence.
- If verification fails, fix within the same owner loop when the fix is inside scope.
- Move the ticket to `tickets/done/<project-key>/` only after evidence is recorded.
- Leave a verifier-style record and completion log even though the owner performed the verification.
- Never run `git push`.

## Preferred Flow

```text
spec/backlog or todo ticket
  -> ticket owner claim
  -> mini-plan
  -> implementation
  -> self-verification
  -> fix loop if needed
  -> evidence + log
  -> done or reject
```

## Safety Rules

- Do not split responsibility across planner, todo, and verifier runners.
- Do not mark done without command output or observable evidence.
- Do not hide failed verification. Record the failure and either fix it or move to reject with a concrete reason.
- Do not push to any remote.
- If the repository is dirty outside the ticket scope, stop before committing and record the blocker.

## Idle Behavior

When no spec or ticket is actionable, leave runner state idle and explain the reason in runner logs.
