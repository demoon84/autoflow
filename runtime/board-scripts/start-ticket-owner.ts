#!/usr/bin/env npx tsx
/*
 * start-ticket-owner.ts
 *
 * Cross-platform Impl AI worker entrypoint. This replaces the old shell
 * dispatcher by composing the audited worker runner-tool operations:
 * active-get -> todo-snapshot/claim -> worktree-ensure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

type ToolJson = Record<string, unknown>;

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const runnerId = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || "worker";
const requestedTicket = process.argv.slice(2).find((arg) => arg && !arg.startsWith("-")) || "";

main();

function main(): void {
  try {
    const active = tool("worker", "active-get", "--runner", runnerId);
    const owned = asArray(active.owned);
    if (owned.length > 0) {
      emitTicket("resume", owned[0], "active");
      return;
    }

    if (requestedTicket) {
      const requested = findTicket(requestedTicket);
      if (!requested) {
        emitIdle("requested_ticket_not_found", requestedTicket);
        process.exit(1);
      }
      if (requested.state === "todo") {
        const claim = tool("worker", "claim", "--ticket", requestedTicket, "--runner", runnerId);
        emitTicket("ok", claim, "requested");
        return;
      }
      emitTicket("resume", ticketItemFromPath(requested.path), requested.state);
      return;
    }

    const snapshot = tool("worker", "todo-snapshot", "--runner", runnerId);
    const todos = asArray(snapshot.todos);
    const claimable = todos.find((item) => Boolean(asObject(item).claimable));
    if (!claimable) {
      const blocked = todos.find((item) => String(asObject(item).blocked_reason || "") !== "");
      if (blocked) {
        const blockedObj = asObject(blocked);
        emitIdle(String(blockedObj.blocked_reason || "ticket_blocked"), String(blockedObj.path || ""));
        return;
      }
      emitIdle("no_actionable_ticket", "");
      return;
    }

    const ticketPath = String(asObject(claimable).path || "");
    const claim = tool("worker", "claim", "--ticket", ticketPath, "--runner", runnerId);
    emitTicket("ok", claim, "todo");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printPairs({
      status: "error",
      runner: runnerId,
      reason: oneLine(message),
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }
}

function emitTicket(status: "ok" | "resume", rawItem: unknown, source: string): void {
  const item = asObject(rawItem);
  const ticketRel = String(item.path || "");
  const ticketAbs = resolveBoardPath(ticketRel);
  const ticketId = idFromTicketPath(ticketRel || ticketAbs);
  const ensure = tool("worker", "worktree-ensure", "--ticket", ticketRel || `Todo-${ticketId}`);
  const stage = String(item.stage || ticketScalar(ticketAbs, "Stage") || "executing");
  const worktreePath = String(ensure.worktree_path || item.worktree_path || "");
  const workingRoot = String(ensure.working_root || worktreePath || projectRoot);
  const nextAction = nextActionFor(ticketId, stage);

  printPairs({
    status,
    source,
    runner: runnerId,
    ticket: ticketRel,
    ticket_id: ticketId,
    stage,
    worktree_status: String(ensure.worktree_status || item.worktree_status || ""),
    worktree_path: worktreePath,
    working_root: workingRoot,
    implementation_root: workingRoot,
    board_root: boardRoot,
    project_root: projectRoot,
    done_target: doneTarget(ticketAbs),
    next_action: nextAction,
    routing_pass: `After verification evidence passes, run scripts/finish-ticket-owner.ts ${ticketId} pass "<short summary>".`,
    routing_fail: `If the owner cannot fix the failure in scope, run scripts/finish-ticket-owner.ts ${ticketId} fail "<concrete reason>".`,
  });
}

function emitIdle(reason: string, detail: string): void {
  printPairs({
    status: "idle",
    runner_status: "idle",
    runtime_status: "idle",
    runner: runnerId,
    reason,
    detail,
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: "No claimable ticket found for this worker tick.",
  });
}

function tool(...args: string[]): ToolJson {
  const runnerTool = path.join(scriptDir, "runner-tool.ts");
  const runner = tsxCommand();
  const env = {
    ...process.env,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_ROLE: process.env.AUTOFLOW_ROLE || "ticket-owner",
    AUTOFLOW_WORKER_ID: runnerId,
  };
  const result = spawnSync(runner.command, [...runner.args, runnerTool, ...args], {
    cwd: boardRoot,
    env,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  const stdout = result.stdout || "";
  let parsed: ToolJson = {};
  try {
    parsed = JSON.parse(stdout) as ToolJson;
  } catch {
    throw new Error(`runner-tool returned non-json output for ${args.join(" ")}: ${stdout || result.stderr}`);
  }
  if (result.status !== 0 || parsed.status === "error") {
    throw new Error(String(parsed.error || result.stderr || `runner-tool failed: ${args.join(" ")}`));
  }
  return parsed;
}

function tsxCommand(): { command: string; args: string[] } {
  const local = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  if (fs.existsSync(local)) return { command: local, args: [] };
  return { command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["tsx"] };
}

function findTicket(raw: string): { state: string; path: string } | null {
  const direct = resolveBoardPath(raw);
  if (direct && fs.existsSync(direct)) {
    const state = path.basename(path.dirname(direct));
    return { state, path: direct };
  }
  const id = normalizeId(raw);
  if (!id) return null;
  for (const state of ["inprogress", "todo", "verifier", "ready-to-merge"]) {
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return { state, path: candidate };
    }
  }
  return null;
}

function ticketItemFromPath(file: string): ToolJson {
  return {
    path: boardRel(file),
    id: idFromTicketPath(file),
    stage: ticketScalar(file, "Stage"),
    worktree_path: ticketWorktreeField(file, "Path"),
    worktree_status: ticketWorktreeField(file, "Status"),
  };
}

function resolveBoardPath(raw: string): string {
  if (!raw) return "";
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(boardRoot, raw.replace(/^[.][/]/, ""));
}

function boardRel(file: string): string {
  const rel = path.relative(boardRoot, file);
  return rel.startsWith("..") ? file : rel;
}

function idFromTicketPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function normalizeId(raw: string): string {
  const match = String(raw || "").match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function ticketScalar(file: string, field: string): string {
  const text = read(file);
  const match = text.match(new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`, "m"));
  return match ? stripTicks(match[1].trim()) : "";
}

function ticketWorktreeField(file: string, field: string): string {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  let inWorktree = false;
  const re = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (/^## Worktree\b/.test(line)) {
      inWorktree = true;
      continue;
    }
    if (/^## /.test(line) && inWorktree) break;
    if (!inWorktree) continue;
    const match = line.match(re);
    if (match) return stripTicks(match[1].trim());
  }
  return "";
}

function doneTarget(ticketAbs: string): string {
  const projectKey = ticketScalar(ticketAbs, "PRD Key") || "unknown";
  return path.join(boardRoot, "tickets", "done", projectKey, path.basename(ticketAbs));
}

function nextActionFor(ticketId: string, stage: string): string {
  if (stage === "merging" || stage === "ready_to_merge" || stage === "needs_ai_merge") {
    return `Continue AI-led merge for ticket ${ticketId}: integrate verified worktree changes into PROJECT_ROOT/main, rerun verification, then rerun finish-ticket-owner pass.`;
  }
  return `Use this same ticket owner turn to update the mini-plan and implement within Allowed Paths. Then run scripts/verify-ticket-owner.ts ${ticketId}, followed by scripts/finish-ticket-owner.ts ${ticketId} pass "<summary>" or fail "<reason>". Never git push.`;
}

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function stripTicks(value: string): string {
  return value.replace(/^`+|`+$/g, "").trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): ToolJson {
  return value && typeof value === "object" ? (value as ToolJson) : {};
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) {
    process.stdout.write(`${key}=${String(value ?? "")}\n`);
  }
}
