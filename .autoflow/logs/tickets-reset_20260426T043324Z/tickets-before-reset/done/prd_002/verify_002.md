# Verification Record Template

## Meta

- Ticket ID: 002
- Project Key: project_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/autoflow

- Target: tickets_002.md
- PRD Key: prd_002
## Obsidian Links
- Project Note: [[prd_002]]
- Plan Note:
- Ticket Note: [[tickets_002]]
- Verification Note: [[verify_002]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-26T02:06:32Z
- Finished At: 2026-04-26T02:06:38Z
- Working Root: `/Users/demoon/Documents/project/autoflow`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh && diff -q runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh && diff -q runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh`
- Exit Code: 0

## Output
### stdout

```text
status=ok
project_root=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.1eb2tET56X
commit_hash=1358bbad304a451116c830f8e11d44795a6f6f66
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-04-26T02:06:38Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 002 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
