# Verification Record Template

## Meta

- Ticket ID: 086
- Project Key: prd_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_086

- Target: tickets_086.md
- PRD Key: prd_088
## Reference Notes
- Project Note: [[prd_088]]
- Plan Note:
- Ticket Note: [[tickets_086]]
- Verification Note: [[verify_086]]

## Criteria Checked

- [ ] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-05-01T21:31:26Z
- Finished At: 2026-05-01T21:31:32Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_086`
- Command: ``rg -n "Done When|\\[x\\]|\\[ \\]" .autoflow/agents .autoflow/reference runtime/board-scripts .autoflow/scripts && bash tests/smoke/ticket-owner-smoke.sh``
- Exit Code: 127

## Output
### stdout

```text

```

### stderr

```text
/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.i2GKGVCExc/.autoflow/scripts/common.sh: line 1384: syntax error near unexpected token `{'
Expected line not found: status=ok
--- /var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.i2GKGVCExc/memo-plan.out ---
bash: .autoflow/scripts/verify-ticket-owner.sh:219:replace_section_block: No such file or directory
```

## Evidence
- Result: failed
- Exit Code: 127
- Completed At: 2026-05-01T21:31:32Z

## Findings
- blocker: Verification command exited 127
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 086 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
