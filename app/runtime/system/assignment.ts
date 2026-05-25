#!/usr/bin/env tsx

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as utils from "../shared/board-utils";

type AssignmentStatus = "leased" | "running" | "completed" | "failed" | "blocked" | "released" | "expired";

type AssignmentRecord = {
  runner_id: string;
  role: string;
  assignment_id: string;
  lease_version: number;
  assigned_item_ref: string;
  status: AssignmentStatus;
  contract_id: string;
  contract_digest: string;
  contract_summary: string;
  contract_refs: string[];
  created_at: string;
  updated_at: string;
  started_at: string;
  completed_at: string;
  expires_at: string;
  result: string;
  reason: string;
};

const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();
const args = process.argv.slice(2);
const allowedRoles = new Set(["planner", "worker", "verifier", "wiki"]);
const allowedCompleteStatuses = new Set(["completed", "failed", "blocked", "released"]);

function usage(): never {
  process.stderr.write(`Usage:
  assignment create --runner <runner-id> --role <planner|worker|verifier|wiki> --item <board-path> [--contract-id <id>] [--contract-digest <sha256:...>] [--contract-summary <text>] [--contract-ref <path>]... [--ttl-sec <n>]
  assignment current [--runner <runner-id>]
  assignment list
  assignment verify --runner <runner-id> --assignment <id> --lease-version <n> [--role <role>] [--item <board-path>]
  assignment start --runner <runner-id> --assignment <id> --lease-version <n>
  assignment complete --runner <runner-id> --assignment <id> --lease-version <n> [--status <completed|failed|blocked|released>] [--result <text>] [--reason <text>]
  assignment release --runner <runner-id> [--reason <text>]
`);
  process.exit(2);
}

function nowIso(): string {
  return utils.nowIso();
}

function safeSegment(raw: string): string {
  return String(raw || "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "";
}

function getArg(name: string): string {
  const idx = args.indexOf(name);
  if (idx < 0) return "";
  const value = args[idx + 1];
  return value && !value.startsWith("--") ? value : "";
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (value && !value.startsWith("--")) values.push(value);
  }
  return values;
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function currentRunner(): string {
  return safeSegment(
    getArg("--runner") ||
    process.env.AUTOFLOW_RUNNER_ID ||
    process.env.RUNNER_ID ||
    ""
  );
}

function stateRoot(): string {
  return path.join(BOARD_ROOT, "automations", "state", "assignments");
}

function assignmentPath(runnerId: string): string {
  return path.join(stateRoot(), `${safeSegment(runnerId)}.json`);
}

function historyPath(): string {
  return path.join(stateRoot(), "history.jsonl");
}

function boardRel(absPath: string): string {
  return utils.boardRelativePath(absPath, BOARD_ROOT);
}

function readAssignment(runnerId: string): AssignmentRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(assignmentPath(runnerId), "utf8")) as AssignmentRecord;
    return parsed && parsed.runner_id ? parsed : null;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function updateRunnerState(record: AssignmentRecord): void {
  const runnerId = safeSegment(record.runner_id);
  const stateDir = path.join(BOARD_ROOT, "runners", "state");
  fs.mkdirSync(stateDir, { recursive: true });
  const file = path.join(stateDir, `${runnerId}.state`);
  const entries = new Map<string, string>();
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq > 0) entries.set(line.slice(0, eq), line.slice(eq + 1));
    }
  } catch {}
  const assignmentIsOpen = !["completed", "released", "expired"].includes(record.status);
  entries.set("runner_id", runnerId);
  if (!assignmentIsOpen) {
    entries.set("status", "idle");
  }
  entries.set("runner_status", record.status === "running" ? "running" : record.status === "leased" ? "leased" : "idle");
  entries.set("assignment_status", record.status);
  entries.set("assignment_id", record.assignment_id);
  entries.set("assignment_role", assignmentIsOpen ? record.role : "");
  entries.set("assignment_lease_version", String(record.lease_version));
  entries.set("assigned_item_ref", assignmentIsOpen ? record.assigned_item_ref : "");
  entries.set("contract_id", assignmentIsOpen ? record.contract_id : "");
  entries.set("contract_digest", assignmentIsOpen ? record.contract_digest : "");
  if (!assignmentIsOpen) {
    entries.set("active_role", "");
    entries.set("active_item", "");
    entries.set("active_ticket_id", "");
    entries.set("active_ticket_title", "");
    entries.set("active_ticket_path", "");
    entries.set("active_spec_ref", "");
    entries.set("active_stage", "idle");
  }
  entries.set("updated_at", record.updated_at);
  writeJsonLikeKeyValue(file, entries);
}

function writeJsonLikeKeyValue(file: string, entries: Map<string, string>): void {
  const lines = [...entries.entries()].map(([key, value]) => `${key}=${value}`);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${lines.join("\n")}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function appendHistory(record: AssignmentRecord, event: string): void {
  fs.mkdirSync(stateRoot(), { recursive: true });
  fs.appendFileSync(historyPath(), `${JSON.stringify({ event, at: nowIso(), ...record })}\n`, "utf8");
}

function saveAssignment(record: AssignmentRecord, event: string): void {
  writeJsonAtomic(assignmentPath(record.runner_id), record);
  updateRunnerState(record);
  appendHistory(record, event);
}

function normalizeRefs(): string[] {
  const refs = [
    ...getArgs("--contract-ref"),
    ...getArg("--contract-refs").split(","),
  ]
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(refs)].sort();
}

function digestFor(input: { role: string; item: string; contractId: string; summary: string; refs: string[] }): string {
  const raw = [input.contractId, input.role, input.item, input.summary, ...input.refs].join("\n");
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

function defaultSummary(role: string, item: string): string {
  return `${role} assignment for ${item || "unassigned item"}`;
}

function assertCurrent(runnerId: string, assignmentId: string, leaseVersion: number): AssignmentRecord {
  const record = readAssignment(runnerId);
  if (!record) fail(1, "assignment_missing", { runner_id: runnerId });
  if (record.assignment_id !== assignmentId || record.lease_version !== leaseVersion) {
    fail(1, "stale_assignment", {
      runner_id: runnerId,
      expected_assignment_id: record.assignment_id,
      expected_lease_version: String(record.lease_version),
      actual_assignment_id: assignmentId,
      actual_lease_version: String(leaseVersion),
    });
  }
  return record;
}

function ok(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ status: "ok", board_root: BOARD_ROOT, project_root: PROJECT_ROOT, ...fields }, null, 2)}\n`);
}

function fail(exitCode: number, error: string, fields: Record<string, unknown> = {}): never {
  process.stdout.write(`${JSON.stringify({ status: "error", error, board_root: BOARD_ROOT, project_root: PROJECT_ROOT, ...fields }, null, 2)}\n`);
  process.exit(exitCode);
}

function cmdCreate(): void {
  const runnerId = currentRunner();
  const role = getArg("--role");
  const item = getArg("--item") || getArg("--assigned-item") || getArg("--assigned-item-ref");
  if (!runnerId) fail(2, "runner_required");
  if (!allowedRoles.has(role)) fail(2, "invalid_role", { role });
  if (!item) fail(2, "assigned_item_required");

  const previous = readAssignment(runnerId);
  const leaseVersion = previous ? positiveInt(String(previous.lease_version), 0) + 1 : 1;
  const now = nowIso();
  const ttlSec = positiveInt(getArg("--ttl-sec"), 60 * 60 * 6);
  const contractId = getArg("--contract-id") || `${role}-assignment-v1`;
  const refs = normalizeRefs();
  const summary = getArg("--contract-summary") || defaultSummary(role, item);
  const digest = getArg("--contract-digest") || digestFor({ role, item, contractId, summary, refs });
  const record: AssignmentRecord = {
    runner_id: runnerId,
    role,
    assignment_id: getArg("--assignment-id") || `asg-${Date.now()}-${runnerId}-${leaseVersion}`,
    lease_version: leaseVersion,
    assigned_item_ref: item,
    status: "leased",
    contract_id: contractId,
    contract_digest: digest,
    contract_summary: summary,
    contract_refs: refs,
    created_at: now,
    updated_at: now,
    started_at: "",
    completed_at: "",
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString().replace(/\.\d+Z$/, "Z"),
    result: "",
    reason: "",
  };
  saveAssignment(record, "create");
  ok({ assignment: record, assignment_path: boardRel(assignmentPath(runnerId)) });
}

function cmdCurrent(): void {
  const runnerId = currentRunner();
  if (!runnerId) fail(2, "runner_required");
  const record = readAssignment(runnerId);
  if (!record) {
    ok({ assignment: null, runner_id: runnerId, assignment_status: "missing" });
    return;
  }
  ok({ assignment: record, assignment_path: boardRel(assignmentPath(runnerId)) });
}

function cmdList(): void {
  const root = stateRoot();
  const assignments: AssignmentRecord[] = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const record = readAssignment(entry.name.replace(/\.json$/, ""));
      if (record) assignments.push(record);
    }
  } catch {}
  assignments.sort((left, right) => left.runner_id.localeCompare(right.runner_id));
  ok({ assignments, assignment_count: assignments.length, assignments_root: boardRel(root) });
}

function cmdVerify(): void {
  const runnerId = currentRunner();
  const assignmentId = getArg("--assignment") || getArg("--assignment-id");
  const leaseVersion = positiveInt(getArg("--lease-version"), 0);
  if (!runnerId || !assignmentId || leaseVersion <= 0) usage();
  const record = assertCurrent(runnerId, assignmentId, leaseVersion);
  const role = getArg("--role");
  const item = getArg("--item");
  if (role && record.role !== role) fail(1, "assignment_role_mismatch", { expected_role: record.role, actual_role: role });
  if (item && record.assigned_item_ref !== item) fail(1, "assignment_item_mismatch", { expected_item: record.assigned_item_ref, actual_item: item });
  ok({ assignment: record, verified: true });
}

function cmdStart(): void {
  const runnerId = currentRunner();
  const assignmentId = getArg("--assignment") || getArg("--assignment-id");
  const leaseVersion = positiveInt(getArg("--lease-version"), 0);
  if (!runnerId || !assignmentId || leaseVersion <= 0) usage();
  const record = assertCurrent(runnerId, assignmentId, leaseVersion);
  const now = nowIso();
  record.status = "running";
  record.started_at = record.started_at || now;
  record.updated_at = now;
  saveAssignment(record, "start");
  ok({ assignment: record, assignment_path: boardRel(assignmentPath(runnerId)) });
}

function cmdComplete(): void {
  const runnerId = currentRunner();
  const assignmentId = getArg("--assignment") || getArg("--assignment-id");
  const leaseVersion = positiveInt(getArg("--lease-version"), 0);
  if (!runnerId || !assignmentId || leaseVersion <= 0) usage();
  const record = assertCurrent(runnerId, assignmentId, leaseVersion);
  const requestedStatus = getArg("--status") || "completed";
  if (!allowedCompleteStatuses.has(requestedStatus)) fail(2, "invalid_completion_status", { requested_status: requestedStatus });
  const now = nowIso();
  record.status = requestedStatus as AssignmentStatus;
  record.completed_at = now;
  record.updated_at = now;
  record.result = getArg("--result") || record.result;
  record.reason = getArg("--reason") || record.reason;
  saveAssignment(record, "complete");
  ok({ assignment: record, assignment_path: boardRel(assignmentPath(runnerId)) });
}

function cmdRelease(): void {
  const runnerId = currentRunner();
  if (!runnerId) fail(2, "runner_required");
  const record = readAssignment(runnerId);
  if (!record) {
    ok({ assignment: null, runner_id: runnerId, assignment_status: "missing" });
    return;
  }
  const now = nowIso();
  record.status = "released";
  record.completed_at = record.completed_at || now;
  record.updated_at = now;
  record.reason = getArg("--reason") || record.reason || "released";
  saveAssignment(record, "release");
  ok({ assignment: record, assignment_path: boardRel(assignmentPath(runnerId)) });
}

const command = args.shift() || "";
switch (command) {
  case "create":
    cmdCreate();
    break;
  case "current":
  case "get":
    cmdCurrent();
    break;
  case "list":
    cmdList();
    break;
  case "verify":
    cmdVerify();
    break;
  case "start":
    cmdStart();
    break;
  case "complete":
    cmdComplete();
    break;
  case "release":
    cmdRelease();
    break;
  case "-h":
  case "--help":
  case "help":
  default:
    usage();
}
