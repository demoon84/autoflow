# Ticket

## Ticket

- ID: Todo-220
- PRD Key: prd_221
- Plan Candidate: Plan AI handoff from tickets/done/prd_221/prd_221.md
- Title: AiConversationPanel 라이브 어댑터 스트림 타이핑 애니메이션
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T06:31:16Z

## Goal

- 이번 작업의 목표: AiConversationPanel 본문에 글자 단위 타이핑 애니메이션을 추가해 codex/claude/gemini 어댑터의 stdout chunk 가 한꺼번에 dump 되지 않고 차례로 흘러나오게 한다. ANSI 색상 span 무결성과 prefers-reduced-motion fallback, 큐 catch-up flush 를 함께 보장한다.

## References

- PRD: tickets/done/prd_221/prd_221.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_221]]
- Plan Note:
- Ticket Note: [[Todo-220]]

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

- [ ] AiConversationPanel 본문에 새 stdout chunk 가 도착하면 글자가 차례로 뜨는 타이핑 애니메이션이 적용된다 (visual confirmation).
- [ ] 큐 길이가 임계 (예: 800자) 를 넘으면 즉시 flush 로 catch-up — 어댑터가 빨리 뱉어도 표시가 영원히 뒤쳐지지 않는다.
- [ ] ANSI 색상 span 이 깨지지 않는다 — color span 안에서만 글자 단위로 release, span 자체는 분할되지 않는다.
- [ ] `prefers-reduced-motion: reduce` 사용자는 애니메이션이 비활성되고 기존 instant render 동작과 동일하다.
- [ ] AiConversationPanel 헤더 / 다른 패널 / 다른 카드 / 자동 스크롤 동작에 시각적 회귀가 없다.
- [ ] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 가 이 티켓을 todo 에서 claim 한 뒤 mini-plan, AiConversationPanel 본문 글자 큐 도입, ANSI span 보존, reduced-motion fallback, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 order_193 을 generated PRD 로 승격하고 todo 티켓을 만든 직후.
- 직전 작업: scripts/start-plan.sh 가 inbox order 를 식별 → planner 가 prd_221 작성 → Todo-220 생성, order 는 tickets/done/prd_221/order_193.md 로 보관.
- 재개 시 먼저 볼 것: PRD prd_221, AiConversationPanel 본문 (`apps/desktop/src/renderer/main.tsx` 약 line 6364 주변), prd_207 헤더 인디케이터 회귀 가드.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_221/prd_221.md at 2026-05-09T06:31:16Z.
- Source order: order_193 — 라이브 어댑터 스트림 타이핑 애니메이션 요청. 후보 구현 안 A (글자 큐 + setTimeout/RAF) 권장, 안 B/C 비추천 사유는 PRD Notes 참고.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
