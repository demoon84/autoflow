# Verification Record Template

## Meta

- Ticket ID: 007
- Project Key: project_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_007

- Target: tickets_007.md
- PRD Key: prd_007
## Obsidian Links
- Project Note: [[prd_007]]
- Plan Note:
- Ticket Note: [[tickets_007]]
- Verification Note: [[verify_007]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-26T04:03:58Z
- Finished At: 2026-04-26T04:03:59Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_007`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 127

## Output
### stdout

```text

```

### stderr

```text
bash: tests/smoke/ticket-owner-smoke.sh: No such file or directory
```

## Evidence
- Result: failed
- Exit Code: 127
- Completed At: 2026-04-26T04:03:59Z

## Findings
- blocker: Verification command exited 127
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 007 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
