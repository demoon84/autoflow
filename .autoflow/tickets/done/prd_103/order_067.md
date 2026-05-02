# Autoflow Order

## Order

- ID: order_067
- Title: AI 프로그레스 바 좌우 전체 폭 사용
- Status: inbox
- Created At: 2026-05-02T00:53:26Z
- Source: $order intake

## Request

프로그레스 바를 좌우 꽉 채워

첨부 스크린샷 기준:
- AI 대시보드 runner 카드의 단계 프로그레스 바가 카드 중앙 일부 폭만 사용하고 좌우 여백이 크게 남아 보임.
- 대기/계획/완료/정체 단계 표시가 카드 가로 영역을 더 넓게 활용하도록 좌우로 꽉 차게 배치한다.
- 첫 단계와 마지막 단계가 카드 내부 좌우 가장자리 근처까지 자연스럽게 퍼져 보이되, 카드 border/패딩과 겹치지 않아야 한다.
- Planner/Worker/위키봇 등 모든 runner progress track에서 일관되게 보이도록 한다.

## Hints

### Scope

- 데스크톱 AI 대시보드의 `.ai-progress-track` 단계 트랙/스텝 레이아웃을 조정해 프로그레스 바가 카드 내부 가용 폭을 좌우로 충분히 채우게 한다. 현재 styles.css의 `--progress-track-inset`, `--progress-track-width`, `.ai-progress-step`/track pseudo element 계산을 점검한다. 단계 label과 dot이 카드 border, 상태 badge, config controls와 겹치지 않도록 반응형도 함께 확인한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
