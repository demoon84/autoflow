# Ticket

## Ticket

- ID: tickets_165
- PRD Key: prd_165
- Plan Candidate: Plan AI handoff from tickets/done/prd_165/prd_165.md
- Title: AI work for prd_165
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T13:13:20Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_165.

## References

- PRD: tickets/done/prd_165/prd_165.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_165]]
- Plan Note:
- Ticket Note: [[tickets_165]]

## Allowed Paths

- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.

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

- [ ] Security scan 이 악성 패턴 / secret leak 감지 → skill 생성 거부 + check 큐 적재.
- [ ] `autoflow skill import <url>` / `skill export <name>` 가 agentskills.io 형식과 정합 (Plan AI 호환 채택 결정 시).
- [ ] Cluster 감지가 비슷한 skill 묶음 후보 list 정상 생성.
- [ ] Meta-skill 추출이 cluster 의 공통 pattern 을 새 skill 로 생성 (사람 검토 후 채택).
- [ ] Deterministic mode 가 임계값 충족 skill 에서 LLM 호출 없이 직접 실행.
- [ ] Deterministic 실행 fail 시 자동 disable + LLM fallback.
- [ ] 모든 환경변수 default off 또는 default safe.
- [ ] 7일 운영 후 security scan 차단 건수 / cluster 감지 건수 / deterministic 실행 비율 측정.
- [ ] `npm run desktop:check` 통과.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_165/prd_165.md at 2026-05-03T13:13:20Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
