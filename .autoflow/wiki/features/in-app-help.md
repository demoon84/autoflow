# In-App Help Section

## Overview
The In-App Help section provides users with a comprehensive guide to the Autoflow Desktop interface, core terminology, and data flow. It is designed to help new users understand the system without needing external documentation.

## Features
- **Sidebar Help Menu**: A dedicated "도움말" (Help) item is added to the sidebar navigation.
- **Help Sections**:
  - **Overview**: General introduction to Autoflow and the `.autoflow/` board directory.
  - **Menu Guide**: Detailed breakdown of each sidebar section (작업 흐름, AI 관리, Wiki, 통계, 자동화 상태) including what users can do and where the data is stored.
  - **Glossary**: Definitions for core terms such as `PRD`, `ticket`, `runner`, `verifier`, `handoff`, and `wiki`.
  - **Triggers**: Guide to PRD handoff triggers (`/af`, `$af`, `#af`, `/autoflow`, `$autoflow`, `#autoflow`) and memo intake triggers (`/memo`, `$memo`, `#memo`) with the "Save / Change / Cancel" workflow where applicable.
  - **Data Flow**: A visual representation of how requirements move from conversation to completion.

## Implementation
- **Location**: `apps/desktop/src/renderer/main.tsx`
- **Component**: `HelpSection`
- **Icons**: Uses `HelpCircle` from `lucide-react`.

## Origins
- **Initial Implementation**: PRD-004 added the help section to ensure user-facing guidance is readily available within the app (`tickets/done/prd_004/prd_004.md`).
- **Terminology Alignment**: Updated to use "PRD" instead of "spec" as part of the project-wide terminology rename (`tickets/done/prd_005/prd_005.md`).
- **Memo Intake Alignment**: Updated to include memo handoff triggers after the inbox/memo flow was added (`tickets/done/prd_030/prd_030.md`).
