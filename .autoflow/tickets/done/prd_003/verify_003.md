# Verification Record Template

## Meta

- Ticket ID: 003
- Project Key: project_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003

- Target: tickets_003.md
- PRD Key: prd_003
## Obsidian Links
- Project Note: [[prd_003]]
- Plan Note:
- Ticket Note: [[tickets_003]]
- Verification Note: [[verify_003]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-26T05:54:03Z
- Finished At: 2026-04-26T05:54:08Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 0

## Output
### stdout

```text
status=ok
project_root=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.XPDiFxNVto
commit_hash=09e9ed2addfbb8e60befb464d129b827008cee5c
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-04-26T05:54:08Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 003 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
