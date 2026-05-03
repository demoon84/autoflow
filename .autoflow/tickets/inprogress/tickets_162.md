# Ticket

## Ticket

- ID: tickets_162
- PRD Key: prd_163
- Plan Candidate: Plan AI handoff from tickets/done/prd_163/prd_163.md
- Title: skill RAG injection and usage stats automation
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T14:16:42Z

## Goal

- 이번 작업의 목표: Phase 1/2 skill 인프라 위에 planner/worker prompt skill matching + injection, `autoflow skill apply ... --to-ticket ...` explicit invocation, `skill_used:` marker 기반 usage stats, verify pass/fail 기반 success/failure stats, low_confidence 다운랭킹을 구현한다.

## References

- PRD: tickets/done/prd_163/prd_163.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_163]]
- Plan Note:
- Ticket Note: [[tickets_162]]

## Allowed Paths

- `packages/cli/skill-project.sh`
- `bin/autoflow`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `.autoflow/wiki/skills-local/`
- `scaffold/board/wiki/skills-local/`
- `packages/cli/README.md`
- `tests/smoke/skill-injection-usage-stats-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_162`
- Branch: autoflow/tickets_162
- Base Commit: 0f7fce7ecc5fe1ce0271d4d799a9b08533f16564
- Worktree Commit: 
- Integration Status: blocked_dirty_project_root

## Goal Runtime
- Status: blocked
- Started At: 2026-05-03T14:16:43Z
- Started Epoch: 1777817803
- Updated At: 2026-05-03T14:23:52Z
- Tick Count: 0
- Time Used Seconds: 429
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: true
- Last Event: ticket_stage_blocked
- Last Progress Fingerprint: 1444529607

## Recovery State

- Status: repairing
- Detected By: runtime
- Failure Class: dirty_project_root_conflict
- Evidence: dirty Allowed Paths in PROJECT_ROOT: .autoflow/wiki/skills-local/ (resolved by earlier orchestration commits c9fe35f, bb4fa18, eb2beb7, f0a53b2). Residual dirty paths surfaced this tick: .autoflow/telemetry/runs.jsonl, .autoflow/tickets/inprogress/tickets_162.md, .autoflow/tickets/check/check_005.md — integrated via blocked-dirty orchestration cleanup commits this tick.
- Planner Decision: Integrate residual dirty paths into local housekeeping commits (orchestration cleanup) so next planner tick can emit source=blocked-auto-recover and return ticket to todo.
- Owner Resume Instruction: Wait for next planner tick to emit blocked-auto-recover and re-claim from todo; ticket-owner will rebuild a worktree from current main.
- Last Recovery At: 2026-05-03T14:22:00Z

## Done When

- [ ] planner/worker 가 새 작업 받을 때 매칭 skill (top-N) 이 prompt 에 자동 주입됨.
- [ ] LLM 응답의 `skill_used: <name>` marker 검출 + sidecar stats 자동 갱신.
- [ ] verify pass/fail 후 success_count / failure_count 자동 갱신.
- [ ] failure threshold 도달 skill 이 `state: low_confidence` 마킹 + 매칭 가중치 하향 (다음 매칭에서 후순위).
- [ ] `autoflow skill apply ... --to-ticket ...` 명시 호출 시 강제 주입 동작.
- [ ] `AUTOFLOW_SKILL_INJECTION_ENABLED=0` 으로 끄면 기존 동작.
- [ ] template 변수 (`${AUTOFLOW_BOARD_ROOT}` 등) 가 preprocessing 시 정상 치환.
- [ ] 7일 운영 후 skill 활용 통계 (전체 활용 횟수, top-3 skill, low_confidence 개수) 측정 가능.
- [ ] 결과 품질 (PRD 처리 / 검증 통과율) baseline ±3%p 이내.
- [ ] `npm run desktop:check` 통과.

