# Verification Record Template

## Meta

- Ticket ID: 150
- Project Key: prd_151
- Verifier: worker
- Status: pass
- Started At: 2026-05-03T12:13:51Z
- Finished At: 2026-05-03T12:14:02Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_150

- Target: tickets_150.md
- PRD Key: prd_151
## Reference Notes
- Project Note: [[prd_151]]
- Plan Note:
- Ticket Note: [[tickets_150]]
- Verification Note: [[verify_150]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command
- Started At: 2026-05-03T12:13:51Z
- Finished At: 2026-05-03T12:14:02Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_150`
- Command: ``bash -lc 'npm run desktop:check && node -e '\''const fs=require("fs"); const src=fs.readFileSync("apps/desktop/src/main.js","utf8"); const match=src.match(/async function selfHealStoppedRunnersForScope\\(scope\\) \\{[\\s\\S]*?\\n\\}/); if(!match) process.exit(1); const body=match[0]; if(body.includes("await listRunners(scope)")) process.exit(1); if(!body.includes("listRunnersCachedOrRefresh(scope")) process.exit(1); if(!/(lastSelfHeal|selfHeal.*Cooldown|knownProjectScopes\\.has)/.test(src)) process.exit(1);'\'''``
- Exit Code: 0

## Output
### stdout

```text
> autoflow@0.1.0 desktop:check
> npm --prefix apps/desktop run check

> @autoflow/desktop@0.1.0 check
> node scripts/check-syntax.mjs && tsc --noEmit && vite build

vite v6.4.2 building for production...
transforming...
✓ 1872 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 1.55s
```

### stderr

```text
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking.
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-05-03T12:14:02Z
- PROJECT_ROOT rerun: same command exited 0 from `/Users/demoon2016/Documents/project/autoflow` after confirming `apps/desktop/src/main.js` matched the verified worktree diff.
- Recorder note: `.autoflow/scripts/verify-ticket-owner.sh 150` first recorded `exit_code=127` because its markdown command re-evaluation introduced a stray `>` token after Vite's stderr warning. The owner ran the command directly in both roots and inspected exit 0 output.

## Findings
- blocker:
- warning: Vite reported the existing chunk-size warning; build still exited 0.

## Blockers

- Blocker:

## Next Fix Hint
- Finish with `scripts/finish-ticket-owner.sh 150 pass "<summary>"`.

## Result

- Verdict: pass
- Summary: self-heal runner-list lookup now uses the cached/inflight helper and same-scope scheduling is cooldown/inflight guarded.

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
