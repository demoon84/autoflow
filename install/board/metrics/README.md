# Metrics

Metrics are derived snapshots. They do not control board state.

Typical values:

- PRD/ticket totals and ticket count by state,
- active ticket count, done count, retry order count, and verifier handoff count,
- product-code files changed, insertions, deletions, net delta, and total changed lines,
- observed AI token usage from runner adapter logs,
- recent 1h/24h token totals plus runner/model/hourly token breakdowns,
- completion rate.

Generated metrics files such as `snapshot.env` are intentionally ignored by git.
