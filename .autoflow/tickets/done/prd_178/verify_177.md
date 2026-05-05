# Verification Record Template

## Meta

- Ticket ID: 177
- Project Key: prd_178
- Verifier: worker
- Status: pass
- Started At: 2026-05-05T00:08:00Z
- Finished At: 2026-05-05T00:10:46Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_177

- Target: tickets_177.md
- PRD Key: prd_178
## Reference Notes
- Project Note: [[prd_178]]
- Plan Note:
- Ticket Note: [[tickets_177]]
- Verification Note: [[verify_177]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash -lc 'bash -n packages/cli/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/run-role.sh runtime/board-scripts/runners-project.sh && node --check apps/desktop/src/main.js && bash tests/smoke/runner-adapter-heartbeat-smoke.sh && tmp="$(mktemp)"; awk "/^run_with_timeout\\(\\)/,/^}/ { print }" packages/cli/run-role.sh > "$tmp"; . "$tmp"; rm -f "$tmp"; output="$(printf "data\\n" | run_with_timeout 5 1 cat -)"; [ "$output" = data ]; set +e; run_with_timeout 1 1 bash -c "sleep 5"; rc=$?; set -e; [ "$rc" -eq 124 ]; npm run desktop:check'`
- Exit Code: 0 in worktree and PROJECT_ROOT

## Output

### stdout

```text
status=ok
project_root=/var/folders/.../tmp.cSQZslFbFY

> autoflow@0.1.0 desktop:check
> npm --prefix apps/desktop run check

> @autoflow/desktop@0.1.0 check
> node scripts/check-syntax.mjs && tsc --noEmit && vite build

✓ 1888 modules transformed.
✓ built in 1.38s
```

### stderr

```text
/var/folders/.../tmp.uGMmCpWMS5: line 92: 23113 Terminated: 15          "$@" 0<&0

Vite emitted the existing chunk-size warning for the renderer bundle.
```

## Evidence

- Result: pass
- Observations: Smoke test observed `active_stage=adapter_running`, at least two `last_event_at` updates during a >5s fake adapter call with 1s heartbeat interval, ISO8601 `last_adapter_chunk_at`, preserved active/spec/log fields during heartbeat writes, and `runner.N.last_adapter_chunk_at=` in runner list output. `run_with_timeout` preserved caller stdin, returned 124 on timeout, and did not accumulate watchdog sleep for fast exit. Worktree and PROJECT_ROOT Allowed Paths are byte-identical after manual integration.

## Findings

- Finding: none

## Blockers

- Blocker: none

## Next Fix Hint

- Hint: none

## Result

- Verdict: pass
- Summary: Adapter-running heartbeat/chunk freshness and desktop stale detection changes satisfy all ticket criteria.
