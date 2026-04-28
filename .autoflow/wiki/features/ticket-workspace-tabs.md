# Ticket Workspace Tabs

## Overview
The Ticket Workspace in the Desktop application simplifies the view of available and completed work by grouping items into three main tabs: **PRD**, **인박스** (Inbox), and **발급 티켓** (Issued Tickets).

## Behavior
- **PRD Tab**: Displays all Product Requirement Documents.
- **인박스 (Inbox) Tab**: Displays actionable quick memo intake items (e.g., `memo_*.md` files under the `tickets/inbox/` directory). These items are view-only and render the same detail layer pattern as PRDs (`tickets/done/prd_030/prd_030.md`).
- **발급 티켓 (Issued Tickets) Tab**: Displays all active and completed tickets in a single, unified list regardless of their workflow stage (todo, inprogress, done, reject). The ticket cards themselves retain their visual stage badges (e.g., `구현`, `완료`) to help users distinguish their current status.
- **Detail View (Layer)**: Clicking any PRD or Ticket card opens a full-width dialog layer (overlay) containing the full markdown body and metadata. This replaced the previous static right-hand preview column, allowing the card list to utilize 100% of the workspace width for better readability (`tickets/done/prd_024/prd_024.md`).

### State Management
The active tab is persisted in `localStorage` under the `autoflow.activeTicketWorkspaceTab` key.
If a user's browser has stale keys from the previous multi-tab design (such as `all`, `inprogress`, `blocked`, `closed`, or `reject`), the application will automatically fall back to the `issued` tab to prevent rendering errors.

## Origins
- **Initial Multi-Tab Design**: The workspace originally featured 7 distinct tabs to filter tickets by status (`tickets/done/prd_011/tickets_011.md`).
- **Simplification**: The tabs were reduced to just PRD and Issued Tickets to streamline the interface and present a holistic view of all issued work (`tickets/done/prd_019/tickets_019.md`).
- **Inbox Addition**: The Inbox tab was later added beside PRD for read-only memo intake review while preserving the issued-ticket tab behavior (`tickets/done/prd_030/prd_030.md`).
