# Ticket

## Ticket

- ID: Todo-156
- PRD Key: prd_157
- Plan Candidate: Plan AI handoff from tickets/done/prd_157/prd_157.md
- Title: Reasoning level 동적 dispatch — tick 복잡도 기반 reasoning 자동 선택
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T13:25:42Z

## Goal

- 이번 작업의 목표: `AUTOFLOW_REASONING_DYNAMIC_ENABLED=1` 일 때 `packages/cli/run-role.sh` 가 adapter 호출 직전에 tick 복잡도를 추정해 simple tick 은 low, normal tick 은 medium, complex/recovery/reject tick 은 high reasoning 으로 dispatch 하도록 구현한다. 환경변수가 꺼져 있거나 어댑터가 reasoning level 을 지원하지 않으면 기존 config reasoning 을 유지한다.

## References

- PRD: tickets/done/prd_157/prd_157.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_157]]
- Plan Note:
- Ticket Note: [[Todo-156]]

## Allowed Paths

- packages/cli/run-role.sh
- packages/cli/cli-common.sh
- runtime/board-scripts/run-role.sh
- tests/smoke/runner-dynamic-reasoning-smoke.sh
- tests/smoke/runner-idle-preflight-skip-smoke.sh
- package.json

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-156`
- Branch: autoflow/Todo-156
- Base Commit: eae762b7ff1221491f7b224d48685035c42fc99c
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T13:17:16Z
- Started Epoch: 1777814236
- Updated At: 2026-05-03T13:25:43Z
- Tick Count: 3
- Time Used Seconds: 507
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 72899614

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `AUTOFLOW_REASONING_DYNAMIC_ENABLED=1` 상태에서 idle/no-actionable planner 또는 ticket tick 이 adapter 호출까지 가는 경우 effective reasoning 이 `low` 로 기록/출력된다.
- [x] 단일 PRD 또는 단일 todo claim 같은 normal tick 은 effective reasoning 이 `medium` 으로 기록/출력된다.
- [x] multi-PRD, reject replan, blocked recovery, `source=blocked-dirty-orchestration`, `source=iteration-no-progress` 같은 complex tick 은 effective reasoning 이 `high` 로 기록/출력된다.
- [x] `AUTOFLOW_REASONING_DYNAMIC_ENABLED=0` 또는 미설정 상태에서는 기존 `runners/config.toml` 의 `reasoning` 값을 그대로 사용한다.
- [x] dry-run adapter command, runner state, runner log 중 적어도 하나에서 default reasoning 과 dynamic effective reasoning 의 차이를 관찰할 수 있다.
- [x] `tests/smoke/runner-dynamic-reasoning-smoke.sh` 가 simple/normal/complex/disabled 케이스를 검증한다.
- [x] `tests/smoke/runner-idle-preflight-skip-smoke.sh` 회귀가 통과한다.
- [x] `npm run desktop:check` 통과.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_157` 에서 todo 티켓을 생성한 뒤 Allowed Paths / Done When / Verification 을 구현 가능한 범위로 좁혔다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 를 `tickets/done/prd_157/prd_157.md` 로 보관하고 `tickets/todo/Todo-156.md` 를 만들었다. Plan AI 는 wiki RAG 와 관련 완료 PRD를 확인했다.
- 재개 시 먼저 볼 것: `packages/cli/run-role.sh` / `runtime/board-scripts/run-role.sh` 의 dynamic reasoning helper, `tests/smoke/runner-dynamic-reasoning-smoke.sh`, 그리고 root/worktree 모두에서 통과한 verification evidence (`verify_156.md`). 남은 일은 finalizer bookkeeping 뿐이다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_157/prd_157.md at 2026-05-03T12:31:03Z.
- Planner context: wiki RAG query terms `reasoning dynamic dispatch`, `run-role.sh reasoning`, `AUTOFLOW_REASONING_DYNAMIC_ENABLED`, `token baseline`, `runner role` returned no direct prior dynamic-reasoning implementation. Relevant constraint: `wiki/architecture/runner-role-slugs.md` keeps internal runner ids stable; do not rename runner ids or config keys while adding dynamic reasoning.
- Planner context: related completed `tickets/done/prd_058/prd_058.md` explicitly left provider/model/reasoning settings out of a display-label change. Treat this ticket as the scoped follow-up that may change reasoning dispatch only, not runner topology or storage ids.
- Planner context: `tickets/done/prd_129/prd_129.md` documents token telemetry paths through `packages/cli/run-role.sh` and `packages/cli/cli-common.sh`; use those measurements as the baseline source for the 15% token reduction follow-up, but this ticket does not need to backfill historical telemetry.
- Planner context: `tickets/done/prd_155/prd_155.md` introduced idle input hash skip patterns. Dynamic reasoning must not break existing skip behavior; when a tick is skipped before adapter invocation, preserve the existing `*_inputs_unchanged` result.
- Implementation note: `runtime/board-scripts/run-role.sh` is included because installed/scaffold runtime behavior should stay aligned with the source CLI runner dispatch path.

