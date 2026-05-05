# Wiki Panel Layout Changes

## Overview

This document outlines the recent changes to the wiki panel's layout, introducing a horizontal split with a collapsible preview pane for improved user experience and efficient information display. These changes were implemented as part of `prd_003`.

## Key Changes

### Horizontal Split Layout

The wiki panel has transitioned from a vertical split (list above, preview below) to a horizontal split. The layout now features:
-   **Left Pane:** Contains the wiki list, search results, and other navigation elements.
-   **Right Pane:** Displays the preview of the selected markdown file.

### Collapsible Preview Pane

The preview pane is now collapsible by default, enhancing usability:
-   **Default State:** The preview pane is closed upon entering the wiki section, allowing the list to occupy the full width.
-   **Automatic Opening:** When a user clicks on an item in the wiki list (e.g., a markdown file), the preview pane automatically opens, adjusting the width of the left pane.
-   **Manual Toggling:** A dedicated toggle button is available in the preview pane's header to manually open or close it.
-   **Re-opening:** If the preview pane is closed, clicking on another item in the wiki list will reopen it.
-   **State Persistence:** The open/closed state is maintained for the current session.

### Visual Adjustments

-   New CSS classes (`.knowledge-split`, `.knowledge-list-pane`, `.knowledge-preview-pane`, `.knowledge-preview-pane--hidden`) have been introduced to manage the new layout and states.
-   A fallback to a stacked layout is implemented for narrow screen widths (< 900px).

## Impact

These changes aim to provide a more organized and efficient way to browse and view wiki content, reducing screen clutter and improving focus on the active content.
