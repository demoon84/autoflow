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
  if (["worker", "ticket", "todo", "merge", "merge-bot"].includes(role)) {
    const owned = listTickets("inprogress").find((file) => {
      if (!workerTicketIsActionable(file)) return false;
      const worker = scalar(file, "Ticket", "AI");
      const claimed = scalar(file, "Ticket", "Claimed By");
      const execution = scalar(file, "Ticket", "Execution AI");
      return !workerId || [worker, claimed, execution].some((value) => value === workerId || value.startsWith(`${workerId}:`));
    });
    if (owned) return `worker work remains: runner ${workerId || "worker"} still has inprogress ticket ${path.basename(owned)}.`;
    const todo = listTickets("todo")[0];
    if (todo) return `worker work remains: claimable ticket ${path.basename(todo)} is waiting.`;
    const ready = listTickets("ready-to-merge")[0];
    if (ready) return `worker merge work remains: ready-to-merge ticket ${path.basename(ready)} is waiting.`;
  }

  if (["plan", "planner"].includes(role)) {
    const prd = listFiles(path.join(boardRoot, "tickets", "prd"), /^(prd|project)_\d+\.md$/)
      .find(plannerFileIsActionable);
    if (prd) return `planner work remains: populated PRD ${path.basename(prd)} still needs planner runner processing.`;
    const order = listFiles(path.join(boardRoot, "tickets", "order"), /^order_.*\.md$/)
      .find(plannerFileIsActionable);
    if (order) return `planner work remains: order ${path.basename(order)} still needs planner runner processing.`;
  }

  if (role === "verifier") {
    const verifier = listTickets("verifier")[0];
    if (verifier) return `verifier work remains: ticket ${path.basename(verifier)} is awaiting verification.`;
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

function plannerFileIsActionable(file: string): boolean {
  const status = (
    scalar(file, "Order", "Status") ||
    scalar(file, "Project", "Status")
  ).toLowerCase();
  if (["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status)) {
    return false;
  }
  if (orderAlreadyPromoted(file)) {
    return false;
  }
  return true;
}

function orderAlreadyPromoted(file: string): boolean {
  const rel = boardRel(file);
  if (!/^tickets\/order\/order_[A-Za-z0-9._-]+\.md$/.test(rel)) return false;
  if (/_retry_/i.test(path.basename(file))) return false;
  for (const root of [path.join(boardRoot, "tickets", "prd"), path.join(boardRoot, "tickets", "done")]) {
    for (const candidate of walkMarkdownFiles(root)) {
      if (!/^(prd|project)_\d+\.md$/i.test(path.basename(candidate))) continue;
      if (sourceOrderRef(candidate) === rel) return true;
    }
  }
  return false;
}

function workerTicketIsActionable(file: string): boolean {
  const text = read(file);
  const stage = (
    scalar(file, "Ticket", "Stage") ||
    scalar(file, "Worktree", "Integration Status") ||
    scalar(file, "Goal Runtime", "Status")
  ).toLowerCase();
  if (/verified[_ -]?pending[_ -]?merge/.test(stage) || /^-\s*Semantic Decision:\s*pass\s*$/mi.test(text)) {
    return true;
  }
  if (
    /verify[_ -]?pending/.test(stage) ||
    /verifier[_ -]?pending/.test(stage) ||
    /submitted[_ -]?to[_ -]?verifier/.test(stage) ||
    /awaiting[_ -]?verifier/.test(stage)
  ) {
    return false;
  }
  return true;
}

function sourceOrderRef(file: string): string {
  return read(file).match(/tickets\/order\/order_[A-Za-z0-9._-]+\.md/)?.[0] || "";
}

function boardRel(file: string): string {
  return path.relative(boardRoot, file).split(path.sep).join("/");
}

function walkMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (current: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(next);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(next);
      }
    }
  };
  visit(dir);
  return out.sort();
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
