# Autoflow Order

## Order

- ID: order_183
- Title: 데스크톱 메뉴명 변경: AI 진행 현황 → AI AutoFlow
- Status: inbox
- Priority: normal
- Created At: 2026-05-08T05:47:55Z
- Source: autoflow order create

## Request

데스크톱 앱의 'AI 진행 현황' 메뉴 이름을 'AI AutoFlow' 로 변경한다.

apps/desktop/src/renderer/ 안에서 'AI 진행 현황' 텍스트가 사용되는 모든 위치를 찾아 'AI AutoFlow' 로 교체한다 (메뉴 라벨, aria-label, tab 이름, 화면 제목 등). 같은 메뉴 영역의 한국어 표기 일관성을 유지한다.

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
