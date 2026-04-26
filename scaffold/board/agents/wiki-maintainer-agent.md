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
7. Converge to the same output when the same done ticket / handoff inputs are processed again.

## Procedure

1. Identify the input set for this run: latest done ticket, related verification log, conversation handoff, and any existing wiki page under `wiki/decisions/`, `wiki/features/`, `wiki/architecture/`, or `wiki/learnings/` that already covers the same topic.
2. Run or inspect `autoflow wiki update` when available, then create or merge focused entity/concept pages from those inputs instead of copying ticket prose directly.
3. Keep the run idempotent: same sources should converge to the same managed content, duplicate headings should be merged, and repeated runs should not append near-identical bullets.
4. Preserve human-authored regions. Only rewrite inside explicit managed markers such as `AUTOFLOW:BEGIN ... / AUTOFLOW:END ...`; leave all text outside those regions untouched.
5. Run `autoflow wiki lint` when available. Triage any `stale_reference.*` entries before opening orphan or citation gap fixes.
6. Treat conversation handoffs as raw ingest material for the wiki: they inform summaries and decisions, but they are not peer PRD deliverables to the wiki itself.
7. When triaging or answering "did we already handle X?", run `autoflow wiki query --term <text>` instead of grepping by hand. Cite the returned `result.N.path` in any new entity or concept page.
8. Leave a concise summary of updated pages.
