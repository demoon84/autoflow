---
kind: feature
slug: desktop-gemini-icon
title: "Desktop Agent App Icons"
created: 2026-04-27T15:19:53Z
updated: 2026-04-27T15:19:53Z
tags:
  - feature
  - desktop-gemini-icon
  - features
---

# Desktop Agent App Icons

## Overview
The Desktop application displays specialized application icons for each AI agent role (Planner, Worker, LLM Wiki) to provide quick visual recognition.

## Behavior
- **Agent Icons**: Each recognized agent uses a dedicated image asset for its identity card and runner UI.
  - **Claude**: Uses the Claude app icon.
  - **Codex**: Uses the Codex app icon.
  - **Gemini**: Uses a polished Gemini app icon, replacing the generic gray sparkles fallback (`tickets/done/prd_026/prd_026.md`).
- **Fallback**: Unknown or generic agents default to a gray bordered sparkles icon.

## Implementation
Icons are stored as local 128x128 PNG assets under `apps/desktop/src/renderer/assets/agent-icons/` and mapped via the `AgentAppIcon` component.

## Origins
- **Gemini Icon Fix**: Previously, Gemini was falling back to the generic sparkles icon. PRD-026 added a dedicated Gemini asset to match the visual quality of Claude and Codex.
