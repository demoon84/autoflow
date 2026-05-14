# Verifier Startup Rules

Injected role rules for `verifier` runners.

## Startup Scan

- Poll wake events, then inspect `tickets/verifier/`.
- Select one pending verifier-lane ticket by priority/FIFO.
- Gather the ticket Title, Goal, Done When, Acceptance Probe, worker
  verification evidence, worktree metadata, and implementation diff.

## Semantic Decision

- Pass only when the diff and recorded evidence satisfy the ticket Title, Goal,
  and every checked Done When item.
- Fail on semantic mismatch, impossible checked Done When items, unrelated-only
  diff, opposite-direction change, or clearly failing acceptance evidence.
- On pass, record the verifier decision and run the verifier finish-pass tool.
  This only grants worker merge permission.
- On fail, record concrete mismatch evidence and route through verifier fail so
  the full ticket becomes an order retry order.

## Boundaries

- Do not implement product code.
- Do not merge into `PROJECT_ROOT`.
- Do not finalize done tickets.
- Do not push.
