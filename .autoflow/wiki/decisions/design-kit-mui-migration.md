# Decision: Migration to MUI Design Kit

## Context
The Autoflow desktop application initially used a custom design kit based on shadcn/ui, Radix primitives, and Tailwind CSS. While functional, the team decided to migrate to Material UI (MUI) to leverage its comprehensive component library, stable styling system (Emotion), and better consistency for complex desktop UI patterns.

## Decision
We will replace the shadcn/Radix/Tailwind foundation with MUI Material for all desktop UI components.

- **Primary Library**: `@mui/material`
- **Styling Engine**: `@emotion/react`, `@emotion/styled`
- **Theme Management**: MUI `ThemeProvider` with a custom theme that preserves Autoflow brand colors and density.
- **Incremental Migration**: Existing components will be replaced gradually, but all new desktop UI work MUST use MUI primitives (Rule 17 in `AGENTS.md`).

## Rationale
- **Consistency**: MUI provides a unified set of components with consistent behavior and accessibility.
- **Speed of Development**: Reducing the need to "build" low-level UI wrappers from Radix primitives.
- **Maintainability**: Moving away from local shadcn-style copies to a managed dependency.

## Typography & Scale
- **Global Font Size Reduction**: In `prd_029`, the desktop application's page-wide typography scale was reduced to make the UI read more compactly. This was implemented via shared CSS and the MUI theme foundation (`apps/desktop/src/renderer/theme.ts` and `styles.css`), ensuring consistency across both custom and MUI-backed text without needing component-level overrides.

## Consequences
- **Positive**: Improved UI consistency, faster development of complex forms and dialogs, and robust theme support.
- **Negative**: Increased bundle size (though less of a concern for a desktop app), and the need for a transition period where both styling systems might coexist.

## Citations
- `prd_027` - Replace the desktop design kit from shadcn/Radix/Tailwind to MUI. Source: `tickets/done/prd_027/prd_027.md`.
- `prd_029` - Reduce desktop app page-wide font size. Source: `tickets/done/prd_029/prd_029.md`.
- `AGENTS.md` Rule 17 (added April 28, 2026).
