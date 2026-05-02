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

`autoflow wiki lint` emits both the legacy keys (`orphan.*`, `citation_gap.*`, `stale_reference.*`) and a new `lint_*` family that the wiki runner consumes:

- `lint_orphan.<n>.page=<board-relative path>` — page never linked from `wiki/index.md` (alias of legacy `orphan.<n>=`).
- `lint_broken_link.<n>.page=` + `lint_broken_link.<n>.target=` — `[[wikilink]]` whose final segment does not match any page stem in the wiki.
- `lint_missing_frontmatter.<n>.page=` — page that does not begin with a YAML frontmatter `---` line. `index.md`, `log.md`, `project-overview.md`, and `README.md` files are excluded from this check.
- `lint_finding_total=<count>` — sum of `orphan_count`, `broken_link_count`, and `missing_frontmatter_count`. When zero, `lint_finding.none=true` is emitted as a single explicit summary line.

Adding `--semantic` runs the LLM contradiction / stale-claim / missing-link pass with three token-frugal controls (whole-wiki short-circuit, per-page diff, byte budget). See [`.autoflow/agents/wiki-maintainer-agent.md`](../agents/wiki-maintainer-agent.md) for the controls and the env vars `AUTOFLOW_WIKI_LINT_PROMPT_BYTES` and `AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH`.

## Retrofitting focused page frontmatter

`autoflow wiki retrofit-frontmatter [--dry-run] [--page wiki/<kind>/<slug>.md] [--allow-adapter]` adds YAML frontmatter to existing focused wiki pages under `wiki/decisions/`, `wiki/features/`, `wiki/learnings/`, and `wiki/architecture/`. It skips `README.md`, managed baseline pages, and any page that already starts with `---`.

The default command is deterministic-first and adapter-free. It derives `kind`, `slug`, `title`, `created`, `updated`, and `tags` from the board-relative path, first H1/fallback slug title, and git history. Existing body bytes are preserved after the inserted frontmatter block and one blank line.

`--dry-run` emits `retrofit.<n>.status=dry_run` and proposed frontmatter without modifying files. `--page` narrows the run to one board-relative page. `--allow-adapter` is optional and only permits fallback-title polish; `AUTOFLOW_WIKI_RETROFIT_PROMPT_BYTES` caps the per-page prompt (default `4096`). Without `--allow-adapter`, the action must not call `run_wiki_adapter_prompt`.

## Filing back synthesis answers

`autoflow wiki query --synth --save-as <slug>` writes the answer to `wiki/answers/<slug>.md` with YAML frontmatter (`kind: synth_answer`, `slug`, `runner`, `created`, `updated`, `terms`, `citations`). Re-running with the same slug preserves `created:` and refreshes `updated:`. The slug must match `[A-Za-z0-9_-]+`.

This realises the LLM-Wiki "good answers can be filed back into the wiki as new pages" recommendation: the next `wiki query` over the same terms can surface the persisted answer and avoid a re-synthesis.

## Ingesting raw sources

`autoflow wiki ingest <source-file> [--slug SLUG] [--no-summary]` adds source documents to the wiki without repeatedly spending adapter tokens.

The command writes the full source body to `wiki-raw/<slug>.md` with YAML frontmatter (`kind: raw_source`, `slug`, `original_path`, `ingested_at`, `updated_at`, `sha256`). The raw layer is source material: wiki agents may read it, but should not rewrite it.

Unless `--no-summary` is used, the command then asks the wiki adapter for a fixed key=value source summary and writes `wiki/sources/<slug>.md` with frontmatter (`kind: source_summary`, `slug`, `created`, `updated`, `raw_source`, `entities`, `concepts`). The summary page includes `## One-liner`, `## Summary`, `## Entities`, `## Concepts`, and `## Source`.

Per-source summary fingerprints live at `runners/state/<runner_id>.ingest.sources.d/<slug>`. Re-ingesting an unchanged source with an existing summary emits `ingest_status=skipped_unchanged_source` and `ingest_summary_status=skipped_unchanged`, calls no adapter, and preserves both files byte-for-byte. If the source changes, the raw file preserves `ingested_at`, the summary preserves `created:`, and both `updated` timestamps advance after a successful adapter summary.

`AUTOFLOW_WIKI_INGEST_PROMPT_BYTES` caps the ingest prompt (default `16384`). Long source bodies are truncated in the adapter prompt with `...[truncated]...`, but the raw file still stores the full body. `AUTOFLOW_WIKI_INGEST_DEBUG_PROMPT_PATH` copies the assembled prompt to disk for verification.
