# Ticket

## Ticket

- ID: tickets_193
- PRD Key: prd_194
- Plan Candidate: Plan AI handoff from tickets/done/prd_194/prd_194.md
- Title: 오른쪽 러너/AI 카드 모델 변경 설정 항상 표시
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-06T00:13:05Z

## Goal

- 이번 작업의 목표: 데스크톱 오른쪽 러너/AI 카드에서 모델 변경 설정 접기/펼치기 토글을 제거하고, 모델/추론 설정 영역을 항상 보이게 한다.

## References

- PRD: tickets/done/prd_194/prd_194.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_194]]
- Plan Note:
- Ticket Note: [[tickets_193]]

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

- [ ] 오른쪽 러너/AI 카드에서 모델 변경 설정 영역을 접거나 펼치는 사용자 노출 toggle button/control 이 렌더링되지 않는다.
- [ ] 모델 selector, 추론 effort selector, 일반 저장 버튼, dirty indicator 가 카드에서 항상 보이는 설정 영역으로 렌더링된다.
- [ ] 모델/추론 변경 후 기존 일반 저장 흐름과 `config_applying`/적용 대기 UI 는 유지된다.
- [ ] 시작/중지/강제 종료 같은 runner lifecycle control 은 기존처럼 렌더링되고 동일 handler 를 호출한다.
- [ ] 제거된 toggle 전용 style/class 가 남아 있으면 불필요한 빈 공간, 접힘 상태 잔재, 어색한 gap 을 만들지 않게 정리된다.
- [ ] Backend IPC, runner restart/start/stop/kill command, config apply fingerprint logic 은 이 PRD에서 변경하지 않는다.
- [ ] `npm run desktop:check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_194/prd_194.md`의 범위와 prior-ticket constraints를 확인하고, 오른쪽 러너/AI 카드의 모델 변경 설정 toggle 제거, 상시 표시 유지, 필요 시 spacing cleanup, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_178`을 `prd_194`와 `tickets_193`으로 승격했다. 작업은 오른쪽 러너/AI 카드의 모델 변경 설정 접기/펼치기 toggle 제거와 설정 영역 상시 표시로 제한된다.
- 직전 작업: wiki RAG query for `모델 변경 토글 오른쪽 러너 AI 카드 model change settings apps/desktop src/renderer main.tsx styles.css` returned `result_count=0`; direct ticket search found relevant prior constraints in `prd_021`, `prd_174`, and `prd_193`.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `RunnerConfigControls` 및 오른쪽 runner/AI card 렌더링 경로에서 모델/추론/저장 controls가 조건부 접힘 상태로 감싸져 있는지 확인한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_194/prd_194.md at 2026-05-06T00:13:05Z.
- Planner wiki pass: `bin/autoflow wiki query --term "모델 변경 토글 오른쪽 러너 AI 카드 model change settings apps/desktop src/renderer main.tsx styles.css" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_021/tickets_021.md` introduced shared runner model/reasoning/save controls in workflow cards. Preserve ordinary model/reasoning/save behavior while removing only the collapse/expand toggle affordance.
- Relevant prior ticket: `tickets/done/prd_174/prd_174.md` established config apply waiting feedback around runner config saves. Preserve `config_applying`/applied fingerprint behavior and do not treat IPC save as completion.
- Relevant prior ticket: `tickets/done/prd_193/prd_193.md` is adjacent runner settings UI cleanup. Follow the same narrow pattern: remove only the visible affordance requested, not underlying runner lifecycle or config plumbing.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
