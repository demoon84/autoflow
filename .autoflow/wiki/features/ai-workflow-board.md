# AI Workflow Board

## Overview
The AI Workflow Board (작업 흐름) provides a real-time, visual summary of the agent runner states, ticket progress, and resource consumption. It serves as the primary observation deck for monitoring Autoflow progress without inspecting raw files.

## Components

- **PRD Pin Bar**: Displays the currently pinned/active Product Requirement Document (PRD) along with a count of total and pending PRDs (`tickets/done/prd_015/tickets_015.md`).
- **Stat Strip**: Hoisted above the ticket board and aligned with the PRD pin bar, it displays real-time resource utilization, such as raw token counts and code-volume changes (`tickets/done/prd_013/tickets_013.md`, `tickets/done/prd_018/tickets_018.md`).
- **Ticket Cards**: Cards in the workflow reflect active agents. Their metadata displays a simplified role label (Planner, Worker, 위키봇) for clarity, with model and reasoning controls hoisted directly into the card for immediate configuration (`tickets/done/prd_021/prd_021.md`).
- **Progress Indicator**: Displays the active state of agents using dots and labels.
  - **Planner/Wiki**: 4-stage flow.
  - **Worker (Impl AI)**: Simplified to 4 stages (`대기 / 구현 / 완료 / 반려`) to match runtime-observable signals (`tickets/done/prd_025/prd_025.md`).
  - **Visual Alignment**: Progress dots are precision-aligned to label centers and support multi-line wrapping in narrow widths (`tickets/done/prd_021/prd_021.md`, `tickets/done/prd_025/prd_025.md`).
- **Visual Design**: The board uses a clean, unified 1px border style. Left-border color accents on cards and pins have been removed to reduce visual noise while preserving status information through icons and progress dots (`tickets/done/prd_023/prd_023.md`).

## Origins
- Continuously improved to present a unified dashboard showing both agent states and overarching PRD progress.
