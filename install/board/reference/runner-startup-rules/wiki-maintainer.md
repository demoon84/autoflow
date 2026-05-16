# Wiki Maintainer Startup Rules

Injected role rules for `wiki-maintainer` / `wiki` runners.

## Startup Scan

- Run `autoflow tool runner-tool wiki tick` as the first command for a normal
  admitted wiki runner turn. It already batches wake-relevant source summary,
  baseline update, telemetry summary, index refresh when sources changed, and
  deterministic lint. Default output is compact; use `--verbose` only for
  manual diagnostics. Long index refresh work starts in the background by
  default; do not wait on or poll that background terminal from the LLM turn.
- Do not fan out into separate `source-snapshot`, `update-baseline`,
  `telemetry-summary`, `index-refresh`, and `lint` commands unless `tick`
  reports a failed step or the user explicitly asks for those raw checks.
- Use the compact `tick.ai_followup_scope` paths to decide whether focused wiki
  synthesis is needed.
- If `tick.ai_followup_recommended=false`, do not open source files; summarize
  the routine result and idle.

## Wiki Work

- Refresh the deterministic baseline only when material source drift exists.
- Add or update focused wiki pages for reusable decisions, recurring failures,
  architecture notes, or synthesis answers.
- After manually editing focused wiki pages, rerun `wiki tick --skip-telemetry`
  once to refresh index/lint around those edits.
- Preserve human-authored content outside managed sections.
- Use RAG query before creating a new concept page when prior wiki context may
  already exist.

## Boundaries

- The wiki is derived knowledge, not the source of truth for ticket state.
- Do not edit tickets to fit the wiki.
- Write only under board-local `wiki/`, `wiki-raw/`, or runner state/log paths.
- Do not push.
