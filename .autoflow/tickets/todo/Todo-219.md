# Ticket

## Ticket

- ID: Todo-219
- PRD Key: prd_220
- Plan Candidate: Plan AI handoff from tickets/done/prd_220/prd_220.md
- Title: 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간)
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T06:28:29Z

## Goal

- 이번 작업의 목표: 데스크톱 통계 카드의 "처리 시간" 라벨과 sub 텍스트를 사용자가 한 눈에 의미를 파악할 수 있게 풀어쓴다. Badge 는 `평균 처리 시간` 으로 바꾸고, sub 라벨은 `lead {avgLead} / 누적 24h {duration24h}` 처럼 짧은 키만 적힌 형태에서 lead/누적 24h 의 실제 의미가 드러나는 한국어 표현으로 교체한다.

## References

- PRD: tickets/done/prd_220/prd_220.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_220]]
- Plan Note:
- Ticket Note: [[Todo-219]]

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

- [ ] `apps/desktop/src/renderer/main.tsx` 의 처리 시간 카드 Badge 텍스트가 `처리 시간` 에서 `평균 처리 시간` 으로 변경되어 있다.
- [ ] 같은 카드 sub 라인이 `lead {avgLead} / 누적 24h {duration24h}` 형태에서 lead 와 누적 24h 의 의미가 드러나는 풀어쓴 한국어 표현으로 교체되어 있다.
- [ ] hover `title` 의 raw 디버그 표기(`n=, lead=Xs, active=Ys, ticks=Z, 24h=Ws`) 는 변경되지 않은 채 유지된다.
- [ ] 다른 두 카드(`변경 코드량`, `토큰 사용량`) 의 Badge 텍스트 / sub / 정렬이 변경되지 않는다.
- [ ] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_220/prd_220.md at 2026-05-09T06:28:29Z.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
