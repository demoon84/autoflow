#!/usr/bin/env npx tsx
/**
 * wiki-query.ts — Autoflow wiki hybrid RAG query wrapper.
 *
 * Sets up AUTOFLOW_WIKI_EMBEDDING_PROVIDER → wiki-embed.ts, AUTOFLOW_WIKI_VECTOR_DIM=1024,
 * then delegates to autoflow wiki query. Emits rag_backend=hybrid
 * when the BM25+vector index and embedding provider are ready.
 *
 * Usage:
 *   npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]
 *
 * All options are forwarded to autoflow wiki query. Extra flag:
 *   --rag          Enable BM25+vector RAG mode (passed through).
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

const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
const EMBED_SCRIPT = path.join(SCRIPT_DIR, "wiki-embed.ts");

const VECTOR_MODEL = process.env.AUTOFLOW_WIKI_VECTOR_MODEL || "BAAI/bge-m3";
const VECTOR_DIM = Number.parseInt(process.env.AUTOFLOW_WIKI_VECTOR_DIM || "", 10) || 1024;

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
    "wiki-query.ts — Autoflow wiki hybrid RAG query (sentence-transformers).",
    "",
    "Usage: npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]",
    "",
    "Sets AUTOFLOW_WIKI_EMBEDDING_PROVIDER=wiki-embed.ts, AUTOFLOW_WIKI_VECTOR_DIM=1024,",
    "then calls autoflow wiki query. rag_backend=hybrid when BM25+vector index is ready.",
    "",
    "Options are forwarded to autoflow wiki query unchanged.",
  ].join("\n") + "\n");
  process.exit(0);
}

const args = process.argv.slice(2);

// Find the Autoflow CLI. The package CLI is TypeScript-only.
const autoflowBin = (() => {
  if (process.env.AUTOFLOW_CLI) return process.env.AUTOFLOW_CLI;
  const repoBin = path.join(PROJECT_ROOT, "app", "bin", "autoflow");
  if (fs.existsSync(repoBin)) return repoBin;
  const local = path.join(PROJECT_ROOT, "node_modules", ".bin", "autoflow");
  if (fs.existsSync(local)) return local;
  return "autoflow";
})();

const embedProvider = embedProviderCmd();
const env: NodeJS.ProcessEnv = {
  ...process.env,
  AUTOFLOW_WIKI_VECTOR_INDEX: "on",
  AUTOFLOW_WIKI_VECTOR_MODEL: VECTOR_MODEL,
  AUTOFLOW_WIKI_VECTOR_DIM: String(VECTOR_DIM),
};
if (embedProvider) {
  env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER = embedProvider;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const cliArgs = ["wiki", "query", PROJECT_ROOT, path.basename(BOARD_ROOT), ...args];
const result = process.env.AUTOFLOW_CLI
  ? spawnSync([autoflowBin, ...cliArgs.map(shellQuote)].join(" "), { shell: true, stdio: "inherit", env })
  : path.isAbsolute(autoflowBin)
    ? spawnSync(process.execPath, [autoflowBin, ...cliArgs], { stdio: "inherit", env })
    : spawnSync(autoflowBin, cliArgs, { stdio: "inherit", env });

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 0);
