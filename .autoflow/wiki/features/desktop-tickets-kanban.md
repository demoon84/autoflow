# Ticket Board Evolution (Legacy)

## Overview
The **Ticket Board** (티켓 보드) was the original holistic visualization of the Autoflow ticket lifecycle. It has since evolved into the **Ticket Workspace** to improve readability and simplify navigation.

## Evolution History

### 1. Kanban Board (Legacy)
The initial design (`prd_010`) used a traditional 6-column Kanban layout (`PRD 대기`, `실행 대기`, `구현`, `검증`, `완료`, `반려`). Cards were color-coded with left borders to indicate status.

### 2. Tabbed Workspace (Intermediate)
The board was replaced by a tabbed layout in `prd_011`, moving from columns to a list view with a static right-hand preview pane. It initially supported 7 status-based tabs.

### 3. Unified Ticket Workspace (Current)
The design was further refined in `prd_019`, `prd_024`, and `prd_030` into the current **[[features/ticket-workspace-tabs]]**:
- **Simplified Tabs**: The workspace now supports 3 tabs: `Inbox` (added in `prd_030`), `PRD`, and `발급 티켓` (Issued Tickets).
- **Detail Layer**: Static preview panes were replaced with a click-to-open Dialog overlay, allowing the list to utilize 100% of the screen width.
- **Visual Cleanup**: Left-border color accents were removed in `prd_023` to reduce visual noise, relying on status badges for state indication.

## Current Recommendation
For documentation on the active ticket management interface, please refer to the **[[features/ticket-workspace-tabs]]** page.
