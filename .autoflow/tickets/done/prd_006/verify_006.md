# Verification Record Template

## Meta

- Ticket ID: 006
- Project Key: project_NNN
- Verifier:
- Status: pass
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

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command
- Started At: 2026-04-26T07:09:22Z
- Finished At: 2026-04-26T07:09:29Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh && bin/autoflow wiki query . --term test --synth >/tmp/wiki-synth.out 2>&1 && grep -q "synth_status=" /tmp/wiki-synth.out && bin/autoflow wiki lint . --semantic >/tmp/wiki-sem.out 2>&1 && grep -q "semantic_status=" /tmp/wiki-sem.out && diff -q .autoflow/agents/wiki-maintainer-agent.md scaffold/board/agents/wiki-maintainer-agent.md && diff -q .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh`
- Exit Code: 0

## Output
### stdout

```text
status=ok
project_root=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.yCtVOqhoxJ
commit_hash=442274ee69fb4c2ccb11c992b00e72d9125686db
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-04-26T07:09:29Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker: finish-pass integration is still blocked outside verification scope because `PROJECT_ROOT` has unrelated dirty paths outside `.autoflow/`.

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 006 fail "<reason>"`.

## Result

- Verdict: pass
- Summary: The declared verification command passed at 2026-04-26T06:25:09Z after restoring the `prd_006` file set into the recreated worktree. Ticket scope is verified; remaining risk is the conflicting root-local edits that block finish integration of worktree commit `89a11dbfa0ea6ffd7247276317e0e3b9c81910ef`.

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
