# Ticket

## Ticket

- ID: Todo-045
- PRD Key: prd_045
- Plan Candidate: Plan AI handoff from tickets/done/prd_045/prd_045.md
- Title: Trim start-plan runtime next_action output
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T06:34:20Z

## Goal

- 이번 작업의 목표: Reduce recurring planner prompt token overhead by replacing long static `next_action=` strings in `start-plan.sh` with short cues that point to the existing planner role instructions.

## References

- PRD: tickets/done/prd_045/prd_045.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_045]]
- Plan Note:
- Ticket Note: [[Todo-045]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-045`
- Branch: autoflow/Todo-045
- Base Commit: e26b4f17a22cd4435fa15d4035bd6709c4a0d52c
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [ ] The memo-inbox `next_action=` emitted by `.autoflow/scripts/start-plan.sh` is a concise one-line cue and no longer repeats the full memo promotion contract.
- [ ] The reject-replan, backlog-to-todo, and legacy-plan `next_action=` values in `.autoflow/scripts/start-plan.sh` are concise one-line cues.
- [ ] `runtime/board-scripts/start-plan.sh` carries the same shortened `next_action=` wording for the same branches.
- [ ] All branch status/source keys and file path outputs remain unchanged.
- [ ] `memo_016` remains a planner directive and does not become a question loop.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `.autoflow/scripts/start-plan.sh` 와 `runtime/board-scripts/start-plan.sh` 의 네 `next_action=` 문구를 축약했고, worktree 와 PROJECT_ROOT 양쪽에 동일하게 반영했다.
- 직전 작업: syntax/removed-fragment 검증을 worktree 와 PROJECT_ROOT 에서 통과했고 `tickets/inprogress/verify_045.md` 에 evidence 를 기록했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_045.md`, PROJECT_ROOT diff, finish-ticket-owner finalizer 결과.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_045/prd_045.md at 2026-04-29T06:31:10Z.

- Runtime hydrated worktree dependency at 2026-04-29T06:31:17Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T06:31:17Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-045; run=tickets/inprogress/verify_045.md
- AI worker-1 prepared resume at 2026-04-29T06:31:48Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-045; run=tickets/inprogress/verify_045.md
- Mini-plan at 2026-04-29T06:32:23Z:
  - Wiki context pass found no direct `start-plan.sh next_action` prior record, then found related prompt-shape context in [[run-role-prompt-dispatch]] and `tickets/done/prd_044/Todo-044.md`; treat runtime output wording as an acceptance surface and keep source/runtime copies aligned.
  - Shorten only the natural-language `next_action=` values for reject-replan, memo-inbox, backlog-to-todo, and legacy-plan branches in `.autoflow/scripts/start-plan.sh` and `runtime/board-scripts/start-plan.sh`.
  - Preserve branch `status=`, `source=`, path outputs, and dynamic identifiers; verify shell syntax and absence of the removed verbose fragments.
- Implementation at 2026-04-29T06:33:47Z: updated both allowed runtime script copies with identical concise `next_action=` values, manually merged the verified changes into PROJECT_ROOT, and reran verification from PROJECT_ROOT.
- Queued without worktree commit at 2026-04-29T06:34:20Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker-1 marked verification pass at 2026-04-29T06:34:20Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T06:34:20Z.
- Coordinator post-merge cleanup at 2026-04-29T06:34:20Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-045 deleted_branch=autoflow/Todo-045.
## Verification
- Run file: `tickets/done/prd_045/verify_045.md`
- Log file: `logs/verifier_045_20260429_063421Z_pass.md`
- Result: passed

## Result

- Summary: Shortened planner next_action output in current and source start-plan runtimes
- Remaining risk: Low; verification checked syntax, old verbose fragment absence, and unchanged machine-readable branch outputs.
