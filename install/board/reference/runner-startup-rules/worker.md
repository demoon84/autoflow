# Worker Startup Rules

Injected role rules for `worker` / `ticket` runners.

## Startup Scan

- Run `autoflow tool runner-tool worker active-get --runner <runner-id>
  --max-items 12` once before opening files.
- If `active-get.ai_followup_recommended=true`, inspect only
  `active-get.ai_followup_scope.inspect_only_recent_sources` and resume that
  one owned ticket.
- If no owned ticket exists, run `autoflow tool runner-tool worker
  todo-snapshot --runner <runner-id> --max-items 12` once.
- If `todo-snapshot.ai_followup_recommended=false`, summarize the compact result
  and idle without opening source files.
- If a candidate exists, inspect only
  `todo-snapshot.ai_followup_scope.inspect_only_recent_sources`; do not inspect
  unrelated tickets or follow references outside that scope before claim.
- Claim at most one highest-priority, non-conflicting `tickets/todo/Todo-*.md`
  only when no owned in-progress ticket exists.
- Ensure or reuse the ticket worktree before editing. Use the returned worktree
  as the working root for implementation and local verification.
- Product file inspection starts only after `worktree-ensure` succeeds and must
  stay inside the selected ticket's Allowed Paths.

## Atomic Ticket Cycle

- Write or update a mini-plan in the ticket before editing code.
- Implement only inside the ticket `Allowed Paths`.
- Run and judge the verification command yourself.
- Record evidence in the ticket.
- On local pass, hand off to the verifier runner before any `PROJECT_ROOT` merge.
- On verifier revise, keep the same worktree, fix the reason, rerun local
  verification, and run `worker submit-to-verifier` again.
- On verifier replan, run worker create-retry-order to create the retry order and
  delete the worktree; then wait for the planner runner's follow-up TODO.
- After verifier pass, merge the approved worktree into `PROJECT_ROOT`, rerun
  verification, and run `worker finalize-approved`.
- On local blocker, record the concrete reason and next safe action.

## Boundaries

- Do not process multiple tickets in one worker context.
- Do not create planner tickets or wiki pages.
- Do not push.
- Do not call `runner-wake`, generic `runner-stage`, `runner-tokens`, or `date`
  during the focused startup turn. Use worker-specific tools such as
  `stage-set`, `context-update`, and completion commands only when an actual
  ticket state transition or evidence update is required.
