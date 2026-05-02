# Autoflow Order

## Order

- ID: order_066
- Title: 오케스트레이터 라벨 단독 표기
- Status: inbox
- Created At: 2026-05-02T00:52:49Z
- Source: $order intake

## Request

오케스트레이터만 표기

첨부 스크린샷 기준:
- AI 대시보드 runner 카드 제목이 현재 `오케스트레이터 (Plan AI)`처럼 보임.
- 화면에는 괄호 안 `Plan AI` 설명을 붙이지 말고 `오케스트레이터`만 표시한다.
- planner 내부 role/id/runtime 값은 바꾸지 않고 사용자 노출 라벨만 정리한다.
- 관련 안내 문구에서도 같은 화면에 중복으로 `Plan AI`가 붙어 어색하면 기존 UI 톤에 맞게 간결하게 정리한다.

## Hints

### Scope

- 데스크톱 AI 대시보드의 planner/orchestrator 사용자 노출 라벨을 `오케스트레이터` 단독 표기로 바꾼다. `displayRunnerDisplayName`, runner role label, empty/help copy 등 동일 화면에서 planner를 설명하는 문구를 점검하되 저장값 role=planner, runner id, runtime contract는 유지한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
