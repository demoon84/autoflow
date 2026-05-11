#!/usr/bin/env npx tsx

import * as fs from "fs";
import * as path from "path";


// Cross-mode (ESM + CJS via tsx) script-dir resolver: process.argv[1]
// is the path to the .ts file currently executing in either runtime.
const SCRIPT_DIR_HERE = require("node:path").dirname(process.argv[1] || "");
type Stage = "inprogress" | "merging" | "idle" | string;

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node runner-stage.ts <stage> [--runner <id>] [--ticket <ticket-id>] [--note <text>]");
  process.exit(0);
}

let stage: Stage = args.shift() as Stage;
if (!stage || stage.startsWith("--")) {
  console.error("Usage: node runner-stage.ts <stage> [--runner <id>] [--ticket <ticket-id>] [--note <text>]");
  process.exit(1);
}

let runnerId: string = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || process.env.WORKER_ID || "worker";
let ticketRef = "";
let note = "";
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--runner" && args[i + 1]) {
    runnerId = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === "--ticket" && args[i + 1]) {
    ticketRef = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === "--note" && args[i + 1]) {
    note = args[i + 1];
    i += 1;
    continue;
  }
}

const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(SCRIPT_DIR_HERE, ".."));
const statePath = path.join(boardRoot, "runners", "state", `${runnerId}.state`);

const readText = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

const normalizeTicketId = (value: string): string => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const ticketIdPattern = [
    /^Todo[-_]?([A-Za-z0-9._-]+)$/i,
    /^tickets?[-_]?([A-Za-z0-9._-]+)$/i,
  ];
  for (const pattern of ticketIdPattern) {
    const m = trimmed.match(pattern);
    if (m) return `Todo-${m[1]}`;
  }

  const pathTicket = trimmed.match(/(?:^|[\/\\])(Todo[-_][^\/\\]+|tickets[-_][^\/\\]+)\.md$/i);
  if (pathTicket) {
    const tail = pathTicket[1];
    const todo = tail.match(/^Todo[-_](.+)$/i);
    const alt = tail.match(/^tickets?[-_](.+)$/i);
    if (todo) return `Todo-${todo[1]}`;
    if (alt) return `Todo-${alt[1]}`;
  }

  const onlyDigits = trimmed.match(/^(\d+)$/);
  if (onlyDigits) return `Todo-${onlyDigits[1]}`;

  return "";
};

const pathForTicket = (ticketValue: string): string => {
  if (!ticketValue) return "";
  const candidates = [
    path.join(boardRoot, "tickets", "inprogress", ticketValue),
    path.join(boardRoot, "tickets", "todo", ticketValue),
    path.join(boardRoot, "tickets", "verifier", ticketValue),
    path.join(boardRoot, "tickets", "ready-to-merge", ticketValue),
    path.join(boardRoot, "tickets", "done", ticketValue),
    path.join(boardRoot, "tickets", "inbox", ticketValue),
    path.join(boardRoot, "tickets", "check", ticketValue),
  ];

  const fileName = path.basename(ticketValue);
  if (fileName.endsWith(".md")) {
    candidates.unshift(path.resolve(ticketValue));
    if (!path.isAbsolute(ticketValue)) {
      candidates.unshift(path.join(boardRoot, ticketValue));
      candidates.unshift(path.join(boardRoot, "tickets", ticketValue));
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = path.normalize(candidate);
    try {
      if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) return normalized;
    } catch {
      continue;
    }
  }

  return "";
};

const readTicketTitle = (ticketFile: string): string => {
  if (!ticketFile) return "";
  const lines = readText(ticketFile).split(/\r?\n/);
  let inTicket = false;
  for (const line of lines) {
    if (/^## /.test(line) && !/^## Ticket/.test(line)) {
      inTicket = false;
      continue;
    }
    if (line === "## Ticket") {
      inTicket = true;
      continue;
    }
    if (!inTicket) continue;
    const m = line.match(/^-\s*Title:\s*(.*?)\s*$/);
    if (m) return m[1];
  }
  return "";
};

const readPrdRef = (ticketFile: string): string => {
  if (!ticketFile) return "";
  const lines = readText(ticketFile).split(/\r?\n/);
  let inReferences = false;
  for (const line of lines) {
    if (/^## /.test(line) && !/^## References/.test(line)) {
      inReferences = false;
      continue;
    }
    if (line === "## References") {
      inReferences = true;
      continue;
    }
    if (!inReferences) continue;
    const m = line.match(/^-\s*PRD:\s*(.*?)\s*$/);
    if (m) return m[1].trim();
  }
  return "";
};

const ticketId = normalizeTicketId(ticketRef);
let ticketPath = "";

if (ticketRef) {
  ticketPath = pathForTicket(ticketRef);
  if (!ticketPath && ticketId) {
    const suffix = ticketId.replace(/^Todo-/, "");
    const legacyNames = [`Todo-${suffix}.md`, `tickets_${suffix}.md`];
    ticketPath = legacyNames
      .flatMap((name) => [
        path.join(boardRoot, "tickets", "inprogress", name),
        path.join(boardRoot, "tickets", "todo", name),
        path.join(boardRoot, "tickets", "verifier", name),
        path.join(boardRoot, "tickets", "done", name),
        path.join(boardRoot, "tickets", "ready-to-merge", name),
      ])
      .find((entry) => {
        try {
          return fs.existsSync(entry) && fs.statSync(entry).isFile();
        } catch {
          return false;
        }
      }) ?? "";
  }
}

if (!ticketId) {
  stage = "idle";
}

if (!fs.existsSync(statePath)) {
  process.exit(0);
}

const ticketTitle = ticketPath ? readTicketTitle(ticketPath) : "";
const specRef = ticketPath ? readPrdRef(ticketPath) : "";
const current = readText(statePath).split(/\r?\n/);

const isIdle = !ticketId || stage === "idle";
const relativePath = (value: string): string => {
  if (!value) return "";
  const rel = path.relative(boardRoot, value);
  if (!rel || rel === "." || rel.startsWith("..") || path.isAbsolute(rel)) return "";
  return rel;
};

const next: Record<string, string> = {
  active_item: isIdle ? "" : `${ticketId}${ticketTitle ? ` — ${ticketTitle}` : ""}`,
  active_ticket_id: isIdle ? "" : ticketId,
  active_ticket_title: isIdle ? "" : ticketTitle,
  active_stage: isIdle ? "idle" : stage,
  active_spec_ref: isIdle ? "" : specRef,
  active_ticket_path: isIdle ? "" : relativePath(ticketPath),
  active_recovery_reason: "",
  active_recovery_status: "",
  active_recovery_failure_class: "",
  active_recovery_worktree_path: "",
  active_recovery_worktree_status: "",
  active_recovery_board_state: "",
  last_result: "",
};
if (note) next.last_result = note;

const known = new Set(Object.keys(next));
const seen = new Set<string>();
const out: string[] = [];

for (const line of current) {
  if (!line.includes("=")) {
    out.push(line);
    continue;
  }

  const eq = line.indexOf("=");
  const key = line.slice(0, eq);
  if (known.has(key)) {
    out.push(`${key}=${next[key]}`);
    seen.add(key);
    continue;
  }
  out.push(line);
}

for (const [key, value] of Object.entries(next)) {
  if (!seen.has(key)) {
    out.push(`${key}=${value}`);
  }
}

fs.writeFileSync(statePath, out.join("\n"));
process.exit(0);
