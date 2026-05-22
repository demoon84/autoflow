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
  decision: "block",
  reason,
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
    const ready = listTickets("ready-to-merge")[0];
    if (ready) return `worker merge work remains: ready-to-merge ticket ${path.basename(ready)} is waiting.`;
    const waitingForVerifier = listTickets("verifier").find((file) =>
      workerOwnsTicket(file, workerId) && workerVerifierTicketIsWaiting(file)
    );
    if (waitingForVerifier) return "";
    const nextTodo = listTickets("todo").find(workerTodoIsClaimable);
    if (nextTodo) {
      return `worker queue remains: claimable TODO ${path.basename(nextTodo)} is waiting. Run worker active-get, then worker todo-snapshot, claim one ticket, and continue before stopping.`;
    }
  }

  if (["plan", "planner"].includes(role)) {
    const prd = listFiles(path.join(boardRoot, "tickets", "prd"), /^(PRD)-\d+\.md$/)
      .find(plannerFileIsActionable);
    if (prd) return `planner work remains: populated PRD ${path.basename(prd)} still needs planner runner processing.`;
  }

  if (role === "verifier") {
    const verifier = listTickets("verifier")[0];
    if (verifier) return `verifier work remains: ticket ${path.basename(verifier)} is awaiting verification.`;
  }

  if (["wiki", "wiki-maintainer"].includes(role)) {
    const wikiReason = wikiWorkReason();
    if (wikiReason) return wikiReason;
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
  return listFiles(path.join(boardRoot, "tickets", state), /^TODO-\d+\.md$/);
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

function wikiWorkReason(): string {
  const state = readWikiFocusedReviewState();
  const pending = state.pending_done_paths
    .map(normalizeBoardRel)
    .filter((item) => item && boardRelFileExists(item));
  if (pending.length > 0) {
    return `wiki work remains: focused done source ${pending[0]} still needs wiki review. Run wiki tick and process one focused page before stopping.`;
  }

  const reviewed = new Set(state.reviewed_done_paths.map(normalizeBoardRel).filter(Boolean));
  const unreviewed = recentDoneMarkdown(50)
    .map(boardRel)
    .filter((item) => item && !reviewed.has(item));
  if (unreviewed.length > 0) {
    return `wiki work remains: ${unreviewed.length} recent done source(s) still need focused wiki review; next source is ${unreviewed[0]}. Run wiki tick again instead of stopping.`;
  }
  return "";
}

function readWikiFocusedReviewState(): { reviewed_done_paths: string[]; pending_done_paths: string[] } {
  const file = path.join(boardRoot, "runners", "state", "wiki-focused-review.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      reviewed_done_paths: Array.isArray(parsed?.reviewed_done_paths)
        ? parsed.reviewed_done_paths.map((item: unknown) => String(item || "")).filter(Boolean)
        : [],
      pending_done_paths: Array.isArray(parsed?.pending_done_paths)
        ? parsed.pending_done_paths.map((item: unknown) => String(item || "")).filter(Boolean)
        : [],
    };
  } catch {
    return { reviewed_done_paths: [], pending_done_paths: [] };
  }
}

function recentDoneMarkdown(limit: number): string[] {
  const files = walkMarkdown(path.join(boardRoot, "tickets", "done"));
  return files
    .map((file) => {
      let mtimeMs = 0;
      try { mtimeMs = fs.statSync(file).mtimeMs; } catch {}
      return { file, mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs || left.file.localeCompare(right.file))
    .slice(0, limit)
    .map((item) => item.file);
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function boardRel(file: string): string {
  const rel = path.relative(boardRoot, file).split(path.sep).join("/");
  return rel && !rel.startsWith("..") ? rel : file;
}

function normalizeBoardRel(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (path.isAbsolute(value)) return boardRel(value);
  return value.replace(/\\/g, "/").replace(/^\.autoflow\//, "").replace(/^\.\//, "");
}

function boardRelFileExists(rel: string): boolean {
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  try {
    return fs.statSync(path.join(boardRoot, rel)).isFile();
  } catch {
    return false;
  }
}

function plannerFileIsActionable(file: string): boolean {
  const status = scalar(file, "Project", "Status").toLowerCase();
  if (["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status)) {
    return false;
  }
  return true;
}

function workerTicketIsActionable(file: string): boolean {
  const text = read(file);
  const stage = ticketStage(file);
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

function workerOwnsTicket(file: string, workerId: string): boolean {
  const worker = scalar(file, "Ticket", "AI");
  const claimed = scalar(file, "Ticket", "Claimed By");
  const execution = scalar(file, "Ticket", "Execution AI");
  return !workerId || [worker, claimed, execution].some((value) => value === workerId || value.startsWith(`${workerId}:`));
}

function workerVerifierTicketIsWaiting(file: string): boolean {
  const text = read(file);
  const stage = ticketStage(file);
  if (
    /verified[_ -]?pending[_ -]?merge/.test(stage) ||
    /revision[_ -]?requested/.test(stage) ||
    /replan[_ -]?requested/.test(stage) ||
    /^-\s*Semantic Decision:\s*(pass|revise|replan|reject)\s*$/mi.test(text)
  ) {
    return false;
  }
  return true;
}

function ticketStage(file: string): string {
  return (
    scalar(file, "Ticket", "Stage") ||
    scalar(file, "Worktree", "Integration Status") ||
    scalar(file, "Goal Runtime", "Status")
  ).toLowerCase();
}

function workerTodoIsClaimable(file: string): boolean {
  return ticketAllowedPaths(file).length > 0;
}

function ticketAllowedPaths(file: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const raw of read(file).split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(raw)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(raw) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const match = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const value = match[1].replace(/`/g, "").trim();
    if (allowedPathIsConcreteRepoPath(value)) out.push(value);
  }
  return [...new Set(out)];
}

function allowedPathIsConcreteRepoPath(raw: string): boolean {
  const clean = String(raw || "").replace(/`/g, "").trim();
  if (!clean) return false;
  if (/^(TBD|TODO:?|N\/A|NA|NONE)$/i.test(clean)) return false;
  if (/^TODO:?/i.test(clean)) return false;
  if (clean.startsWith("/")) return false;
  if (clean.startsWith("../") || clean.includes("/../")) return false;
  if (/[*?\[\]]/.test(clean)) return false;
  return true;
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
