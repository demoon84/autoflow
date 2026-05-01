# Ticket

## Ticket

- ID: tickets_079
- PRD Key: prd_081
- Plan Candidate: Plan AI handoff from tickets/done/prd_081/prd_081.md
- Title: 위키 헤더 제거와 상세 패널 상시 노출
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:05:53Z

## Goal

- 이번 작업의 목표: 데스크톱 Wiki 화면에서 좌측 목록 상단의 작은 `Wiki / 목록` 헤더와 미리보기 토글을 제거하고, 우측 상세 패널이 첫 진입부터 항상 보이도록 복구한다.

## References

- PRD: tickets/done/prd_081/prd_081.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_081]]
- Plan Note:
- Ticket Note: [[tickets_079]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

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

- [ ] Wiki 메뉴 첫 진입 시 좌측 목록 상단에 작은 `Wiki` 배지와 `목록` 라벨 헤더가 더 이상 보이지 않는다.
- [ ] Wiki 메뉴 첫 진입 시 우측 상세 패널이 닫힌 상태가 아니라 항상 노출된다.
- [ ] 선택 항목이 없는 상태에서는 우측 상세 패널에 기존 빈 상태 메시지가 보이며, 패널 자체는 숨겨지지 않는다.
- [ ] `WikiList`, `HandoffList`, `WikiQueryPanel` 결과를 선택하면 우측 상세 패널이 닫히지 않고 선택한 markdown 본문을 표시한다.
- [ ] `미리보기 열기` 버튼과 Wiki 상세 패널 닫기 버튼이 일반 화면 경로에서 제거되어 사용자가 상세 패널을 접을 수 없다.
- [ ] `apps/desktop/src/renderer/main.tsx` 와 `apps/desktop/src/renderer/styles.css` 에서 Wiki 전용 `isWikiPreviewOpen`, `setIsWikiPreviewOpen`, `knowledge-preview-pane--hidden`, `knowledge-preview-open-toggle`, `log-preview-close` 경로가 남아 있지 않거나 더 이상 Wiki 패널 숨김에 쓰이지 않는다.
- [ ] 좁은 폭에서는 기존 반응형 규칙 안에서 좌우 영역이 사용 가능하게 유지되고, old hidden class 때문에 우측 패널이 `display: none` 이 되지 않는다.
- [ ] 다른 페이지의 `runner-page-summary`, `LogPreview`, 상세 패널 동작은 이번 Wiki 전용 변경으로 회귀하지 않는다.
- [ ] 구현은 Allowed Paths 두 파일 안에만 머문다.

## Next Action

- Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `apps/desktop/src/renderer/main.tsx` 의 Wiki toolbar/preview state 흐름과 `apps/desktop/src/renderer/styles.css` 의 Wiki preview 관련 selector 를 좁게 수정하고, `npm run desktop:check` 로 검증한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_047.md` 를 `tickets/done/prd_081/prd_081.md` 로 승격하고 `tickets_079` todo 티켓을 생성했다.
- 직전 작업: `bin/autoflow wiki query --term "knowledge-page-toolbar" --term "knowledge-preview-pane" --term "isWikiPreviewOpen" --term "위키 페이지 헤더 제거"` 를 실행했고, `scripts/start-plan.sh 081` 로 PRD 를 done 에 보관한 뒤 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_081/prd_081.md`, `tickets/done/prd_081/memo_047.md`, `tickets/done/prd_032/tickets_032.md`, `apps/desktop/src/renderer/main.tsx` 의 `isWikiPreviewOpen` / `knowledge-page-toolbar` / `LogPreview headerAction`, `apps/desktop/src/renderer/styles.css` 의 `.knowledge-page-toolbar`, `.knowledge-preview-pane--hidden`, `.log-preview-close`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_081/prd_081.md at 2026-04-30T23:05:53Z.
- Wiki context: `tickets/done/prd_032/tickets_032.md` records the prior completed always-visible Wiki preview change: `isWikiPreviewOpen`, `PanelRightOpen`, `.knowledge-preview-pane--hidden`, `.knowledge-preview-open-toggle`, `.log-preview-close`, `미리보기 열기`, and `미리보기 닫기` were removed, with `npm run desktop:check` passing.
- Wiki context: `tickets/done/prd_003/reject_003.md` records the older manual resolution that introduced the collapsed-by-default `isWikiPreviewOpen` flow and repeated retry/worktree overlap on `main.tsx` / `styles.css`.
- Wiki context: `tickets/done/prd_057/prd_057.md` and `tickets/done/prd_057/tickets_059.md` warn to scope preview CSS changes to `.knowledge-preview-pane` or `.knowledge-page` so other `.log-preview` surfaces do not regress.
- Current code scan before planning found the rollback-related symbols still present: `isWikiPreviewOpen`, `setIsWikiPreviewOpen`, `PanelRightOpen`, `knowledge-page-toolbar`, `knowledge-preview-pane--hidden`, `미리보기 열기`, and `log-preview-close`.
- Mini-plan hint: remove the small left toolbar summary and the preview open/close state path; keep existing `readWikiLog`/selection loading behavior by delegating directly to the existing log read path without a close/open toggle.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
