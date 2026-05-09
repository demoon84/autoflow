# Autoflow Order

## Order

- ID: order_189
- Title: Planner backlog PRD 우선 처리 정책
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T05:25:01Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Planner 가 backlog PRD 가 남아있으면 inbox order 보다 PRD → Todo 흐름을 우선 처리
- Priority: normal
- Status: ready


플래너가 order/prd를 처리 할때 prd가 남아 있다면 prd를 먼저 작성하게 하는건 어떨까?

## Notes

- 사용자 의도: Planner 매 tick 에서 (a) `tickets/backlog/prd_*.md` 에 대기중인 PRD 가 있고 (b) `tickets/inbox/order_*.md` 에 새 order 가 있을 때, **(a) 의 backlog PRD 를 Todo 티켓으로 변환하는 것을 (b) 의 새 PRD 작성보다 먼저** 처리하자는 제안. WIP-first 정책.
- 효과: backlog bloat 줄어듦, 진행 중 작업이 새 작업보다 먼저 끝남, 진행 예측 가능성 향상.
- Tradeoff:
  - 새 order 가 high/critical 인데도 backlog PRD 가 normal priority 면 우선순위 역전이 일어남 → AGENTS.md rule 20 의 priority sort (critical/high/normal/low) 가 카테고리 사이에도 적용돼야 함. 즉 **priority 가 카테고리(backlog vs inbox)보다 우선**, 같은 priority 안에서 backlog PRD 가 inbox order 보다 우선.
  - backlog PRD 가 영원히 Todo 로 못 변환되는 stuck 상태면 inbox 가 영원히 starvation. 가드: 같은 PRD 가 N tick 연속 stuck 이면 inbox 처리로 fallback.
- 구현 후보 위치:
  - `.autoflow/scripts/start-plan.sh` (loop runner 의 plan tick 진입점) 에서 후보 enumerate 부분.
  - `.autoflow/agents/spec-author-agent.md` (PRD 작성 흐름) 와 `.autoflow/agents/plan-to-ticket-agent.md` (PRD → Todo 변환 흐름) 의 contract 명시.
  - `.autoflow/agents/agent-definitions.md` 또는 비슷한 메타 문서에 우선순위 규칙 갱신.
- 구현 대안 비교 (planner 가 결정):
  - **A** (제안 그대로): 같은 priority 안에서 backlog PRD → inbox order 순. starvation 가드는 stuck-tick 카운트.
  - **B**: backlog PRD 가 1개 이상 있으면 그 tick 에는 inbox 처리 자체 skip (단순). starvation 가드 더 강하게 필요.
  - **C**: tick 마다 round-robin (한 번은 backlog, 한 번은 inbox). 단순하지만 backlog 가 빨리 비지 않음.
- AGENTS.md rule 20 의 priority enum 은 그대로 유지. 카테고리 간 우선순위만 추가.
- 회귀 가드:
  - retry order (`order_*_retry_*.md`) 는 기존 PRD 와 묶여 있으므로 inbox 그대로 처리해야 backlog PRD 와 자연스러운 매칭. retry 는 일반 order 와 다른 카테고리로 구분 가능.
  - express order (rule 21) 는 PRD 단계 자체를 건너뛰므로 우선순위 정책에서 제외.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
