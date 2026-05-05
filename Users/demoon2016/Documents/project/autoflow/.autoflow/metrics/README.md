# Metrics

Metrics are derived snapshots. They do not control board state.

Typical values:

- spec count,
- handoff archive count,
- ticket count by state,
- active ticket count,
- done count,
- reject count,
- runner counts by state,
- verifier pass/fail counts,
- Autoflow completion commit count,
- product-code files changed, insertions, deletions, and total changed lines,
- observed AI token usage from runner adapter logs,
- pass rate,
- completion rate.

`metrics/daily.jsonl` may store appended snapshots.
