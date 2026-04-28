# Worker Display Policy

## Overview
To provide a clean and consistent user experience across the desktop UI, tickets, and logs, Autoflow uses a standardized naming convention for AI workers. This policy decouples internal storage identifiers from user-facing labels.

## Policy: Roles and worker-N Convention
- **Runner Cards**: On the AI Workflow Board, runners are identified by their primary role (e.g., `Planner`, `Worker`, `위키봇`) for immediate functional clarity (`tickets/done/prd_021/prd_021.md`).
- **Actor Attribution**: New user-visible runtime notes, logs, ticket previews, and desktop metadata prefer `worker-N` (e.g., `worker-1`) instead of `AI-N`.
- **Internal ID**: The underlying storage identifier (e.g., `owner-1`, `wiki-1`) remains unchanged for backward compatibility and internal configuration consistency.
- **Normalization**: Board scripts use `display_worker_id` to emit `worker-N` and compatible ownership checks to treat legacy `AI-N`, `owner-N`, and `worker-N` values as the same worker.

## Scope
- **Markdown Fields**: `- AI:`, `- Claimed By:`, `- Execution AI:`, `- Verifier AI:`.
- **Note Summaries**: New summaries prefer `worker-N` wording.
- **Markdown Viewer**: The desktop application no longer force-rewrites worker-like ids into `AI-N`; code blocks and inline code remain protected because ordinary text is no longer rewritten.

## Exclusions
- **Raw Quotes**: User-provided text in `## Reject Reason` or `## Result.Summary` preserves raw citations.
- **Code Blocks**: Identifiers inside code blocks or inline backticks are preserved as-is.
- **Storage**: `config.toml`, runner state files, and role keys maintain their original identifiers.
- **Historical Evidence**: Completed tickets, verification records, logs, and other archives are not mass-edited solely to replace old `AI-N` text.

## Origins
- **Decision**: Established to reduce visual noise and unify worker mentions across the project (`tickets/done/prd_009/prd_009.md`).
- **Superseding Update**: `prd_039` replaced the prior user-visible `AI-N` convention with `worker-N` while preserving parser compatibility and internal ids.
- **Standard**: Formally documented in `AGENTS.md` and `CLAUDE.md`.

## Citations

- Original policy source: `tickets/done/prd_009/tickets_009.md`
- Superseding source: `tickets/done/prd_039/tickets_039.md`
- Verification: `tickets/done/prd_039/verify_039.md`
