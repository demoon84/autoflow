# Autoflow Memo

## Memo

- ID: memo_012
- Title: Move Work menu item to top
- Status: inbox
- Created At: 2026-04-28T20:54:51Z
- Source: autoflow memo create

## Request

좌측 메뉴 작업을 맨위로

## Hints

### Scope

- Move the left sidebar Work/작업 menu item to the top of the navigation order.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: npm --prefix apps/desktop run check

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
