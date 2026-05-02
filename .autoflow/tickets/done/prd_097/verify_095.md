# Verification Record Template

## Meta

- Ticket ID: 095
- Project Key: prd_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_095

- Target: tickets_095.md
- PRD Key: prd_097
## Reference Notes
- Project Note: [[prd_097]]
- Plan Note:
- Ticket Note: [[tickets_095]]
- Verification Note: [[verify_095]]

## Criteria Checked

- [ ] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-05-02T00:36:42Z
- Finished At: 2026-05-02T00:37:52Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_095`
- Command: `bash -n .autoflow/scripts/common.sh && bash -n runtime/board-scripts/common.sh && bash tests/smoke/ticket-owner-replan-smoke.sh`
- Exit Code: 0

## Output
### stdout

```text
status=ok
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.mnkuZc9jrH
commit_hash=02ef53651712aea1f7f1a21865d4485573e4349b
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-05-02T00:37:52Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 095 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
