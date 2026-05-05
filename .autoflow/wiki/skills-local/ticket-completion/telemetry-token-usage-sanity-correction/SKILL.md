---
name: "telemetry-token-usage-sanity-correction"
description: "telemetry token usage sanity correction"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/telemetry-project.sh"
  keywords:
    - "telemetry"
    - "token"
    - "usage"
    - "sanity"
    - "correction"
    - "packages"
    - "cli"
    - "project"
    - "run"
    - "role"
    - "runtime"
    - "board"
pinned: false
created_from:
  prd: "prd_181"
  ticket: "tickets_180"
created_at: "2026-05-05T00:42:03Z"
---

# telemetry token usage sanity correction

## Trigger

- Reuse when: telemetry token usage sanity correction
- Source ticket: `tickets/done/prd_181/tickets_180.md`

## Recommended Procedure

- `bash packages/cli/telemetry-project.sh token-usage --project-root "$PWD" --runner worker --since "2026-05-03T22:47:35Z"` no longer returns `86004270902` or any value at/above `100000000` when the only source of excess is an impossible single telemetry row.
- A temporary smoke fixture with one corrupt row (`token_input=43000004027`, `token_output=43000000020`) and one normal worker row returns the normal worker total, preserves the `--since` / `--until` filters, and records warning evidence for the skipped corrupt row.
- `run-role.sh` token extraction ignores board/wiki snippet text and numeric fingerprints as token counts, while still parsing explicit adapter token markers and JSON usage objects.
- budget preflight does not write `last_result=token_budget_exceeded` when the sanitized telemetry command reports that the total is suspicious/impossible rather than trusted budget usage.
- The implementation does not edit or delete `.autoflow/telemetry/runs.jsonl`, `.autoflow/metrics/token-cache.tsv`, or `.autoflow/policies/budget.toml`; fixture data stays inside temporary smoke-test boards.

## Pitfalls

- Low; row sanity threshold defaults to `100000000` and can be overridden with `AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS` if future adapter limits change.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh && bash tests/smoke/telemetry-token-usage-sanity-smoke.sh && bash tests/smoke/metrics-token-usage-smoke.sh && bash packages/cli/telemetry-project.sh token-usage --project-root "$PWD" --runner worker --since "2026-05-03T22:47:35Z" | tee /tmp/autoflow-token-usage-sanity-root.out && awk -F= '\''$1=="token_usage" { found=1; if (($2+0) >= 100000000) exit 2 } END { if (!found) exit 1 }'\'' /tmp/autoflow-token-usage-sanity-root.out'``

## Source Evidence

- Ticket: `tickets/done/prd_181/tickets_180.md`
- PRD: `tickets/done/prd_181/prd_181.md`
- Verification: `tickets/done/prd_181/verify_180.md`
- Result summary: telemetry token usage sanity correction
