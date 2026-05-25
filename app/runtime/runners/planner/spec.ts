#!/usr/bin/env npx tsx
/*
 * start-spec.ts — reserve/resume a PRD authoring runner.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const shareRoot = path.resolve(
  (process.env.AUTOFLOW_SHARE_ROOT && process.env.AUTOFLOW_SHARE_ROOT.trim()) ||
  path.join(os.homedir(), ".autoflow", "share")
);
const workerId = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || "spec";
const requestedId = process.argv[2] || "";
const specDir = path.join(boardRoot, "tickets", "prd");
const specTemplate = path.join(shareRoot, "reference", "project-spec-template.md");

if (!fs.existsSync(specTemplate)) {
  process.stderr.write(`Spec template not found: ${specTemplate}\n`);
  process.exit(1);
}

const active = activeSpecFile();
if (active) {
  const activeId = idFromPath(active);
  const requested = requestedId ? normalizeId(requestedId) : "";
  if (requested && requested !== activeId) {
    printPairs({
      status: "blocked",
      reason: "conversation_already_has_active_spec",
      active_spec_id: activeId,
      active_spec_file: active,
      requested_spec_id: requested,
      board_root: boardRoot,
      project_root: projectRoot,
      next_action: "Resume, save, cancel, or hand off the active PRD before reserving another runner.",
    });
    process.exit(0);
  }
  setContext(activeId, active);
  printSpec("resume", activeId, active);
  process.exit(0);
}

const specId = requestedId ? normalizeId(requestedId) : nextSpecId();
const specFile = path.join(specDir, `PRD-${specId}.md`);
setContext(specId, specFile);
printSpec("ready_for_input", specId, specFile);

function printSpec(status: string, specId: string, specFile: string): void {
  printPairs({
    status,
    spec_id: specId,
    spec_file: specFile,
    spec_template: specTemplate,
    spec_created: "false",
    spec_is_placeholder: isPlaceholder(specFile) ? "true" : "false",
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: `Gather intent, scope, acceptance criteria, and verification in chat. Only after explicit save approval, write ${specFile}.`,
    confirmation_required: "true",
    confirmation_phrases: "저장,OK 저장,확정,save,go,yes save,좋아 저장해",
  });
}

function activeSpecFile(): string {
  const context = readContext();
  if (context.role !== "spec" || !context.active_ticket_id) return "";
  if (context.active_ticket_path) return path.join(boardRoot, context.active_ticket_path);
  return path.join(specDir, `PRD-${normalizeExistingId(context.active_ticket_id)}.md`);
}

function readContext(): Record<string, string> {
  const file = path.join(boardRoot, "automations", "state", "current.context");
  const out: Record<string, string> = {};
  for (const line of read(file).split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

function setContext(specId: string, specFile: string): void {
  const file = path.join(boardRoot, "automations", "state", "current.context");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `role=spec\nworker_id=${workerId}\nactive_ticket_id=${specId}\nactive_stage=authoring\nactive_ticket_path=${path.relative(boardRoot, specFile)}\nupdated_at=${nowIso()}\n`, "utf8");
}

function nextSpecId(): string {
  let max = 0;
  for (const file of listFiles(path.join(boardRoot, "tickets"), /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/)) {
    if (isPlaceholder(file)) continue;
    const parsed = parseExistingId(idFromPath(file));
    max = Math.max(max, parsed.numeric);
  }
  return String(max + 1).padStart(3, "0");
}

function listFiles(root: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    try {
      for (const name of fs.readdirSync(dir)) {
        const file = path.join(dir, name);
        const stat = fs.statSync(file);
        if (stat.isDirectory()) walk(file);
        else if (pattern.test(name)) out.push(file);
      }
    } catch {}
  };
  walk(root);
  return out.sort();
}

function isPlaceholder(file: string): boolean {
  return read(file).includes("Replace with your project name");
}

function idFromPath(file: string): string {
  return normalizeExistingId(path.basename(file).replace(/\.md$/i, "").replace(/^PRD-/i, ""));
}

function normalizeId(value: string): string {
  const existing = parseExistingId(value.replace(/^PRD-/i, ""));
  if (existing.numeric <= 0) return "";
  return String(existing.numeric).padStart(3, "0");
}

function normalizeExistingId(value: string): string {
  const parsed = parseExistingId(value);
  return parsed.id;
}

function parseExistingId(value: string): {namespace: string; numeric: number; id: string} {
  const raw = String(value || "").trim().replace(/\.md$/i, "").replace(/^PRD-/i, "");
  const scoped = raw.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
  if (scoped) {
    const namespace = slug(scoped[1]);
    const numeric = Number.parseInt(scoped[2], 10) || 0;
    return {namespace, numeric, id: numeric ? String(numeric).padStart(3, "0") : ""};
  }
  const numericMatch = raw.match(/(\d+)/);
  const numeric = numericMatch ? Number.parseInt(numericMatch[1], 10) || 0 : 0;
  return {namespace: "", numeric, id: numeric ? String(numeric).padStart(3, "0") : ""};
}

function slug(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "local";
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) process.stdout.write(`${key}=${value}\n`);
}
