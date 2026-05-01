# Ticket

## Ticket

- ID: tickets_079
- PRD Key: prd_081
- Plan Candidate: Plan AI handoff from tickets/done/prd_081/prd_081.md
- Title: 위키 헤더 제거와 상세 패널 상시 노출
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T19:15:25Z

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
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_079`
- Branch: autoflow/tickets_079
- Base Commit: 514b43acaa72eaa754cd2c16cc7f4e57f81bf7c6
- Worktree Commit: e50c03ff12873528b9d9a987e19c22e6d3b818d1
- Integration Status: integrated

## Goal Runtime
- Status: complete
- Started At: 2026-05-01T19:13:57Z
- Started Epoch: 1777662837
- Updated At: 2026-05-01T19:15:27Z
- Tick Count: 2
- Time Used Seconds: 90
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3057741741

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] Wiki 메뉴 첫 진입 시 좌측 목록 상단에 작은 `Wiki` 배지와 `목록` 라벨 헤더가 더 이상 보이지 않는다.
- [x] Wiki 메뉴 첫 진입 시 우측 상세 패널이 닫힌 상태가 아니라 항상 노출된다.
- [x] 선택 항목이 없는 상태에서는 우측 상세 패널에 기존 빈 상태 메시지가 보이며, 패널 자체는 숨겨지지 않는다.
- [x] `WikiList`, `HandoffList`, `WikiQueryPanel` 결과를 선택하면 우측 상세 패널이 닫히지 않고 선택한 markdown 본문을 표시한다.
- [x] `미리보기 열기` 버튼과 Wiki 상세 패널 닫기 버튼이 일반 화면 경로에서 제거되어 사용자가 상세 패널을 접을 수 없다.
- [x] `apps/desktop/src/renderer/main.tsx` 와 `apps/desktop/src/renderer/styles.css` 에서 Wiki 전용 `isWikiPreviewOpen`, `setIsWikiPreviewOpen`, `knowledge-preview-pane--hidden`, `knowledge-preview-open-toggle`, `log-preview-close` 경로가 남아 있지 않거나 더 이상 Wiki 패널 숨김에 쓰이지 않는다.
- [x] 좁은 폭에서는 기존 반응형 규칙 안에서 좌우 영역이 사용 가능하게 유지되고, old hidden class 때문에 우측 패널이 `display: none` 이 되지 않는다.
- [x] 다른 페이지의 `runner-page-summary`, `LogPreview`, 상세 패널 동작은 이번 Wiki 전용 변경으로 회귀하지 않는다.
- [ ] 구현은 Allowed Paths 두 파일 안에만 머문다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_047.md` 를 `tickets/done/prd_081/prd_081.md` 로 승격하고 `tickets_079` todo 티켓을 생성했다.
- 직전 작업: `bin/autoflow wiki query --term "knowledge-page-toolbar" --term "isWikiPreviewOpen" --term "위키 헤더 제거"` 를 수행했고, `ticket-owner` 이전 티켓 완료본으로 `tickets/done/prd_032/tickets_032.md` 와 `tickets/done/prd_057/tickets_059.md`가 제시한 방식(항상 노출, `.knowledge-preview-pane` 스코프 유지)을 재확인했다.  
- 이번 턴에서는 `apps/desktop/src/renderer/main.tsx` 와 `apps/desktop/src/renderer/styles.css` 변경을 worktree 기준으로 반영하고, 동일 경로 기준으로 통합 증적을 남긴다.

## Notes

- Mini-plan (AI owned):
  - 1) `main.tsx`에서 `isWikiPreviewOpen`/`setIsWikiPreviewOpen` 상태와 토글 분기(`knowledge-preview-open-toggle`, `knowledge-preview-close`)를 제거한다. `readWikiLog`는 단순 `readLog`로 동작해 항목 선택 시 항상 우측 패널이 표시되도록 유지한다. 근거: `[[tickets/done/prd_032/tickets_032.md]]`, `[[tickets/done/prd_057/tickets_059.md]]`.
  - 2) 좌측 wiki 툴바 헤더(`knowledge-page-toolbar` + `runner-page-summary`/`Wiki` 배지, `목록` 라벨, `미리보기 열기`)를 제거해 첫 진입 시 헤더가 보이지 않게 한다.
  - 3) 우측 패널 마킹에서 `knowledge-preview-pane--hidden`/`aria-hidden` 조건부 노출을 제거하고, `LogPreview` 닫기 버튼 전달(`log-preview-close`)을 삭제해 접기 동작을 차단한다.
  - 4) `styles.css`에서 wiki 전용 토글/숨김 관련 클래스 선언 여지를 정리해 다른 페이지 규격(`runner-page-summary`, `LogPreview`)을 건드리지 않는다. 근거: `[[tickets/done/prd_057/tickets_059.md]]`.
- Created by planner (Plan AI) from tickets/done/prd_081/prd_081.md at 2026-04-30T23:05:53Z.
- Wiki context: `tickets/done/prd_032/tickets_032.md` records the prior completed always-visible Wiki preview change: `isWikiPreviewOpen`, `PanelRightOpen`, `.knowledge-preview-pane--hidden`, `.knowledge-preview-open-toggle`, `.log-preview-close`, `미리보기 열기`, and `미리보기 닫기` were removed, with `npm run desktop:check` passing.
- Wiki context: `tickets/done/prd_003/reject_003.md` records the older manual resolution that introduced the collapsed-by-default `isWikiPreviewOpen` flow and repeated retry/worktree overlap on `main.tsx` / `styles.css`.
- Wiki context: `tickets/done/prd_057/prd_057.md` and `tickets/done/prd_057/tickets_059.md` warn to scope preview CSS changes to `.knowledge-preview-pane` or `.knowledge-page` so other `.log-preview` surfaces do not regress.
- Current code scan before planning found the rollback-related symbols still present: `isWikiPreviewOpen`, `setIsWikiPreviewOpen`, `PanelRightOpen`, `knowledge-page-toolbar`, `knowledge-preview-pane--hidden`, `미리보기 열기`, and `log-preview-close`.
- Mini-plan hint: remove the small left toolbar summary and the preview open/close state path; keep existing `readWikiLog`/selection loading behavior by delegating directly to the existing log read path without a close/open toggle.

- Runtime hydrated worktree dependency at 2026-05-01T19:13:57Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T19:13:56Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_079; run=tickets/inprogress/verify_079.md
- Prepared worktree commit e50c03ff12873528b9d9a987e19c22e6d3b818d1 at 2026-05-01T19:15:25Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-05-01T19:15:25Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-05-01T19:15:25Z: AI already integrated worktree commit e50c03ff12873528b9d9a987e19c22e6d3b818d1 into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-01T19:15:25Z.
- Coordinator post-merge cleanup at 2026-05-01T19:15:25Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_079 deleted_branch=autoflow/tickets_079.
## Verification
- Run file: `tickets/done/prd_081/verify_079.md`
- Log file: `logs/verifier_079_20260501_191526Z_pass.md`
- Result: passed

## Result

- Summary: 위키 헤더/미리보기 토글 제거 및 상세 패널 상시 노출 복구 완료
  - Wiki 헤더/토글/닫기 경로 제거, 우측 상세 패널 상시 노출 복구 완료.
  - `npm run desktop:check` (worktree + 프로젝트 루트 기준) 통과.
- Remaining risk: 없음
