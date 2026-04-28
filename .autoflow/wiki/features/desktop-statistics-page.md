# Desktop Statistics Page

## Overview

The desktop Statistics (`통계`) page provides a comprehensive view of the board's metrics, history, and recent logs. It is designed around a MUI-backed dashboard structure.

## Core Components

The Statistics page primarily centers on the following layout blocks in `apps/desktop/src/renderer/main.tsx` (specifically around `activeSettingsSection === "snapshot"`):
- **ReportingDashboard:** Displays summary metric cards and chart cards using MUI-aligned styling.
- **BoardSearch:** Provides search functionality within the context of the board.
- **MetricsHistory:** Shows historical data for board metrics.
- **Recent Logs & Log Previews:** Lists recent runner logs for quick access.

## Layout and Styling

- **MUI Foundation:** The dashboard uses the existing Emotion/MUI theme wrapper rather than custom UI primitives. Styles are grouped under `.report-*` and `.snapshot-panel` classes in `apps/desktop/src/renderer/styles.css`.
- **Scroll Behavior:** The page layout includes scroll containment (`.snapshot-panel`, `.report-panel`), ensuring that when the content is taller than the available app viewport, users can scroll vertically to reach the lower sections (like recent logs) without breaking the overall app shell layout.

## Data Parity

- **Shared Metrics:** The `ReportingDashboard` shares the exact same `board.metrics` and formatting helpers (e.g., `formatCount`) as the Work Flow page's top stat strip.
- **Token Usage Formatting:** Token counts on both the Work Flow strip and the Statistics dashboard are displayed as raw numbers with thousands separators (e.g., `33,381,501`) rather than compact notations (like `33M`), ensuring strict data parity between the two views.

## Related PRDs
- `tickets/done/prd_013` (Stat strip data parity)
- `tickets/done/prd_018` (Token formatting parity)
- `tickets/done/prd_035` (MUI dashboard redesign)
- `tickets/done/prd_037` (Scroll containment fix)
