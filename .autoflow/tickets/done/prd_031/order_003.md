# Autoflow Memo

## Memo

- ID: memo_003
- Title: Remove AI management menu and page
- Status: promoted
- Created At: 2026-04-28T14:35:23Z
- Source: autoflow memo create

## Request

AI관리 메뉴를 없애줘 ai 관리 페이지도 삭제

## Hints

### Scope

- desktop UI navigation and AI management page

### Allowed Paths

- `apps/desktop/src`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T14:52:56Z into `tickets/done/prd_031/prd_031.md` and `tickets/todo/tickets_031.md`.
- Scope inferred as desktop navigation/page routing removal because the request says “AI관리 메뉴” and “ai 관리 페이지도 삭제”; memo hints narrowed Allowed Paths to `apps/desktop/src` and verification to `npm run desktop:check`.
- Wiki context requires preserving workflow page runner controls from `prd_021` while removing only the separate management surface.
