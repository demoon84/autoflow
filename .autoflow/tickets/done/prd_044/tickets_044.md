# Ticket

## Ticket

- ID: tickets_044
- PRD Key: prd_044
- Plan Candidate: Plan AI handoff from tickets/done/prd_044/prd_044.md
- Title: Sync runtime run-role prompt dispatch
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T05:35:13Z

## Goal

- 이번 작업의 목표: Bring `runtime/board-scripts/run-role.sh` back in line with `packages/cli/run-role.sh` for role-specific adapter prompt dispatch so each runner prompt emits only the boundary and required-flow lines relevant to the current role.

## References

- PRD: tickets/done/prd_044/prd_044.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_044]]
- Plan Note:
- Ticket Note: [[tickets_044]]

## Allowed Paths

- `runtime/board-scripts/run-role.sh`
- `packages/cli/run-role.sh`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_044`
- Branch: autoflow/tickets_044
- Base Commit: ede45be535b1f6a9daea2bada6eebf2a8ace9947
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [x] `runtime/board-scripts/run-role.sh` defines `role_boundary_for_current_role` with only the current role's boundary emitted for `ticket`, `planner`, `todo`, `verifier`, `wiki`, `coordinator`, and `self-improve` roles where applicable.
- [x] `runtime/board-scripts/run-role.sh` defines `role_specific_required_flow_items` so wiki context flow is emitted only for planner/ticket/todo style work and ticket-owner merge-judgment flow is emitted only for ticket-owner work.
- [x] Runtime `write_agent_prompt` uses the role-specific helper output rather than hardcoding all role boundary bullets and all role-specific Required-flow lines into every prompt.
- [x] Dry-run prompt output for `planner` includes the planner boundary but does not include ticket-owner-only merge-judgment text or every other role boundary.
- [x] Dry-run prompt output for `ticket` includes the ticket-owner merge-judgment required-flow text.
- [x] The implementation stays inside `runtime/board-scripts/run-role.sh` and `packages/cli/run-role.sh`.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `runtime/board-scripts/run-role.sh` 를 CLI의 role-specific prompt dispatch helper block에 맞춰 수정했고, 검증된 변경을 PROJECT_ROOT 에 수동 반영했다.
- 직전 작업: PROJECT_ROOT 에서 syntax/helper-block diff/planner dry-run/ticket dry-run acceptance 명령이 통과했다.
- 재개 시 먼저 볼 것: `runtime/board-scripts/run-role.sh` 의 `role_boundary_for_current_role`, `role_specific_required_flow_items`, `write_agent_prompt`, 그리고 `/tmp/autoflow-runtime-planner-prompt.txt`, `/tmp/autoflow-runtime-ticket-prompt.txt`.
- Planning constraint: `runtime/board-scripts/runners-project.sh` still invokes `${SCRIPT_DIR}/run-role.sh`, so synchronize the runtime copy instead of deleting it.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_044/prd_044.md at 2026-04-29T05:28:34Z.
- Wiki query command: `./bin/autoflow wiki query . --term "run-role.sh role-specific dispatch write_agent_prompt packages/cli runtime board-scripts 94946f2 token"`.
- Wiki/ticket context: query returned `result_count=0`; no prior completed ticket or wiki decision directly constrained this prompt-dispatch optimization.
- Repository context: `bin/autoflow` invokes `packages/cli/run-role.sh`, while `runtime/board-scripts/runners-project.sh` invokes `${SCRIPT_DIR}/run-role.sh`; therefore this ticket should synchronize the runtime copy rather than remove it.
- Repository context: current source drift is specifically that `packages/cli/run-role.sh` has role-specific prompt helpers, while `runtime/board-scripts/run-role.sh` hardcodes broad Required-flow and Role boundary prompt text in `write_agent_prompt`.
- Mini-plan: sync the role-specific helper functions from `packages/cli/run-role.sh` into `runtime/board-scripts/run-role.sh`, update runtime `write_agent_prompt` to consume helper output, then verify syntax, helper-block diff, and dry-run prompt behavior for `planner` and `ticket`.
- Wiki context: owner-run wiki query from project root returned `result_count=0` for `run-role role_specific_required_flow_items role_boundary_for_current_role write_agent_prompt` and `runtime board-scripts packages cli prompt dispatch ticket-owner merge judgment`; no prior wiki/ticket finding changes the implementation approach.
- Implementation: added `role_boundary_for_current_role` and `role_specific_required_flow_items` to `runtime/board-scripts/run-role.sh`, changed runtime `write_agent_prompt` to emit only role-specific helper output, and added a minimal `cli-common.sh` fallback so the runtime copy can execute from the repo layout during dry-run verification.
- Verification: passed from PROJECT_ROOT at 2026-04-29T05:33:27Z with `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh && diff -u <(sed -n '/^role_boundary_for_current_role()/,/^write_agent_prompt()/p' packages/cli/run-role.sh) <(sed -n '/^role_boundary_for_current_role()/,/^write_agent_prompt()/p' runtime/board-scripts/run-role.sh) && runtime/board-scripts/run-role.sh planner . .autoflow --runner planner-1 --dry-run >/tmp/autoflow-runtime-planner-prompt.txt && grep -q -- "- planner:" /tmp/autoflow-runtime-planner-prompt.txt && ! grep -q -- "AI owns implementation, verification judgment, and merge judgment" /tmp/autoflow-runtime-planner-prompt.txt && runtime/board-scripts/run-role.sh ticket . .autoflow --runner owner-1 --dry-run >/tmp/autoflow-runtime-ticket-prompt.txt && grep -q -- "AI owns implementation, verification judgment, and merge judgment" /tmp/autoflow-runtime-ticket-prompt.txt`.

- Runtime hydrated worktree dependency at 2026-04-29T05:29:15Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T05:29:14Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_044; run=tickets/inprogress/verify_044.md
- AI worker-1 prepared resume at 2026-04-29T05:29:31Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_044; run=tickets/inprogress/verify_044.md
- Queued without worktree commit at 2026-04-29T05:35:12Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker-1 marked verification pass at 2026-04-29T05:35:12Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T05:35:13Z.
- Coordinator post-merge cleanup at 2026-04-29T05:35:13Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_044 deleted_branch=autoflow/tickets_044.
## Verification
- Run file: `tickets/done/prd_044/verify_044.md`
- Log file: `logs/verifier_044_20260429_053513Z_pass.md`
- Result: passed

## Result

- Summary: Runtime run-role prompt dispatch now emits role-specific flow and boundary text
- Remaining risk: Low; runtime copy still has unrelated broader drift from CLI outside the prompt-dispatch helper block, as scoped by the PRD.
