# Verification Record Template

## Meta

- Ticket ID: 151
- Project Key: prd_NNN
- Verifier: worker
- Status: pass
- Started At: 2026-05-03T12:24:53Z
- Finished At: 2026-05-03T12:26:45Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_151

- Target: tickets_151.md
- PRD Key: prd_152
## Reference Notes
- Project Note: [[prd_152]]
- Plan Note:
- Ticket Note: [[tickets_151]]
- Verification Note: [[verify_151]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash packages/cli/metrics-project.sh "$PWD" .autoflow snapshot`
- Exit Code: 0

## Output

### stdout

```text
worktree baseline before config change:
timestamp=2026-05-03T12:24:53Z
verifier_pass_count=78
verifier_fail_count=6
verification_pass_rate_percent=92.9
autoflow_token_usage_count=0
autoflow_token_report_count=3

project_root verification after manual merge:
timestamp=2026-05-03T12:26:45Z
verifier_pass_count=78
verifier_fail_count=6
verification_pass_rate_percent=92.9
autoflow_token_usage_count=10046854
autoflow_token_report_count=223
```

### stderr

```text
```

## Evidence

- Result: pass
- Observations:
  - `.autoflow/runners/config.toml` changed only the `id = "verifier"` block from `opus-1m/high` to `sonnet-4.6/medium`.
  - `.autoflow/metrics/aba-prd-152.md` records the baseline snapshot, the 7-day compare gates, and explicit rollback instructions.
  - `bash packages/cli/metrics-project.sh "$PWD" .autoflow --write` appended the baseline row to `.autoflow/metrics/daily.jsonl` before the config change.
  - Manual merge into `PROJECT_ROOT` was completed for the three allowed paths and the same snapshot command passed again from `/Users/demoon2016/Documents/project/autoflow`.

## Findings

- Finding: none

## Blockers

- Blocker: none

## Next Fix Hint

- Hint: on or after 2026-05-10, rerun snapshot + `--write`, compare against the baseline row, and execute the documented rollback only if any ABA gate fails.

## Result

- Verdict: pass
- Summary: verifier runner downgrade and ABA baseline report are in place, with snapshot evidence recorded before and after integration.
