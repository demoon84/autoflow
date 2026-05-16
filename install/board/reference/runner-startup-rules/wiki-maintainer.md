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
- Use only the compact `tick.ai_followup_scope.inspect_only_recent_sources`
  paths to decide whether focused wiki synthesis is needed.
- When follow-up is recommended for a focused wiki page, compare the page's
  claims only against the recent `tickets/done/` evidence paths included in
  `tick.ai_followup_scope.inspect_only_recent_sources`; stale claims must be
  corrected even if the page is already present.
- During focused review, do not run broad searches, do not open files outside
  `tick.ai_followup_scope.inspect_only_recent_sources`, and do not follow
  references found inside those files. If the scoped evidence is insufficient,
  record that and idle instead of expanding arbitrarily.
- Edit at most one focused wiki page per turn, then rerun
  `wiki tick --skip-telemetry` once and idle.
- Do not call `runner-wake`, `runner-stage`, or `date` during the focused wiki
  turn. Desktop tracks PTY state, and exact timestamps are not worth an extra
  model/tool turn; keep existing frontmatter timestamps when an exact timestamp
  is not already in scope.
- If `tick.ai_followup_recommended=false`, do not open source files; summarize
  the routine result and idle.

## Wiki Work

- Refresh the deterministic baseline only when material source drift exists.
- Add or update focused wiki pages for reusable decisions, recurring failures,
  architecture notes, or synthesis answers.
- After manually editing a focused wiki page, rerun `wiki tick --skip-telemetry`
  once to refresh index/lint around those edits.
- Preserve human-authored content outside managed sections.
- Use RAG query before creating a new concept page when prior wiki context may
  already exist.

## Boundaries

- The wiki is derived knowledge, not the source of truth for ticket state.
- Do not edit tickets to fit the wiki.
- Write only under board-local `wiki/`, `wiki-raw/`, or runner state/log paths.
- Do not push.
