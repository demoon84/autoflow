# Ticket

## Ticket

- ID: Todo-250
- PRD Key: prd_245
- Plan Candidate: Plan AI handoff from tickets/done/prd_245/prd_245.md
- Title: Stats page 4 cards inline SVG visualization
- Priority: normal
- Change Type: code
- Stage: todo
- AI: 
- Claimed By: 
- Execution AI: 
- Verifier AI:
- Last Updated: 2026-05-10T09:07:42Z

## Goal

- 이번 작업의 목표: 데스크톱 통계 페이지의 4종 카드(코드 영향 / 토큰 사용량 / 러너 상태 / 완료 커밋)에 각각 inline SVG 시각화를 1개 이상 추가한다. 외부 차트 라이브러리는 도입하지 않으며, 데이터 없을 때 기존 fallback 메시지("러너 실행 후 채워집니다") 를 그대로 유지한다. 기존 `CompletionTrend` / `ReportBarBreakdown` / `ReportSplitBar` 패턴을 확장 또는 재사용해 일관된 형태를 유지한다.

## References

- PRD: tickets/done/prd_245/prd_245.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_245]]
- Plan Note:
- Ticket Note: [[Todo-250]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/main.js`
- `packages/cli/metrics-project.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_250`
- Branch: autoflow/tickets_250
- Base Commit: ee23cd3a6a97c00374b6e14cff5d542fbb5c310a
- Worktree Commit: 
- Integration Status: pending

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
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] 통계 페이지 코드 영향 카드에 inline SVG 시각화(예: 일자별 추가/삭제 stacked bar)가 표시된다.
- [ ] 통계 페이지 토큰 사용량 카드에 inline SVG 시각화(예: 24h 추세 line/area 또는 러너별 분해 stacked bar)가 표시된다.
- [ ] 통계 페이지 러너 상태 카드에 inline SVG 시각화(예: 24h tick 결과 timeline 점 또는 평균 tick 시간 막대)가 표시된다.
- [ ] 통계 페이지 완료 커밋 카드에 inline SVG 시각화(예: 14일 commit count bar)가 표시된다.
- [ ] 데이터가 비어 있는 카드는 기존 fallback 메시지("러너 실행 후 채워집니다") 를 그대로 보여 준다.
- [ ] `apps/desktop/package.json` dependencies / devDependencies 가 변경되지 않는다(외부 차트 의존성 추가 금지).
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 가 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다. 먼저 현재 4개 카드의 데이터 흐름과 기존 inline SVG 컴포넌트를 읽고 누락된 집계 키만 최소 보강한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 inbox order_218 을 prd_245 로 승격하고 todo 티켓을 생성한 직후.
- 직전 작업: planner 가 `tickets/inbox/order_218.md` 를 `tickets/done/prd_245/` 로 옮기고 generated PRD 와 Todo-250 을 만들었다.
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_245/prd_245.md`, Goal, Allowed Paths, Done When, prd_241 본문(차트 가이드 원본).

## Notes

- Created by planner (Plan AI) from tickets/done/prd_245/prd_245.md at 2026-05-10T07:19:26Z.
- 원 order: `tickets/done/prd_245/order_218.md` (이전 위치 `tickets/inbox/order_218.md`).
- 참조 PRD: `[[prd_241]]` (차트 설계 원본). `[[prd_240]]`, `[[prd_204]]` 도 카드 상세/구성 컨텍스트 제공.

- Runtime hydrated worktree dependency at 2026-05-10T09:07:42Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
