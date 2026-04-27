# Decision: Handoff as Raw Source

## Context
Previously, PRD handoffs (stored in `conversations/`) were treated as peer entities to the Wiki. This led to a cluttered UI where "Wiki" and "Handoff" were separate top-level categories, even though handoffs are primarily inputs to the wiki generation process.

## Decision
Align with the **3-layer model** (raw sources → wiki → schema) inspired by the Karpathy LLM Wiki pattern. 
Handoffs are now strictly classified as **Raw Sources**, alongside tickets and logs.

## Consequences
- The Desktop UI sidebar merged "Wiki & Handoff" into a single "Wiki" item.
- Handoffs are displayed within a "Sources" collapsible section inside the Wiki panel.
- The `wiki-maintainer-agent` (Wiki Bot) explicitly treats handoffs as ingest inputs, not deliverables.
- `boardFileKind` logic identifies `conversations/` paths as `Source · Handoff`.

## Origins
- **PRD-001**: Restructure Wiki & Handoff panel — handoff as wiki source, not a peer (`tickets/done/prd_001/prd_001.md`).
- **Discussion**: Chat session 2026-04-26 deriving from Karpathy LLM Wiki gist (442a6bf555914893e9891c11519de94f).
