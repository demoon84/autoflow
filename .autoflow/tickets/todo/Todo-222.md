# Ticket

## Ticket

- ID: Todo-222
- PRD Key: prd_223
- Plan Candidate: Plan AI handoff from tickets/done/prd_223/prd_223.md
- Title: wiki RAG sqlite FTS5 + BM25 phase 1 도입
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T07:07:49Z

## Goal

- 이번 작업의 목표: `autoflow wiki query --rag` 가 chunk grep + 점수합산이 아니라 sqlite FTS5 의 MATCH + bm25() ranking 으로 동작하도록 phase 1 만 좁게 도입한다. order/autoflow skill 의 "Lookup Before Saving" 흐름에서 자주 0 hit 으로 떨어지는 query (예: "skill removal", "ticket-owner reject", "express order") 가 BM25 키워드 매칭으로 의미 있는 결과를 반환하게 만든다. vector embedding / hybrid re-rank 는 본 PRD 범위 밖이며 별도 후속 order/PRD 로 다룬다.

## References

- PRD: tickets/done/prd_223/prd_223.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_223]]
- Plan Note:
- Ticket Note: [[Todo-222]]

## Allowed Paths

- `.autoflow/scripts/wiki-search-index.sh`
- `packages/cli/wiki-project.sh`
- `.gitignore`
- `AGENTS.md`

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

- [ ] Implementation stays inside Allowed Paths
- [ ] Verification evidence is recorded before done/reject

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_223/prd_223.md at 2026-05-09T07:07:49Z.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow && AUTOFLOW_WIKI_FTS_INDEX=on bash .autoflow/scripts/wiki-search-index.sh && bin/autoflow wiki query --rag --term "skill removal" --limit 3 . .autoflow`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
