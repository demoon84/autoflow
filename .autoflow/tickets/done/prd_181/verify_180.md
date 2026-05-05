# Verification Record Template

## Meta

- Ticket ID: 180
- Project Key: prd_181
- Verifier: worker
- Status: pass
- Started At: 2026-05-05T00:33:50Z
- Finished At: 2026-05-05T00:41:19Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_180

- Target: tickets_180.md
- PRD Key: prd_181
## Reference Notes
- Project Note: [[prd_181]]
- Plan Note:
- Ticket Note: [[tickets_180]]
- Verification Note: [[verify_180]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash -lc 'bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh && bash tests/smoke/telemetry-token-usage-sanity-smoke.sh && bash tests/smoke/metrics-token-usage-smoke.sh && bash packages/cli/telemetry-project.sh token-usage --project-root "$PWD" --runner worker --since "2026-05-03T22:47:35Z" | tee /tmp/autoflow-token-usage-sanity-root.out && awk -F= '\''$1=="token_usage" { found=1; if (($2+0) >= 100000000) exit 2 } END { if (!found) exit 1 }'\'' /tmp/autoflow-token-usage-sanity-root.out'`
- Exit Code: 0

## Output

### stdout

```text
tests/smoke/telemetry-token-usage-sanity-smoke.sh: status=ok
tests/smoke/metrics-token-usage-smoke.sh: status=ok
runner_id=worker
since=2026-05-03T22:47:35Z
until=
token_usage=173036
token_usage_trusted=true
skipped_suspicious_token_rows=0
token_usage_max_row_tokens=100000000
```

### stderr

```text
No stderr from the final PROJECT_ROOT verification command.
```

## Evidence

- Result: pass
- Observations: Temporary smoke fixtures prove corrupt rows with `token_input=43000004027` and `token_output=43000000020` are skipped with warning evidence, normal rows and time filters are preserved, markdown/fingerprint snippets are ignored by token extraction, explicit JSON usage still records, and suspicious telemetry does not write `last_result=token_budget_exceeded`.

## Findings

- Finding: none

## Blockers

- Blocker: none

## Next Fix Hint

- Hint: none

## Result

- Verdict: pass
- Summary: Telemetry token usage sanity correction is implemented and verified in worktree and PROJECT_ROOT.
