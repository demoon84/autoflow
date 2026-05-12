#!/usr/bin/env npx tsx
/**
 * wiki-query.ts — Autoflow wiki RAG query wrapper with hybrid scoring.
 *
 * Sets up AUTOFLOW_WIKI_EMBEDDING_PROVIDER → wiki-embed.ts, AUTOFLOW_WIKI_VECTOR_DIM=384,
 * then delegates to autoflow wiki query (wiki-project.sh). Emits rag_backend=hybrid
 * when vector index and embedding provider are both ready; BM25 fallback otherwise.
 *
 * Usage:
 *   npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]
 *
 * All options are forwarded to autoflow wiki query. Extra flag:
 *   --rag          Enable RAG hybrid/BM25 mode (passed through).
 *   --synth        Enable synthesis (passed through).
 *   --limit N      Result limit (passed through).
 *
 * Exit 0 always (1원칙).
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { spawnSync } from "node:child_process";

const BOARD_ROOT = process.env.BOARD_ROOT
  || process.env.AUTOFLOW_BOARD_ROOT
  || path.join(process.cwd(), ".autoflow");

const PROJECT_ROOT = process.env.PROJECT_ROOT
  || process.env.AUTOFLOW_PROJECT_ROOT
  || path.resolve(BOARD_ROOT, "..");

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const EMBED_SCRIPT = path.join(SCRIPT_DIR, "wiki-embed.ts");

const VECTOR_DIM = 384;

// ─── Detect embed provider ────────────────────────────────────────────────────

function embedProviderCmd(): string {
  // If already configured, respect it
  if (process.env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER) {
    return process.env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER;
  }
  // Default: use wiki-embed.ts via tsx
  if (fs.existsSync(EMBED_SCRIPT)) {
    const tsxBin = path.join(PROJECT_ROOT, "node_modules", ".bin", "tsx");
    if (fs.existsSync(tsxBin)) {
      return `${tsxBin} ${EMBED_SCRIPT}`;
    }
    // Try global tsx
    const globalCheck = spawnSync("npx", ["tsx", "--version"], { stdio: "pipe", timeout: 5000 });
    if (globalCheck.status === 0) {
      return `npx tsx ${EMBED_SCRIPT}`;
    }
  }
  return "";
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write([
    "wiki-query.ts — Autoflow wiki RAG query with hybrid scoring (sentence-transformers).",
    "",
    "Usage: npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]",
    "",
    "Sets AUTOFLOW_WIKI_EMBEDDING_PROVIDER=wiki-embed.ts, AUTOFLOW_WIKI_VECTOR_DIM=384,",
    "then calls autoflow wiki query. rag_backend=hybrid when vector index is ready;",
    "falls back to fts5_bm25 or chunk_grep automatically.",
    "",
    "Options are forwarded to autoflow wiki query unchanged.",
  ].join("\n") + "\n");
  process.exit(0);
}

const args = process.argv.slice(2);

// Find autoflow CLI
const autoflowBin = (() => {
  const local = path.join(PROJECT_ROOT, "node_modules", ".bin", "autoflow");
  if (fs.existsSync(local)) return local;
  const localPkg = path.join(PROJECT_ROOT, "packages", "cli", "wiki-project.sh");
  if (fs.existsSync(localPkg)) return null; // use shell directly
  return "autoflow";
})();

const embedProvider = embedProviderCmd();
const env: NodeJS.ProcessEnv = {
  ...process.env,
  AUTOFLOW_WIKI_VECTOR_INDEX: "on",
  AUTOFLOW_WIKI_VECTOR_DIM: String(VECTOR_DIM),
};
if (embedProvider) {
  env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER = embedProvider;
}

let result: ReturnType<typeof spawnSync>;

if (autoflowBin) {
  result = spawnSync(autoflowBin, ["wiki", "query", ...args], {
    stdio: "inherit",
    env,
  });
} else {
  // Fallback: call wiki-project.sh directly
  const wikiScript = path.join(PROJECT_ROOT, "packages", "cli", "wiki-project.sh");
  if (!fs.existsSync(wikiScript)) {
    process.stderr.write("[wiki-query] autoflow CLI and wiki-project.sh not found.\n");
    process.exit(0);
  }
  result = spawnSync("bash", [wikiScript, "query", PROJECT_ROOT, ".autoflow", ...args], {
    stdio: "inherit",
    env,
  });
}

process.exit(result.status ?? 0);
