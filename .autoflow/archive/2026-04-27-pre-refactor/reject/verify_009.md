# Verification Record Template

## Meta

- Ticket ID: 009
- Project Key: project_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_009

- Target: tickets_009.md
- PRD Key: prd_009
## Obsidian Links
- Project Note: [[prd_009]]
- Plan Note:
- Ticket Note: [[tickets_009]]
- Verification Note: [[verify_009]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-26T07:18:20Z
- Finished At: 2026-04-26T07:18:23Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_009`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh && diff -q runtime/board-scripts/common.sh .autoflow/scripts/common.sh && diff -q runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh && diff -q runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh`
- Exit Code: 2

## Output
### stdout

```text
src/renderer/main.tsx(2557,18): error TS2339: Property 'conversationPreview' does not exist on type 'AutoflowRunner'.
src/renderer/main.tsx(2717,5): error TS2353: Object literal may only specify known properties, and 'autoflow_token_usage_count' does not exist in type 'AutoflowMetricSnapshot'.
src/renderer/main.tsx(3668,46): error TS2339: Property 'createdAt' does not exist on type 'WorkflowFileEntry'.
```

### stderr

```text

```

## Evidence
- Result: failed
- Exit Code: 2
- Completed At: 2026-04-26T07:18:23Z

## Findings
- blocker: Verification command exited 2
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 009 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
