#!/usr/bin/env npx tsx
/**
 * start-plan.ts
 *
 * TypeScript entry point for the Autoflow Planner AI (start-plan) runner.
 * Implements planner state machine types and pre-flight validation, then
 * delegates full planner orchestration to start-plan.legacy.sh.
 *
 * Planner states:
 *   idle     — no actionable input (inbox, backlog, legacy plan)
 *   planning — PRD/order promotion or todo ticket generation in progress
 *   done     — this tick produced a todo ticket; planner hands off to worker
 *   blocked  — unrecoverable input (needs_user, vague-done-when, etc.)
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const legacyScript = path.join(scriptDir, "start-plan.legacy.sh");

// ─── Planner State Machine Types ─────────────────────────────────────

type PlannerState = "idle" | "planning" | "done" | "blocked";
type PlannerSource =
  | "todo"
  | "order-inbox"
  | "retry-inbox"
  | "express-order"
  | "backlog"
  | "legacy-plan"
  | "vague-done-when"
  | "needs_user_secret"
  | "no_actionable_plan_input";

interface PlannerOutput {
  status: "ok" | "idle" | "blocked";
  source?: PlannerSource;
  state: PlannerState;
  board_root?: string;
  project_root?: string;
  next_action?: string;
  worker_role?: string;
}

function derivePlannerState(status: string, source?: string): PlannerState {
  if (status === "idle") return "idle";
  if (status === "blocked") return "blocked";
  if (!source) return "planning";
  const doneSources: PlannerSource[] = ["todo", "backlog", "express-order"];
  if (doneSources.includes(source as PlannerSource)) return "done";
  return "planning";
}

function parsePlannerOutput(raw: string): Partial<PlannerOutput> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=");
    if (eq !== -1) {
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  const status = out["status"] ?? "idle";
  const source = out["source"] as PlannerSource | undefined;
  return {
    status: status as PlannerOutput["status"],
    source,
    state: derivePlannerState(status, source),
    board_root: out["board_root"],
    project_root: out["project_root"],
    next_action: out["next_action"],
    worker_role: out["worker_role"],
  };
}

// ─── Pre-flight ───────────────────────────────────────────────────────

function preflightCheck(): string | null {
  if (!fs.existsSync(legacyScript)) {
    return `start-plan.legacy.sh not found at ${legacyScript}`;
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(
    "start-plan.ts — Autoflow Planner AI runner (TS entry point).\n" +
    "Usage: npx tsx start-plan.ts [ticket-id]\n" +
    "Planner states: idle | planning | done | blocked\n" +
    "Delegates full planner orchestration to start-plan.legacy.sh.\n"
  );
  process.exit(0);
}

const preflightErr = preflightCheck();
if (preflightErr) {
  process.stderr.write(`[start-plan] pre-flight failed: ${preflightErr}\n`);
  process.exit(1);
}

const result = spawnSync("bash", [legacyScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[start-plan] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === "number" ? result.status : 1);
