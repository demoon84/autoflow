---
kind: decision
slug: design-kit-mui-migration
title: "Decision: Migration to MUI Design Kit"
created: 2026-04-28T21:20:26Z
updated: 2026-04-28T21:20:26Z
tags:
  - decision
  - design-kit-mui-migration
  - decisions
---

# Decision: Migration to MUI Design Kit

This page records a historical migration decision from late April 2026. It is not the current blanket rule for new Desktop work: the active board policy in `AGENTS.md` now prefers local shadcn-style React components owned in-app with `lucide-react` icons for new Desktop changes, while existing MUI-era surfaces remain part of the historical codebase and wiki record.

## Context
The Autoflow desktop application initially used a custom design kit based on shadcn/ui, Radix primitives, and Tailwind CSS. While functional, the team decided to migrate to Material UI (MUI) to leverage its comprehensive component library, stable styling system (Emotion), and better consistency for complex desktop UI patterns.

## Decision
At the time of `prd_027`, the team chose to replace the shadcn/Radix/Tailwind foundation with MUI Material for desktop UI components.

- **Primary Library**: `@mui/material`
- **Styling Engine**: `@emotion/react`, `@emotion/styled`
- **Theme Management**: MUI `ThemeProvider` with a custom theme that preserves Autoflow brand colors and density.
- **Incremental Migration**: Existing components would be replaced gradually under the April 2026 policy snapshot captured by this page.

## Rationale
- **Consistency**: MUI provides a unified set of components with consistent behavior and accessibility.
- **Speed of Development**: Reducing the need to "build" low-level UI wrappers from Radix primitives.
- **Maintainability**: Moving away from local shadcn-style copies to a managed dependency.

## Typography & Scale
- **Global Font Size Reduction**: In `prd_029`, the desktop application's page-wide typography scale was reduced to make the UI read more compactly. This was implemented via shared CSS and the MUI theme foundation (`apps/desktop/src/renderer/theme.ts` and `styles.css`), ensuring consistency across both custom and MUI-backed text without needing component-level overrides.

## Consequences
- **Positive**: Improved UI consistency, faster development of complex forms and dialogs, and robust theme support.
- **Negative**: Increased bundle size (though less of a concern for a desktop app), and the need for a transition period where both styling systems might coexist.
- **Later Update**: The board's current Desktop rule later moved back toward locally owned shadcn-style components plus `lucide-react` for new UI work, so this page should be read as historical context rather than the latest mandatory baseline.

## Citations
- `prd_027` - Replace the desktop design kit from shadcn/Radix/Tailwind to MUI. Source: `tickets/done/prd_027/prd_027.md`.
- `prd_029` - Reduce desktop app page-wide font size. Source: `tickets/done/prd_029/prd_029.md`.
- Historical `AGENTS.md` Rule 17 snapshot from late April 2026.
