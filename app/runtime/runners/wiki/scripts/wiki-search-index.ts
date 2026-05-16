#!/usr/bin/env npx tsx
/*
 * wiki-search-index.ts — wiki BM25+vector hybrid index refresher.
 *
 * Builds .autoflow/runners/state/wiki-search.db so `autoflow wiki query --rag`
 * can use SQLite FTS5/BM25 plus dense vector similarity.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveAutoflowRepoRoot } from "../../../shared/tsx";

const BOARD_ROOT = process.env.BOARD_ROOT
  || process.env.AUTOFLOW_BOARD_ROOT
  || path.join(process.cwd(), ".autoflow");

const PROJECT_ROOT = process.env.PROJECT_ROOT
  || process.env.AUTOFLOW_PROJECT_ROOT
  || path.resolve(BOARD_ROOT, "..");

const autoflowBin = (() => {
  if (process.env.AUTOFLOW_CLI) return process.env.AUTOFLOW_CLI;
  const repoBin = path.join(resolveAutoflowRepoRoot(__dirname), "app", "bin", "autoflow");
  if (fs.existsSync(repoBin)) return repoBin;
  const local = path.join(PROJECT_ROOT, "node_modules", ".bin", "autoflow");
  if (fs.existsSync(local)) return local;
  return "autoflow";
})();

const args = ["wiki", "ingest", PROJECT_ROOT, path.basename(BOARD_ROOT), ...process.argv.slice(2)];
const env = {
  ...process.env,
  AUTOFLOW_WIKI_VECTOR_INDEX: "on",
  AUTOFLOW_WIKI_VECTOR_MODEL: process.env.AUTOFLOW_WIKI_VECTOR_MODEL || "BAAI/bge-m3",
  AUTOFLOW_WIKI_VECTOR_DIM: process.env.AUTOFLOW_WIKI_VECTOR_DIM || "1024",
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const result = process.env.AUTOFLOW_CLI
  ? spawnSync([autoflowBin, ...args.map(shellQuote)].join(" "), { shell: true, stdio: "inherit", env })
  : path.isAbsolute(autoflowBin)
    ? spawnSync(process.execPath, [autoflowBin, ...args], { stdio: "inherit", env })
    : spawnSync(autoflowBin, args, { stdio: "inherit", env });

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 0);
