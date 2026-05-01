# Autoflow Memo

## Memo

- ID: memo_056
- Title: 대기 Order 항목 삭제 버튼
- Status: inbox
- Created At: 2026-05-01T00:30:20Z
- Source: autoflow memo create

## Request

대기중인 항목을 삭제 하고 싶을 경우가 있을 수 있으므로 삭제 버튼 추가. 스크린샷 기준 Order 탭의 tickets/inbox 대기 항목 카드에서 삭제할 수 있어야 함.

## Hints

### Scope

- 데스크톱 앱 Order 탭의 tickets/inbox/memo_*.md 대기 항목 카드에 삭제 버튼을 추가한다. 삭제는 아직 대기중인 inbox Order 항목에만 적용하고, 확인 절차 후 해당 memo 파일을 제거하거나 안전하게 삭제 처리한 뒤 보드 목록을 새로고침한다. PRD, 발급 티켓, done/reject 항목 삭제는 이번 범위에서 제외한다.

### Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/dialog.tsx`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
