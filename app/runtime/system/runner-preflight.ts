#!/usr/bin/env tsx

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { readRunnerStateFile, writeRunnerStateFile } from "../../shared/runner-state-store";

type PreflightDecision = {
  actionable: boolean;
  reason: string;
  counts: Record<string, number>;
  firstPath?: string;
};

const ARGV = process.argv.slice(2);

function arg(name: string, fallback = ""): string {
  const index = ARGV.indexOf(name);
  if (index >= 0 && ARGV[index + 1]) return ARGV[index + 1];
  const prefix = `${name}=`;
  const found = ARGV.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name: string): boolean {
  return ARGV.includes(name);
}

function help(): void {
  process.stdout.write(`Usage: tsx runner-preflight.ts --runner <id> --role <role> [--write-state]\n`);
}

if (ARGV.includes("--help") || ARGV.includes("-h")) {
  help();
  process.exit(0);
}

const RUNNER_ID = arg("--runner", process.env.AUTOFLOW_RUNNER_ID || process.env.RUNNER_ID || "");
const ROLE = normalizeRole(arg("--role", RUNNER_ID));
const BOARD_ROOT = path.resolve(
  process.env.AUTOFLOW_BOARD_ROOT ||
  process.env.BOARD_ROOT ||
  path.join(process.cwd(), ".autoflow")
);
const TICKETS_ROOT = path.join(BOARD_ROOT, "tickets");
const STATE_DIR = path.join(BOARD_ROOT, "runners", "state");
const NOW = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

if (!RUNNER_ID) {
  process.stderr.write("runner-preflight requires --runner\n");
  process.exit(1);
}

function normalizeRole(value: string): string {
  const raw = String(value || "").toLowerCase();
  if (raw === "plan") return "planner";
  if (raw === "ticket" || raw === "todo" || raw === "merge" || raw === "merge-bot") return "worker";
  if (raw === "verify") return "verifier";
  if (raw === "wiki") return "wiki-maintainer";
  return raw || "worker";
}

function boardRel(filePath: string): string {
  const rel = path.relative(BOARD_ROOT, filePath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : filePath;
}

function listFiles(dir: string, pattern: RegExp, limit = 50): string[] {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  entries = entries
    .filter((name) => pattern.test(name))
    .map((name) => path.join(dir, name))
    .filter((filePath) => {
      try { return fs.statSync(filePath).isFile(); } catch { return false; }
    })
    .sort((a, b) => a.localeCompare(b));
  return entries.slice(0, limit);
}

function scalarInSection(filePath: string, section: string, field: string): string {
  let text = "";
  try { text = fs.readFileSync(filePath, "utf8"); } catch { return ""; }
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inSection = heading[1].trim().toLowerCase() === section.toLowerCase();
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^-\s*([^:]+):\s*(.*?)\s*$/);
    if (match && match[1].trim().toLowerCase() === field.toLowerCase()) return match[2].trim();
  }
  return "";
}

function plannerQueueFileIsActionable(filePath: string): boolean {
  const status = (
    scalarInSection(filePath, "Order", "Status") ||
    scalarInSection(filePath, "Project", "Status")
  ).toLowerCase();
  return !["blocked", "done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status);
}

function workerInprogressFileIsActionable(filePath: string): boolean {
  let text = "";
  try { text = fs.readFileSync(filePath, "utf8"); } catch { return false; }
  const stage = (
    scalarInSection(filePath, "Ticket", "Stage") ||
    scalarInSection(filePath, "Worktree", "Integration Status") ||
    scalarInSection(filePath, "Goal Runtime", "Status")
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

function walkMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (current: string): void => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(filePath);
      }
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

function pendingWakeCount(runnerId: string): number {
  const queuePath = path.join(STATE_DIR, `${runnerId}-wake.queue.jsonl`);
  const pointerPath = path.join(STATE_DIR, `${runnerId}-wake.pointer`);
  let pointer = "";
  try { pointer = fs.readFileSync(pointerPath, "utf8").trim(); } catch {}
  try {
    return fs.readFileSync(queuePath, "utf8")
      .split(/\n/)
      .filter(Boolean)
      .filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return !pointer || String(parsed.at || "") > pointer;
        } catch {
          return false;
        }
      }).length;
  } catch {
    return 0;
  }
}

function advanceWakePointerToLatest(runnerId: string): void {
  const queuePath = path.join(STATE_DIR, `${runnerId}-wake.queue.jsonl`);
  const pointerPath = path.join(STATE_DIR, `${runnerId}-wake.pointer`);
  let latest = "";
  try {
    for (const line of fs.readFileSync(queuePath, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        const at = String(parsed.at || "");
        if (at && (!latest || at > latest)) latest = at;
      } catch {}
    }
  } catch {
    return;
  }
  if (!latest) return;
  try { fs.writeFileSync(pointerPath, `${latest}\n`); } catch {}
}

