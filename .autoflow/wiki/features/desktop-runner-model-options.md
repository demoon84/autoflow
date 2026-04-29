# Desktop Runner Model Options

## Overview

Desktop runner model lists should expose only supported provider/model combinations while preserving the provider itself as a selectable choice.

## Current Constraints

- Gemini remains a supported runner provider in Desktop AI management.
- Unsupported Gemini 3.1 preview entries were removed from `runnerAgentModelOptions.gemini`.
- The supported Gemini list after `prd_040` keeps `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite`.
- This was intentionally an option-list-only change in `apps/desktop/src/renderer/main.tsx`; runner lifecycle, command construction, and saved-value normalization were preserved.

## Reusable Guidance

- When Desktop provider/model controls are updated, keep the scope narrow: adjust model lists separately from runner adapter logic.
- Preserve Gemini as a selectable provider unless a later ticket explicitly changes provider support.
- Treat adjacent `main.tsx` work as overlap-prone and avoid mixing model catalog cleanup with unrelated UI or navigation edits.

## Sources

- `tickets/done/prd_040/tickets_040.md`
- `tickets/done/prd_040/verify_040.md`
- Related context: [[features/wiki-bot-codex-adapter]]
