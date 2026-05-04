# Verification Record Template

## Meta

- Ticket ID: 174
- Project Key: prd_175
- Verifier: worker
- Status: pass
- Started At: 2026-05-05T07:08:00+09:00
- Finished At: 2026-05-05T07:17:00+09:00
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_174

- Target: tickets_174.md
- PRD Key: prd_175
## Reference Notes
- Project Note: [[prd_175]]
- Plan Note:
- Ticket Note: [[tickets_174]]
- Verification Note: [[verify_174]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash tests/smoke/planner-realtime-wakeup-smoke.sh && bash tests/smoke/runner-tick-backoff-smoke.sh && npm run desktop:check`
- Exit Code: 0

## Output

### stdout

```text
tests/smoke/planner-realtime-wakeup-smoke.sh: exit 0
tests/smoke/runner-tick-backoff-smoke.sh: exit 0, output included `status=ok`
npm run desktop:check: exit 0, Vite build completed successfully with the existing chunk-size warning.
```

### stderr

```text

```

## Evidence

- Result: pass
- Observations: `AUTOFLOW_PLANNER_REALTIME_ENABLED=1` wakes planner sleep early for inbox order, backlog PRD, and reject inputs. Burst order creation produced one adapter invocation and no overlap marker. `AUTOFLOW_PLANNER_REALTIME_ENABLED=0` produced no realtime wakeup log and preserved interval polling during the smoke window. Existing backoff smoke and desktop check still pass from PROJECT_ROOT after manual integration. After `needs_ai_merge/worktree_rebase_required`, worktree HEAD was fast-forwarded to PROJECT_ROOT HEAD and the same verification command passed again from the worktree.

## Findings

- Finding: none

## Blockers

- Blocker: none

## Next Fix Hint

- Hint: none

## Result

- Verdict: pass
- Summary: planner realtime wakeup trigger verified with polling fallback and existing backoff/desktop checks.
