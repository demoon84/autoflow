# Desktop Tickets Kanban

## Overview
The **Tickets Kanban** (티켓 보드) provides a board-style visualization of the entire ticket lifecycle, from PRD backlog to completion or rejection.

## Structure
- **Columns**: 6 status-based columns derived from `.autoflow/tickets/` directory structure:
  - `PRD 대기` (backlog)
  - `실행 대기` (todo)
  - `구현` (inprogress)
  - `검증` (verifier)
  - `완료` (done)
  - `반려` (reject)
- **Cards**: Each card represents a ticket or PRD, showing:
  - Identifier (`PRD-NNN`, `Ticket-NNN`, `Reject-NNN`).
  - Title (one-line ellipsis).
  - Metadata: Assigned AI (`AI-N`), Project Key, and Last Modified Date.
- **Visual Cues**: Color-coded left borders (3px) indicate the current stage (e.g., primary for in-progress, destructive for reject).

## Interaction
- **Layered Preview**: Clicking a card opens a `Dialog`-based inline layer displaying the full markdown content using the standard `MarkdownViewer`.
- **Read-Only**: The current implementation is focused on visualization and status monitoring; drag-and-drop state transitions are handled by agent runners.

## Origins
- **Design Handoff**: Introduced via `prd_010` to provide a holistic view of the Autoflow board state beyond the active runner cards (`tickets/done/prd_010/tickets_010.md`).
