# Wiki Preview Flow

## Overview
The **Wiki Preview Flow** provides a split-pane interface in the Wiki (Knowledge) section, allowing users to browse list of logs/handoffs while viewing content in a side-by-side preview.

## Behavior
- **Hidden by Default**: To maximize list visibility, the preview pane is closed by default when entering the Wiki section.
- **Auto-Open on Select**: Clicking any item in the `WikiList`, `HandoffList`, or `WikiQueryPanel` results automatically opens the preview pane on the right.
- **Toggle Control**: 
  - A close (`×`) button in the preview header hides the pane.
  - A "미리보기 열기" (Open Preview) toggle in the toolbar allows re-opening the pane if a path is currently selected.
- **Section Persistence**: The preview state resets (closes) when switching to other settings sections (e.g., automation, snapshots) and returning to the Wiki.

## Origins
- **Design Handoff**: Implemented via manual resolution of `prd_003` to improve visual information density and interaction consistency (`tickets/done/prd_003/reject_003.md`).
