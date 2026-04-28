# Autoflow Memo

## Memo

- ID: memo_009
- Title: Rename ticket page to Tickets
- Status: promoted
- Created At: 2026-04-28T14:49:42Z
- Source: autoflow memo create

## Request

티켓 정보 페이지 이름을 Tickets로 변경 index를 제일 앞으로 이동

## Hints

### Scope

- Desktop UI navigation label/order update

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

### Verification

- Command: npm --prefix apps/desktop run check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T15:26:40Z into `tickets/backlog/prd_036.md`.
- Scope inferred as a desktop navigation label/order change because the request names the ticket information page and asks to change its name to `Tickets` while moving its index/order to the front.
- Wiki context: `tickets/done/prd_019/prd_019.md` and `tickets/done/prd_024/prd_024.md` both point related ticket workspace work to `apps/desktop/src/renderer/main.tsx`, and code search found the relevant `settingsNavigation` item there.
