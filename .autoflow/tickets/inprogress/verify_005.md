# Verification Record Template

## Meta

- Ticket ID: 005
- Project Key: prd_005
- Verifier: AI-5
- Status: fail
- Started At: 2026-04-26T08:19:04Z
- Finished At: 2026-04-26T08:19:07Z
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005

- Target: tickets_005.md
- PRD Key: prd_005
## Obsidian Links
- Project Note: [[prd_005]]
- Plan Note:
- Ticket Note: [[tickets_005]]
- Verification Note: [[verify_005]]

## Criteria Checked

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was rerun in this turn.

## Command
- Started At: 2026-04-26T08:19:04Z
- Finished At: 2026-04-26T08:19:07Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005`
- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs && cd ../.. && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 1

## Output
### stdout

```text

```

### stderr

```text
Expected line not found: runner_count=2
--- /var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU/runner-list.out ---
status=ok
action=list
project_root=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU
board_root=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU/.autoflow
board_dir_name=.autoflow
config_path=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU/.autoflow/runners/config.toml
runner_count=1
runner.1.id=owner-1
runner.1.role=ticket-owner
runner.1.agent=codex
runner.1.model=
runner.1.reasoning=
runner.1.mode=one-shot
runner.1.interval_seconds=60
runner.1.interval_effective_seconds=60
runner.1.enabled=true
runner.1.command=
runner.1.command_preview=codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C /var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU -
runner.1.state_status=idle
runner.1.active_item=
runner.1.active_ticket_id=
runner.1.active_ticket_title=
runner.1.active_stage=
runner.1.active_spec_ref=
runner.1.pid=
runner.1.started_at=
runner.1.last_event_at=
runner.1.last_result=
runner.1.last_runtime_log=
runner.1.last_prompt_log=
runner.1.last_stdout_log=
runner.1.last_stderr_log=
runner.1.artifact_status=not_applicable
runner.1.artifact_runtime_status=absent
runner.1.artifact_prompt_status=absent
runner.1.artifact_stdout_status=absent
runner.1.artifact_stderr_status=absent
runner.1.last_log_line=
runner.1.state_path=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU/.autoflow/runners/state/owner-1.state
runner.1.log_path=/var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/tmp.SmmElypWYU/.autoflow/runners/logs/owner-1.log
```

## Evidence
- Result: failed
- Exit Code: 1
- Completed At: 2026-04-26T08:19:07Z

## Findings
- blocker: `tests/smoke/ticket-owner-smoke.sh` still expects `runner_count=2` with `wiki-maintainer-1`, but a fresh temp board from `autoflow init` reports only `runner_count=1` / `owner-1`.
- warning: The in-scope `prd_005` alias/template/UI work remains validated; the remaining failure lives in runtime/scaffold expectations outside this ticket's Allowed Paths.

## Blockers

- Blocker: Do not queue `tickets_005` for ready-to-merge until a separate runtime/scaffold change reconciles `tests/smoke/ticket-owner-smoke.sh` with the current default runner template (`scaffold/board/runners/config.toml` / init output), or until the verification command for this PRD is updated to match the live runner scaffold.

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 005 fail "<reason>"`.

## Result

- Verdict: blocked
- Summary: At board completion `54.5%`, the current `tickets_005` worktree validates the in-scope PRD alias/template behavior and the desktop renderer compiles again, but the required full verification command still fails on an out-of-scope smoke assumption: temp `autoflow init` scaffolds one default runner while `tests/smoke/ticket-owner-smoke.sh` still requires two.

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [ ] automated verification passed
