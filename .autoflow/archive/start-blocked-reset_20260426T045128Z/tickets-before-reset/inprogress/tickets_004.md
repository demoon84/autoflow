# Ticket

## Ticket

- ID: tickets_004
- PRD Key: prd_004
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_004/prd_004.md
- Title: AI work for prd_004
- Stage: blocked
- AI: AI-4
- Claimed By: AI-4
- Execution AI: AI-4
- Verifier AI: AI-4
- Last Updated: 2026-04-26T04:48:15Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_004.

## References

- PRD: tickets/done/prd_004/prd_004.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_004]]
- Plan Note:
- Ticket Note: [[tickets_004]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Worktree
- Path:
- Branch:
- Base Commit: 07a05bb0162134d69c2a2d0c4960de327fd3d587
- Worktree Commit:
- Integration Status: project_root_fallback

## Done When

- [ ] 사이드바 마지막에 "도움말" 항목이 추가되어 있다.
- [ ] 도움말 클릭 시 `activeSettingsSection === "help"` 로 전환되고 다른 섹션은 unmount 된다.
- [ ] Help 섹션에 (1) 개요 (2) 메뉴 가이드 5개 카드(작업 흐름 / AI 관리 / Wiki / 처리 지표 / 자동화 상태) (3) 용어 사전 (4) 트리거 안내 (5) 데이터 흐름 한눈에 — 5개 영역이 모두 렌더된다.
- [ ] 각 메뉴 카드는 라벨 / 1줄 요약 / "여기서 할 수 있는 일" 불릿 2개 이상 / "데이터 위치" 표기를 포함한다.
- [ ] 용어 사전 카드는 spec / ticket / runner / verifier / handoff / wiki / stop-hook / file watcher 8개 항목을 모두 포함한다.
- [ ] 트리거 안내 카드는 `/af`, `#af`, `/autoflow`, `#autoflow` 4개 트리거가 모두 언급되며, "저장 / 바꿔 / 취소" 흐름이 표시된다.
- [ ] Help 섹션을 떠났다가 다시 들어와도 다른 섹션의 state(선택된 로그, 토글 등)에 영향이 없다.
- [ ] 사이드바 라벨/순서/동작은 도움말 추가 외에 변동 없음.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash tests/smoke/ticket-owner-smoke.sh` exit 0.

## Next Action
- Runtime wait: shared Allowed Paths are already held by lower-number in-progress ticket(s): tickets_001:apps/desktop/src/renderer/main.tsx, tickets_001:apps/desktop/src/renderer/styles.css, tickets_002:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/styles.css. Retry automatically when blockers clear.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-4 from tickets/done/prd_004/prd_004.md at 2026-04-26T04:47:24Z.

- Runtime auto-blocked: shared_allowed_path_conflict at 2026-04-26T04:47:24Z; blockers=tickets_001:apps/desktop/src/renderer/main.tsx, tickets_001:apps/desktop/src/renderer/styles.css, tickets_002:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/styles.css
## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
