# ABA Report: prd_152 verifier model/reasoning token savings

## Scope

- Ticket: `tickets_151`
- Runner: `id = "verifier"`
- Config change: `model = "opus-1m"` + `reasoning = "high"` -> `model = "sonnet-4.6"` + `reasoning = "medium"`
- Out of scope: planner / worker / wiki runner settings

## Baseline Snapshot

- Snapshot command: `bash packages/cli/metrics-project.sh "$PWD" .autoflow snapshot`
- Baseline capture time: `2026-05-03T12:24:53Z`
- Durable snapshot append: `bash packages/cli/metrics-project.sh "$PWD" .autoflow --write`
- Written snapshot time: `2026-05-03T12:26:06Z`

Observed baseline key=value output:

```text
verifier_pass_count=78
verifier_fail_count=6
verifier_total=84
verification_pass_rate_percent=92.9
autoflow_token_usage_count=0
autoflow_token_report_count=3
snapshot_file=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_151/.autoflow/metrics/daily.jsonl
```

Baseline note:

- This ticket uses the current `metrics-project.sh` snapshot output as the authoritative baseline required by the ticket.
- The earlier `tickets/done/prd_129/tickets_130.md` telemetry work remains the context for where adapter token records come from.
- The current snapshot exposes verifier pass/fail totals and overall observed token totals. Follow-up comparison after 7 days should reuse the same command and compare against the appended `daily.jsonl` baseline row written at `2026-05-03T12:26:06Z`.

## 7-Day ABA Compare Gate

- Re-run after 7 days from baseline date: on or after `2026-05-10` using `bash packages/cli/metrics-project.sh "$PWD" .autoflow snapshot` and a fresh `--write` append.
- Token gate: cumulative token usage must be at least 20% lower versus baseline.
- Pass-rate gate: `verification_pass_rate_percent` must remain within baseline `92.9` plus or minus `3.0` percentage points.
- Fail-count gate: `verifier_fail_count` must remain below baseline `6 * 1.5 = 9`.

## Rollback Instruction

- If any ABA gate fails, revert the verifier runner block in `.autoflow/runners/config.toml` to `model = "opus-1m"` and `reasoning = "high"`.
- Record the rollback execution time, rerun snapshot collection, and append the rollback outcome to this same report.
- Keep planner / worker / wiki runner settings unchanged during rollback.

## Follow-Up Checklist

- [x] Baseline snapshot captured before verifier config change
- [x] Baseline row appended to `.autoflow/metrics/daily.jsonl`
- [x] Verifier runner changed to mid-tier model with `reasoning = "medium"`
- [ ] 7-day ABA follow-up snapshot captured
- [ ] ABA gates evaluated
- [ ] Rollback executed if any gate fails
