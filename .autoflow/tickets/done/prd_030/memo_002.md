# Autoflow Memo

## Memo

- ID: memo_002
- Title: Show inbox next to PRD
- Status: promoted
- Created At: 2026-04-28T14:35:03Z
- Source: autoflow memo create

## Request

인박스도 PRD옆에 보여줘

## Hints

### Scope

- desktop UI board navigation

### Allowed Paths

- `apps/desktop/src`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T14:43:32Z into `tickets/backlog/prd_030.md`.
- Scope inferred as desktop ticket workspace navigation because the request says “인박스도 PRD옆에 보여줘” and wiki context identifies the current workspace tabs as `PRD` and `발급 티켓`.
- Archived by planner-1 after `tickets/todo/tickets_030.md` was created.
