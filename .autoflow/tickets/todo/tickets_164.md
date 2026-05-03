# Ticket

## Ticket

- ID: tickets_164
- PRD Key: prd_166
- Plan Candidate: Plan AI handoff from tickets/done/prd_166/prd_166.md
- Title: skill curator lifecycle and auto-extraction triggers
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T13:11:02Z

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

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status: warn
- Last Lint Vagueness Score: 1

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

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

- 다음에 바로 이어서 할 일: Impl AI 는 `tickets_157`(PRD-158 prompt caching), `tickets_159`/`tickets_161`(Phase 1 skill 저장소)의 결과를 먼저 확인한 뒤 Curator, auto-extraction trigger, nudge guard, CLI 명령을 같은 schema 위에 구현한다.

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

## Verification

- Command: `bash -lc 'bash -n packages/cli/skill-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/curator-run.sh runtime/board-scripts/curator-run.sh && tests/smoke/skill-curator-auto-extract-smoke.sh && bash bin/autoflow skill curator-run "$PWD" .autoflow --once && npm run desktop:check'`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
