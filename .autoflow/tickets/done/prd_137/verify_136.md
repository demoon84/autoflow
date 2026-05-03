# Verification Record

## Meta

- Ticket ID: 136
- Project Key: prd_137
- Verifier: worker
- Status: pass
- Started At: 2026-05-03T10:24:00Z
- Finished At: 2026-05-03T10:26:14Z
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_136
- Target: tickets_136.md
- PRD Key: prd_137

## Reference Notes

- Project Note: [[prd_137]]
- Plan Note:
- Ticket Note: [[tickets_136]]
- Verification Note: [[verify_136]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `npm run desktop:check`
- Worktree Exit Code: 0
- PROJECT_ROOT Exit Code: 0

## Output

### stdout

```text
> autoflow@0.1.0 desktop:check
> npm --prefix apps/desktop run check

> @autoflow/desktop@0.1.0 check
> node scripts/check-syntax.mjs && tsc --noEmit && vite build

vite v6.4.2 building for production...
✓ 1887 modules transformed.
✓ built
```

### stderr

```text
Vite emitted the existing chunk-size advisory only; the command exited 0.
```

## Evidence

- Result: passed
- Allowed Paths: product changes are limited to `apps/desktop/src/renderer/main.tsx` and `apps/desktop/src/renderer/styles.css`.
- Worktree verification: `npm run desktop:check` exited 0 from `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_136`.
- Merge verification: the same diff was applied to `/Users/demoon2016/Documents/project/autoflow`, then `npm run desktop:check` exited 0 from PROJECT_ROOT.
- Acceptance evidence:
  - `ReportingDashboard` now renders four primary KPI cards first: 완료 티켓, 검증 통과율, 막힌 항목, 토큰 사용량.
  - Secondary stats moved request/PRD, commit, changed-file, and runner-artifact values below the primary KPI row.
  - User-facing labels replace `인수인계` with `전달된 요청` / `전달 요청`; the old `AI 사용량` mixed-unit chart label was removed.
  - Counts use `formatCompactCount`, `formatCount`, and `formatPercentValue`; card/chart `title`, `detail`, and `meta` expose exact units such as 개, 줄, 토큰, %, 커밋.
  - Token usage no longer shares a bar scale with artifact count; token cards show token and log counts as separate inline stats.
  - Code impact no longer compares file count with line count on one bar scale; changed files are a separate numeric stat and added/deleted lines use a same-unit split bar.
  - Blocked KPI combines `rejectCount`, `runnerBlocked`, runner `needs_user`/blocked signals, and `merge-blocked` ticket files; nonzero values use `report-tone-red`.
  - `metricsHistory` is filtered to the latest seven-day window when timestamped history exists; current-only data displays `최근 스냅샷`, and no history displays `전체 누적`.
  - Verification, token usage, code impact, and blocked-state areas include zero-data fallback/empty text such as `검증이 완료되면 채워집니다`, `러너 실행 후 채워집니다`, and `막힘 신호가 없습니다`.
- Superseded helper artifact: `scripts/verify-ticket-owner.sh 136` was invoked once after manual verification, but it misread the markdown command including backticks and recorded exit 127 (`bash: >: command not found`). That helper output is superseded by the direct AI-run worktree and PROJECT_ROOT commands above.

## Findings

- Finding: none.

## Blockers

- Blocker: none.

## Next Fix Hint

- Hint: none.

## Result

- Verdict: pass
- Summary: Desktop statistics dashboard readability redesign passed worktree and PROJECT_ROOT verification.
