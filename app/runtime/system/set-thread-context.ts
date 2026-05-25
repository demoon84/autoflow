#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as utils from "../shared/board-utils";

const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();

function usage(): never {
  process.stderr.write("Usage: set-thread-context.js <worker|plan|verifier|wiki> [worker-id] [active-ticket-id] [active-stage] [active-ticket-path]\n");
  process.exit(1);
}

function pointerToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
}

function currentThreadKey(): string {
  return pointerToken(process.env.AUTOFLOW_THREAD_KEY || process.env.CODEX_THREAD_ID || "");
}

function stateRoot(): string {
  return path.join(BOARD_ROOT, "automations", "state");
}

function threadStateRoot(): string {
  return path.join(stateRoot(), "threads");
}

function threadContextPath(key: string): string {
  return path.join(threadStateRoot(), `${key}.context`);
}

function currentContextPath(): string {
  return path.join(stateRoot(), "current.context");
}

function readContextValue(file: string, key: string): string {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq > 0 && line.slice(0, eq) === key) return line.slice(eq + 1);
    }
  } catch {}
  return "";
}

function contextEffectiveFile(): string {
  const key = currentThreadKey();
  if (key) {
    const file = threadContextPath(key);
    if (fs.existsSync(file)) return file;
  }
  const current = currentContextPath();
  return fs.existsSync(current) ? current : "";
}

function contextEffectiveValue(key: string): string {
  const file = contextEffectiveFile();
  return file ? readContextValue(file, key) : "";
}

function defaultWorkerId(): string {
  return process.env.AUTOFLOW_WORKER_ID || process.env.CODEX_AUTOMATION_ID || process.env.CODEX_THREAD_ID || `${process.env.USER || "unknown"}@${os.hostname() || "localhost"}:${process.pid}`;
}

function writeContextSnapshot(role: string, workerId: string, executionPool: string, verifierPool: string, activeTicketId: string, activeTicketPath: string, activeStage: string): void {
  fs.mkdirSync(threadStateRoot(), { recursive: true });
  const threadKey = currentThreadKey();
  const timestamp = utils.nowIso();
  const activeUpdatedAt = activeTicketId || activeTicketPath || activeStage ? timestamp : "";
  const body = [
    `role=${role}`,
    `worker_id=${workerId}`,
    `thread_key=${threadKey}`,
    `board_root=${BOARD_ROOT}`,
    `project_root=${PROJECT_ROOT}`,
    `execution_pool=${executionPool}`,
    `verifier_pool=${verifierPool}`,
    `active_ticket_id=${activeTicketId}`,
    `active_ticket_path=${activeTicketPath}`,
    `active_stage=${activeStage}`,
    `updated_at=${timestamp}`,
    `active_updated_at=${activeUpdatedAt}`,
    "",
  ].join("\n");

  if (threadKey) fs.writeFileSync(threadContextPath(threadKey), body, "utf8");
  fs.writeFileSync(currentContextPath(), body, "utf8");
}

function normalizeRole(raw: string): string {
  if (raw === "ticket") return "worker";
  return raw;
}

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 5) usage();

const role = normalizeRole(args[0]);
if (!["worker", "plan", "verifier", "wiki"].includes(role)) usage();

const workerId = args[1] || defaultWorkerId();
const activeTicketId = args[2] || "";
const activeStage = args[3] || "";
const activeTicketPath = args[4] || "";
const executionPool = process.env.AUTOFLOW_EXECUTION_POOL || contextEffectiveValue("execution_pool");
const verifierPool = process.env.AUTOFLOW_VERIFIER_POOL || contextEffectiveValue("verifier_pool");

writeContextSnapshot(role, workerId, executionPool, verifierPool, activeTicketId, activeTicketPath, activeStage);

const threadKey = currentThreadKey();
const threadFile = threadKey ? threadContextPath(threadKey) : "";
const currentFile = currentContextPath();

process.stdout.write("status=ok\n");
process.stdout.write(`role=${role}\n`);
process.stdout.write(`worker_id=${workerId}\n`);
process.stdout.write(`thread_key=${threadKey}\n`);
if (threadFile) process.stdout.write(`thread_context=${threadFile}\n`);
process.stdout.write(`current_context=${currentFile}\n`);
process.stdout.write(`active_ticket_id=${activeTicketId}\n`);
process.stdout.write(`active_stage=${activeStage}\n`);
process.stdout.write(`active_ticket_path=${activeTicketPath}\n`);
process.stdout.write(`board_root=${BOARD_ROOT}\n`);
process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
