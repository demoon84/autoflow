# Worker Display Policy

## Overview
To provide a clean and consistent user experience across the desktop UI, tickets, and logs, Autoflow uses a standardized naming convention for AI workers. This policy decouples internal storage identifiers from user-facing labels.

## Policy: AI-N Convention
- **Display Label**: All AI workers are identified as `AI-N` (e.g., `AI-1`, `AI-2`, `AI-smoke`) in markdown content, UI headers, and notes.
- **Internal ID**: The underlying storage identifier (e.g., `owner-1`, `ai-3`) remains unchanged for backward compatibility and internal configuration consistency.
- **Normalization**: Board scripts use a `display_worker_id` helper to normalize identifiers before recording them in tickets or logs.

## Scope
- **Markdown Fields**: `- AI:`, `- Claimed By:`, `- Execution AI:`, `- Verifier AI:`.
- **Note Summaries**: `Created by AI-N`, `AI-N marked pass/fail`.
- **Markdown Viewer**: The desktop application provides a fallback transform to ensure `AI-N` formatting in the UI even if legacy data is present.

## Exclusions
- **Raw Quotes**: User-provided text in `## Reject Reason` or `## Result.Summary` preserves raw citations.
- **Code Blocks**: Identifiers inside code blocks or inline backticks are preserved as-is.
- **Storage**: `config.toml`, runner state files, and role keys maintain their original identifiers.

## Origins
- **Decision**: Established to reduce visual noise and unify worker mentions across the project (`tickets/done/prd_009/prd_009.md`).
- **Standard**: Formally documented in `AGENTS.md` and `CLAUDE.md`.
