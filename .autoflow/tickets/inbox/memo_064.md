# Autoflow Order

## Order

- ID: order_064
- Title: Reject 레이어 딤드 표시 수정
- Status: inbox
- Created At: 2026-05-02T00:23:34Z
- Source: $order intake

## Request

딤드가 이상함

첨부 스크린샷 기준:
- AI 대쉬보드에서 반려 3건 보류 레이어를 열면 배경 딤드가 화면 전체에 회색 막처럼 덮여 보임.
- 왼쪽 사이드바와 본문 경계에서 딤드가 끊기거나 과하게 밝아 보여 모달/레이어 포커스가 어색함.
- 배경은 적절히 어두워져야 하지만, 사이드바/본문/레이어 경계가 자연스럽고 reject 레이어 자체의 가독성은 유지되어야 함.
- 다른 ORDER/PRD/TODO 상세 레이어의 overlay 동작과도 일관되게 맞춘다.

## Hints

### Scope

- 데스크톱 AI 대쉬보드의 WorkflowPinLayer/reject detail layer overlay 딤드 스타일을 조정한다. overlay 색상/투명도/backdrop-filter/레이어 z-index 또는 컨테이너 범위를 점검해 화면 전체 딤드가 어색하게 보이는 문제를 해결한다. reject 레이어뿐 아니라 ORDER/PRD/TODO 레이어 회귀도 확인한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
