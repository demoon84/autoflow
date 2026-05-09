---
kind: feature
slug: desktop-statistics-page
title: "Desktop Statistics Page"
created: 2026-04-28T21:20:26Z
updated: 2026-04-29T16:52:51Z
tags:
  - feature
  - desktop-statistics-page
  - features
---

# Desktop Statistics Page

## Overview

The desktop Statistics (`통계`) page provides a comprehensive view of the board's metrics, history, and recent logs. It is designed around a MUI-backed dashboard structure.

## Core Components

The Statistics page primarily centers on the following layout blocks in `apps/desktop/src/renderer/main.tsx` (specifically around `activeSettingsSection === "snapshot"`):
- **ReportingDashboard:** Displays summary metric cards and chart cards using MUI-aligned styling. Includes "평균 처리 시간" (Average Processing Time) card which shows average active/lead time and 24h cumulative duration (prd_218, prd_220).
- **BoardSearch:** Provides search functionality within the context of the board.
- **MetricsHistory:** Shows historical data for board metrics.
- **Recent Logs & Log Previews:** Lists recent runner logs for quick access.

## Layout and Styling

- **MUI Foundation:** The dashboard uses the existing Emotion/MUI theme wrapper rather than custom UI primitives. Styles are grouped under `.report-*` and `.snapshot-panel` classes in `apps/desktop/src/renderer/styles.css`.
- **Scroll Behavior:** The page layout includes scroll containment (`.snapshot-panel`, `.report-panel`), ensuring that when the content is taller than the available app viewport, users can scroll vertically to reach the lower sections (like recent logs) without breaking the overall app shell layout.
- **Dynamic Grid:** The metric strip uses `repeat(auto-fit, minmax(152px, 1fr))` grid, allowing the newly added "평균 처리 시간" card to be placed automatically alongside "변경 코드량" and "토큰 사용량" cards (prd_218).

## Data Parity

- **Shared Metrics:** The `ReportingDashboard` shares the exact same `board.metrics` and formatting helpers (e.g., `formatCount`) as the Work Flow page's top stat strip.
- **Token Usage Formatting:** Token counts on both the Work Flow strip and the Statistics dashboard are displayed as raw numbers with thousands separators (e.g., `33,381,501`) rather than compact notations (like `33M`), ensuring strict data parity between the two views.
- **Processing Time Metrics:** Emits `autoflow_avg_lead_seconds`, `autoflow_avg_active_seconds`, `autoflow_avg_ticks_per_done_ticket`, and `autoflow_duration_total_24h_seconds` via `metrics-project.sh` (prd_218).

## Related Context

- The Work Flow page strip that shares the same metrics source is documented in [[features/workflow-stat-strip]].

## Related PRDs
- `tickets/done/prd_013` (Stat strip data parity)
- `tickets/done/prd_018` (Token formatting parity)
- `tickets/done/prd_035` (MUI dashboard redesign)
- `tickets/done/prd_037` (Scroll containment fix)
- `tickets/done/prd_218` (Processing Time card added)
- `tickets/done/prd_220` (Processing Time label clarification)
