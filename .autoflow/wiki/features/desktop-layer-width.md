# Desktop Layer Width

## Overview

Desktop detail layers use fixed desktop widths with viewport caps so wider reading surfaces do not break narrow screens.

## Current Constraints

- `prd_024` established the dialog/layer pattern for PRD and ticket detail viewing.
- `prd_043` widened the main Desktop layer surfaces by 30% while preserving existing open/close behavior, scrolling, and viewport safety.
- The current CSS targets are:
  - `.workflow-pin-layer-panel`: `680px -> 884px`
  - `.ticket-detail-layer-panel`: `980px -> 1274px`
- The existing viewport caps remain part of the contract:
  - `.workflow-pin-layer-panel`: `max-width: calc(100vw - 48px)`
  - `.ticket-detail-layer-panel`: `max-width: calc(100vw - 32px)`

## Reusable Guidance

- Prefer CSS-only width adjustments before touching dialog markup or behavior.
- Preserve ESC/outside-click behavior, focus handling, markdown rendering, and scroll containment when tuning layer size.
- Keep width changes tied to the existing viewport cap pattern instead of introducing independent responsive logic per layer.

## Sources

- `tickets/done/prd_024/tickets_024.md`
- `tickets/done/prd_043/tickets_043.md`
- `tickets/done/prd_043/verify_043.md`
- Related context: [[features/ticket-workspace-tabs]]
