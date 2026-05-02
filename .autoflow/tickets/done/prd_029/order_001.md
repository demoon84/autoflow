# Autoflow Memo

## Memo

- ID: memo_001
- Title: Reduce page-wide font size
- Status: promoted
- Created At: 2026-04-28T14:34:12Z
- Source: autoflow memo create

## Request

페이지 전체 폰트 사이즈를 줄여줘

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T14:36:21Z into `tickets/backlog/prd_029.md`.
- Scope inferred as desktop renderer page-wide typography because the request says “페이지 전체 폰트 사이즈” and wiki context points related desktop UI styling work to `apps/desktop/src/renderer/theme.ts`, `apps/desktop/src/renderer/styles.css`, and narrowly `apps/desktop/src/renderer/main.tsx`.
