# Verification Record Template

## Meta

- Ticket ID: 160
- Project Key: prd_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_160

- Target: tickets_160.md
- PRD Key: prd_161
## Reference Notes
- Project Note: [[prd_161]]
- Plan Note:
- Ticket Note: [[tickets_160]]
- Verification Note: [[verify_160]]

## Criteria Checked

- [ ] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-05-03T13:58:18Z
- Finished At: 2026-05-03T13:58:34Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_160`
- Command: ``bash -lc 'bash -n packages/cli/scaffold-project.sh packages/cli/upgrade-project.sh packages/cli/package-board-common.sh packages/cli/stop-hook-project.sh .autoflow/scripts/install-stop-hook.sh runtime/board-scripts/install-stop-hook.sh && tests/smoke/quote-prefix-shadow-dir-smoke.sh && quoted_count=$(find . -maxdepth 2 -name "\"*" | wc -l | tr -d " "); test "$quoted_count" = "0"'``
- Exit Code: 127

## Output
### stdout

```text

```

### stderr

```text
find: /var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.CsCNcV9495/.autoflow/tickets/plan: No such file or directory
bash: ok: command not found
```

## Evidence
- Result: failed
- Exit Code: 127
- Completed At: 2026-05-03T13:58:34Z

## Findings
- blocker: Verification command exited 127
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 160 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
