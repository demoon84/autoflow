#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as utils from "../shared/board-utils";

const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();

function usage(): never {
    process.stderr.write("Usage: clear-thread-context.js [--active-only]\n");
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
    } catch {
    }
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

function defaultWorkerId(): string {
    return process.env.AUTOFLOW_WORKER_ID || process.env.CODEX_AUTOMATION_ID || process.env.CODEX_THREAD_ID || `${process.env.USER || "unknown"}@${os.hostname() || "localhost"}:${process.pid}`;
}

function writeContextSnapshot(role: string, workerId: string, executionPool: string, verifierPool: string): void {
    fs.mkdirSync(threadStateRoot(), {recursive: true});
    const threadKey = currentThreadKey();
    const timestamp = utils.nowIso();
    const body = [
        `role=${role}`,
        `worker_id=${workerId}`,
        `thread_key=${threadKey}`,
        `board_root=${BOARD_ROOT}`,
        `project_root=${PROJECT_ROOT}`,
        `execution_pool=${executionPool}`,
        `verifier_pool=${verifierPool}`,
        "active_ticket_id=",
        "active_ticket_path=",
        "active_stage=",
        `updated_at=${timestamp}`,
        "active_updated_at=",
        "",
    ].join("\n");

    if (threadKey) fs.writeFileSync(threadContextPath(threadKey), body, "utf8");
    fs.writeFileSync(currentContextPath(), body, "utf8");
}

function clearActiveTicketContextRecord(): boolean {
    const contextFile = contextEffectiveFile();
    const role = process.env.AUTOFLOW_ROLE || (contextFile ? readContextValue(contextFile, "role") : "");
    if (!role) return false;

    const workerId = process.env.AUTOFLOW_WORKER_ID || (contextFile ? readContextValue(contextFile, "worker_id") : "") || defaultWorkerId();
    const executionPool = process.env.AUTOFLOW_EXECUTION_POOL || (contextFile ? readContextValue(contextFile, "execution_pool") : "");
    const verifierPool = process.env.AUTOFLOW_VERIFIER_POOL || (contextFile ? readContextValue(contextFile, "verifier_pool") : "");

    writeContextSnapshot(role, workerId, executionPool, verifierPool);
    return true;
}

const args = process.argv.slice(2);
if (args.length > 1) usage();
let activeOnly = false;
if (args.length === 1) {
    if (args[0] !== "--active-only") usage();
    activeOnly = true;
}

const threadKey = currentThreadKey();
const threadFile = threadKey ? threadContextPath(threadKey) : "";
const currentFile = currentContextPath();

if (activeOnly) {
    process.stdout.write(`status=${clearActiveTicketContextRecord() ? "active_cleared" : "no_context"}\n`);
    process.stdout.write(`thread_key=${threadKey}\n`);
    if (threadFile) process.stdout.write(`thread_context=${threadFile}\n`);
    process.stdout.write(`current_context=${currentFile}\n`);
    process.stdout.write(`board_root=${BOARD_ROOT}\n`);
    process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
    process.exit(0);
}

if (threadFile && fs.existsSync(threadFile)) fs.rmSync(threadFile);
if (fs.existsSync(currentFile)) {
    const currentThreadKeyValue = readContextValue(currentFile, "thread_key");
    if (!threadKey || !currentThreadKeyValue || threadKey === currentThreadKeyValue) fs.rmSync(currentFile);
}

process.stdout.write("status=cleared\n");
process.stdout.write(`thread_key=${threadKey}\n`);
if (threadFile) process.stdout.write(`thread_context=${threadFile}\n`);
process.stdout.write(`current_context=${currentFile}\n`);
process.stdout.write(`board_root=${BOARD_ROOT}\n`);
process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
