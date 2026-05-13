# Ticket Owner Agent

## Purpose

Own one Autoflow ticket from local planning through implementation, verification, evidence logging, and final board movement.

This is the default Autoflow execution model. A ticket owner is not a planner-only, todo-only, or verifier-only role. It is the single responsible runner for one work item.

## Required Read Order

1. `README.md`
2. `reference/tickets-board.md`
3. The referenced spec archived under `tickets/done/<project-key>/`, when the ticket points to one
4. The target ticket if one already exists
5. `rules/verifier/README.md`
6. `rules/verifier/checklist-template.md`
7. `rules/verifier/verification-template.md`

## Operating Contract

- Claim exactly one ticket-sized unit of work.
- Treat Autoflow as AI-led: shell scripts are deterministic tools that make the AI's work convenient, consistent, and auditable, not replacement workers or hidden decision makers.
- Use `scripts/start-ticket-owner.ts` before editing. It resumes an owned ticket, claims a todo ticket, or adopts a legacy verifier ticket. Plan AI creates todo tickets from backlog PRDs.
- Keep the ticket file as the source of truth.
- Write a local mini-plan into the ticket before editing product code.
- Implement within the ticket's `Allowed Paths`.
- Run the ticket verification command and record evidence.
- Prefer `scripts/verify-ticket-owner.ts <ticket-id-or-path>` for automated checks; it reads the command from the ticket or referenced project spec, executes it from the ticket working root, and records command/output/evidence in `tickets/inprogress/verify_NNN.md`.
- If verification fails, fix within the same owner loop when the fix is inside scope.
- Move the ticket to `tickets/done/<project-key>/` only after evidence is recorded.
- Leave a verifier-style record and completion log even though the owner performed the verification.
- On pass, run `scripts/finish-ticket-owner.ts <ticket-id-or-path> pass "<short summary>"`; it integrates worktree changes when needed, moves the ticket to done, writes the verifier log, clears active context, and creates a local commit when the project is a git repo.
- Pass/completion commit messages must use `[prd_NNN] 작업내용 요약본`, where `prd_NNN` comes from the ticket `PRD Key` / project key. Use `[tickets_NNN]` only for legacy tickets without a PRD key.
- On fail that cannot be fixed in scope, run `scripts/finish-ticket-owner.ts <ticket-id-or-path> fail "<concrete reject reason>"`; it moves the ticket to reject, writes the verifier log, clears active context, and does not commit failed work.
- Never run `git push`.

## Preferred Flow

```text
Plan AI todo ticket
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
- If `finish-ticket-owner.* pass` or `merge-ready-ticket.*` returns `status=needs_ai_merge`, keep working the same ticket: merge verified worktree changes into `PROJECT_ROOT`/main, rerun verification from `PROJECT_ROOT`, then rerun `finish-ticket-owner.* pass`.

## Idle Behavior

When no ticket is actionable, leave runner state idle and explain the reason in runner logs.
