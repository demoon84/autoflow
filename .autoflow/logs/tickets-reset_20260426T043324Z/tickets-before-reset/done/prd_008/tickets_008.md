# Ticket

## Ticket

- ID: tickets_008
- PRD Key: prd_008
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_008/prd_008.md
- Title: Ticket owner work for prd_008
- Stage: done
- AI: AI-2
- Claimed By: AI-2
- Execution AI: AI-2
- Verifier AI: AI-2
- Last Updated: 2026-04-26T02:00:47Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_008.

## References

- PRD: tickets/done/prd_008/prd_008.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_008]]
- Plan Note:
- Ticket Note: [[tickets_008]]

## Allowed Paths

- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/common.sh
- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/common.sh
- .autoflow/agents/ticket-owner-agent.md
- scaffold/board/agents/ticket-owner-agent.md
- AGENTS.md
- CLAUDE.md
- README.md
- apps/desktop/src/renderer/main.tsx
- tests/smoke/ticket-owner-smoke.sh
- tests/smoke/ticket-owner-replan-smoke.sh

## Worktree
- Path:
- Branch:
- Base Commit: aadf973ec6300c5a964baf012491b90dd88f0b68
- Worktree Commit:
- Integration Status: no_worktree

## Done When

- [ ] reject ticket 이 1건 있고 retry_count=0 인 상태에서 `start-ticket-owner.sh` 실행 → exit 0, `status=ok`, `source=replan`, `retry_count=1` 출력. ticket 파일이 `tickets/todo/tickets_NNN.md` 로 이동되어 있다.
- [ ] 옮겨진 ticket 의 Stage=`todo`, Owner / Claimed By / Execution Owner / Verifier Owner 가 빈 값, Worktree.Integration Status=`pending_claim`.
- [ ] 옮겨진 ticket 에 `## Reject History` 섹션이 존재하고 직전 Reject Reason 과 timestamp 가 기록되어 있다.
- [ ] retry_count 가 상한(`AUTOFLOW_REJECT_MAX_RETRIES`, 기본 2) 에 도달한 reject 는 `start-ticket-owner.sh` 가 건너뛰고 `replan_skipped.*` 메타키만 출력. ticket 은 reject/ 에 그대로 둔다.
- [ ] `AUTOFLOW_REJECT_AUTO_REPLAN=off` 환경에서는 어떤 reject 도 건드리지 않고 기존 흐름(spec→ticket) 으로 빠진다.
- [ ] 기존 owner smoke (`tests/smoke/ticket-owner-smoke.sh`) 가 통과한다 (reject 가 없을 땐 동작 변화 없음).
- [ ] 신규 smoke (`tests/smoke/ticket-owner-replan-smoke.sh`) 가 통과한다 — reject 1건 → replan → 새 todo claim → mock pass → done 의 end-to-end.
- [ ] `.autoflow/agents/ticket-owner-agent.md` Procedure 가 `source=replan` 케이스에서 Reject History 를 반영해 mini-plan 작성한다는 단계를 명시.
- [ ] `diff -q runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh` 출력 없음.
- [ ] `diff -q runtime/board-scripts/common.sh .autoflow/scripts/common.sh` 출력 없음.
- [ ] `diff -q .autoflow/agents/ticket-owner-agent.md scaffold/board/agents/ticket-owner-agent.md` 출력 없음.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.

## Next Action
- 완료됨: ticket-owner pass 처리와 evidence log 기록 완료.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-2 from tickets/done/prd_008/prd_008.md at 2026-04-26T01:46:09Z.

- AI-2 prepared spec at 2026-04-26T01:46:09Z; worktree=/Users/demoon/Documents/project/autoflow; run=tickets/inprogress/verify_008.md
- AI-2 prepared resume at 2026-04-26T01:47:15Z; worktree=/Users/demoon/Documents/project/autoflow; run=tickets/inprogress/verify_008.md
- Mini-plan (2026-04-26T02:10:00Z):
  1. Add reject retry helpers in `runtime/board-scripts/common.sh` and mirror them to `.autoflow/scripts/common.sh`, preserving ticket notes while resetting machine-owned state for replan.
  2. Extend `start-ticket-owner.sh` to scan `tickets/reject/` before backlog spec claim, emit `source=replan` and skip metadata, and leave the replanned ticket in `todo` for the next owner claim.
  3. Add a dedicated smoke test and update owner/docs/UI wording to describe bounded automatic retry in ticket-owner mode.
- Implementation checkpoint (2026-04-26T02:18:00Z): added bounded reject retry helpers plus `source=replan` / `replan_skipped.*` output in the owner runtime, updated the owner docs and reject card copy, and fixed smoke harness isolation by unsetting inherited `AUTOFLOW_BOARD_ROOT` / `AUTOFLOW_PROJECT_ROOT` during temp-board runtime checks.
- Ticket owner verification passed at 2026-04-26T02:00:27Z: command exited 0
- No worktree path recorded at 2026-04-26T02:00:47Z; verifier will commit board-only changes from PROJECT_ROOT.
- AI-2 marked pass at 2026-04-26T02:00:47Z.
## Verification
- Run file: `tickets/done/prd_008/verify_008.md`
- Log file: `logs/verifier_008_20260426_020047Z_pass.md`
- Result: passed

## Result

- Summary: added bounded reject auto-replan with owner smoke coverage
- Remaining risk:
