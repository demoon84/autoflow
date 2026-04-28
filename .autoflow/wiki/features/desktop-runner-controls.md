# Desktop Runner Controls

Simplified runner control UI for the desktop application.

## Overview

The desktop runner controls were simplified to improve visual clarity and focus on essential actions. This change removed redundant controls and cleaned up labeling.

## Key Changes

- **Removed Restart Control**: The `AI 재시작` (Restart) button was removed from the runner control surface. Users can achieve the same result by stopping and starting the runner.
- **Label Simplification**: The `AI` prefix was removed from start and stop controls.
  - `AI 시작` → `시작` (Start)
  - `AI 중지` → `중지` (Stop)
- **Accessibility**: Tooltips and aria-labels were updated to match the simplified labels while preserving existing behavior.

## Implementation Details

- **Module**: `apps/desktop/src/renderer/main.tsx`
- **UI Components**: Migrated to **MUI Material** primitives as part of the project-wide UI modernization (`prd_027`).
- **Preserved Behavior**: 
  - Loading spinners and disabled states remain intact.
  - Loop-mode requirement warning ("반복 모드에서만 시작할 수 있습니다") was preserved.

## History

- Introduced in [[features/ai-workflow-board]] (`prd_021`).
- Simplified in `prd_028` (2026-04-28).

## Citations

- Source: `tickets/done/prd_028/prd_028.md`
- Related: [[features/ai-workflow-board]]
