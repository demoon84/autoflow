# Autoflow Memo

## Memo

- ID: memo_007
- Title: Delete Knowledge UI item
- Status: promoted
- Created At: 2026-04-28T14:44:41Z
- Source: autoflow memo create

## Request

delete

Screenshot: /var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/TemporaryItems/NSIRD_screencaptureui_omzSwb/스크린샷 2026-04-28 오후 11.44.19.png
Context: Knowledge UI item/header shown in screenshot.

## Hints

### Scope

- desktop UI Knowledge navigation/header removal; confirm exact target from screenshot if ambiguous

### Allowed Paths

- `apps/desktop/src`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T15:13:59Z into `tickets/backlog/prd_034.md`.
- Scope inferred as a narrow desktop Wiki/Knowledge in-page header removal because the screenshot shows a book icon plus `Knowledge` text and a code search found that visible label in `apps/desktop/src/renderer/main.tsx`.
- Wiki context: direct query for `Delete Knowledge UI item Knowledge header apps/desktop/src desktop:check` returned no direct matches; broader `Knowledge`, `desktop UI`, and `apps/desktop/src` query surfaced `tickets/done/prd_032/prd_032.md` and `wiki/features/wiki-preview-flow.md`, so the generated PRD preserves existing Wiki list/query/preview behavior and limits implementation to renderer header/spacing files.
