# Ticket

## Ticket

- ID: tickets_005
- Project Key: project_001
- Plan Candidate: Update README and reference docs to describe Autoflow as a local coding-agent harness with board ledger and wiki map.
- Title: Document the local agent harness and wiki direction
- Stage: done
- Owner: verify-1
- Claimed By: todo-1
- Execution Owner: unassigned
- Verifier Owner: verify-1
- Last Updated: 2026-04-24T23:18:03Z

## Goal

- 이번 작업의 목표: repository and generated-board docs clearly describe Autoflow as a local coding-agent harness where the board is the execution ledger and the wiki is derived project knowledge.

## References

- Project Spec: tickets/done/project_001/project_001.md
- Feature Spec:
- Plan Source: tickets/inprogress/plan_001.md

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]
- Ticket Note: [[tickets_005]]

## Allowed Paths

- README.md
- reference/
- rules/
- agents/
- templates/board/README.md
- templates/host-AGENTS.md
- plan.md

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005_local`
- Branch: codex/autoflow-tickets-005
- Base Commit: 30f9b3a872bbadf4c3047b1e693a4906122d19b8
- Worktree Commit: c3717f62ec53ca3fa5ca7f47237cfa56ef7d134c
- Integration Status: integrated

## Done When

- [x] README states the new positioning: local work harness for Codex, Claude, OpenCode, Gemini CLI, and similar coding agents.
- [x] Docs distinguish board ledger from wiki map.
- [x] Docs describe `#autoflow` as spec handoff only, with execution handled by Autoflow runners later.
- [x] Docs make clear that runner execution and desktop terminal controls are later phases if not implemented yet.
- [x] Existing `#spec`, `#plan`, `#todo`, `#veri` workflow documentation remains accurate.

## Next Action
- Complete. No further action for this ticket.

## Resume Context
- Current state: verifier passed after resolving README/reference wording overlap.
- Last runtime action: `integrate-worktree.sh tickets/verifier/tickets_005.md` produced worktree commit `c3717f62ec53ca3fa5ca7f47237cfa56ef7d134c`; conflicts were resolved in `PROJECT_ROOT`.
- Next reader: use the linked verification record and completion log for evidence.

## Notes

- Avoid over-documenting features that are not implemented yet. Mark future runner execution clearly as planned.

- Claimed by todo-1 at 2026-04-24T22:58:16Z; execution=unassigned; verifier=unassigned; worktree=/Users/demoon/Documents/project/autoflow
- Worktree corrected to `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005_local` on branch `codex/autoflow-tickets-005` after fixed branch name was already used by another worktree.
- Updated root README with Autoflow positioning as a local work harness for Codex, Claude Code, OpenCode, and Gemini CLI.
- Added board ledger / wiki map / runners process-state distinction.
- Documented `#autoflow` as planned spec handoff alias and clarified that existing `#spec`, `#plan`, `#todo`, `#veri` flow remains current behavior.
- Updated generated board README and host AGENTS template with the same direction.
- Updated `agents/spec-author-agent.md` and `reference/README.md` to name the handoff intent without creating runtime behavior.
- Verification run from worktree: `grep` confirmed target wording across docs.
- Verification run from worktree: `git diff --check` passed.
- Handed off to verifier at 2026-04-24T23:00:48Z via scripts/handoff-todo.*
- Verifier prepared by verify-1 via scripts/start-verifier.sh at 2026-04-24T23:00:52Z
- Worktree integration blocked at 2026-04-24T23:01:01Z: PROJECT_ROOT has non-board dirty files. Commit/stash unrelated changes before integrating this ticket.
- Verifier evidence: `git diff --check` passed; grep confirmed required wording; changed files are within allowed paths. Pass is blocked only by central dirty-root protection.
- Allowed path was not present in worktree during integration at 2026-04-24T23:16:36Z, so it was skipped: plan.md
- Worktree integration hit a cherry-pick conflict at 2026-04-24T23:16:36Z: c3717f62ec53ca3fa5ca7f47237cfa56ef7d134c. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying.
- 2026-04-24T23:18:03Z: Resolved documentation overlap, confirmed required wording with grep, ran `git diff --check`, and marked integration as passed.
- Allowed path was not present in worktree during integration at 2026-04-24T23:16:36Z, so it was skipped: plan.md
- Worktree integration hit a cherry-pick conflict at 2026-04-24T23:16:36Z: c3717f62ec53ca3fa5ca7f47237cfa56ef7d134c. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying.
## Verification
- Run file: `tickets/done/project_001/verify_005.md`
- Log file: `logs/verifier_005_20260424_231826Z_pass.md`
- Result: passed

## Result

- Summary: Documented Autoflow as a local coding-agent harness with board ledger, planned wiki map, and planned `#autoflow` spec handoff direction.
- Remaining risk: This ticket updates docs only; runtime alias and local runner execution remain later phases.
