# Ticket

## Ticket

- ID: Todo-252
- PRD Key: prd_247
- Plan Candidate: Plan AI handoff from tickets/done/prd_247/prd_247.md
- Title: 라이브 터미널 폰트 크기 12px → 10px
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-10T09:04:12Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 라이브 PTY 터미널(LivePtyView) 글자 크기를 12px 에서 10px 로 줄여 한 화면에 더 많은 출력이 보이도록 한다. xterm.js 가 사용하는 `LIVE_TERMINAL_FONT_SIZE` 상수 하나만 변경하고, 두 개의 `new Terminal({ fontSize: ... })` 호출이 같은 상수를 계속 공유하게 유지한다.

## References

- PRD: tickets/done/prd_247/prd_247.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_247]]
- Plan Note:
- Ticket Note: [[Todo-252]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

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

- [ ] `apps/desktop/src/renderer/main.tsx` 의 `LIVE_TERMINAL_FONT_SIZE` 상수가 `10` 으로 변경되어 있다.
- [ ] `apps/desktop/src/renderer/main.tsx` 의 두 `new XTermTerminal({ fontSize: ... })` 호출이 같은 `LIVE_TERMINAL_FONT_SIZE` 상수를 계속 사용하며, 별도 하드코딩은 없다.
- [ ] `rg -n "LIVE_TERMINAL_FONT_SIZE" apps/desktop/src/renderer/main.tsx` 결과가 상수 정의 1회와 사용 2회만 보여준다.
- [ ] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by 019e111c-4a35-7701-8bc8-461a135580e4 (Plan AI) from tickets/done/prd_247/prd_247.md at 2026-05-10T09:04:12Z.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