function plannerRecoveryFiles(): string[] {
  const candidates = [
    ...listFiles(path.join(TICKETS_ROOT, "todo"), /^(Todo-\d+|tickets_\d+)\.md$/),
    ...listFiles(path.join(TICKETS_ROOT, "inprogress"), /^(Todo-\d+|tickets_\d+|plan_\d+)\.md$/),
  ];
  return candidates.filter((filePath) => {
    let text = "";
    try { text = fs.readFileSync(filePath, "utf8"); } catch { return false; }
    if (!/## Recovery State/i.test(text)) return false;
    const status = text.match(/^-\s*Status:\s*(.*?)\s*$/mi)?.[1]?.trim().toLowerCase() || "";
    if (status && !["clear", "cleared", "none", "resolved", "idle", "ok"].includes(status)) return true;
    return /Failure Class:|Planner Decision:|Worker Resume Instruction:/i.test(text);
  });
}

function currentWikiIndexSourceHash(): string {
  const dbPath = path.join(STATE_DIR, "wiki-search.db");
  if (!fs.existsSync(dbPath)) return "";
  const result = spawnSync("sqlite3", [dbPath, "SELECT value FROM wiki_index_meta WHERE key='source_hash' LIMIT 1;"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function currentWikiSourceHash(): { hash: string; count: number } {
  const files = [
    ...walkMarkdownFiles(path.join(BOARD_ROOT, "wiki")),
    ...walkMarkdownFiles(path.join(TICKETS_ROOT, "done")),
  ].sort((a, b) => a.localeCompare(b));
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    try {
      const text = fs.readFileSync(file, "utf8");
      if (!text.trim()) continue;
      const relPath = path.relative(BOARD_ROOT, file);
      const contentSha = crypto.createHash("sha256").update(text).digest("hex");
      hash.update(relPath).update("\0").update(contentSha).update("\0");
    } catch {}
  }
  return { hash: hash.digest("hex"), count: files.length };
}

function first(files: string[]): string {
  return files[0] ? boardRel(files[0]) : "";
}

function decide(): PreflightDecision {
  const wakes = pendingWakeCount(RUNNER_ID);

  if (ROLE === "planner") {
    const orders = listFiles(path.join(TICKETS_ROOT, "order"), /^order_.*\.md$/).filter(plannerQueueFileIsActionable);
    const prds = listFiles(path.join(TICKETS_ROOT, "prd"), /^(prd|project)_\d+\.md$/).filter(plannerQueueFileIsActionable);
    const recovery = plannerRecoveryFiles();
    const files = [...orders, ...prds, ...recovery];
    return {
      actionable: files.length > 0,
      reason: files.length > 0 ? "planner_queue_or_recovery" : "idle_no_planner_work",
      counts: { wake: wakes, order: orders.length, prd: prds.length, recovery: recovery.length },
      firstPath: first(files),
    };
  }

  if (ROLE === "worker") {
    const inprogress = listFiles(path.join(TICKETS_ROOT, "inprogress"), /^(Todo-\d+|tickets_\d+)\.md$/)
      .filter(workerInprogressFileIsActionable);
    const readyToMerge = listFiles(path.join(TICKETS_ROOT, "ready-to-merge"), /^(Todo-\d+|tickets_\d+)\.md$/);
    const todo = listFiles(path.join(TICKETS_ROOT, "todo"), /^(Todo-\d+|tickets_\d+)\.md$/);
    const files = [...inprogress, ...readyToMerge, ...todo];
    return {
      actionable: files.length > 0,
      reason: files.length > 0 ? "worker_queue" : "idle_no_worker_work",
      counts: { wake: wakes, inprogress: inprogress.length, ready_to_merge: readyToMerge.length, todo: todo.length },
      firstPath: first(files),
    };
  }

  if (ROLE === "verifier") {
    const verifier = listFiles(path.join(TICKETS_ROOT, "verifier"), /^(Todo-\d+|tickets_\d+)\.md$/);
    return {
      actionable: verifier.length > 0,
      reason: verifier.length > 0 ? "verifier_queue" : "idle_no_verifier_work",
      counts: { wake: wakes, verifier: verifier.length },
      firstPath: first(verifier),
    };
  }

  if (ROLE === "wiki-maintainer") {
    const current = currentWikiSourceHash();
    const indexed = currentWikiIndexSourceHash();
    const stale = current.count > 0 && (!indexed || indexed !== current.hash);
    return {
      actionable: stale,
      reason: stale ? "wiki_index_stale" : "idle_wiki_index_current",
      counts: { wake: wakes, wiki_sources: current.count, index_hash_match: indexed && indexed === current.hash ? 1 : 0 },
    };
  }

  return { actionable: false, reason: "idle_unknown_role", counts: { wake: wakes } };
}

function writeIdleState(decision: PreflightDecision): void {
  const statePath = path.join(STATE_DIR, `${RUNNER_ID}.state`);
  const existing = readRunnerStateFile(statePath);
  const now = NOW();
  writeRunnerStateFile(statePath, {
    ...existing,
    id: RUNNER_ID,
    role: ROLE,
    status: "idle",
    pid: "",
    active_item: "",
    active_ticket_id: "",
    active_ticket_title: "",
    active_stage: "idle",
    active_spec_ref: "",
    active_ticket_path: "",
    active_recovery_reason: "",
    active_recovery_status: "",
    active_recovery_failure_class: "",
    active_recovery_worktree_path: "",
    active_recovery_worktree_status: "",
    active_recovery_board_state: "",
    last_result: "preflight_idle",
    last_event_at: now,
    preflight_last_at: now,
    preflight_last_result: "idle",
    preflight_last_reason: decision.reason,
    updated_at: now,
  });
}

const decision = decide();
if (!decision.actionable && hasFlag("--write-state")) {
  advanceWakePointerToLatest(RUNNER_ID);
  writeIdleState(decision);
}

process.stdout.write([
  "status=ok",
  `runner=${RUNNER_ID}`,
  `role=${ROLE}`,
  `decision=${decision.actionable ? "start" : "skip"}`,
  `result=${decision.actionable ? "preflight_actionable" : "preflight_idle"}`,
  `actionable=${decision.actionable ? "true" : "false"}`,
  `reason=${decision.reason}`,
  `first_path=${decision.firstPath || ""}`,
  ...Object.entries(decision.counts).map(([key, value]) => `count.${key}=${value}`),
  "",
].join("\n"));
