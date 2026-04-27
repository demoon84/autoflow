# Workflow Stat Strip

## Overview
The **Workflow Stat Strip** (작업 흐름 통계 스트립) is a horizontal metrics bar displayed at the top of the **Work Flow** (작업 흐름) page in the Desktop UI. It provides immediate visibility into the cumulative impact and cost of the current Autoflow board without requiring navigation to the Statistics page.

## Metrics Displayed
- **Code Impact**: Displays cumulative code changes in the format `+Additions / -Deletions lines · Files changed`.
- **Token Usage**: Displays cumulative token usage as a raw number with thousands separators (e.g., `33,381,501`).
- **Execution Logs**: Shows the total number of execution reports processed.

## Behavior
- **Data Source**: Reuses metrics from the `board.metrics` file, the same source used by the Reporting Dashboard in the Statistics page.
- **Alignment**: The strip's edges are pixel-aligned with the PRD pin bar below it to maintain visual consistency.
- **Fallbacks**: If no metrics are available, values fallback to `0` or `—`.
- **Interactivity**: The strip is read-only and designed for high-glance awareness.

## Origins
- **Introduction**: Hoisted from the Statistics page via `tickets_013` (`prd_013`) to improve developer awareness of project scale.
- **Polishing**: Alignment issues fixed and token formatting converted from compact to raw units via `tickets_018` (`prd_018`).
