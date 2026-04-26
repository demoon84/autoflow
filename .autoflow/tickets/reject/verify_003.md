# Verification Record Template

## Meta

- Ticket ID: 003
- Project Key: project_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/autoflow

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
- Started At: 2026-04-26T02:29:39Z
- Finished At: 2026-04-26T02:29:43Z
- Working Root: `/Users/demoon/Documents/project/autoflow`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 1

## Output
### stdout

```text

```

### stderr

```text
Expected line not found: 1. Treat `#af` and `/af` as Autoflow spec handoff triggers.
--- /var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.OFdjP3pche/.claude/skills/af/SKILL.md ---
---
name: af
description: Short alias for the Autoflow PRD handoff skill. Use when the user says "#af", invokes "/af", or wants to start an Autoflow handoff quickly.
---

# Autoflow Short Alias

Follow the same workflow as the `autoflow` skill:

1. Treat `#af` and `/af` as Autoflow PRD handoff triggers.
2. Draft the full PRD in chat first.
3. Save only after explicit user confirmation.
4. Save only to the Autoflow backlog PRD queue.
5. Do not plan, create tickets, implement, verify, commit, or push.

If the `autoflow` skill file is available, read it and follow its fuller instructions.
```

## Evidence
- Result: failed
- Exit Code: 1
- Completed At: 2026-04-26T02:29:43Z

## Findings
- blocker: Verification command exited 1
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
- [ ] automated verification passed
