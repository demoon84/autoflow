# Verification Record Template

## Meta

- Ticket ID: 020
- Project Key: project_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020

- Target: tickets_020.md
- PRD Key: prd_020
## Obsidian Links
- Project Note: [[prd_020]]
- Plan Note:
- Ticket Note: [[tickets_020]]
- Verification Note: [[verify_020]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-04-27T14:19:01Z
- Finished At: 2026-04-27T14:19:03Z
- Working Root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020`
- Command: `bin/autoflow doctor /Users/demoon/Documents/project/autoflow .autoflow && bash -n runtime/board-scripts/start-ticket-owner.sh && bash -n runtime/board-scripts/common.sh && bash -n .autoflow/scripts/start-ticket-owner.sh`
- Exit Code: 0

## Output
### stdout

```text
check.wiki_scaffold=ok
check.metrics_scaffold=ok
check.adapter_scaffold=ok
check.script_common.sh=ok
check.script_common.sh_executable=ok
check.script_runner-common.sh=ok
check.script_runner-common.sh_executable=ok
check.script_check-stop.sh=ok
check.script_check-stop.sh_executable=ok
check.script_file-watch-common.sh=ok
check.script_file-watch-common.sh_executable=ok
check.script_install-stop-hook.sh=ok
check.script_install-stop-hook.sh_executable=ok
check.script_run-hook.sh=ok
check.script_run-hook.sh_executable=ok
check.script_watch-board.sh=ok
check.script_watch-board.sh_executable=ok
check.script_set-thread-context.sh=ok
check.script_set-thread-context.sh_executable=ok
check.script_clear-thread-context.sh=ok
check.script_clear-thread-context.sh_executable=ok
check.script_start-ticket-owner.sh=ok
check.script_start-ticket-owner.sh_executable=ok
check.script_verify-ticket-owner.sh=ok
check.script_verify-ticket-owner.sh_executable=ok
check.script_finish-ticket-owner.sh=ok
check.script_finish-ticket-owner.sh_executable=ok
check.script_merge-ready-ticket.sh=ok
check.script_merge-ready-ticket.sh_executable=ok
check.script_update-wiki.sh=ok
check.script_update-wiki.sh_executable=ok
check.script_start-plan.sh=ok
check.script_start-plan.sh_executable=ok
check.script_start-todo.sh=ok
check.script_start-todo.sh_executable=ok
check.script_handoff-todo.sh=ok
check.script_handoff-todo.sh_executable=ok
check.script_start-verifier.sh=ok
check.script_start-verifier.sh_executable=ok
check.script_start-spec.sh=ok
check.script_start-spec.sh_executable=ok
check.script_integrate-worktree.sh=ok
check.script_integrate-worktree.sh_executable=ok
check.script_write-verifier-log.sh=ok
check.script_write-verifier-log.sh_executable=ok
check.script_invoke-runtime-sh.ps1=ok
check.script_runner-common.ps1=ok
check.script_codex-stop-hook.ps1=ok
check.script_check-stop.ps1=ok
check.script_install-stop-hook.ps1=ok
check.script_set-thread-context.ps1=ok
check.script_clear-thread-context.ps1=ok
check.script_start-ticket-owner.ps1=ok
check.script_verify-ticket-owner.ps1=ok
check.script_finish-ticket-owner.ps1=ok
check.script_merge-ready-ticket.ps1=ok
check.script_start-spec.ps1=ok
check.script_start-plan.ps1=ok
check.script_start-todo.ps1=ok
check.script_handoff-todo.ps1=ok
check.script_start-verifier.ps1=ok
check.script_integrate-worktree.ps1=ok
check.script_write-verifier-log.ps1=ok
check.script_run-hook.ps1=ok
check.script_watch-board.ps1=ok
check.project_root_marker=ok
project_root_marker_value=..
check.project_root_marker_resolves=ok
project_root_marker_resolved=/Users/demoon/Documents/project/autoflow
check.project_root_marker_matches_host=ok
check.board_version_marker=ok
board_version=0.1.0
package_version=0.1.0
check.board_version_matches_package=ok
check.starter_heartbeat_set_toml=ok
check.starter_file_watch_psd1=ok
check.starter_README_md=ok
check.starter__gitignore=ok
check.starter_README_md=ok
check.starter_backlog_md=ok
check.starter_backlog_processed_md=ok
check.starter_project_spec_template_md=ok
check.starter_feature_spec_template_md=ok
check.starter_plan_md=ok
check.starter_plan_template_md=ok
check.starter_roadmap_md=ok
check.starter_runner_harness_md=ok
check.starter_wiki_md=ok
check.starter_tickets_board_md=ok
check.starter_ticket_template_md=ok
check.starter_logs_md=ok
check.starter_hook_logs_md=ok
check.starter_heartbeat_set_template_toml=ok
check.starter_ticket_owner_heartbeat_template_toml=ok
check.starter_plan_heartbeat_template_toml=ok
check.starter_todo_heartbeat_template_toml=ok
check.starter_verifier_heartbeat_template_toml=ok
check.starter_checklist_template_md=ok
check.starter_verification_template_md=ok
check.legacy_reject_ticket_names=ok
check.ticket_duplicate_ids=ok
check.ticket_template_Plan_Candidate=ok
check.ticket_template_Stage=ok
check.ticket_template_Claimed_By=ok
check.ticket_template_Execution_AI=ok
check.ticket_template_Verifier_AI=ok
doctor.passed_inprogress_recovery_pending_count=2
doctor.passed_inprogress_recovery_pending_tickets=tickets_016,tickets_021
check.passed_inprogress_recovery_pending=warning
doctor.ticket.012.file=/Users/demoon/Documents/project/autoflow/.autoflow/tickets/inprogress/tickets_012.md
doctor.ticket.012.state=inprogress
doctor.ticket.012.stage=executing
doctor.ticket.012.allowed_paths=.autoflow/automations/heartbeat-set.toml,.autoflow/runners/config.toml,.autoflow/runners/state/ (any other old-id state files to clean up),.autoflow/runners/state/owner-1.state (rename to worker.state),.autoflow/runners/state/planner-1.state (rename to planner.state),.autoflow/runners/state/wiki-1.state (rename to wiki-maintainer.state),.autoflow/scripts/merge-ready-ticket.sh (wiki-1 comment reference),AGENTS.md,CLAUDE.md,apps/desktop/src/renderer/main.tsx,bin/autoflow (CLI help text runner id examples)
check.ticket_012_allowed_paths=ok
check.ticket_012_shared_path_blockers=ok
doctor.ticket.012.blockers=
check.ticket_012_project_root_dirty_allowed_paths=warning
doctor.ticket.012.project_root_dirty_allowed_paths=.autoflow/runners/config.toml,AGENTS.md,apps/desktop/src/renderer/main.tsx
doctor.ticket.012.worktree_path=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_012
doctor.ticket.012.worktree_branch=autoflow/tickets_012
doctor.ticket.012.worktree_base_commit=cce1ea5dacf0d14adfb4aec5039037d9553d54f0
doctor.ticket.012.integration_status=pending
doctor.ticket.012.worktree_head=cce1ea5dacf0d14adfb4aec5039037d9553d54f0
doctor.ticket.012.worktree_actual_branch=autoflow/tickets_012
check.ticket_012_worktree=ok
doctor.ticket.012.worktree_status=ok
check.ticket_012_risk_hints=warning
doctor.ticket.012.blocker_hint=out_of_scope_or_snapshot_risk
doctor.ticket.016.file=/Users/demoon/Documents/project/autoflow/.autoflow/tickets/inprogress/tickets_016.md
doctor.ticket.016.state=inprogress
doctor.ticket.016.stage=executing
doctor.ticket.016.allowed_paths=apps/desktop/src/renderer/main.tsx (add data-runner-role and data-runner-count attributes to the AI progress board container and cells)
check.ticket_016_allowed_paths=ok
check.ticket_016_shared_path_blockers=ok
doctor.ticket.016.blockers=
check.ticket_016_project_root_dirty_allowed_paths=ok
doctor.ticket.016.project_root_dirty_allowed_paths=
doctor.ticket.016.worktree_path=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_016
doctor.ticket.016.worktree_branch=autoflow/tickets_016
doctor.ticket.016.worktree_base_commit=14295dc36619674559bc977d47d12274e37eceed
doctor.ticket.016.integration_status=pending
doctor.ticket.016.worktree_head=14295dc36619674559bc977d47d12274e37eceed
doctor.ticket.016.worktree_actual_branch=autoflow/tickets_016
check.ticket_016_worktree=ok
doctor.ticket.016.worktree_status=ok
check.ticket_016_risk_hints=ok
doctor.ticket.016.blocker_hint=
doctor.ticket.020.file=/Users/demoon/Documents/project/autoflow/.autoflow/tickets/inprogress/tickets_020.md
doctor.ticket.020.state=inprogress
doctor.ticket.020.stage=executing
doctor.ticket.020.allowed_paths=.autoflow/scripts/common.sh,.autoflow/scripts/merge-ready-ticket.sh,.autoflow/scripts/start-ticket-owner.sh,packages/cli/doctor-project.sh,runtime/board-scripts/common.sh,runtime/board-scripts/merge-ready-ticket.sh,runtime/board-scripts/start-ticket-owner.sh
check.ticket_020_allowed_paths=ok
check.ticket_020_shared_path_blockers=ok
doctor.ticket.020.blockers=
check.ticket_020_project_root_dirty_allowed_paths=ok
doctor.ticket.020.project_root_dirty_allowed_paths=
doctor.ticket.020.worktree_path=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020
doctor.ticket.020.worktree_branch=autoflow/tickets_020
doctor.ticket.020.worktree_base_commit=9dfdec4cd10caa5a0bf259984a32257d7eda25ec
doctor.ticket.020.integration_status=pending
doctor.ticket.020.worktree_head=049209895508984a9418dc02ff4d7a1cc088088e
doctor.ticket.020.worktree_actual_branch=autoflow/tickets_020
check.ticket_020_worktree=ok
doctor.ticket.020.worktree_status=ok
check.ticket_020_risk_hints=ok
doctor.ticket.020.blocker_hint=
doctor.ticket.021.file=/Users/demoon/Documents/project/autoflow/.autoflow/tickets/inprogress/tickets_021.md
doctor.ticket.021.state=inprogress
doctor.ticket.021.stage=ready_to_merge
doctor.ticket.021.allowed_paths=apps/desktop/src/components/ui/,apps/desktop/src/renderer/,apps/desktop/src/renderer/main.tsx,apps/desktop/src/renderer/styles.css
check.ticket_021_allowed_paths=ok
check.ticket_021_shared_path_blockers=warning
doctor.ticket.021.blockers=tickets_012:apps/desktop/src/renderer/main.tsx
check.ticket_021_project_root_dirty_allowed_paths=warning
doctor.ticket.021.project_root_dirty_allowed_paths=apps/desktop/src/renderer/,apps/desktop/src/renderer/main.tsx,apps/desktop/src/renderer/styles.css
doctor.ticket.021.worktree_path=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_021
doctor.ticket.021.worktree_branch=autoflow/tickets_021
doctor.ticket.021.worktree_base_commit=049209895508984a9418dc02ff4d7a1cc088088e
doctor.ticket.021.integration_status=blocked_dirty_scope_conflict
doctor.ticket.021.worktree_head=f1b2b0186041ba7fd33ff06305460b49af9bdb47
doctor.ticket.021.worktree_actual_branch=autoflow/tickets_021
check.ticket_021_worktree=ok
doctor.ticket.021.worktree_status=ok
check.ticket_021_risk_hints=ok
doctor.ticket.021.blocker_hint=
doctor.active_ticket_count=4
doctor.shared_path_blocked_ticket_count=1
doctor.worktree_issue_count=0
doctor.project_root_dirty_overlap_count=2
doctor.risk_hint_ticket_count=1
doctor.shared_nonbase_head_group_count=0
check.operational_blockers=warning
check.board_initialized=ok
warning.1=runner self-improve-1 has unsupported role=self-improve; expected ticket-owner, planner, todo, verifier, wiki-maintainer, coordinator, doctor, or watcher
warning.2=handoff is not under conversations/prd_NNN/: /Users/demoon/Documents/project/autoflow/.autoflow/conversations/prd_022/spec-handoff.md
warning.3=passed inprogress ticket(s) still need auto-resume finish-pass: tickets_016,tickets_021
warning.4=ticket 012 Allowed Paths overlap dirty PROJECT_ROOT paths: .autoflow/runners/config.toml,AGENTS.md,apps/desktop/src/renderer/main.tsx
warning.5=ticket 012 contains notes that hint at out-of-scope, shared-head, project-root fallback, or worktree snapshot risk
warning.6=ticket 021 is blocked by lower-number active ticket Allowed Paths: tickets_012:apps/desktop/src/renderer/main.tsx
warning.7=ticket 021 Allowed Paths overlap dirty PROJECT_ROOT paths: apps/desktop/src/renderer/,apps/desktop/src/renderer/main.tsx,apps/desktop/src/renderer/styles.css
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-04-27T14:19:03Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 020 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
