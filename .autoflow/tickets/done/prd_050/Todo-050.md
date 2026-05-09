# Ticket

## Ticket

- ID: Todo-050
- PRD Key: prd_050
- Plan Candidate: Plan AI handoff from tickets/done/prd_050/prd_050.md
- Title: Gate and trim wiki semantic lint prompts
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T07:50:47Z

## Goal

- 이번 작업의 목표: Reduce recurring Wiki AI adapter token usage by skipping unchanged semantic lint runs and sending shorter wiki page context when lint does run.

## References

- PRD: tickets/done/prd_050/prd_050.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_050]]
- Plan Note:
- Ticket Note: [[Todo-050]]

## Allowed Paths

- `packages/cli/wiki-project.sh`
- `tests/smoke/wiki-semantic-lint-change-gate-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-050`
- Branch: autoflow/Todo-050
- Base Commit: d3734813de7c48f955d8c42ffd83a011fd3363d6
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [x] `run_semantic_lint` computes a wiki input fingerprint from the markdown files it would send to the adapter.
- [x] After a successful semantic lint adapter run, the fingerprint is recorded in board/runner state.
- [x] A later semantic lint run with the same wiki input fingerprint returns a skipped status without invoking the adapter.
- [x] Changing a wiki markdown page changes the fingerprint and allows semantic lint to invoke the adapter again.
- [x] The semantic lint prompt no longer includes the first 220 lines of every wiki page; each page is capped to roughly the first 80 lines or a comparably smaller deterministic summary.
- [x] Existing `semantic_status=skipped_no_adapter`, `semantic_status=failed`, `semantic_status=ok`, and `semantic_finding.*` output contracts remain parseable.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: semantic lint가 wiki markdown 입력 fingerprint를 계산하고, 성공한 adapter 실행 후 `runners/state/<runner>.semantic-lint.fingerprint`에 기록하며, 동일 fingerprint 재실행은 `semantic_status=skipped_unchanged`로 adapter 호출 없이 반환한다.
- 직전 작업: worktree와 PROJECT_ROOT 모두에서 `bash -n packages/cli/wiki-project.sh tests/smoke/wiki-semantic-lint-change-gate-smoke.sh && bash tests/smoke/wiki-semantic-lint-change-gate-smoke.sh && bash tests/smoke/wiki-runner-idle-skip-smoke.sh`가 exit 0으로 통과했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_050.md` evidence와 PROJECT_ROOT의 `packages/cli/wiki-project.sh`, `tests/smoke/wiki-semantic-lint-change-gate-smoke.sh`.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_050/prd_050.md at 2026-04-29T06:52:33Z.
- Wiki context: `./bin/autoflow wiki query --term "wiki semantic lint run_semantic_lint maybe_skip_unchanged_wiki_turn packages/cli/wiki-project.sh"` returned `result_count=0`, so no wiki-derived prior decision constrains this scope.
- Ticket history context: `tickets/done/prd_006/*` previously introduced `autoflow wiki query --synth` and `autoflow wiki lint --semantic`; preserve semantic lint output keys and no-adapter behavior.
- Repository pattern: `tests/smoke/wiki-runner-idle-skip-smoke.sh` demonstrates the existing fingerprint-and-skip runner pattern and fake adapter invocation-count assertion style.
- Scope guard: do not change wiki synthesis, wiki query, non-semantic lint, runner topology, ticket lifecycle, or `.autoflow/wiki/` generated pages.
- Owner mini-plan (2026-04-29T07:44Z): add semantic lint page-list/content fingerprint helpers in `packages/cli/wiki-project.sh`, store successful fingerprints under `runners/state/<runner>.semantic-lint.fingerprint`, skip unchanged semantic lint before adapter invocation, reduce per-page prompt slice to 80 lines, and add an isolated smoke test covering first run, unchanged skip, changed wiki rerun, and prompt truncation.
- Current-turn wiki context: repeated `autoflow wiki query` terms found only this PRD (`tickets/done/prd_050/prd_050.md`) and no additional semantic lint output-contract records, so the implementation follows the ticket history note above and existing `wiki-runner-idle-skip-smoke.sh` pattern.

- Runtime hydrated worktree dependency at 2026-04-29T07:43:45Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T07:43:44Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-050; run=tickets/inprogress/verify_050.md
- AI worker-1 prepared resume at 2026-04-29T07:44:22Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-050; run=tickets/inprogress/verify_050.md
- Ticket owner verification passed by worker-1 at 2026-04-29T07:49:48Z: command exited 0
- Queued without worktree commit at 2026-04-29T07:50:47Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker-1 marked verification pass at 2026-04-29T07:50:47Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T07:50:47Z.
- Coordinator post-merge cleanup at 2026-04-29T07:50:47Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-050 deleted_branch=autoflow/Todo-050.
## Verification
- Run file: `tickets/done/prd_050/verify_050.md`
- Log file: `logs/verifier_050_20260429_075048Z_pass.md`
- Result: passed

## Result

- Summary: Added semantic lint fingerprint gate and prompt truncation smoke coverage.
- Remaining risk: Low; the new skip status is additive and existing `skipped_no_adapter`, `failed`, `ok`, and `semantic_finding.*` lines remain parseable.
