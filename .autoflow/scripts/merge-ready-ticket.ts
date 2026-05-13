#!/usr/bin/env npx tsx
/*
 * merge-ready-ticket.ts
 *
 * Cross-platform merge finalization shim. The durable finalization logic lives
 * in finish-ticket-owner.ts; this command preserves the historical manual
 * merge entrypoint without delegating to shell.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write("Usage: merge-ready-ticket.ts <ticket-id-or-path>\n");
  process.exit(0);
}

const ticketRef = process.argv[2] || "";
if (!ticketRef) {
  process.stderr.write("Usage: merge-ready-ticket.ts <ticket-id-or-path>\n");
  process.exit(1);
}

const ticketFile = resolveTicketFile(ticketRef);
const summary = ticketFile ? scalar(ticketFile, "Result", "Summary") || "merge ready ticket" : "merge ready ticket";
const finishTs = path.join(scriptDir, "finish-ticket-owner.ts");
const runner = tsxCommand();
const result = spawnSync(runner.command, [...runner.args, finishTs, ticketRef, "pass", summary], {
  cwd: boardRoot,
  env: {
    ...process.env,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_ROLE: "merge",
    AUTOFLOW_SKIP_VERIFIER: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`[merge-ready-ticket] exec error: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(typeof result.status === "number" ? result.status : 1);

function tsxCommand(): { command: string; args: string[] } {
  const local = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  if (fs.existsSync(local)) return { command: local, args: [] };
  return { command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["tsx"] };
}

function resolveTicketFile(ref: string): string {
  const normalized = ref.replace(/^[.][/]/, "");
  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;
  if (normalized.includes("/")) {
    const candidate = path.join(boardRoot, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  const id = normalizeId(ref);
  for (const state of ["ready-to-merge", "inprogress", "verifier", "todo"]) {
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

function scalar(file: string, section: string, field: string): string {
  const content = read(file);
  const lines = content.split(/\r?\n/);
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

function normalizeId(value: string): string {
  const match = value.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
