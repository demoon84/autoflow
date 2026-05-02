# Autoflow Order

## Order

- ID: order_069
- Title: AI 대쉬보드 카드 1열 3칸 가로 배치로 변경
- Status: inbox
- Created At: 2026-05-02T01:59:49Z
- Source: /order intake

## Request

1열 3칸 배열로 변경 하고
오케스트레이터, 워커, 위키봇 순으로 배치 한다

첨부 스크린샷 기준:
- 현재 AI 대쉬보드 워크플로 영역이 2열 grid 로 보임. 왼쪽 컬럼에 `오케스트레이터 (Plan AI)` 와 `위키봇` 두 카드가 세로로 쌓여 있고, 오른쪽 컬럼에 `Worker` 카드가 하나 크게 차 있음.
- 원하는 결과: 같은 행에 카드 3 개가 가로로 나란히 놓이는 1행 3열 레이아웃. 좌→우 순서는 `오케스트레이터` → `Worker` → `위키봇`.
- 카드 안의 내용(상태 stepper, 실행 중 표시, 토큰 사용량, 어댑터/모델/추론 셀렉트, 저장 버튼, 로그 영역)은 그대로 두고 배치/순서만 바꾸는 것이 의도.
- 좁은 화면에서 가로 3 칸이 겹쳐 보이지 않도록 너비/넘침 처리도 함께 점검.

## Hints

### Scope

- 데스크톱 AI 대쉬보드의 워크플로 카드 그리드 레이아웃을 1행 3열(오케스트레이터/Worker/위키봇 순)로 정렬한다. 각 카드 내부 콘텐츠와 기능은 그대로 둔다. 좁은 뷰포트(예: 데스크톱 창 폭 축소) 에서 카드가 깨지지 않도록 가로 overflow / min-width / wrap 동작을 같이 확인한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
