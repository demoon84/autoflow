# Ticket

## Ticket

- ID: tickets_116
- PRD Key: prd_117
- Plan Candidate: Plan AI handoff from tickets/done/prd_117/prd_117.md
- Title: AI work for prd_117
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-02T23:04:49Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_117.

## References

- PRD: tickets/done/prd_117/prd_117.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_117]]
- Plan Note:
- Ticket Note: [[tickets_116]]

## Allowed Paths

- bin/autoflow
- packages/cli/memo-project.sh
- packages/cli/order-project.sh
- packages/cli/README.md
- apps/desktop/src/**
- .autoflow/scripts/start-plan.sh
- .autoflow/scripts/common.sh
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/spec-author-agent.md
- .autoflow/rules/**
- .autoflow/reference/memo.md
- .autoflow/reference/order.md
- .autoflow/automations/README.md
- .autoflow/runners/config.toml
- .autoflow/tickets/inbox/memo_*.md
- .autoflow/tickets/inbox/order_*.md
- .autoflow/tickets/done/prd_*/memo_*.md
- .autoflow/tickets/done/prd_*/order_*.md
- .claude/skills/order/SKILL.md
- .codex/skills/order/SKILL.md
- integrations/claude/skills/order/SKILL.md
- integrations/codex/skills/order/SKILL.md
- scaffold/board/reference/memo.md
- scaffold/board/reference/order.md
- scaffold/board/AGENTS.md
- scaffold/board/README.md
- scaffold/host/AGENTS.md
- scaffold/host/CLAUDE.md
- AGENTS.md
- CLAUDE.md
- README.md

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

## Recovery State

- Status: healthy
- Detected By: planner
- Failure Class: ambiguous_scope
- Evidence: Ticket was created from `prd_117` with placeholder Allowed Paths (`TODO: Plan AI must narrow this...`), which would make Impl AI claim unsafe. Wiki queries for `prd_117 order_NNN memo order rename Allowed Paths scanner inbox desktop` and `order inbox memo delete PRD terminology rename autoflow order create` returned `result_count=0`.
- Planner Decision: Replaced the placeholder with the concrete PRD-117 module paths, including old/new CLI script names, inbox/done data rename globs, Plan AI scanner scripts, desktop source, skills, docs, and scaffold references. No wiki/ticket finding constrained this narrowing.
- Owner Resume Instruction: Claim from todo and implement the atomic memo-to-order removal inside the listed paths only; use `git mv` for file renames that must preserve history and do not reintroduce backward-compat memo aliases.
- Last Recovery At: 2026-05-02T23:04:49Z

## Done When

- [ ] `autoflow order create <project-root> <board-dir-name> --title "test"` 가 `.autoflow/tickets/inbox/order_NNN.md` 를 생성하고, 본문 첫 줄이 `# Autoflow Order`, 두 번째 헤딩이 `## Order` 이다.
- [ ] `autoflow memo create ...` 호출 시 명령을 찾을 수 없다는 에러가 나거나, dispatch 가 의도적으로 제거되어 동작하지 않는다 (alias 부활 금지).
- [ ] `bin/autoflow --help` 출력에 `memo` 라는 단어가 등장하지 않고 `order` 만 노출된다.
- [ ] 데스크톱 앱에서 `npm run desktop:check` 가 통과한다 (TypeScript 미사용 식별자 / 빌드 에러 없음).
- [ ] 데스크톱 앱 핀 레이어(ORDER) 가 기존 `order_*.md` (rename 직후) 들을 정상 표시하고, 항목 클릭 시 본문 헤딩이 `# Autoflow Order` 로 보인다.
- [ ] `apps/desktop/src/`, `bin/`, `packages/cli/`, `.autoflow/agents/`, `.autoflow/rules/`, `.autoflow/reference/`, `scaffold/`, `.claude/skills/order/`, `.codex/skills/order/`, `integrations/{claude,codex}/skills/order/`, `AGENTS.md`, `CLAUDE.md`, `README.md` 에 대해 `grep -rni "memo" <path>` 결과가 의도된 잔재 (예: 이번 PRD 본문 자체, 마이그레이션 노트) 외에는 0건이다.
- [ ] `.autoflow/tickets/inbox/memo_*.md` 와 `.autoflow/tickets/done/prd_*/memo_*.md` 가 모두 `order_*.md` 로 rename 되었고, `git log --follow` 로 이전 history 가 추적된다.
- [ ] `.autoflow/reference/memo.md` 와 `scaffold/board/reference/memo.md` 가 `order.md` 로 rename 되어 더 이상 존재하지 않는다.
- [ ] `AGENTS.md`, `CLAUDE.md`, 스킬 SKILL.md 본문에 "backward compat", "memo 는 그대로 유지", "intentionally unchanged" 같은 backward-compat 설명문이 남아 있지 않다.
- [ ] Plan AI 가 새로 들어오는 `order_NNN.md` 를 정상 인지하고 generated PRD 로 승격할 수 있다 (스캐너 정규식 및 경로 식별).

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤, 위 Allowed Paths 안에서 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_117` 기반 ticket의 placeholder Allowed Paths를 PRD module 경로와 rename 대상 globs로 좁혀 Impl AI claim 가능 상태로 만들었다.
- 직전 작업: `autoflow wiki query --rag` 2건을 실행했고 관련 blocking finding 없이 `Allowed Paths`, `Recovery State`, `Next Action`, `Resume Context`를 갱신했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_117/prd_117.md`, 이 티켓의 `Allowed Paths`, `Done When`, 그리고 PRD Notes의 보존 대상/검증 후 cleanup 지시.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_117/prd_117.md at 2026-05-02T23:03:26Z.
- Planner scope repair at 2026-05-02T23:04:49Z: replaced placeholder Allowed Paths with concrete PRD-117 paths. Wiki queries for PRD-117/order rename terms returned `result_count=0`, so no prior decision changed the ticket scope.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
