# Ticket

## Ticket

- ID: tickets_164
- PRD Key: prd_166
- Plan Candidate: Plan AI handoff from tickets/done/prd_166/prd_166.md
- Title: skill curator lifecycle and auto-extraction triggers
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-04T01:58:45Z

## Goal

- 이번 작업의 목표: Phase 1 skill 저장소 위에 Wiki AI 소유 Curator lifecycle, auto-extraction trigger, nudge guard, 관련 CLI/정책 문서를 추가한다.

## References

- PRD: tickets/done/prd_166/prd_166.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_166]]
- Plan Note:
- Ticket Note: [[tickets_164]]

## Allowed Paths

- `.autoflow/scripts/curator-run.sh`
- `runtime/board-scripts/curator-run.sh`
- `packages/cli/skill-project.sh`
- `bin/autoflow`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `.autoflow/agents/wiki-maintainer-agent.md`
- `scaffold/board/agents/wiki-maintainer-agent.md`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `AGENTS.md`
- `scaffold/host/AGENTS.md`
- `.autoflow/wiki/skills-local/`
- `scaffold/board/wiki/skills-local/`
- `packages/cli/README.md`
- `tests/smoke/skill-curator-auto-extract-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_164`
- Branch: autoflow/tickets_164
- Base Commit: 8f558c53d8e12111609e135e837f1f2c1d2f54d9
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-04T01:16:17Z
- Started Epoch: 1777857377
- Updated At: 2026-05-04T01:59:03Z
- Tick Count: 10
- Time Used Seconds: 2566
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: true
- Last Event: no_board_progress
- Last Progress Fingerprint: 1789948040

## Recovery State

- Status: healthy
- Detected By: planner
- Failure Class: dirty_root
- Evidence: PROJECT_ROOT no longer reports dirty Allowed Paths overlapping this ticket; auto-recovered at 2026-05-04T01:15:37Z.
- Planner Decision: Integrated the current runtime-listed dirty PROJECT_ROOT paths plus the runtime-created check ledger as local commit `ab32dbd` (`[PRD_166][ticket_164] orchestration cleanup: blocked dirty runtime evidence`) because they are board/runtime housekeeping paths and no active ticket Allowed Paths more specifically owns them. The next planner tick should surface `source=blocked-auto-recover` if PROJECT_ROOT remains clean except for non-runtime-listed wiki drift.
- Owner Resume Instruction: Continue the fresh claim from current main; reuse the existing PRD, Allowed Paths, and Done When.
- Last Recovery At: 2026-05-04T01:15:37Z

## Done When

