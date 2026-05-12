# Autoflow Order

## Order

- Title: Express path 자동 승격 — Planner 가 inbox order 의 Allowed Paths 추론
- Priority: normal
- Status: ready
- Change Type: code

## Request

현재 Express path 는 사용자가 Allowed Paths / Done When 을 inbox order 에 직접
박아야 동작. 자율주행 목표는 "한 줄 던지면 도착" 이므로 Planner 가 inbox 본문 +
wiki RAG + repo grep 으로 Allowed Paths 후보를 자동 추론해 Express 로 승격해야 함.

해야 할 것:
1. .autoflow/agents/plan-to-ticket-agent.md 에 "Allowed Paths 자동 추론" 단계 신설
   - inbox order 본문에서 키워드 추출
   - autoflow wiki query --rag 로 관련 파일군 회상
   - git grep 으로 키워드 매칭 파일 후보 집계
   - 후보가 ≤3개로 좁고 일치도 높으면 Express 자동 승격
   - 모호하면 일반 PRD 흐름으로 fallback (현 동작)
2. Done When 도 본문에서 "관찰 가능한 동사" (예: "표시한다", "통과한다") 추출해
   체크리스트 자동 생성
3. 자동 승격 시 ticket 본문 Notes 에 "Express auto-promoted (confidence: high)" 마킹

## Allowed Paths

- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/scripts/promote-order-to-ticket.ts

## Done When

- [ ] inbox 에 Allowed Paths 없이 자연어만 있는 order 투입 시 Planner 가 후보 추론
- [ ] 후보가 ≤3개 + 일치도 임계 이상이면 Express 승격 (Express: true 박힘)
- [ ] 모호한 order 는 PRD 흐름 fallback (회귀)
- [ ] 자동 승격 ticket 의 Notes 에 confidence 표기

## Verification

- Command: 가짜 inbox order ("renderer-tickets-pin-card.tsx 의 progress bar 색 변경") 투입 후 promote 결과 확인

## Notes

- order_297(wiki vector RAG) 가 먼저 머지되면 회상 정확도 상승
- 자동 승격 confidence 낮으면 안전하게 PRD fallback (1원칙: 모호하면 전진하되 안전망)
