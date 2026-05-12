# Ticket

## Ticket

- ID: Todo-295
- PRD Key: prd_283
- Plan Candidate: `plan-to-ticket-agent.md` "Allowed Paths 자동 추론" 단계 신설 + `promote-order-to-ticket.ts` 신규 (키워드 추출 → wiki RAG → git grep → 후보 평가 → Express 승격/fallback 분기) + 자동 승격 confidence 마킹.
- Title: Express path 자동 승격 — Planner가 inbox order의 Allowed Paths 추론
- Priority: normal
- Change Type: code
- Stage: inprogress
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `plan-to-ticket-agent.md`에 "Allowed Paths 자동 추론" 단계를 신설한다: inbox order 본문 키워드 추출 → `autoflow wiki query --rag` → git grep 매칭 → 후보 ≤3개 + 일치도 임계 이상 시 Express 자동 승격.
- Done When도 본문에서 "관찰 가능한 동사" 추출해 체크리스트 자동 생성.
- 자동 승격 시 ticket Notes에 "Express auto-promoted (confidence: high)" 마킹.
- `.autoflow/scripts/promote-order-to-ticket.ts` 신규 작성.

## References

- PRD: tickets/done/prd_283/prd_283.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_283]] — order_297(wiki vector RAG) 머지 시 회상 정확도 향상.
- Plan Note:
- Ticket Note:

## Allowed Paths

- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/scripts/promote-order-to-ticket.ts`

## Worktree

- Branch:
- Path:
- Base:
- Created At:

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
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] inbox에 Allowed Paths 없이 자연어만 있는 order 투입 시 Planner가 후보 추론
- [x] 후보가 ≤3개 + 일치도 임계 이상이면 Express 승격 (Express: true 박힘)
- [x] 모호한 order는 PRD 흐름 fallback (회귀)
- [x] 자동 승격 ticket의 Notes에 confidence 표기

## Next Action

- `plan-to-ticket-agent.md`에 "Allowed Paths 자동 추론" 단계 초안 작성.

## Resume Context

- Current state: todo — 작업 시작 전.
- Last completed action: Planner가 prd_283에서 티켓 생성.
- First thing to inspect on resume: `plan-to-ticket-agent.md`의 Express path 처리 흐름 확인.

## Notes

- Mini-plan: (1) `promote-order-to-ticket.ts` 신규 (키워드 추출 + wiki RAG + git grep + 후보 평가) → (2) `plan-to-ticket-agent.md` 단계 추가 → (3) confidence 마킹 → (4) fallback 회귀 테스트.
- Progress:

## Verification

- Command: 가짜 inbox order ("renderer-tickets-pin-card.tsx의 progress bar 색 변경") 투입 후 promote 결과 확인
- Run file:
- Result:

## Result

- Summary: plan-to-ticket-agent.md step 6a 추가 (Allowed Paths 자동 추론 + Express 자동 승격 절차). promote-order-to-ticket.ts 신규 작성 (키워드 추출 → wiki RAG → git grep → 후보≤3 판정 → Express 승격/fallback).
- Commit:
