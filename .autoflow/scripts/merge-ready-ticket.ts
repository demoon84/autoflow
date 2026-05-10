#!/usr/bin/env npx tsx
/**
 * merge-ready-ticket.ts
 *
 * TypeScript entry point for the Autoflow worktree-to-main merge flow.
 * Performs a pre-flight Integration Status check (needs_ai_merge detection)
 * then delegates full merge orchestration to merge-ready-ticket.legacy.sh.
 *
 * needs_ai_merge conditions (checked pre-flight):
 *   - Worktree Integration Status already set to needs_ai_merge
 *   - Unresolved merge conflicts in worktree
 */

import { spawnSync, execFileSync } from "node:child_process";
import * as path from "node:path";
import { readFileSafe, resolveBoardRoot, ticketWorktreeField } from "./board-utils.js";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const legacyScript = path.join(scriptDir, "merge-ready-ticket.legacy.sh");

// ─── Pre-flight: needs_ai_merge detection ────────────────────────────

function checkNeedsAiMerge(ticketFile: string): string | null {
  if (!ticketFile) return null;
  const content = readFileSafe(ticketFile);
  if (!content) return null;

  // Check current Integration Status
  const integStatus = ticketWorktreeField(ticketFile, "Integration Status");
  if (integStatus === "needs_ai_merge") {
    return `Integration Status already set to needs_ai_merge`;
  }

  // Check for conflict markers in worktree
  const worktreePath = ticketWorktreeField(ticketFile, "Path").replace(/`/g, "").trim();
  if (worktreePath) {
    try {
      execFileSync("git", ["diff", "--check"], {
        cwd: worktreePath,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch {
      return `Conflict markers detected in worktree at ${worktreePath}`;
    }
  }

  return null;
}

function resolveTicketFile(arg: string): string {
  if (!arg) return "";
  if (arg.endsWith(".md")) return arg;
  const boardRoot = resolveBoardRoot();
  const num = arg.replace(/^Todo-/i, "");
  return path.join(boardRoot, "tickets", "inprogress", `Todo-${num}.md`);
}

// ─── Main ─────────────────────────────────────────────────────────────

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(
    "merge-ready-ticket.ts — Autoflow worktree merge pre-flight (TS).\n" +
    "Usage: npx tsx merge-ready-ticket.ts [ticket-id-or-path]\n" +
    "Checks needs_ai_merge conditions then delegates to merge-ready-ticket.legacy.sh.\n"
  );
  process.exit(0);
}

// Pre-flight: emit warning if needs_ai_merge detected (non-blocking)
const ticketArg = process.argv[2] ?? "";
if (ticketArg) {
  try {
    const ticketFile = resolveTicketFile(ticketArg);
    const reason = checkNeedsAiMerge(ticketFile);
    if (reason) {
      process.stderr.write(
        `[merge-ready-ticket] pre-flight: needs_ai_merge detected — ${reason}\n` +
        `[merge-ready-ticket] delegating to legacy script which will handle the merge routing\n`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[merge-ready-ticket] pre-flight skipped: ${msg}\n`);
  }
}

const result = spawnSync("bash", [legacyScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[merge-ready-ticket] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === "number" ? result.status : 1);