## Next Action
- Runtime wait: PROJECT_ROOT has dirty changes in this ticket's Allowed Paths (.autoflow/wiki/skills-local/). Commit/stash those changes or intentionally integrate them before ticket-owner continues.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_163`에서 todo 티켓을 생성했고, PRD 기준으로 Allowed Paths / Next Action / Verification 을 구현 가능한 Phase 3 범위로 좁혔다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` 가 `source=backlog-to-todo`, `todo_ticket=tickets_162.md`, `lint_status=ok`, `lint_vagueness_score=0`를 반환했다. Plan AI 는 wiki RAG와 선행 done ticket context를 확인했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_163/prd_163.md`, `tickets/done/prd_160/prd_160.md`, `tickets/done/prd_162/prd_162.md`, `packages/cli/skill-project.sh`, `packages/cli/run-role.sh`, `.autoflow/scripts/finish-ticket-owner.sh`.
- Wiki/ticket constraints: `skill`/`Hermes` RAG는 `tickets/done/prd_160/order_146.md`, `tickets/done/prd_160/prd_160.md`, `tickets/done/prd_162/prd_162.md`를 반환했다. Phase 3는 Phase 1/2의 최종 폴더형 `.autoflow/wiki/skills-local/<category>/<name>/SKILL.md` + `.usage.json` schema를 재사용하고, 보안 scan/agentskills.io/desktop UI/deterministic mode는 후속 PRD 범위로 남긴다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_163/prd_163.md at 2026-05-03T13:03:48Z.
- Planner runtime: `.autoflow/scripts/start-plan.sh` returned `source=backlog-to-todo`, `todo_ticket=tickets_162.md`, `lint_status=ok`, `lint_vagueness_score=0`.
- Planner wiki pass: `bin/autoflow wiki query --term "Hermes skill injection RAG explicit invocation usage stats skill apply" --rag` returned `result_count=0`; broader `bin/autoflow wiki query --term "skill" --term "Hermes" --term "self-improvement" --limit 10 --rag` returned `tickets/done/prd_160/order_146.md`, `tickets/done/prd_160/prd_160.md`, and `tickets/done/prd_162/prd_162.md` as the relevant prior context.
- Planner wiki pass: `bin/autoflow wiki query --term "run-role" --term "runners-project" --term "backoff" --limit 10 --rag` returned `tickets/done/prd_044/prd_044.md`, `tickets/done/prd_044/tickets_044.md`, and `wiki/features/run-role-prompt-dispatch.md`; keep `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` prompt-dispatch behavior aligned while adding injection.
- Dependency decision: this ticket assumes the Phase 1/2 skill storage and curator tickets have landed first. If worker claims this ticket before `tickets_159`/`tickets_161` and `tickets_164` or their replacements establish `packages/cli/skill-project.sh`, `.autoflow/wiki/skills-local/.usage.json`, and Curator lifecycle conventions, update `Recovery State` instead of inventing a second schema.
- Active queue constraint: `tickets/inprogress/tickets_155.md`, `tickets_todo/tickets_156.md`, and `tickets_todo/tickets_158.md` already touch runner dispatch paths such as `packages/cli/run-role.sh`. The default single worker should serialize these; if manual/concurrent execution occurs, avoid overlapping edits and preserve the source/runtime run-role mirror contract.
- Scope decision: implement RAG-style matching/injection, explicit apply, preprocessing variables, usage stats, verify-result stats, low_confidence weighting, and `skill_used:` marker handling only. Do not implement Desktop skill UI, security scan, agentskills.io import/export, clustering, or deterministic mode here.
- Planner guard pass: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=1`; unresolved warning is the existing `tickets_119` leftover worktree with no board ticket. Planner did not delete or reset that worktree.

- Runtime hydrated worktree dependency at 2026-05-03T14:16:42Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-03T14:16:42Z; dirty_paths=.autoflow/wiki/skills-local/
- Blocked-dirty orchestration at 2026-05-03T14:22:00Z: residual dirty paths .autoflow/telemetry/runs.jsonl + .autoflow/tickets/inprogress/tickets_162.md + .autoflow/tickets/check/check_005.md integrated as PRD_163/tickets_162 cleanup commit and misc telemetry cleanup commit (see check_006.md). Next planner tick should emit source=blocked-auto-recover.
## Verification

- Command: `bash -lc 'bash -n packages/cli/skill-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh && tests/smoke/skill-injection-usage-stats-smoke.sh && npm run desktop:check'`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
