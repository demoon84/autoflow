#!/usr/bin/env npx tsx
/**
 * wiki-query.ts — Autoflow markdown wiki query wrapper.
 *
 * Delegates to autoflow wiki query. With --rag, Autoflow tries optional qmd
 * first and falls back to markdown scan. No Autoflow-owned wiki DB is required.
 *
 * Usage:
 *   npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]
 *
 * All options are forwarded to autoflow wiki query. Extra flag:
 *   --rag          Try qmd search, then markdown fallback (passed through).
 *   --synth        Enable synthesis (passed through).
 *   --limit N      Result limit (passed through).
 *
 * Exit 0 always (1원칙).
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveAutoflowRepoRoot } from "../../../shared/tsx";

const BOARD_ROOT = process.env.BOARD_ROOT
  || process.env.AUTOFLOW_BOARD_ROOT
  || path.join(process.cwd(), ".autoflow");

const PROJECT_ROOT = process.env.PROJECT_ROOT
  || process.env.AUTOFLOW_PROJECT_ROOT
  || path.resolve(BOARD_ROOT, "..");

const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1] || __filename));

// ─── Main ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write([
    "wiki-query.ts — Autoflow markdown wiki query.",
    "",
    "Usage: npx tsx wiki-query.ts --term <text> [--term <text>...] [--rag] [options]",
    "",
    "Calls autoflow wiki query. --rag uses qmd when available, then markdown scan fallback.",
    "",
    "Options are forwarded to autoflow wiki query unchanged.",
  ].join("\n") + "\n");
  process.exit(0);
}

const args = process.argv.slice(2);

// Find the Autoflow CLI. The package CLI is TypeScript-only.
const autoflowBin = (() => {
  if (process.env.AUTOFLOW_CLI) return process.env.AUTOFLOW_CLI;
  const repoBin = path.join(resolveAutoflowRepoRoot(SCRIPT_DIR), "app", "bin", "autoflow");
  if (fs.existsSync(repoBin)) return repoBin;
  const local = path.join(PROJECT_ROOT, "node_modules", ".bin", "autoflow");
  if (fs.existsSync(local)) return local;
  return "autoflow";
})();

const env: NodeJS.ProcessEnv = {
  ...process.env,
  AUTOFLOW_WIKI_SEARCH_PROVIDER: process.env.AUTOFLOW_WIKI_SEARCH_PROVIDER || "auto",
};

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
