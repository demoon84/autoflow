# Autoflow Memo

## Memo

- ID: memo_004
- Title: Keep wiki page expanded
- Status: promoted
- Created At: 2026-04-28T14:35:56Z
- Source: autoflow memo create

## Request

위키 페이지를 항상 펼쳐있는 UI로 변경 이전 작업내역 참고

## Hints

### Scope

- desktop UI wiki page; reference previous done tickets and wiki history

### Allowed Paths

- `apps/desktop/src`
- `.autoflow/wiki`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T14:57:47Z into `tickets/backlog/prd_032.md`.
- Scope inferred as a narrow desktop Wiki preview-state change because the request says “위키 페이지를 항상 펼쳐있는 UI로 변경” and wiki context identifies the existing hidden-by-default preview flow from `prd_003`.
- Archived by planner-1 after `tickets/todo/tickets_032.md` was created.
