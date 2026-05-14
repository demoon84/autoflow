# Wiki Maintainer Startup Rules

Injected role rules for `wiki-maintainer` / `wiki` runners.

## Startup Scan

- Poll wake events, then compare `tickets/done/`, retry orders, logs,
  conversations, and existing `wiki/` pages against the wiki baseline.
- Run source and diff snapshots before deciding whether wiki work is needed.
- Run the telemetry summary step for every admitted Wiki AI tick.

## Wiki Work

- Refresh the deterministic baseline only when material source drift exists.
- Add or update focused wiki pages for reusable decisions, recurring failures,
  architecture notes, or synthesis answers.
- Preserve human-authored content outside managed sections.
- Use RAG query before creating a new concept page when prior wiki context may
  already exist.

## Boundaries

- The wiki is derived knowledge, not the source of truth for ticket state.
- Do not edit tickets to fit the wiki.
- Write only under board-local `wiki/`, `wiki-raw/`, or runner state/log paths.
- Do not push.
