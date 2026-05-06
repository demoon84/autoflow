# Autoflow Order

## Order

- ID: order_178
- Title: 모델 변경 토글 제거 및 상시 표시
- Status: inbox
- Priority: normal
- Created At: 2026-05-05T23:53:44Z
- Source: autoflow order create

## Request

오른쪽 러너/AI 카드의 모델 변경 토글 버튼을 제거하고, 모델 변경 설정 영역이 항상 보이도록 수정한다.

## Hints

### Scope

- 데스크톱 앱 오른쪽 러너 진행/설정 카드에서 모델 변경 설정을 접고 펼치는 토글 버튼을 없앤다. 모델/추론 effort 등 기존 모델 변경 컨트롤은 항상 렌더링되게 유지한다. 시작/중지/강제 종료 같은 러너 제어 버튼은 유지한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
