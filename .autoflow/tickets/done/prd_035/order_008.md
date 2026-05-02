# Autoflow Memo

## Memo

- ID: memo_008
- Title: Apply MUI dashboard design to stats page
- Status: promoted
- Created At: 2026-04-28T14:45:16Z
- Source: autoflow memo create

## Request

통계페이지 디자인이 mui대쉬보드 가 적용되야함

## Hints

### Scope

- desktop statistics page UI; apply MUI dashboard pattern and existing MUI theme/components

### Allowed Paths

- `apps/desktop/src`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T15:20:32Z into `tickets/backlog/prd_035.md`.
- Scope inferred as the desktop Statistics page `ReportingDashboard` and surrounding statistics layout because the request says the statistics page design should apply a MUI dashboard pattern.
- Wiki context: `./bin/autoflow wiki query . --term "statistics page" --term "MUI dashboard" --term "desktop statistics" --term "apps/desktop/src" --term "theme"` surfaced `tickets/done/prd_027/prd_027.md`, `wiki/decisions/design-kit-mui-migration.md`, `tickets/done/prd_029/prd_029.md`, and statistics-related tickets `prd_013` / `prd_018`.
