# Ticket

## Ticket

- ID: tickets_085
- PRD Key: prd_087
- Plan Candidate: Plan AI handoff from tickets/done/prd_087/prd_087.md
- Title: 위키 문서 뷰어 모드
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T00:14:25Z

## Goal

- 이번 작업의 목표: 데스크톱 Wiki 문서 상세/미리보기 영역이 raw console/pre 형식이나 편집형 표시가 아니라, 사용자가 읽기 쉬운 읽기 전용 Markdown viewer mode로 표시되게 한다.

## References

- PRD: tickets/done/prd_087/prd_087.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_087]]
- Plan Note:
- Ticket Note: [[tickets_085]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/markdown-viewer.tsx`

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

- [ ] Wiki 섹션에서 Wiki 문서, handoff 문서, wiki query 결과 문서를 선택하면 본문이 `MarkdownViewer` 기반 viewer mode로 표시된다.
- [ ] Wiki preview body는 raw console/pre 박스가 아니라 heading, list, code block, table 등 Markdown 구조가 렌더링된 읽기 전용 문서 뷰로 보인다.
- [ ] Wiki 문서 preview에는 `textarea`, `contentEditable`, 편집 toolbar, 편집 가능한 입력 커서가 노출되지 않는다.
- [ ] 기존 Wiki preview 흐름은 유지된다: Wiki 진입 시 닫힘, 항목 선택 시 열림, 닫기 버튼, "미리보기 열기" 토글이 계속 동작한다.
- [ ] 일반 로그/터미널/runner output preview를 raw 형식으로 보여야 하는 화면은 이 변경 때문에 Markdown viewer로 강제 전환되지 않는다.
- [ ] Markdown viewer가 긴 code block, table, link를 포함한 문서에서도 preview pane 폭을 넘겨 레이아웃을 깨지 않고 스크롤 가능하게 표시한다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `LogPreview`/Wiki knowledge preview 경로를 확인하고, Wiki 문서 본문만 `MarkdownViewer` 기반 read-only viewer mode로 전환한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_054.md` 를 `tickets/done/prd_087/prd_087.md` 로 승격하고 todo 티켓을 생성했다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 를 done 으로 보관하고 `tickets/todo/tickets_085.md` 를 만들었다. Wiki context pass 는 `markdown-viewer.tsx` 이력(`tickets/done/prd_009/prd_009.md`, `tickets/done/prd_039/prd_039.md`)과 기존 Wiki preview flow(`.autoflow/wiki/features/wiki-preview-flow.md`)를 확인했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 knowledge section `LogPreview` 호출부와 하단 `LogPreview` 구현, `apps/desktop/src/components/ui/markdown-viewer.tsx`, `.markdown-viewer`/`.knowledge-preview-pane` CSS.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_087/prd_087.md at 2026-05-01T00:14:25Z.
- Planner wiki context: `tickets/done/prd_009/prd_009.md` 와 `tickets/done/prd_039/prd_039.md` 는 `markdown-viewer.tsx` 가 기존 markdown preview 보조 처리에 쓰인 이력을 보여준다.
- Planner wiki context: `.autoflow/wiki/features/wiki-preview-flow.md` 의 hidden-by-default, select-to-open, close/reopen toggle 흐름은 유지해야 한다.
- Planner constraint: `tickets/reject/reject_003.md` 는 Wiki preview toggle 재시도가 runtime cleanup/smoke 계약 블로커로 max retry에 도달했음을 보여준다. 이 티켓은 그 reject를 재시도하지 않고 Wiki 문서 viewer mode만 다룬다.

## Verification

- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
