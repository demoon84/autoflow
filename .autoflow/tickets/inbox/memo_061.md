# Autoflow Memo

## Memo

- ID: memo_061
- Title: Planner 오케스트레이터 역할 표시
- Status: inbox
- Created At: 2026-05-01T22:22:50Z
- Source: autoflow memo create

## Request

Planner 가 오케스트레이터 역할도 하면 역할을 ai대쉬보드에 명확히 표현

요청 의미:
- AI 대쉬보드에서 planner-1이 단순 계획 담당처럼만 보이지 않게 한다.
- 현재 기본 토폴로지에서 Planner는 Orchestrator AI 역할도 하므로, runner 카드/역할 라벨/도움말/빈 상태 문구 등 사용자 노출 UI에 그 의미를 명확히 표현한다.
- 예: Plan AI만 보이는 곳은 Orchestrator/Planner 또는 오케스트레이터 역할이 드러나는 한국어 라벨로 정리한다. 정확한 문구는 기존 UI 톤에 맞춘다.

## Hints

### Scope

- 데스크톱 AI 대쉬보드에서 planner role 표시명을 Orchestrator 역할까지 드러내도록 조정한다. runner role label, singleton display wording, 안내 문구를 점검하되 runner id/role 저장값(planner-1, role=planner)과 보드 runtime 계약은 바꾸지 않는다. 긴 라벨 때문에 카드/행 레이아웃이 깨지지 않도록 styles도 필요 시 최소 보정한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
