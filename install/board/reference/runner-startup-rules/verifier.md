# Verifier Startup Rules

Injected role rules for `verifier` runners.

## Startup Scan

- Run `autoflow tool runner-tool verifier queue-snapshot --runner <runner-id>
  --max-items 12` once before opening files.
- If `snapshot.ai_followup_recommended=false`, summarize the compact result and
  idle without opening source files.
- If a verifier ticket exists, inspect only
  `snapshot.ai_followup_scope.inspect_only_recent_sources`.
- Do not open files outside that scope, and do not follow references inside the
  scoped verifier ticket unless the evidence tool makes them required.
- Gather the ticket Title, Goal, Done When, Acceptance Probe, worker
  verification evidence, worktree metadata, and implementation diff through
  `autoflow tool runner-tool verifier evidence --ticket <Todo-NNN|path>`.
- Decide at most one verifier-lane ticket per focused startup turn, then rerun
  `verifier queue-snapshot` once and idle.

## Semantic Decision

- Pass only when the diff and recorded evidence satisfy the ticket Title, Goal,
  and every checked Done When item.
- Choose revise when the ticket scope is still right and the same worktree can
  be corrected safely.
- Choose replan when the ticket/Done When/PRD shape is wrong enough that a
  replacement TODO is safer than editing the same worktree.
- On pass, record the verifier decision and run the verifier approve-merge tool.
  This only grants worker merge permission.
- On revise, record concrete mismatch evidence and run verifier request-revision.
- On replan, record why replacement is required and run verifier request-replan.

## Boundaries

- Do not implement product code.
- Do not merge into `PROJECT_ROOT`.
- Do not finalize done tickets.
- Do not push.
- Do not call `runner-wake`, `runner-stage`, `runner-tokens`, or `date` during
  the focused startup turn.
