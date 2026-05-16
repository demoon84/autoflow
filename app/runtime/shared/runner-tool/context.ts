import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import * as utils from "../board-utils";

export { crypto, fs, path, spawnSync, utils };

export const SCRIPT_DIR = path.dirname(process.argv[1] || __filename);
export const RUNTIME_ROOT = path.resolve(SCRIPT_DIR, "..");
export const DEFAULT_PROJECT_ROOT = utils.resolveProjectRoot();
export const DEFAULT_BOARD_ROOT = utils.resolveBoardRoot();
export const BOARD_ROOT = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || DEFAULT_BOARD_ROOT);
export const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || DEFAULT_PROJECT_ROOT);
export const TICKETS_ROOT = path.join(BOARD_ROOT, "tickets");

export type JsonValue = unknown;
export type JsonObject = Record<string, unknown>;

export interface QueueItem {
  kind: string;
  path: string;
  id: string;
  priority: string;
  priority_rank: number;
  title: string;
  status: string;
  stage: string;
  retry: boolean;
  express: boolean;
  recovery_status?: string;
  failure_class?: string;
}

export interface WorkerTicketItem extends QueueItem {
  allowed_paths: string[];
  claimed_by: string;
  execution_ai: string;
  worktree_path: string;
  worktree_status: string;
  conflicts?: ConflictInfo[];
}

export interface ConflictInfo {
  path: string;
  ticket: string;
  runner: string;
}

export interface GitRunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface WakeEmitResult extends GitRunResult {
  ok: boolean;
}

export const args = process.argv.slice(2);

export function readOptionalTextFile(file: string): string {
  if (!file) return "";
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

export function stripTicks(value: string): string {
  return String(value || "").replace(/^`+|`+$/g, "").trim();
}

export function oneLine(value: string, maxLen: number): string {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
}

export function unique(values: string[]): string[] {
  const normalize = (raw: string): string => String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
  return [...new Set(values.filter(Boolean).map(normalize))].sort();
}

export function git(gitArgs: string[], cwd: string): GitRunResult {
  const result = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export function spawnTsScript(scriptPath: string, scriptArgs: string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  const localTsx = path.join(PROJECT_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const command = fs.existsSync(localTsx) ? localTsx : (process.platform === "win32" ? "npx.cmd" : "npx");
  const args = fs.existsSync(localTsx) ? [scriptPath, ...scriptArgs] : ["tsx", scriptPath, ...scriptArgs];
  return spawnSync(command, args, { encoding: "utf8", env });
}

export function emitRunnerWake(runnerId: string, reason: string, kind: string): WakeEmitResult {
  const result = spawnTsScript(
    path.join(RUNTIME_ROOT, "system", "runner-wake.ts"),
    ["emit", "--runner", runnerId, "--reason", reason, "--kind", kind],
    {
      ...process.env,
      PROJECT_ROOT,
      AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
      BOARD_ROOT,
      AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
    }
  );
  const status = typeof result.status === "number" ? result.status : 1;
  return {
    ok: status === 0,
    status,
    stdout: spawnOutputText(result.stdout),
    stderr: spawnOutputText(result.stderr),
  };
}

export function spawnOutputText(value: string | Buffer | null | undefined): string {
  if (typeof value === "string") return value;
  return value ? value.toString("utf8") : "";
}

export function getArg(name: string): string {
  const idx = args.indexOf(name);
  if (idx < 0) return "";
  const value = args[idx + 1];
  return value && !value.startsWith("--") ? value : "";
}

export function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== name) continue;
    const value = args[i + 1];
    if (value && !value.startsWith("--")) values.push(value);
  }
  return values;
}

export function hasFlag(name: string): boolean {
  return args.includes(name);
}

export function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function numberValue(value: JsonValue | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeSegment(raw: string): string {
  return String(raw || "").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

export function currentRunnerId(fallback = "planner"): string {
  return getArg("--runner") || process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || fallback;
}

export function idFromPath(file: string): string {
  const base = path.basename(file);
  const m = base.match(/(\d+)/);
  return m ? String(Number.parseInt(m[1], 10)).padStart(3, "0") : "";
}

export function normalizeId(raw: string): string {
  const m = String(raw || "").match(/(\d+)/);
  return m ? String(Number.parseInt(m[1], 10)).padStart(3, "0") : "";
}

export function collectFiles(root: string, pattern: RegExp, depth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, level: number): void => {
    if (level > depth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, level + 1);
      else if (pattern.test(entry.name)) out.push(full);
    }
  };
  walk(root, 1);
  return out.sort();
}

export function resolveBoardPath(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^`+|`+$/g, "").replace(/^[.][/]/, "");
  const candidates = path.isAbsolute(cleaned)
    ? [cleaned]
    : [
        path.join(BOARD_ROOT, cleaned),
        path.join(BOARD_ROOT, cleaned.replace(/^\.autoflow\//, "")),
      ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (resolved === path.resolve(BOARD_ROOT) || resolved.startsWith(path.resolve(BOARD_ROOT) + path.sep)) return resolved;
  }
  return "";
}

export function boardRel(file: string): string {
  return utils.boardRelativePath(file, BOARD_ROOT);
}

export function stringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

export function safeIsFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

export function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

export function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ok(fields: JsonObject): void {
  process.stdout.write(JSON.stringify({ status: "ok", ...fields }, null, 2) + "\n");
}

export function fail(exitCode: number, message: string, extra: JsonObject = {}): never {
  process.stdout.write(JSON.stringify({ status: "error", error: message, ...extra }, null, 2) + "\n");
  process.exit(exitCode);
}
