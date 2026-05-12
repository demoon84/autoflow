# Autoflow Order

## Order

- ID: order_312
- Title: 데스크탑 AI Autoflow runner 카드 순서 재배치
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T06:51:22Z
- Source: autoflow order create

## Request

데스크탑 dashboard / 설정의 AI Autoflow runner 카드 grid 배치를 아래처럼 조정해서 발행한다.

요청 기준:
- 헤더/summary 아래 AI Autoflow 영역에서 왼쪽은 Planner 1칸이 row 2개를 세로 span 한다.
- 오른쪽은 2 col x 2 row 격자다.
- 모든 gap은 --workflow-grid-gap (12px)를 유지한다.
- 카드 순서/위치는 다음처럼 조정한다.
  - 1/4: Worker (오른쪽 상단 왼쪽)
  - 2/4: Verifier (오른쪽 상단 오른쪽)
  - 3/4: Worker-2 (오른쪽 하단 왼쪽)
  - 4/4: LLM Wiki (오른쪽 하단 오른쪽)
- 즉 기존 예시의 Worker-2 / LLM Wiki / Verifier 위치가 다르면 위 순서로 맞춘다.
- Planner는 왼쪽 1fr 영역에서 두 row를 span 하므로 카드 키가 길어져도 된다.
- 오른쪽 2x2 카드들은 기존 prd_292/order_306의 높이 정렬 의도도 유지한다.

참고: 첨부 이미지의 마지막 수정 지시: "2/4 Verifier, 3/4 Worker-2, 4/4 LLM Wiki 이렇게 조정해서 발행".

## Hints

### Scope

- Desktop settings AI Autoflow runner progress board card ordering/layout only

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npm run check; desktop dev 화면에서 AI Autoflow grid의 DOM 순서/위치와 카드 height를 확인

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
