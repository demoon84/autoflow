# Ticket

## Ticket

- ID: tickets_003
- PRD Key: prd_003
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_003/prd_003.md
- Title: AI work for prd_003
- Stage: blocked
- AI: AI-3
- Claimed By: AI-3
- Execution AI: AI-3
- Verifier AI: AI-3
- Last Updated: 2026-04-26T04:48:14Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_003.

## References

- PRD: tickets/done/prd_003/prd_003.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_003]]
- Plan Note:
- Ticket Note: [[tickets_003]]

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

- [ ] Wiki 섹션 진입 직후 LogPreview 가 보이지 않고, 좌측 목록 + 검색 패널이 패널 전체 폭을 차지한다.
- [ ] WikiList / HandoffList / WikiQueryPanel 결과 중 어느 항목이든 클릭하면 우측에 LogPreview 가 펼쳐지고 좌측 목록 폭이 줄어든다.
- [ ] 펼쳐진 LogPreview 헤더 우측에 닫기(×) 버튼이 보이고, 클릭하면 미리보기 영역이 사라지고 좌측이 다시 전체 폭이 된다.
- [ ] 미리보기를 닫은 상태에서 `selectedLogPath` 가 남아 있으면, 좌측 패널 어딘가에 "미리보기 열기" 형태의 토글 버튼이 노출되어 다시 펼칠 수 있다.
- [ ] Wiki 외 다른 settings 섹션(snapshot, automation 등)은 시각적 회귀 없음 — `.settings-section` 의 기본 grid 가 유지됨.
- [ ] 다른 섹션으로 이동했다가 다시 Wiki 로 돌아오면 미리보기는 다시 닫힌 기본 상태로 시작.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash tests/smoke/ticket-owner-smoke.sh` exit 0.

## Next Action
- Runtime wait: shared Allowed Paths are already held by lower-number in-progress ticket(s): tickets_001:apps/desktop/src/renderer/main.tsx, tickets_001:apps/desktop/src/renderer/styles.css, tickets_002:apps/desktop/src/renderer/main.tsx. Retry automatically when blockers clear.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-3 from tickets/done/prd_003/prd_003.md at 2026-04-26T04:47:22Z.

- Runtime auto-blocked: shared_allowed_path_conflict at 2026-04-26T04:47:22Z; blockers=tickets_001:apps/desktop/src/renderer/main.tsx, tickets_001:apps/desktop/src/renderer/styles.css, tickets_002:apps/desktop/src/renderer/main.tsx
## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
