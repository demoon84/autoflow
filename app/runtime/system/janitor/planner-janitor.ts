#!/usr/bin/env tsx
/*
 * planner-janitor.ts — stuck-state recovery for the autoflow board.
 * See planner-janitor.js for full doc.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {isRunnerProcessAlive} from "../../../shared/runner-state-store";

const ARGV = process.argv.slice(2);
function arg(name: string, fallback?: string): string | undefined {
  const i = ARGV.indexOf(name);
  if (i >= 0 && ARGV[i + 1]) return ARGV[i + 1];
  return fallback;
}
const DRY_RUN = ARGV.includes("--dry-run");
const BOARD_ROOT = path.resolve(arg("--board", process.env.AUTOFLOW_BOARD_ROOT || ".autoflow") || ".autoflow");
const PROJECT_ROOT = path.resolve(process.env.AUTOFLOW_PROJECT_ROOT || process.env.PROJECT_ROOT || path.dirname(BOARD_ROOT));
const WORKTREE_PROJECT_KEY = path.basename(PROJECT_ROOT) || "project";
const ZOMBIE_MIN = parseInt(process.env.AUTOFLOW_JANITOR_ZOMBIE_MIN || "30", 10);
const NOW = new Date();
const NOW_ISO = NOW.toISOString().replace(/\.\d+Z$/, "Z");

if (ARGV.includes("--help") || ARGV.includes("-h")) {
  process.stdout.write([
    "Usage: autoflow tool planner-janitor [--board <path>] [--dry-run]",
    "",
    "Cleans stale worker locks, stuck inprogress tickets, and stale ticket worktrees.",
    "Dirty worktrees are always preserved.",
  ].join("\n") + "\n");
  process.exit(0);
}

function log(msg: string): void {
  process.stdout.write(`[janitor] ${msg}\n`);
}
function warn(msg: string, err?: any): void {
  const detail = err && err.message ? ` — ${err.message}` : "";
  process.stderr.write(`[janitor] WARN ${msg}${detail}\n`);
}

function safeReadFile(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function safeWriteFile(p: string, content: string): boolean {
  if (DRY_RUN) { log(`DRY-RUN write ${p}`); return true; }
  try { fs.writeFileSync(p, content, "utf8"); return true; }
  catch (err: any) { warn(`write failed ${p}`, err); return false; }
}
function safeRename(src: string, dst: string): boolean {
  if (DRY_RUN) { log(`DRY-RUN mv ${src} → ${dst}`); return true; }
  try { fs.renameSync(src, dst); return true; }
  catch (err: any) { warn(`mv failed ${src} → ${dst}`, err); return false; }
}
function safeReadDir(p: string): string[] {
  try { return fs.readdirSync(p); } catch { return []; }
}
function pidAlive(pid: number): boolean {
  return isRunnerProcessAlive(pid);
}
function gitOutput(args: string[], cwd?: string): string {
  const result = gitRun(args, cwd);
  return result.status === 0 ? result.stdout : "";
}
function gitRun(args: string[], cwd?: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd: cwd || BOARD_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) {
    return { status: 1, stdout: "", stderr: result.error.message };
  }
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function ticketWorktreePath(ticketNum: string): string {
  return path.join(
    process.env.HOME || "/tmp",
    "Library/Caches/autoflow/worktrees",
    WORKTREE_PROJECT_KEY,
    `tickets_${ticketNum}`
  );
}

function worktreeDirty(wtPath: string): boolean {
  const result = gitRun(["status", "--porcelain", "--untracked-files=all"], wtPath);
  if (result.status !== 0) {
    warn(`worktree status failed; preserving ${wtPath}`, new Error(result.stderr || "git status failed"));
    return true;
  }
  return result.stdout.trim().length > 0;
}

function removeTicketWorktree(wtPath: string, branch: string, label: string): boolean {
  if (worktreeDirty(wtPath)) {
    log(`${label} skipped (has changes): ${wtPath}`);
    return false;
  }
  if (DRY_RUN) {
    log(`DRY-RUN prune ${wtPath}`);
    return true;
  }
  const removeResult = gitRun(["worktree", "remove", "--force", wtPath], PROJECT_ROOT);
  if (removeResult.status !== 0) {
    warn(`${label} remove failed: ${wtPath}`, new Error(removeResult.stderr || "git worktree remove failed"));
    return false;
  }
  const branchResult = gitRun(["branch", "-D", branch], PROJECT_ROOT);
  if (branchResult.status !== 0) {
    warn(`${label} branch delete failed: ${branch}`, new Error(branchResult.stderr || "git branch delete failed"));
    return false;
  }
  log(`${label} pruned: ${wtPath}`);
  return true;
}
function appendNote(ticketPath: string, line: string): boolean {
  const content = safeReadFile(ticketPath);
  if (!content) return false;
  const m = content.match(/(\n## Notes[ \t]*\n)([\s\S]*?)(?=\n## |\Z)/);
  const audit = `- ${line} (${NOW_ISO})`;
  let next: string;
  if (m && typeof m.index === "number") {
    const before = content.slice(0, m.index + m[1].length);
    const body = m[2] || "";
    const after = content.slice(m.index + m[0].length);
    next = `${before}${body}${body.endsWith("\n") ? "" : "\n"}${audit}\n${after}`;
  } else {
    next = `${content}${content.endsWith("\n") ? "" : "\n"}\n## Notes\n\n${audit}\n`;
  }
  return safeWriteFile(ticketPath, next);
}

interface WorkerLock { runnerId: string; pid: number; uuid?: string; spawnedAt: string; }

function parseWorkerLock(line: string): WorkerLock | null {
  const modern = line.match(/^([\w-]+):(\d+):([0-9TZ:.\-]+)$/);
  if (modern) {
    return { runnerId: modern[1], pid: parseInt(modern[2], 10), spawnedAt: modern[3] };
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(line)) {
    return { runnerId: "legacy", pid: 0, uuid: line, spawnedAt: "" };
  }
  return null;
}

function clearStaleWorkerLocks(): number {
  const ticketDirs = ["todo", "inprogress"].map((d) => path.join(BOARD_ROOT, "tickets", d));
  let cleared = 0;
  for (const dir of ticketDirs) {
    for (const name of safeReadDir(dir)) {
      if (!name.startsWith("Todo-") && !name.startsWith("prd_")) continue;
      if (!name.endsWith(".md")) continue;
      const ticketPath = path.join(dir, name);
      const content = safeReadFile(ticketPath);
      if (!content) continue;
      const lockMatch = content.match(/^- Result:\s*pending worker by\s*(.+)$/m);
      if (!lockMatch) continue;
      const claim = parseWorkerLock(lockMatch[1].trim());
      let stale = false;
      if (!claim) stale = true;
      else if (claim.pid > 0 && !pidAlive(claim.pid)) stale = true;
      else if (claim.runnerId === "legacy") stale = true;
      if (!stale) continue;
      const cleared_line = lockMatch[0].replace(/pending worker by\s*.+$/, "");
      const next = content.replace(lockMatch[0], cleared_line);
      if (safeWriteFile(ticketPath, next)) {
        appendNote(ticketPath, `planner cleared stale lock (${lockMatch[1].trim().slice(0, 60)})`);
        log(`stale lock cleared: ${name}`);
        cleared += 1;
      }
    }
  }
  return cleared;
}

function worktreeChangeCount(ticketId: string): number {
  const ticketNum = ticketId.replace(/^Todo-/i, "");
  const wtPath = ticketWorktreePath(ticketNum);
  if (!fs.existsSync(wtPath)) return 0;
  const stat = gitOutput(["diff", "--shortstat"], wtPath);
  const m = stat.match(/(\d+)\s+files?\s+changed/);
  return m ? parseInt(m[1], 10) : 0;
}

function fixAtomicViolations(): number {
  const inprogressDir = path.join(BOARD_ROOT, "tickets", "inprogress");
  const todoDir = path.join(BOARD_ROOT, "tickets", "todo");
  const tickets = safeReadDir(inprogressDir).filter((n) => /^Todo-\d+\.md$/i.test(n));
  if (tickets.length <= 1) return 0;
  const ranked = tickets
    .map((name) => ({ name, changes: worktreeChangeCount(name.replace(/\.md$/, "")) }))
    .sort((a, b) => b.changes - a.changes);
  const winner = ranked[0];
  const losers = ranked.slice(1);
  log(`atomic violation: ${tickets.length} inprogress. keeping ${winner.name} (${winner.changes} files), reverting ${losers.length}`);
  let moved = 0;
  for (const l of losers) {
    const src = path.join(inprogressDir, l.name);
    const dst = path.join(todoDir, l.name);
    if (safeRename(src, dst)) {
      appendNote(dst, `planner reverted to todo: atomic violation, ${l.changes} worktree files`);
      moved += 1;
    }
  }
  return moved;
}

function fixZombieAndStageMismatch(): number {
  const inprogressDir = path.join(BOARD_ROOT, "tickets", "inprogress");
  const todoDir = path.join(BOARD_ROOT, "tickets", "todo");
  let moved = 0;
  for (const name of safeReadDir(inprogressDir)) {
    if (!/^Todo-\d+\.md$/i.test(name)) continue;
    const ticketPath = path.join(inprogressDir, name);
    const content = safeReadFile(ticketPath);
    if (!content) continue;
    const stageMatch = content.match(/^- Stage:\s*(.+)$/m);
    const stage = stageMatch ? stageMatch[1].trim().toLowerCase() : "";
    const startedMatch = content.match(/^- Started At:\s*([0-9TZ:.\-]+)$/m);
    const started = startedMatch ? startedMatch[1].trim() : "";
    const ticketId = name.replace(/\.md$/, "");
    const changes = worktreeChangeCount(ticketId);

    const stageMismatch = stage === "todo" && changes === 0;
    let zombie = false;
    if (changes === 0 && started) {
      const startedDate = new Date(started);
      if (!Number.isNaN(startedDate.valueOf())) {
        const ageMin = (NOW.valueOf() - startedDate.valueOf()) / 60000;
        if (ageMin >= ZOMBIE_MIN) zombie = true;
      }
    }
    if (!stageMismatch && !zombie) continue;

    const reason = stageMismatch
      ? "stage/folder mismatch (Stage=todo + clean worktree)"
      : `zombie claim (${ZOMBIE_MIN}m+ idle, clean worktree)`;
    const dst = path.join(todoDir, name);
    if (safeRename(ticketPath, dst)) {
      appendNote(dst, `planner reverted to todo: ${reason}`);
      log(`reverted: ${name} (${reason})`);
      moved += 1;

      const ticketNum = ticketId.replace(/^Todo-/i, "");
      const wtPath = ticketWorktreePath(ticketNum);
      if (fs.existsSync(wtPath) && !DRY_RUN) {
        removeTicketWorktree(wtPath, `autoflow/tickets_${ticketNum}`, "resolved worktree");
      }
    }
  }
  return moved;
}

function collectTicketStates(): Map<string, "active" | "done"> {
  const states = new Map<string, "active" | "done">();
  for (const dir of ["todo", "inprogress"]) {
    const root = path.join(BOARD_ROOT, "tickets", dir);
    for (const f of safeReadDir(root)) {
      const m = f.match(/^Todo-(\d+)\.md$/i);
      if (m) states.set(m[1], "active");
    }
  }
  const doneRoot = path.join(BOARD_ROOT, "tickets", "done");
  for (const sub of safeReadDir(doneRoot)) {
    const subDir = path.join(doneRoot, sub);
    for (const f of safeReadDir(subDir)) {
      const m = f.match(/^Todo-(\d+)\.md$/i);
      if (m) states.set(m[1], "done");
    }
  }
  return states;
}

function pruneOrphanWorktrees(): number {
  const list = gitOutput(["worktree", "list", "--porcelain"], PROJECT_ROOT);
  if (!list) return 0;
  const blocks = list.split(/\n\n+/).filter(Boolean);
  let pruned = 0;
  const ticketStates = collectTicketStates();
  for (const block of blocks) {
    const wtMatch = block.match(/^worktree (.+)$/m);
    const branchMatch = block.match(/^branch refs\/heads\/(.+)$/m);
    const wtPath = wtMatch ? wtMatch[1] : "";
    const branch = branchMatch ? branchMatch[1] : "";
    if (!wtPath || !branch) continue;
    const m = branch.match(/autoflow\/tickets_(\d+)$/);
    if (!m) continue;
    const ticketNum = m[1];
    const state = ticketStates.get(ticketNum);
    if (state === "active") continue;
    if (state === "done") {
      if (removeTicketWorktree(wtPath, branch, "done-ticket worktree")) {
        pruned += 1;
      }
      continue;
    }
    if (removeTicketWorktree(wtPath, branch, "orphan worktree")) {
      pruned += 1;
    }
  }
  return pruned;
}

(function main(): void {
  log(`board=${BOARD_ROOT} dry-run=${DRY_RUN}`);
  let total = 0;
  try { total += clearStaleWorkerLocks(); } catch (e: any) { warn("stale-lock pass failed", e); }
  try { total += fixAtomicViolations(); } catch (e: any) { warn("atomic pass failed", e); }
  try { total += fixZombieAndStageMismatch(); } catch (e: any) { warn("zombie pass failed", e); }
  try { total += pruneOrphanWorktrees(); } catch (e: any) { warn("orphan-worktree pass failed", e); }
  log(`done: ${total} fixes applied`);
  process.exit(0);
})();
