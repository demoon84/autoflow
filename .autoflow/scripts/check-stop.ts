#!/usr/bin/env npx tsx
/*
 * check-stop.ts — Codex Stop hook guard.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));

if (/^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_STOP_BYPASS || "")) process.exit(0);

const context = loadContext();
const role = process.env.AUTOFLOW_ROLE || context.role || "";
const workerId = process.env.AUTOFLOW_WORKER_ID || context.worker_id || "";
if (!role) process.exit(0);

const reason = reasonFor(role, workerId);
if (!reason) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "Stop",
    decision: "block",
    reason,
  },
}, null, 2) + "\n");

function reasonFor(role: string, workerId: string): string {
  if (["worker", "ticket", "todo"].includes(role)) {
    const owned = listTickets("inprogress").find((file) => {
      const worker = scalar(file, "Ticket", "AI");
      const claimed = scalar(file, "Ticket", "Claimed By");
      const execution = scalar(file, "Ticket", "Execution AI");
      return !workerId || [worker, claimed, execution].some((value) => value === workerId || value.startsWith(`${workerId}:`));
    });
    if (owned) return `worker work remains: runner ${workerId || "worker"} still has inprogress ticket ${path.basename(owned)}.`;
    const todo = listTickets("todo")[0];
    if (todo) return `worker work remains: claimable ticket ${path.basename(todo)} is waiting.`;
  }

  if (["plan", "planner"].includes(role)) {
    const prd = listFiles(path.join(boardRoot, "tickets", "prd"), /^(prd|project)_\d+\.md$/)[0];
    if (prd) return `planner work remains: populated PRD ${path.basename(prd)} still needs Plan AI processing.`;
    const order = listFiles(path.join(boardRoot, "tickets", "order"), /^order_.*\.md$/)[0];
    if (order) return `planner work remains: order ${path.basename(order)} still needs Plan AI processing.`;
  }

  if (role === "verifier") {
    const verifier = listTickets("verifier")[0];
    if (verifier) return `verifier work remains: ticket ${path.basename(verifier)} is awaiting verification.`;
  }

  if (role === "merge" || role === "merge-bot") {
    const ready = listTickets("ready-to-merge")[0];
    if (ready) return `merge finalization work remains: ready-to-merge ticket ${path.basename(ready)} is waiting.`;
  }

  return "";
}

function loadContext(): Record<string, string> {
  const file = path.join(boardRoot, "automations", "state", "current.context");
  const out: Record<string, string> = {};
  for (const line of read(file).split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

function listTickets(state: string): string[] {
  return listFiles(path.join(boardRoot, "tickets", state), /^(Todo-\d+|tickets_\d+)\.md$/);
}

function listFiles(dir: string, pattern: RegExp): string[] {
  try {
    return fs.readdirSync(dir)
      .filter((name) => pattern.test(name))
      .sort()
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return match[1].replace(/^`+|`+$/g, "").trim();
  }
  return "";
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
