# Ticket

## Ticket

- ID: tickets_091
- PRD Key: prd_093
- Plan Candidate: Plan AI handoff from tickets/done/prd_093/prd_093.md
- Title: Worker 작업 생명주기 격리
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T21:29:06Z

## Goal

- 이번 작업의 목표: worker claim/resume부터 pass/fail/blocked 종료까지 제품 코드, 보드 산출물, finalization 준비 변경이 main working tree에 중간 상태로 새지 않도록 격리 계약과 런타임/문서/smoke를 정비한다.

## References

- PRD: tickets/done/prd_093/prd_093.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_093]]
- Plan Note:
- Ticket Note: [[tickets_091]]

## Allowed Paths

- runtime/board-scripts/start-ticket-owner.sh
- .autoflow/scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- runtime/board-scripts/merge-ready-ticket.sh
- .autoflow/scripts/merge-ready-ticket.sh
- runtime/board-scripts/common.sh
- .autoflow/scripts/common.sh
- runtime/board-scripts/update-wiki.sh
- .autoflow/scripts/update-wiki.sh
- .autoflow/agents/ticket-owner-agent.md
- scaffold/board/agents/ticket-owner-agent.md
- dogfood-board/agents/ticket-owner-agent.md
- .autoflow/reference/tickets-board.md
- scaffold/board/reference/tickets-board.md
- .autoflow/automations/README.md
- scaffold/board/automations/README.md
- tests/smoke/ticket-owner-*.sh
- tests/smoke/worker-*.sh

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
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Worker가 티켓을 claim/resume한 직후 main working tree에 제품 코드 변경이 생기지 않는다.
- [ ] Worker claim 시 isolation context 경로/브랜치/기준 commit이 티켓에 기록된다.
- [ ] Worker 구현/검증 중 제품 코드 변경은 ticket worktree 또는 integration worktree/branch 안에만 존재한다.
- [ ] `needs_ai_merge` 상태 이후에도 main에 미커밋 제품 코드 변경을 남긴 채 다음 티켓을 claim하지 않는다.
- [ ] pass 최종화가 성공하면 main에는 완료 commit만 남고 working tree는 깨끗하며, 성공한 isolation worktree/branch는 삭제되거나 archived 상태로 명시된다.
- [ ] fail/reject/max retry/blocked 경로에서는 main working tree가 깨끗하고, 복구 대상은 격리 worktree/branch 또는 board evidence로 남는다.
- [ ] cleanup 실패 상태에서는 owner가 새 티켓을 claim하지 않고 planner/owner가 복구 지시를 볼 수 있다.
- [ ] `.autoflow` 보드 변경이 main에 직접 남아야 하는 경우와 격리되어야 하는 경우가 문서와 smoke로 구분된다.
- [ ] deterministic wiki 갱신이 main dirty를 남긴 채 중단되지 않도록 finalization commit 경계 안에서 처리된다.
- [ ] 기존 `ticket-owner-smoke`, dirty-root, needs-ai-merge 관련 smoke가 새 격리 계약에 맞게 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 claim 한 뒤 `tickets/done/prd_093/prd_093.md` 의 `Lifecycle Isolation Contract` 를 기준으로 현재 owner/finalization 흐름의 main dirty 발생 지점을 분류하고, 가장 작은 안전한 격리 모델을 런타임 mirror, scaffold 문서, smoke 에 반영한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_093` 을 todo 티켓으로 생성하고, wiki/reject context 를 반영해 owner 실행 지시를 좁혔다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 를 `tickets/done/prd_093/prd_093.md` 로 보관하고 `tickets/todo/tickets_091.md` 를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_093/prd_093.md`, `wiki/answers/dirty-root-finalization-blockers-20260502.md`, `wiki/answers/open-layer-flicker-finalization-blocker-20260501.md`, `wiki/learnings/manual-merge-recovery-20260427.md`, `wiki/answers/finish-ticket-owner-cleanup-status-contract.md`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_093/prd_093.md at 2026-05-01T21:29:06Z.
- Planner wiki context checkpoint by planner-1 at 2026-05-02T06:29:28+0900: `./bin/autoflow wiki query . --term 'Worker 작업 생명주기 격리' --term 'main working tree dirty finalization' --term 'ticket worktree integration branch finish-ticket-owner merge-ready-ticket update-wiki' --term 'dirty_root finalization blocker' --term 'cleanup_status=ok finish-ticket-owner output contract' --term 'setup-required-panel broad dirty renderer rewrite' --term 'open-layer flicker finalization blocker' --term 'runtime/board-scripts/start-ticket-owner.sh finish-ticket-owner.sh merge-ready-ticket.sh common.sh update-wiki.sh' --limit 12` surfaced `conversations/prd_093/spec-handoff.md`; follow-up dirty-root query surfaced done context only indirectly, so planner also read the relevant wiki answers directly.
- Planning constraint: `wiki/answers/dirty-root-finalization-blockers-20260502.md` and `wiki/answers/open-layer-flicker-finalization-blocker-20260501.md` both point to unsafe pass finalization when PROJECT_ROOT carries broad dirty renderer/API changes. This ticket should prevent that class of blocker by making worker isolation/finalization boundaries explicit and testable.
- Planning constraint: `wiki/learnings/manual-merge-recovery-20260427.md` records earlier dirty-scope integration gridlock in shared desktop files; preserve the dirty scope guard and avoid any flow that silently stages unrelated root changes.
- Planning constraint: `wiki/answers/finish-ticket-owner-cleanup-status-contract.md` records the `cleanup_status=ok` output contract expected by ticket-owner smoke; keep cleanup/finalization status output aligned with smoke expectations while changing isolation behavior.

## Verification

- Command: `bash -n runtime/board-scripts/common.sh .autoflow/scripts/common.sh runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh`
- Command: `bash tests/smoke/ticket-owner-smoke.sh`
- Command: `bash tests/smoke/ticket-owner-dirty-unrelated-integration-smoke.sh`
- Command: `bash tests/smoke/ticket-owner-goal-runtime-smoke.sh`
- Command: `bash tests/smoke/board-protocol-scaffold-sync-smoke.sh`
- Command: `git diff --check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
