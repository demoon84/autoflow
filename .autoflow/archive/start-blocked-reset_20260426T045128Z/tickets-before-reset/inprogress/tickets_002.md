# Ticket

## Ticket

- ID: tickets_002
- PRD Key: prd_002
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_002/prd_002.md
- Title: AI work for prd_002
- Stage: blocked
- AI: AI-2
- Claimed By: AI-2
- Execution AI: AI-2
- Verifier AI: AI-2
- Last Updated: 2026-04-26T04:48:14Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_002.

## References

- PRD: tickets/done/prd_002/prd_002.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_002]]
- Plan Note:
- Ticket Note: [[tickets_002]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/vite-env.d.ts
- apps/desktop/src/main.js
- packages/cli/runners-project.sh
- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh
- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh

## Worktree
- Path:
- Branch:
- Base Commit: 07a05bb0162134d69c2a2d0c4960de327fd3d587
- Worktree Commit:
- Integration Status: project_root_fallback

## Done When

- [ ] `start-ticket-owner.sh` 가 ticket 을 점유한 직후 runner state 에 `active_item`, `active_ticket_id`, `active_ticket_title`, `active_stage`, `active_spec_ref` 5개 키를 채워 넣는다.
- [ ] `finish-ticket-owner.sh` 가 done / reject 시 위 5개 키를 빈 값으로 클리어한다.
- [ ] `start_runner` / `stop_runner` (packages/cli/runners-project.sh) 는 위 5개 키를 보존하거나 명시적으로만 비운다.
- [ ] `autoflow runners list . | grep "active_ticket_id"` 가 처리 중인 runner 에 대해 비어 있지 않은 값을 출력한다.
- [ ] `AutoflowRunner` 타입에 `activeTicketId`, `activeTicketTitle`, `activeStage`, `activeSpecRef` 가 정의되고, IPC 가 이를 채운다.
- [ ] 데스크톱 작업 흐름의 AI 행에 "지금 처리 중: tickets_001 — Restructure ... (prd_001)" 형태 라인이 노출된다 (실제 ticket 작업 중일 때).
- [ ] Idle 상태에서는 한국어 인간 친화 메시지("대기 중 — 처리할 백로그/티켓 없음")가 노출된다.
- [ ] 작업 중 행을 클릭하면 LogPreview 에 ticket 파일 본문이 열린다.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash tests/smoke/ticket-owner-smoke.sh` exit 0.
- [ ] `diff -q runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh` 출력 없음.
- [ ] `diff -q runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh` 출력 없음.

## Next Action
- Runtime wait: shared Allowed Paths are already held by lower-number in-progress ticket(s): tickets_001:apps/desktop/src/renderer/main.tsx. Retry automatically when blockers clear.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-2 from tickets/done/prd_002/prd_002.md at 2026-04-26T04:47:21Z.

- Runtime auto-blocked: shared_allowed_path_conflict at 2026-04-26T04:47:21Z; blockers=tickets_001:apps/desktop/src/renderer/main.tsx
## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
