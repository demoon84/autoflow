# Ticket

## Ticket

- ID: Todo-224
- PRD Key: prd_224
- Plan Candidate: Plan AI handoff from tickets/done/prd_224/prd_224.md
- Title: AiConversationPanel 진행 중 활동 인디케이터 (elapsed + tokens)
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T07:17:00Z

## Goal

- 이번 작업의 목표: 데스크톱 러너 패널(`AiConversationPanel`) 하단에 실행 중일 때만 보이는 한 줄짜리 활동 인디케이터(`※ 45s · ↓ 272 tokens` 형식)를 추가해, 러너가 살아 있는지를 정량(경과 시간 + 누적 토큰) 신호로 사용자에게 알려준다. 기존 IPC 데이터 (`runner.startedAt`, `runner.lastEventAt`, `runner.tokenUsage`) 만 사용하고 새 IPC 는 만들지 않는다.

## References

- PRD: tickets/done/prd_224/prd_224.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_224]]
- Plan Note:
- Ticket Note: [[Todo-224]]

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

- [ ] AiConversationPanel 하단에 elapsed time + token 카운트가 한 줄로 표시된다 (running 시 시각 확인).
- [ ] running 일 때만 표시, idle/stopped/blocked 시 숨김 또는 dimmed 로 사용자 시각에 명확히 구분된다.
- [ ] elapsed 가 1초 주기로 자동 갱신되고, 컴포넌트 unmount 또는 러너 정지 시 setInterval/RAF 가 cleanup 되어 누수가 없다.
- [ ] elapsed 포맷은 60초 미만 `Ns` (예: `45s`), 60초 이상 `MmSSs` 또는 `Mm Ss` (예: `12m 30s`) 형식이다.
- [ ] token 카운트는 `runner.tokenUsage` 또는 telemetry token 합산 값을 그대로 사용하며 새 IPC 는 만들지 않는다.
- [ ] `prefers-reduced-motion: reduce` 사용자에서 spinner 등 회전 애니메이션이 없고, 정적 텍스트/dot 만 표시된다.
- [ ] PRD 207 의 binary 상태 badge 와 PRD 221 의 본문 타이핑 동작은 그대로 유지되고 시각 회귀가 없다.
- [ ] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_224/prd_224.md at 2026-05-09T07:17:00Z.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
