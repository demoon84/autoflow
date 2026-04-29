# Ticket

## Ticket

- ID: tickets_003
- PRD Key: prd_003
- Plan Candidate: 사용자 직접 재활성 — 이전 reject_003 의 Manual Resolution 이 부분만 메인에 남아 PRD Done When 미충족
- Title: Wiki 섹션 미리보기 토글 (PRD prd_003 마무리)
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T21:00:00Z

## Goal

- 이번 작업의 목표: PRD prd_003 의 Wiki 섹션 미리보기 토글 흐름을 완성한다. Wiki 진입 시 미리보기는 닫힌 상태로 시작, 결과 항목 클릭 시 펼쳐지고, 헤더 닫기(×)와 좌측 "미리보기 열기" 토글로 자유롭게 여닫을 수 있어야 한다.

## References

- PRD: tickets/done/prd_003/prd_003.md
- Feature Spec:
- Plan Source: 사용자 직접 재활성
- 이전 시도 기록: tickets/done/prd_003/reject_003.md (retry 10/10 도달 + 2026-04-26 Manual Resolution 노트 보관)

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Worktree
- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

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

- 1) `apps/desktop/src/renderer/main.tsx` 의 현재 상태를 확인한다. 이미 `readWikiLog` 콜백과 `knowledge-toolbar-trailing` 영역은 살아있다 (Manual Resolution 잔존). 누락은 (a) `isWikiPreviewOpen` React state, (b) `LogPreview` 헤더의 `<X>` 닫기 버튼 (Wiki 섹션 한정), (c) 좌측 toolbar 의 `<PanelRightOpen>` "미리보기 열기" 토글, (d) Wiki 섹션 떠날 때/돌아올 때 state 리셋, (e) `knowledge-preview-pane--hidden` 클래스 + `aria-hidden` 토글.
- 2) `apps/desktop/src/renderer/styles.css` 에 `.knowledge-preview-pane--hidden { display: none; }`, `.knowledge-preview-open-toggle`, `.log-preview-close` 추가.
- 3) `tickets/done/prd_003/reject_003.md` 끝의 `## Manual Resolution` 노트가 정확한 구현 가이드를 담고 있으므로 그걸 그대로 따라가면 된다.
- 4) 검증 3종 (`tsc --noEmit`, `check-syntax.mjs`, `ticket-owner-smoke.sh`) 모두 exit 0 확인.

## Resume Context

- 현재 상태 요약: 2026-04-26 Manual Resolution 일부만 메인에 남아있음. `readWikiLog` 콜백 / `WikiList` `HandoffList` `WikiQueryPanel` `onSelect` 연결 / `.knowledge-toolbar-trailing` CSS 는 존재. `isWikiPreviewOpen` state, 닫기/열기 버튼, `knowledge-preview-pane--hidden` 클래스, 진입/이탈 리셋은 누락. PRD Done When 6개 중 동작 가능한 항목은 1~2개에 그침.
- 직전 작업: 2026-04-30 사용자가 "완료 항목의 Reject-003 처리됐으면 todo 로" 지시 → reject 폴더가 아닌 done/prd_003/ 의 archive 를 확인하고 부분 구현 상태를 진단해 todo 로 재활성화.
- 재개 시 먼저 볼 것: `tickets/done/prd_003/reject_003.md` 의 `## Manual Resolution` 섹션 (정확한 구현 절차) 와 `tickets/done/prd_003/prd_003.md` 의 acceptance criteria. 이전 reject 사유 (lower-number ticket 들이 같은 paths 를 점유하던 문제) 는 현재 보드에 그 경합 ticket 들이 없으므로 더 이상 차단 요인 아님.

## Notes

- 사용자 요청으로 done/prd_003/reject_003.md 를 todo 로 재활성 (2026-04-30). Retry 카운트 0 으로 리셋. 이전 시도/사유 기록은 archive 에 그대로 보존.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:

## Retry

- Retry Count: 0
- Max Retries: 10