- Runtime hydrated worktree dependency at 2026-05-03T13:17:15Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T13:17:14Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-156; run=tickets/inprogress/verify_156.md
- AI worker prepared resume at 2026-05-03T13:17:42Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-156; run=tickets/inprogress/verify_156.md
- Mini-plan (worker, 2026-05-03): `start-ticket-owner.sh` returned `status=resume`, `source=resume`, `worktree_status=ready`, `implementation_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-156`. Wiki pass was attempted twice with `bin/autoflow wiki query --term 'Reasoning level 동적 dispatch' --term 'AUTOFLOW_REASONING_DYNAMIC_ENABLED' --term 'run-role.sh reasoning' --rag` and a narrower `--term 'AUTOFLOW_REASONING_DYNAMIC_ENABLED' --rag`, but both timed out after 20s/10s; treating that timeout itself as evidence, I fell back to direct related context from `wiki/architecture/runner-role-slugs.md`, `tickets/done/prd_155/prd_155.md`, and `tickets/done/prd_129/prd_129.md`. Constraints carried forward: keep runner ids/config keys stable, preserve PRD-155 idle skip semantics (`*_inputs_unchanged` path must remain intact), and expose the selected reasoning through existing state/log/dry-run output paths rather than inventing a parallel telemetry channel. Plan: (1) add a tick-complexity classifier plus adapter reasoning-support gate in `packages/cli/run-role.sh`, (2) mirror the same runtime behavior in `runtime/board-scripts/run-role.sh`, (3) add smoke coverage for simple/normal/complex/disabled reasoning dispatch and rerun the idle preflight regression plus `npm run desktop:check`.
- Implementation (worker, 2026-05-03): added dynamic reasoning classification to `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh`, gated by `AUTOFLOW_REASONING_DYNAMIC_ENABLED` plus agent capability. The runner now records `configured_reasoning`, `effective_reasoning`, `reasoning_source`, and `reasoning_complexity` through dry-run output, runner state, and runner log while preserving configured reasoning when the env is off or the adapter lacks support.
- Verification (worker, 2026-05-03): `bash tests/smoke/runner-dynamic-reasoning-smoke.sh`, `bash tests/smoke/runner-idle-preflight-skip-smoke.sh`, and `npm run desktop:check` all passed in both the ticket worktree and PROJECT_ROOT after manual integration. Idle regression fixtures were updated to current board contracts (`order_*.md` for planner actionable input and direct `tickets/todo/*.md` fixture for ticket wake-up).
- Queued without worktree commit at 2026-05-03T13:25:42Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T13:25:41Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T13:25:42Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-156 deleted_branch=autoflow/Todo-156.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T13:25:42Z.
## Verification
- Run file: `tickets/done/prd_157/verify_156.md`
- Log file: `logs/verifier_156_20260503_132543Z_pass.md`
- Result: passed

## Result

- Summary: dynamic reasoning dispatch + smoke coverage
- Remaining risk: Complexity classification is intentionally heuristic and queue-shape based for dry-run/idle contexts. If planner actionable semantics expand again, the smoke fixtures may need another contract refresh even though the runtime gate itself is isolated.
