# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_001/prd_001.md
- Title: AI work for prd_001
- Stage: planning
- AI: AI-1
- Claimed By: AI-1
- Execution AI: AI-1
- Verifier AI: AI-1
- Last Updated: 2026-04-26T04:47:52Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_001.

## References

- PRD: tickets/done/prd_001/prd_001.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_001]]
- Plan Note:
- Ticket Note: [[tickets_001]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css
- .autoflow/agents/wiki-maintainer-agent.md
- scaffold/board/agents/wiki-maintainer-agent.md

## Worktree
- Path:
- Branch:
- Base Commit: 07a05bb0162134d69c2a2d0c4960de327fd3d587
- Worktree Commit:
- Integration Status: project_root_fallback

## Done When

- [ ] 사이드바 `settingsNavigation` 의 `knowledge` 항목 라벨이 `Wiki` 단일이고, "Handoff" 단어가 라벨에 없다.
- [ ] Knowledge 패널 내부에 위→아래 순서로 `WikiQueryPanel` → `WikiList` → `Sources` collapsible 섹션이 렌더된다.
- [ ] `Sources` 섹션은 클릭으로 펼치고 접을 수 있으며, 초기 상태는 펼침.
- [ ] `HandoffList` 가 `Sources` 섹션 내부에 위치하고 `WikiList` 와 peer 가 아니다.
- [ ] `aria-label="Wiki & Handoff"` 표기가 사라지고 `Wiki` 로 통일됐다.
- [ ] `boardFileKind` 가 `conversations/` 경로에 대해 raw-source 의미의 라벨을 반환한다.
- [ ] HandoffList 의 헤더·빈 상태·메타 텍스트에 "인수인계" 같은 동격 표현이 남아 있지 않다.
- [ ] 핸드오프 행을 클릭하면 기존처럼 `LogPreview` 에 본문이 표시된다 (회귀 없음).
- [ ] `.autoflow/agents/wiki-maintainer-agent.md` 의 Inputs / Procedure 가 "conversation handoff 는 wiki 입력 소스" 의미를 명시한다.
- [ ] `diff -q .autoflow/agents/wiki-maintainer-agent.md scaffold/board/agents/wiki-maintainer-agent.md` 가 출력 없음 (동일).
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash tests/smoke/ticket-owner-smoke.sh` exit 0.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-1 from tickets/done/prd_001/prd_001.md at 2026-04-26T04:47:18Z.

- AI AI-1 prepared spec at 2026-04-26T04:47:18Z; worktree=/Users/demoon/Documents/project/autoflow; run=tickets/inprogress/verify_001.md
- AI AI-1 prepared resume at 2026-04-26T04:47:52Z; worktree=/Users/demoon/Documents/project/autoflow; run=tickets/inprogress/verify_001.md
## Verification
- Run file: `tickets/inprogress/verify_001.md`
- Log file: pending
- Result: pending ticket-owner by AI-1

## Result

- Summary:
- Remaining risk:
