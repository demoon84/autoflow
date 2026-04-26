# Verification Template

## Meta

- Project Key: project_001
- Ticket ID: 003
- Target: tickets_003.md
- Status: passed
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_003]]
- Verification Note: [[verify_003]]

## Checks

- [x] spec reference confirmed
- [x] allowed paths respected
- [x] implementation completed
- [x] manual or automated verification passed

## Findings

- pass: `autoflow upgrade` adds missing runner/wiki scaffold to existing boards and reports scaffold counters.
- pass: Existing runner config, wiki index, runner state, metrics, conversation summary, ticket, log, and automation state files kept the same hashes across upgrade.
- warning: PowerShell behavior was aligned in code but not executed locally because `pwsh`/`powershell` is unavailable in this environment.

## Next Fix Hint

- No follow-up required for this ticket.

## Evidence

- Spec reference exists: `tickets/done/project_001/project_001.md`.
- Worktree root: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_003_local`.
- Worktree commit integrated into `PROJECT_ROOT`: `65cd1c340e5e894c845b2987bfe1e6c9c77abc9a`.
- Changed implementation files are within allowed paths: `scripts/cli/upgrade-project.sh` and `scripts/cli/upgrade-project.ps1`.
- `bash -n scripts/cli/upgrade-project.sh scripts/cli/package-board-common.sh` passed.
- Smoke project: `/tmp/autoflow-upgrade-verify.WA03my`.
- First upgrade returned `status=upgraded`, `scaffold_directories_created=7`, `scaffold_files_created=23`, `scaffold_files_present=2`.
- Status after first upgrade returned `runner_scaffold_present=true` and `wiki_scaffold_present=true`.
- Second upgrade returned `status=already_current`, `managed_files_created=0`, `managed_files_updated=0`, `scaffold_files_created=0`, `scaffold_files_present=25`, `backups_created=0`.
- Hash comparison for existing runner config, wiki index, runner state, metrics, conversation summary, ticket, log, and automation state files returned no diff.
- Self-host board upgrade returned `status=upgraded` on the first run, then `status=already_current` with `managed_files_updated=0` and `backups_created=0` on the second run.
- `./bin/autoflow status .` now reports `runner_scaffold_present=true`, `wiki_scaffold_present=true`, `ticket_done_count=5`, and `ticket_blocked_count=0`.
- `./bin/autoflow doctor .` now returns `status=ok`, `error_count=0`, `warning_count=0`, `check.runner_scaffold=ok`, and `check.wiki_scaffold=ok`.
- `rg "tickets/runs"` across the updated README/template/doctor/package-board files returned no matches.

## Notes

- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_003]]`, `[[verify_003]]`) 으로 적는다.
