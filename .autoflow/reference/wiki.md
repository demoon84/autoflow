# Wiki Reference

The wiki summarizes completed work and decisions.

Use wiki pages for:

- project overview,
- work log,
- decisions,
- feature notes,
- architecture notes,
- lessons learned,
- filed-back synthesis answers (under `wiki/answers/`).
- source summaries derived from raw ingested files (under `wiki/sources/`).

Do not use the wiki as the source of truth for active ticket stage, ownership, pass/fail result, or commit state.

## Lint output keys

`autoflow wiki lint` emits both the legacy keys (`orphan.*`, `citation_gap.*`, `stale_reference.*`) and a new `lint_*` family that the wiki-1 runner consumes:

- `lint_orphan.<n>.page=<board-relative path>` — page never linked from `wiki/index.md` (alias of legacy `orphan.<n>=`).
- `lint_broken_link.<n>.page=` + `lint_broken_link.<n>.target=` — `[[wikilink]]` whose final segment does not match any page stem in the wiki.
- `lint_missing_frontmatter.<n>.page=` — page that does not begin with a YAML frontmatter `---` line. `index.md`, `log.md`, `project-overview.md`, and `README.md` files are excluded from this check.
- `lint_finding_total=<count>` — sum of `orphan_count`, `broken_link_count`, and `missing_frontmatter_count`. When zero, `lint_finding.none=true` is emitted as a single explicit summary line.

Adding `--semantic` runs the LLM contradiction / stale-claim / missing-link pass with three token-frugal controls (whole-wiki short-circuit, per-page diff, byte budget). See [`.autoflow/agents/wiki-maintainer-agent.md`](../agents/wiki-maintainer-agent.md) for the controls and the env vars `AUTOFLOW_WIKI_LINT_PROMPT_BYTES` and `AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH`.

## Filing back synthesis answers

`autoflow wiki query --synth --save-as <slug>` writes the answer to `wiki/answers/<slug>.md` with YAML frontmatter (`kind: synth_answer`, `slug`, `runner`, `created`, `updated`, `terms`, `citations`). Re-running with the same slug preserves `created:` and refreshes `updated:`. The slug must match `[A-Za-z0-9_-]+`.

This realises the LLM-Wiki "good answers can be filed back into the wiki as new pages" recommendation: the next `wiki query` over the same terms can surface the persisted answer and avoid a re-synthesis.

## Ingesting raw sources

`autoflow wiki ingest <source-file> [--slug SLUG] [--no-summary]` adds source documents to the wiki without repeatedly spending adapter tokens.

The command writes the full source body to `wiki-raw/<slug>.md` with YAML frontmatter (`kind: raw_source`, `slug`, `original_path`, `ingested_at`, `updated_at`, `sha256`). The raw layer is source material: wiki agents may read it, but should not rewrite it.

Unless `--no-summary` is used, the command then asks the wiki adapter for a fixed key=value source summary and writes `wiki/sources/<slug>.md` with frontmatter (`kind: source_summary`, `slug`, `created`, `updated`, `raw_source`, `entities`, `concepts`). The summary page includes `## One-liner`, `## Summary`, `## Entities`, `## Concepts`, and `## Source`.

Per-source summary fingerprints live at `runners/state/<runner_id>.ingest.sources.d/<slug>`. Re-ingesting an unchanged source with an existing summary emits `ingest_status=skipped_unchanged_source` and `ingest_summary_status=skipped_unchanged`, calls no adapter, and preserves both files byte-for-byte. If the source changes, the raw file preserves `ingested_at`, the summary preserves `created:`, and both `updated` timestamps advance after a successful adapter summary.

`AUTOFLOW_WIKI_INGEST_PROMPT_BYTES` caps the ingest prompt (default `16384`). Long source bodies are truncated in the adapter prompt with `...[truncated]...`, but the raw file still stores the full body. `AUTOFLOW_WIKI_INGEST_DEBUG_PROMPT_PATH` copies the assembled prompt to disk for verification.
