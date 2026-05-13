#!/usr/bin/env npx tsx
/*
 * wiki-search-index.ts — optional wiki FTS/vector index refresher.
 *
 * The current TS wiki query path falls back safely when no index is present.
 * This command keeps the old entrypoint non-blocking and cross-platform.
 */

const enabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_WIKI_FTS_INDEX || "");
if (!enabled) {
  process.stdout.write("status=skipped\nreason=AUTOFLOW_WIKI_FTS_INDEX_off\n");
  process.exit(0);
}
process.stdout.write("status=skipped\nreason=fts_indexer_ts_not_configured\nnext_action=wiki query will use built-in fallback search.\n");
