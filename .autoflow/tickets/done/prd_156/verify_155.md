# Verification Record Template

## Meta

- Ticket ID: 155
- Project Key: prd_156
- Verifier: worker
- Status: pass
- Started At: 2026-05-03T12:50:35Z
- Finished At: 2026-05-03T13:01:32Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_155

- Target: tickets_155.md
- PRD Key: prd_156
## Reference Notes
- Project Note: [[prd_156]]
- Plan Note:
- Ticket Note: [[tickets_155]]
- Verification Note: [[verify_155]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash tests/smoke/runner-tick-backoff-smoke.sh && npm run desktop:check`
- Exit Code: 0

## Output

### stdout

```text
status=ok
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.pdm9RXCuYy

> autoflow@0.1.0 desktop:check
> npm --prefix apps/desktop run check

> @autoflow/desktop@0.1.0 check
> node scripts/check-syntax.mjs && tsc --noEmit && vite build

vite build completed successfully.
```

### stderr

```text
vite chunk-size warning only: `index-EuHnhhfY.js` exceeds 500 kB after minification.
```

## Evidence

- Result:
  - `tests/smoke/runner-tick-backoff-smoke.sh` passed from `PROJECT_ROOT`.
  - `worker.state`/`runners list` reflected `current_interval_seconds=4`, `idle_streak_count=1`, then reset to base `2` and `0` after actionable input.
  - disabled scenario preserved `current_interval_seconds=2`, `idle_streak_count=0`.
  - smoke also asserted the 24h capped-call arithmetic (`288 < 1008`) for the required 30% reduction threshold.
- Observations:
  - backoff sleep emitted an early wake and the worker adapter executed before the extended interval fully elapsed.
  - `packages/cli/runners-project.sh` now persists dynamic interval state and exposes it through `runner.*.interval_effective_seconds`.

## Findings

- Finding:
  - No blocking verification finding.

## Blockers

- Blocker:
  - None.

## Next Fix Hint

- Hint:
  - If a future change adds runner-local UI for the raw streak value, reuse `runner.*.idle_streak_count` instead of recomputing in the renderer.

## Result

- Verdict: pass
- Summary: loop runner backoff expands idle interval, wakes on changed input, resets on actionable work, and passes desktop check.
