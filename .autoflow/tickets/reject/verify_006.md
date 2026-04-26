# Verification Record Template

## Meta

- Ticket ID: 006
- PRD Key: prd_006
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006

- Target: tickets_006.md
## Obsidian Links
- Project Note: [[prd_006]]
- Plan Note:
- Ticket Note: [[tickets_006]]
- Verification Note: [[verify_006]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-26T01:09:56Z
- Finished At: 2026-04-26T01:09:56Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh && bin/autoflow wiki query . --term test --synth >/tmp/wiki-synth.out 2>&1 && grep -q "synth_status=" /tmp/wiki-synth.out && bin/autoflow wiki lint . --semantic >/tmp/wiki-sem.out 2>&1 && grep -q "semantic_status=" /tmp/wiki-sem.out && diff -q .autoflow/agents/wiki-maintainer-agent.md scaffold/board/agents/wiki-maintainer-agent.md && diff -q .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh`
- Exit Code: 254

## Output
### stdout

```text

```

### stderr

```text
npm error code ENOENT
npm error syscall lstat
npm error path /Users/demoon/Documents/project/autoflow/apps/desktop/lib
npm error errno -2
npm error enoent ENOENT: no such file or directory, lstat '/Users/demoon/Documents/project/autoflow/apps/desktop/lib'
npm error enoent This is related to npm not being able to find a file.
npm error enoent
npm error A complete log of this run can be found in: /Users/demoon/.npm/_logs/2026-04-26T01_09_56_325Z-debug-0.log
```

## Evidence
- Result: failed
- Exit Code: 254
- Completed At: 2026-04-26T01:09:56Z

## Findings
- blocker: Verification command exited 254
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 006 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
