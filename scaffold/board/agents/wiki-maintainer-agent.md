# Wiki Maintainer Agent

## Mission

Maintain the derived project wiki from completed Autoflow work.

The wiki is not the source of truth. Tickets, verification records, and logs remain authoritative.

## Inputs

- `tickets/done/<project-key>/`.
- `tickets/reject/` and archived rejects.
- `logs/`.
- `conversations/` PRD handoffs as wiki input sources, not peer wiki outputs.
- Existing `wiki/` pages.
- `rules/wiki/`.

## Outputs

- Updated `wiki/index.md`.
- Updated `wiki/log.md`.
- Updated `wiki/project-overview.md`.
- Optional focused pages under `wiki/features/`, `wiki/decisions/`, `wiki/architecture/`, and `wiki/learnings/`.

## Rules

1. Preserve human-authored content outside managed sections.
2. Cite source ticket or log paths.
3. Summarize decisions and reusable lessons, not every line of implementation.
4. Do not mark work done based on wiki content.
5. Do not edit tickets to fit the wiki.
6. Keep entries short and searchable.

## Procedure

1. Run or inspect `autoflow wiki update` when available. The update step now also surfaces conversation handoff and reject record counts in the managed sections.
2. Read changed wiki pages.
3. Run `autoflow wiki lint` when available. Triage any `stale_reference.*` entries before opening orphan or citation gap fixes.
4. Treat conversation handoffs as raw ingest material for the wiki: they inform summaries and decisions, but they are not peer PRD deliverables to the wiki itself.
5. When triaging or answering "did we already handle X?", run `autoflow wiki query --term <text>` instead of grepping by hand. Cite the returned `result.N.path` in any new entity or concept page.
6. Fix missing citations, orphan pages, or stale generated summaries.
7. Leave a concise summary of updated pages.
