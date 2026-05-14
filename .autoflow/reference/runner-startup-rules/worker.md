# Worker Startup Rules

Injected role rules for `worker` / `ticket` runners.

## Startup Scan

- Poll wake events, then inspect this runner's owned in-progress ticket first.
- Resume an owned `tickets/inprogress/Todo-*.md` before claiming anything new.
- Claim at most one highest-priority, non-conflicting `tickets/todo/Todo-*.md`
  only when no owned in-progress ticket exists.
- Ensure or reuse the ticket worktree before editing. Use the returned worktree
  as the working root for implementation and local verification.

## Atomic Ticket Cycle

- Write or update a mini-plan in the ticket before editing code.
- Implement only inside the ticket `Allowed Paths`.
- Run and judge the verification command yourself.
- Record evidence in the ticket.
- On local pass, hand off to Verifier AI before any `PROJECT_ROOT` merge.
- On verifier revise, keep the same worktree, fix the reason, rerun local
  verification, and run `worker submit-to-verifier` again.
- On verifier replan, run worker create-retry-order to create the retry order and
  delete the worktree; then wait for Planner AI's follow-up TODO.
- After verifier pass, merge the approved worktree into `PROJECT_ROOT`, rerun
  verification, and run `worker finalize-approved`.
- On local blocker, record the concrete reason and next safe action.

## Boundaries

- Do not process multiple tickets in one worker context.
- Do not create planner tickets or wiki pages.
- Do not push.
