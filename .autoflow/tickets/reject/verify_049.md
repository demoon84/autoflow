# Verification Record Template

## Meta

- Ticket ID: 049
- Project Key: prd_NNN
- Verifier:
- Status: fail
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049

- Target: tickets_049.md
- PRD Key: prd_049
## Obsidian Links
- Project Note: [[prd_049]]
- Plan Note:
- Ticket Note: [[tickets_049]]
- Verification Note: [[verify_049]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-29T07:41:48Z
- Finished At: 2026-04-29T07:42:05Z
- Working Root: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049`
- Command: `bash -n runtime/board-scripts/common.sh .autoflow/scripts/common.sh runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh && diff -q runtime/board-scripts/common.sh .autoflow/scripts/common.sh && diff -q runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh && diff -q runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 1

## Output
### stdout

```text

```

### stderr

```text
Expected line not found: cleanup_status=ok
--- /var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.qL2Y37H4px/finish.out ---
status=done
outcome=pass
ticket=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.qL2Y37H4px/.autoflow/tickets/inprogress/tickets_001.md
ticket_id=001
run=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.qL2Y37H4px/.autoflow/tickets/inprogress/verify_001.md
status=no_code_changes
ticket_id=001
worktree_path=/private/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/.autoflow-worktrees/tmp.qL2Y37H4px/tickets_001
inline_merge_exit=0
inline_merge=done; wiki+log written
commit_status=committed_via_inline_merge
next_action=AI merge finalization completed. Impl AI may pick the next todo ticket on the next tick.
board_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.qL2Y37H4px/.autoflow
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.qL2Y37H4px
```

## Evidence
- Result: failed
- Exit Code: 1
- Completed At: 2026-04-29T07:42:05Z

## Findings
- blocker: Verification command exited 1
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 049 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
