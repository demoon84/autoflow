# Verification Record Template

## Meta

- Ticket ID: 120
- Project Key: prd_121
- Verifier: worker
- Status: pass
- Started At: 2026-05-03T07:02:00Z
- Finished At: 2026-05-03T07:18:00Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_120

- Target: tickets_120.md
- PRD Key: prd_121
## Reference Notes
- Project Note: [[prd_121]]
- Plan Note:
- Ticket Note: [[tickets_120]]
- Verification Note: [[verify_120]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash packages/cli/telemetry-project.sh self-test && bin/autoflow telemetry compact --before 2026-01-01 && npm run desktop:check`
- Exit Code: 0

## Output

### stdout

```text
self_test_status=ok
archived_count=0
archive_path=
npm run desktop:check completed successfully.
```

### stderr

```text
Vite emitted the existing chunk-size warning during `npm run desktop:check`; build still exited 0.
```

## Evidence

- Result: pass
- Observations:
  - Temp board worker success tick added exactly one `runs.jsonl` row; tail row was jq-valid and contained `event_version`, `runner_id`, `started_at`, `ended_at`, `duration_ms`, `result`.
  - Temp board worker failure tick with stderr and exit 2 added exactly one `failures.jsonl` row with `result=failed` and `failure_class=adapter_exit_2`.
  - `bin/autoflow telemetry query --limit 5` skipped corrupt rows and returned five valid rows; `--runner worker --result success --limit 10` returned only matching rows.
  - Temp compact before `2026-04-15` archived an old `2026-04-01` row to `runs.2026-04.jsonl.gz` and removed it from `runs.jsonl`.
  - Temp scaffold and upgrade runs created `.autoflow/telemetry/` and `.autoflow/telemetry/.gitignore`.
  - Worktree and PROJECT_ROOT copies of all Allowed Paths match after AI-led merge.

## Findings

- Finding: No blocking findings.

## Blockers

- Blocker: None.

## Next Fix Hint

- Hint: None.

## Result

- Verdict: pass
- Summary: All PRD acceptance criteria were verified in the worktree, merged into PROJECT_ROOT, and reverified from PROJECT_ROOT.
