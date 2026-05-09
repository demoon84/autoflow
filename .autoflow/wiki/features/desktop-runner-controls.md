---
kind: feature
slug: desktop-runner-controls
title: "Desktop Runner Controls"
created: 2026-04-28T21:20:26Z
updated: 2026-04-28T21:20:26Z
tags:
  - feature
  - desktop-runner-controls
  - features
---

# Desktop Runner Controls

Simplified runner control UI for the desktop application.

## Overview

The desktop runner controls were simplified to improve visual clarity and focus on essential actions. This change removed redundant controls and cleaned up labeling.

## Key Changes

- **Removed Restart Control**: The `AI 재시작` (Restart) button was removed from the runner control surface. Users can achieve the same result by stopping and starting the runner.
- **Label Simplification**: The `AI 시작` → `시작` (Start) and `AI 중지` → `중지` (Stop) labels were simplified (`prd_028`).
- **Always-Visible Model Controls**: The collapse/expand toggle for model and inference settings was removed from the runner card. These controls are now always visible when the runner is configurable (`prd_194`).
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
- Model and inference settings changed to be always visible in `prd_194` (2026-05-08).

## Citations

- Source: `tickets/done/prd_028/prd_028.md`
- Source: `tickets/done/prd_194/prd_194.md`
- Related: [[features/ai-workflow-board]]
