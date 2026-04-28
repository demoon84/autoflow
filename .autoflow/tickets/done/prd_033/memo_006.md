# Autoflow Memo

## Memo

- ID: memo_006
- Title: Hide unwanted Esc focus artifact
- Status: promoted
- Created At: 2026-04-28T14:44:09Z
- Source: autoflow memo create

## Request

esc 키를 누르면 이렇게 안보였으면 좋겠어 mui인거 같아

Screenshot: /var/folders/2m/xlbkckq158l79qnmb9ytdrnm0000gn/T/TemporaryItems/NSIRD_screencaptureui_pDFg40/스크린샷 2026-04-28 오후 11.43.37.png

## Hints

### Scope

- desktop UI MUI focus/selection state after Escape key; inspect ticket chip/input styling shown in screenshot

### Allowed Paths

- `apps/desktop/src`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI may promote this memo into a generated backlog PRD and todo ticket when scope, allowed paths, and verification can be made concrete.
- If the memo is too ambiguous or unsafe, Plan AI must set `Status: needs-info` and record the smallest required question instead of creating implementation work.

## Planner Notes

- Promoted by planner-1 at 2026-04-28T15:09:23Z into `tickets/backlog/prd_033.md`, then runtime archived the PRD to `tickets/done/prd_033/prd_033.md` and created `tickets/todo/tickets_033.md`.
- Screenshot was accessible during planning and showed a `#tickets_029` tag/chip with a grey selected block and heavy rounded outline after Escape.
- Wiki context: exact Esc/MUI focus-artifact query returned no direct prior result; broad MUI desktop query surfaced `wiki/decisions/design-kit-mui-migration.md`, `tickets/done/prd_027/prd_027.md`, and `tickets/done/prd_029/prd_029.md`.