- [ ] Curator 가 7일 주기 + idle 시점에 자동 동작 (시뮬레이션으로 즉시 trigger 가능).
- [ ] 30일 unused skill 이 stale 마킹, 90일 unused 가 archive 이동 확인.
- [ ] Pinned skill 이 모든 transition 우회.
- [ ] **Auxiliary client 사용으로 main session prompt cache 가 깨지지 않음** (PRD-158 cache hit rate 모니터링).
- [ ] 4개 trigger 가 정상 동작 — 각각 시뮬레이션으로 skill 1건씩 생성 확인.
- [ ] Nudge 가 N tick 마다 정상 trigger, 재귀 방지 flag 동작.
- [ ] `AUTOFLOW_CURATOR_ENABLED=0` 으로 끄면 기존 동작 유지.
- [ ] 7일 운영 후 skills-local/ 누적 증가 + archive 이동 패턴 확인.
- [ ] `npm run desktop:check` 통과.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog `prd_166`을 `tickets_164`로 승격하고, Phase 2 Curator/auto-extraction 범위로 Allowed Paths를 좁혔다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 166`가 `source=backlog-to-todo`, `todo_ticket=tickets_164.md`, `lint_status=warn`, `lint_vagueness_score=1`을 반환했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_166/prd_166.md`, `tickets/todo/tickets_157.md`, `tickets/inprogress/tickets_159.md`, `tickets/todo/tickets_161.md`, `packages/cli/skill-project.sh`, `packages/cli/run-role.sh`, `.autoflow/scripts/finish-ticket-owner.sh`, `.autoflow/scripts/start-plan.sh`.
- Wiki/ticket constraints: `bin/autoflow wiki query --term "Hermes skill security scan agentskills clustering deterministic mode PRD 165 Phase 5" --term "skill curator auto-extraction trigger auxiliary client PRD 166 Phase 2" --term "skill registry RAG injection desktop skill UI PRD 162 PRD 163 PRD 164 dependencies" --limit 12 --rag` returned `result_count=0`. Current ticket evidence shows `tickets_162`/`tickets_163` are downstream Phase 3/4 work and should not define a second skill schema if this Phase 2 ticket has not landed.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_166/prd_166.md at 2026-05-03T13:10:38Z.
- Planner dependency decision: `prd_166` was promoted before backlog `prd_165` because `prd_165` is Phase 5 and `prd_166` is the missing Phase 2 Curator layer. Keep Phase 5 security/import/clustering/deterministic mode out of this ticket.
- Scope decision: implement Curator lifecycle, four auto-extraction triggers, nudge recursion guard, and CLI/status commands only. Do not implement RAG prompt injection, Desktop skill UI, security scan, agentskills import/export, clustering, meta-skill, or deterministic execution here.
- Dependency decision: if Phase 1 storage/CLI schema from `tickets_159` or `tickets_161` is not available when this ticket is claimed, update `Recovery State` with a dependency blocker instead of inventing another schema.
- Active queue constraint: this ticket touches `packages/cli/run-role.sh`, `.autoflow/scripts/common.sh`, `.autoflow/scripts/finish-ticket-owner.sh`, and `.autoflow/scripts/start-plan.sh`; the default single worker should serialize those edits against `tickets_156`, `tickets_158`, `tickets_159`, and `tickets_162`.
- Guard evidence: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=1`; unresolved warning is the existing `tickets_119` leftover worktree with no board ticket. Planner did not delete or reset that worktree.

- Runtime hydrated worktree dependency at 2026-05-04T00:21:07Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-04T00:50:48Z; dirty_paths=.autoflow/wiki/skills-local/
- Planner blocked-dirty orchestration at 2026-05-04T00:53:02Z: runtime-listed board/runtime housekeeping paths were integrated in commit `b817ea7` for `prd_166` / `tickets_164`; wiki context did not surface a contrary constraint in the existing ticket Resume Context (`result_count=0` for the same skill-curator PRD_166 query).
- Planner blocked-dirty orchestration at 2026-05-04T00:57:32Z: runtime-listed board/runtime housekeeping paths were integrated in commit `f95fa37` for `prd_166` / `tickets_164`; wiki context query `tickets_164 dirty_root telemetry runs check_179` returned `result_count=0`, so no prior wiki/ticket constraint changed the cleanup decision.
- Guard evidence: `autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved warnings are the existing `tickets_119` leftover worktree with no board ticket and `tickets_163` dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`. Planner did not delete or reset those worktrees.
- Planner blocked-dirty orchestration at 2026-05-04T01:01:31Z: runtime-listed board/runtime housekeeping paths plus the runtime-created `tickets/check/check_182.md` ledger were integrated in commit `6706c41` for `prd_166` / `tickets_164`; wiki context query for the current dirty-root/check-ledger terms returned `result_count=0`.
- Guard evidence: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved warnings remain the existing `tickets_119` leftover worktree with no board ticket and `tickets_163` dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`. Planner did not delete or reset those worktrees.
- Planner blocked-dirty orchestration at 2026-05-04T01:04:56Z: runtime-listed board/runtime housekeeping paths plus the runtime-created `tickets/check/check_184.md` ledger were integrated in commit `0f1a2e2` for `prd_166` / `tickets_164`. The wiki query for this tick did not return before the cleanup decision; no contrary wiki constraint was present in the existing ticket recovery context.
- Guard evidence: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved warnings remain the existing `tickets_119` leftover worktree with no board ticket and `tickets_163` dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`. Planner did not delete or reset those worktrees.
- Planner blocked-dirty orchestration at 2026-05-04T01:10:33Z: runtime-listed board/runtime housekeeping paths plus the runtime-created `tickets/check/check_186.md` ledger were integrated in commit `2728283` for `prd_166` / `tickets_164`. Wiki query for `tickets_164 dirty_root runner health telemetry runs` returned `result_count=0`, so no prior wiki/ticket constraint changed the cleanup decision. `git status --short` after cleanup showed remaining dirty path `.autoflow/wiki/agents/prompt-evolution.md`, which was not part of this runtime's `dirty_paths` and was not staged or reset by planner.
- Guard evidence: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved warnings remain the existing `tickets_119` leftover worktree with no board ticket and `tickets_163` dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`. Planner did not delete or reset those worktrees.
- Planner blocked-dirty orchestration at 2026-05-04T01:14:25Z: runtime-listed board/runtime housekeeping paths plus the runtime-created `tickets/check/check_188.md` ledger were integrated in commit `ab32dbd` for `prd_166` / `tickets_164`. Wiki context did not surface a contrary constraint; remaining dirty path `.autoflow/wiki/agents/prompt-evolution.md` was not part of this runtime's `dirty_paths` and was not staged or reset by planner.
- Guard evidence: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved warnings remain the existing `tickets_119` leftover worktree with no board ticket and `tickets_163` dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`. Planner did not delete or reset those worktrees.
- Auto-recovery at 2026-05-04T01:15:37Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Cleaned stale todo worktree metadata at 2026-05-04T01:16:14Z: removed already-merged worktree /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_164 before fresh claim.
- Runtime hydrated worktree dependency at 2026-05-04T01:16:15Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-04T01:16:14Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_164; run=tickets/inprogress/verify_164.md
- AI worker prepared resume at 2026-05-04T01:58:45Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_164; run=tickets/inprogress/verify_164.md
- Goal runtime suppressed continuation at 2026-05-04T01:59:03Z: adapter worker exited 0 without changing durable ticket state. Update Notes, Resume Context, Verification, Result, or finish/reject before relying on another identical tick.
## Verification
- Run file: `tickets/inprogress/verify_164.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
