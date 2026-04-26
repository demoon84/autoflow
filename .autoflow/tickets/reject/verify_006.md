# Verification Record Template

## Meta

- Ticket ID: 006
- Project Key: project_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006

- Target: tickets_006.md
- PRD Key: prd_006
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
- Started At: 2026-04-26T03:04:45Z
- Finished At: 2026-04-26T03:04:45Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh && bin/autoflow wiki query . --term test --synth >/tmp/wiki-synth.out 2>&1 && grep -q "synth_status=" /tmp/wiki-synth.out && bin/autoflow wiki lint . --semantic >/tmp/wiki-sem.out 2>&1 && grep -q "semantic_status=" /tmp/wiki-sem.out && diff -q .autoflow/agents/wiki-maintainer-agent.md scaffold/board/agents/wiki-maintainer-agent.md && diff -q .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh`
- Exit Code: 1

## Output
### stdout

```text

[41m                                                                               [0m
[41m[37m                This is not the tsc command you are looking for                [0m
[41m                                                                               [0m

To get access to the TypeScript compiler, [34mtsc[0m, from the command line either:

- Use [1mnpm install typescript[0m to first add TypeScript to your project [1mbefore[0m using npx
- Use [1myarn[0m to avoid accidentally running code from un-installed packages
```

### stderr

```text

```

## Evidence
- Result: failed
- Exit Code: 1
- Completed At: 2026-04-26T03:04:45Z

## Findings
- blocker: Verification command exited 1
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
