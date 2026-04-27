# PRD Terminology Rename

## Decision
The core output of the requirement gathering process in Autoflow is now officially termed a **PRD** (Product Requirement Document), replacing the previous "spec" or "specification" terminology.

## Rationale
- **Clarity**: "PRD" is a standard industry term that clearly distinguishes high-level requirements from low-level technical specifications or file formats.
- **Consistency**: Unified terminology across the Desktop UI, agent documentation, host guides, and CLI tools reduces user confusion.

## Scope of Change
- **User-Facing UI**: Labels in the Desktop application (e.g., "스펙" -> "PRD").
- **Documentation**: All agent role descriptions (`.autoflow/agents/*.md`) and host guides (`README.md`, `AGENTS.md`, `CLAUDE.md`).
- **Templates**: Reference templates for new requirements (`reference/project-spec-template.md`).
- **CLI Alias**: Added `autoflow prd` as the primary command for requirement management, while keeping `autoflow spec` as a legacy alias.

## Preservation (Backward Compatibility)
To ensure system stability and script compatibility, the following remain unchanged:
- **File & Directory Names**: `tickets/done/prd_005/prd_005.md`, `agents/spec-author-agent.md`, etc.
- **Internal Keys**: `spec_id`, `spec_count`, `status=ready_for_input`.
- **Function/Variable Names**: `specTotal`, `extractSpecAllowedPaths`.

## Source
- `tickets/done/prd_005/prd_005.md` (2026-04-26).
