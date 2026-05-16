# Verifier Rules

Verifier rules define how the verifier runner decides whether a worker handoff is ready to merge, needs revision, or needs replanning.

Read this file after `rules/README.md` and before inspecting a verifier ticket.

## Inputs

- Verifier queue files under `tickets/verifier/`.
- The source inprogress ticket referenced by the verifier ticket.
- Worker verification evidence recorded in the ticket.
- Worktree metadata and implementation diff collected by `autoflow tool runner-tool verifier evidence`.

## Decisions

- `pass`: the diff and recorded evidence satisfy the ticket Title, Goal, Acceptance Probe, and checked Done When items.
- `revise`: the ticket scope is still correct, but the same worktree needs concrete follow-up changes.
- `replan`: the ticket shape, Done When, or PRD is wrong enough that a replacement TODO is safer than editing the current worktree.

## Boundaries

- Do not implement product code.
- Do not merge product code into `PROJECT_ROOT`.
- Do not finalize done tickets.
- Do not push.

Use `checklist-template.md` for the review checklist and `verification-template.md` for durable decision notes.
