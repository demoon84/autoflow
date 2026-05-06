# Ticket

## Ticket

- ID: tickets_192
- PRD Key: prd_193
- Plan Candidate: Plan AI handoff from tickets/done/prd_193/prd_193.md
- Title: 러너 설정 화면의 저장하고 재시작 버튼 제거
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-06T00:07:59Z

## Goal

- 이번 작업의 목표: 데스크톱 러너 설정 화면에서 일반 저장 흐름은 유지하면서, 저장과 재시작을 함께 수행하는 별도 버튼만 사용자에게 보이지 않게 제거한다.

## References

- PRD: tickets/done/prd_193/prd_193.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_193]]
- Plan Note:
- Ticket Note: [[tickets_192]]

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

- [ ] `apps/desktop/src/renderer/main.tsx` 에서 사용자에게 보이는 `저장하고 재시작` 버튼 또는 동일 의미의 별도 save+restart control 이 runner 설정 화면/카드에 렌더링되지 않는다.
- [ ] 일반 `저장` 버튼은 그대로 남아 있고, 모델/추론 변경 후 기존 저장 흐름으로 runner config 를 저장할 수 있다.
- [ ] 저장 적용 대기/dirty indicator/disabled 상태 등 기존 일반 저장 UX 는 제거된 save+restart 버튼과 무관하게 유지된다.
- [ ] `save and restart` 전용 style/class 가 남아 있으면 버튼 제거 후 레이아웃에 불필요한 빈 공간이나 어색한 gap 을 만들지 않게 정리된다.
- [ ] Backend IPC, runner restart command, start/stop/restart action guard, config apply fingerprint logic 은 이 티켓에서 변경하지 않는다.
- [ ] `npm run desktop:check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_193/prd_193.md`의 범위와 prior-ticket constraints를 확인하고, visible `저장하고 재시작` 버튼 제거, 필요 시 spacing cleanup, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- Current state: Plan AI 가 `order_177`을 `prd_193`과 `tickets_192`로 승격했다. 작업은 visible save+restart affordance 제거에 한정된다.
- Last completed action: wiki RAG query for `저장하고 재시작 runner settings save restart apps desktop main.tsx styles.css` returned `result_count=0`; direct ticket search found relevant prior constraints in `prd_174`, `prd_021`, and `prd_028`.
- First thing to inspect on resume: `apps/desktop/src/renderer/main.tsx` 에서 runner 설정 저장 버튼들이 렌더링되는 컴포넌트와 `tickets/done/prd_174/prd_174.md`의 config apply feedback 경계를 먼저 확인한다.

## Notes

- Created by planner (Plan AI) from `tickets/done/prd_193/prd_193.md` at 2026-05-06T00:07:59Z.
- Planner wiki pass: `bin/autoflow wiki query --term "저장하고 재시작 runner settings save restart apps desktop main.tsx styles.css" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_174/prd_174.md` added save/restart as an explicit config apply affordance. Remove only the visible separate button; do not remove config apply evidence or runner restart plumbing that may be reused elsewhere.
- Relevant prior ticket: `tickets/done/prd_021/tickets_021.md` established shared runner config controls across desktop cards. Preserve the ordinary save control and shared draft state.
- Relevant prior ticket: `tickets/done/prd_028/prd_028.md` is the closest narrow UI-removal precedent: remove visible restart affordance while preserving underlying start/stop behavior.
- Runtime note: `start-plan.sh` returned idle even though `order_177` existed in inbox, so this planner tick promoted the order directly from board state and preserved that evidence in the PRD Notes.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Result: pending

## Result

- Summary:
- Commit:
