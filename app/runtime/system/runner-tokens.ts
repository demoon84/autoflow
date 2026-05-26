#!/usr/bin/env tsx
/*
 * runner-tokens.ts — LLM-reported token usage tracker.
 * See runner-tokens.js for full doc; CLI/output unchanged.
 */

import * as fs from "node:fs";
import * as path from "node:path";


// Cross-mode (ESM + CJS via tsx) script-dir resolver: process.argv[1]
// is the path to the .ts file currently executing in either runtime.
const SCRIPT_DIR_HERE = require("node:path").dirname(process.argv[1] || "");
const ARGV = process.argv.slice(2);
const SUBCMD = ARGV[0];

function arg(name: string, fallback?: string): string | undefined {
  const i = ARGV.indexOf(name);
  if (i > 0 && ARGV[i + 1]) return ARGV[i + 1];
  return fallback;
}

function help(): void {
  process.stdout.write(`Usage: tsx runner-tokens.ts <report|show|import-session-token-usage|reset> [args]
  report  --runner <id> [--tick-id <id>] --input <N> --output <N>
          [--cache-read <N>] [--cache-create <N>] [--note <text>]
  show    --runner <id>
  import-session-token-usage --runner <id>
  reset   --runner <id> [--note <text>]
`);
}

const RUNNING_AS_CLI = !!process.argv[1] && /runner-tokens\.(ts|js|cjs|mjs)$/.test(process.argv[1]);
if (RUNNING_AS_CLI && (!SUBCMD || SUBCMD === "--help" || SUBCMD === "-h")) {
  help();
  process.exit(0);
}

let BOARD_ROOT = path.resolve(
  process.env.AUTOFLOW_BOARD_ROOT ||
  process.env.BOARD_ROOT ||
  path.join(SCRIPT_DIR_HERE, "..")
);
let STATE_DIR = path.join(BOARD_ROOT, "runners", "state");
const NOW = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

export function setBoardRoot(boardRoot: string): void {
  BOARD_ROOT = path.resolve(boardRoot);
  STATE_DIR = path.join(BOARD_ROOT, "runners", "state");
}

function warn(msg: string): void {
  process.stderr.write(`[runner-tokens] ${msg}\n`);
}

function ensureDirs(): void {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
}

function statePath(runner: string): string {
  return path.join(STATE_DIR, `${runner}.state`);
}
function stateLockPath(runner: string): string {
  return `${statePath(runner)}.lock`;
}
function sessionCursorPath(runner: string): string {
  return path.join(STATE_DIR, `${runner}.session-cursor.json`);
}
function tokenHistoryPath(runner: string): string {
  return path.join(STATE_DIR, `${runner}.tokens-history.jsonl`);
}

const TOKEN_HISTORY_PRUNE_SIZE_BYTES = 512 * 1024;
const TOKEN_HISTORY_RETENTION_MS = 25 * 60 * 60 * 1000;

type SessionFileCursor = {
  mtimeMs: number;
  size: number;
  belongsToRunner?: boolean;
};
type SessionCursorMap = Record<string, SessionFileCursor>;
type SessionCursorAll = {
  codex?: SessionCursorMap;
  claude?: SessionCursorMap;
};

function loadSessionCursor(runner: string): SessionCursorAll {
  try {
    const raw = fs.readFileSync(sessionCursorPath(runner), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as SessionCursorAll;
  } catch {}
  return {};
}

function saveSessionCursor(runner: string, cursor: SessionCursorAll): void {
  try {
    const target = sessionCursorPath(runner);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cursor));
    fs.renameSync(tmp, target);
  } catch (err: any) {
    warn(`session cursor write failed: ${err?.message || err}`);
  }
}

function readSliceUtf8(filePath: string, fromOffset: number, toSize: number): string {
  if (toSize <= fromOffset) return "";
  const length = toSize - fromOffset;
  const buf = Buffer.allocUnsafe(length);
  let fd = -1;
  try {
    fd = fs.openSync(filePath, "r");
    let read = 0;
    while (read < length) {
      const n = fs.readSync(fd, buf, read, length - read, fromOffset + read);
      if (n <= 0) break;
      read += n;
    }
    return buf.slice(0, read).toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd >= 0) try { fs.closeSync(fd); } catch {}
  }
}

function sleepSync(ms: number): void {
  const view = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(view, 0, 0, ms);
}

function withStateLock<T>(runner: string, action: () => T): T | null {
  const lockPath = stateLockPath(runner);
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "owner"),
        `pid=${process.pid}\ncreated_at=${NOW()}\n`,
        "utf8"
      );
      try {
        return action();
      } finally {
        try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch {}
      }
    } catch (error: any) {
      if (error?.code !== "EEXIST") {
        warn(`state lock failed: ${error?.message || error}`);
        return null;
      }
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 30000) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {}
      if (Date.now() >= deadline) {
        warn("report ignored: state lock timeout");
        return null;
      }
      sleepSync(25);
    }
  }
}

function readState(runner: string): string {
  try { return fs.readFileSync(statePath(runner), "utf8"); }
  catch { return ""; }
}
function writeState(runner: string, content: string): boolean {
  try {
    const target = statePath(runner);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, target);
    return true;
  }
  catch (err: any) { warn(`state write failed: ${err && err.message}`); return false; }
}

type TokenHistoryEntry = {
  at: string;
  tickId?: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
};

// tickId 가 비어 있는 legacy/외부 entry 와의 중복도 막기 위해 (at + 사용량 tuple)
// 기반 fallback 키를 함께 만든다. 같은 turn 의 record 는 이 키가 일치한다.
function tokenHistoryFallbackKey(entry: TokenHistoryEntry): string {
  return `at:${entry.at}|in:${entry.input}|out:${entry.output}|cr:${entry.cacheRead}|cc:${entry.cacheCreate}`;
}

function tokenHistoryKeysFor(entry: TokenHistoryEntry): string[] {
  const keys: string[] = [];
  const tickId = String(entry.tickId || "").trim();
  if (tickId) keys.push(`tick:${tickId}`);
  keys.push(tokenHistoryFallbackKey(entry));
  return keys;
}

function readTokenHistoryKeys(runner: string): Set<string> {
  const set = new Set<string>();
  let text = "";
  try { text = fs.readFileSync(tokenHistoryPath(runner), "utf8"); } catch { return set; }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: any;
    try { parsed = JSON.parse(trimmed); } catch { continue; }
    if (!parsed || typeof parsed !== "object") continue;
    const entry: TokenHistoryEntry = {
      at: String(parsed.at || ""),
      tickId: String(parsed.tickId || parsed.tick_id || ""),
      input: parseInt0(parsed.input),
      output: parseInt0(parsed.output),
      cacheRead: parseInt0(parsed.cacheRead ?? parsed.cache_read),
      cacheCreate: parseInt0(parsed.cacheCreate ?? parsed.cache_create),
    };
    for (const key of tokenHistoryKeysFor(entry)) set.add(key);
  }
  return set;
}

function appendTokenHistoryEntries(
  runner: string,
  entries: TokenHistoryEntry[],
  knownKeys: Set<string>,
): number {
  if (entries.length === 0) return 0;
  const lines: string[] = [];
  for (const entry of entries) {
    if (!entry.at) continue;
    const keys = tokenHistoryKeysFor(entry);
    if (keys.some((key) => knownKeys.has(key))) continue;
    for (const key of keys) knownKeys.add(key);
    // 기존 reader 호환을 위해 표준 필드 순서를 유지하고 tickId 는 추가 필드로만 둔다.
    const out: TokenHistoryEntry = {
      at: entry.at,
      input: entry.input,
      output: entry.output,
      cacheRead: entry.cacheRead,
      cacheCreate: entry.cacheCreate,
    };
    if (entry.tickId) out.tickId = entry.tickId;
    lines.push(JSON.stringify(out));
  }
  if (lines.length === 0) return 0;
  try {
    fs.appendFileSync(tokenHistoryPath(runner), lines.join("\n") + "\n", "utf8");
  } catch (err: any) {
    warn(`token history append failed: ${err?.message || err}`);
    return 0;
  }
  return lines.length;
}

function pruneTokenHistoryIfLarge(runner: string, nowMs: number): void {
  const target = tokenHistoryPath(runner);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return;
  }
  if (stat.size <= TOKEN_HISTORY_PRUNE_SIZE_BYTES) return;

  const keepAfterMs = nowMs - TOKEN_HISTORY_RETENTION_MS;
  try {
    const kept = fs.readFileSync(target, "utf8")
      .split(/\r?\n/)
      .filter((line) => {
        if (!line.trim()) return false;
        try {
          const parsed = JSON.parse(line);
          const atMs = Date.parse(String(parsed?.at || ""));
          return Number.isFinite(atMs) && atMs >= keepAfterMs;
        } catch {
          return false;
        }
      });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, kept.length > 0 ? kept.join("\n") + "\n" : "", "utf8");
    fs.renameSync(tmp, target);
  } catch (err: any) {
    warn(`token history prune failed: ${err?.message || err}`);
  }
}

function parseStateLines(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    map.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return map;
}

function serializeStateLines(map: Map<string, string>): string {
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

function compactStamp(at = new Date()): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function parseInt0(s: unknown): number {
  const v = parseInt(String(s || "0"), 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function tokenRoleFromState(map: Map<string, string>): string {
  const candidates = [
    map.get("active_role") || "",
    map.get("assignment_role") || "",
    map.get("role") || "",
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized) return normalized;
  }
  return "";
}

const tokenDefaults = new Map<string, string>([
  ["cumulative_tokens", "0"],
  ["cumulative_total_tokens", "0"],
  ["cumulative_cache_read_tokens", "0"],
  ["cumulative_cache_create_tokens", "0"],
  ["cumulative_llm_request_count", "0"],
  ["last_turn_tokens", "0"],
  ["last_turn_total_tokens", "0"],
  ["last_turn_input_tokens", "0"],
  ["last_turn_output_tokens", "0"],
  ["last_turn_cache_read_tokens", "0"],
  ["last_turn_cache_create_tokens", "0"],
  ["last_turn_llm_request_count", "0"],
  ["last_turn_at", ""],
  ["last_turn_tick_id", ""],
  ["last_turn_role", ""],
  ["token_source", "none"],
  ["last_token_usage_source", "none"],
  ["cumulative_code_files_changed", "0"],
  ["cumulative_code_insertions", "0"],
  ["cumulative_code_deletions", "0"],
  ["cumulative_code_volume", "0"],
  ["cumulative_code_net_delta", "0"],
  ["last_code_ticket_id", ""],
  ["last_code_files_changed", "0"],
  ["last_code_insertions", "0"],
  ["last_code_deletions", "0"],
  ["last_code_volume", "0"],
  ["last_code_net_delta", "0"],
  ["last_code_reported_at", ""],
  ["code_source", "none"],
]);

interface ReportOpts {
  tickId?: string;
  input?: string;
  output?: string;
  cacheRead?: string;
  cacheCreate?: string;
  note?: string;
}

type TokenEntry = {
  tickId: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  turnTotal: number;
  at: string;
  atMs: number;
};

type SessionFileEntry = { filePath: string; mtimeMs: number; size: number };

function allSessionTokenEntriesForRunner(runner: string, map: Map<string, string>): TokenEntry[] {
  const projectRoot = projectRootForSessionLogs();
  const agent = String(map.get("agent") || "").toLowerCase();
  const cursor: SessionCursorAll = {};
  const knownTicks = new Set<string>();
  return [
    ...(agent === "codex" ? scopedCodexSessionTokenEntries(runner, map, knownTicks, 0, cursor, false) : []),
    ...(agent === "claude" ? scopedClaudeSessionTokenEntries(runner, projectRoot, map, knownTicks, 0, cursor, false) : []),
  ].sort((left, right) => left.atMs - right.atMs || left.tickId.localeCompare(right.tickId));
}

function backfillLlmRequestCount(runner: string, map: Map<string, string>): number {
  const existing = parseInt0(map.get("cumulative_llm_request_count"));
  const entries = allSessionTokenEntriesForRunner(runner, map);
  const count = Math.max(existing, entries.length);
  if (count > existing) {
    map.set("cumulative_llm_request_count", String(count));
  }
  return count;
}

function sessionLogFileEntries(root: string, limit = 40): SessionFileEntry[] {
  const out: SessionFileEntry[] = [];
  const visit = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const filePath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (!ent.isFile() || !ent.name.endsWith(".jsonl")) continue;
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      out.push({ filePath, mtimeMs: stat.mtimeMs, size: stat.size });
    }
  };
  visit(root);
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out.slice(0, Math.max(1, limit));
}

function sessionLogFiles(root: string, limit = 40): string[] {
  return sessionLogFileEntries(root, limit).map((e) => e.filePath);
}

function scopedCodexSessionTokenEntries(
  runner: string,
  state: Map<string, string>,
  knownTicks: Set<string>,
  afterMs: number,
  cursorAll: SessionCursorAll,
  useCursor = true,
): TokenEntry[] {
  const codexHome = state.get("codex_home") || "";
  if (!path.isAbsolute(codexHome)) return [];
  const sessionsRoot = path.join(codexHome, "sessions");
  if (!fs.existsSync(sessionsRoot)) return [];
  const projectRoot = projectRootForSessionLogs();
  const sessionNeedles = [`Project root: ${projectRoot}`, `Runner id:    ${runner}`];

  const entries: TokenEntry[] = [];
  const seen = new Set<string>();
  const cursor: SessionCursorMap = cursorAll.codex || (cursorAll.codex = {});
  for (const fileEntry of sessionLogFileEntries(sessionsRoot)) {
    const filePath = fileEntry.filePath;
    const prev = cursor[filePath];
    if (useCursor && prev && prev.mtimeMs === fileEntry.mtimeMs && prev.size === fileEntry.size) continue;
    const fromOffset = useCursor && prev && prev.size <= fileEntry.size ? prev.size : 0;
    const raw = readSliceUtf8(filePath, fromOffset, fileEntry.size);
    let belongsToRunner = prev?.belongsToRunner === true;
    if (!belongsToRunner) {
      const head = fromOffset === 0 ? raw : readSliceUtf8(filePath, 0, Math.min(fileEntry.size, 512 * 1024));
      belongsToRunner = sessionNeedles.every((needle) => head.includes(needle));
    }
    if (useCursor) cursor[filePath] = { mtimeMs: fileEntry.mtimeMs, size: fileEntry.size, belongsToRunner };
    if (!belongsToRunner) continue;
    if (!raw) continue;
    const rel = path.relative(sessionsRoot, filePath);
    let lineIndex = 0;
    let lastSessionTotal = 0;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      lineIndex += 1;
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (parsed?.type !== "event_msg" || parsed?.payload?.type !== "token_count") continue;
      const usage = parsed?.payload?.info?.last_token_usage;
      if (!usage || typeof usage !== "object") continue;
      const sessionUsage = parsed?.payload?.info?.total_token_usage;
      const at = String(parsed?.timestamp || "");
      const atMs = Date.parse(at);
      if (!Number.isFinite(atMs) || atMs <= afterMs) continue;
      const inputTotal = parseInt0(usage.input_tokens);
      const cacheRead = parseInt0(usage.cached_input_tokens);
      const output = parseInt0(usage.output_tokens);
      const reportedTurnTotal = parseInt0(usage.total_tokens) || inputTotal + output;
      const sessionTotal = sessionUsage && typeof sessionUsage === "object"
        ? parseInt0(sessionUsage.total_tokens)
        : 0;
      if (sessionTotal > 0) {
        if (sessionTotal <= lastSessionTotal) continue;
        lastSessionTotal = sessionTotal;
      }
      const turnTotal = reportedTurnTotal;
      if (turnTotal <= 0) continue;

      const tickId = sessionTotal > 0
        ? `codex-session:${rel}:total:${sessionTotal}`
        : `codex-session:${rel}:${lineIndex}`;
      if (knownTicks.has(tickId) || seen.has(tickId)) continue;
      seen.add(tickId);
      entries.push({
        tickId,
        input: Math.max(0, inputTotal - cacheRead),
        output,
        cacheRead,
        cacheCreate: 0,
        turnTotal,
        at,
        atMs,
      });
    }
  }
  return entries.sort((left, right) => left.atMs - right.atMs || left.tickId.localeCompare(right.tickId));
}

function projectRootForSessionLogs(): string {
  const explicit = process.env.AUTOFLOW_PROJECT_ROOT || process.env.PROJECT_ROOT || "";
  if (explicit && path.isAbsolute(explicit)) return path.resolve(explicit);
  if (path.basename(BOARD_ROOT) === ".autoflow") return path.dirname(BOARD_ROOT);
  return path.dirname(BOARD_ROOT);
}

function textContentIncludes(value: unknown, needles: string[]): boolean {
  let text = "";
  if (Array.isArray(value)) {
    text = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof (item as any).text === "string") return (item as any).text;
        return "";
      })
      .join("\n");
  } else if (typeof value === "string") {
    text = value;
  }
  if (!text) return false;
  return needles.every((needle) => text.includes(needle));
}

function claudeProjectChatRoot(projectRoot: string): string {
  const home = process.env.HOME || "";
  if (!home || !projectRoot) return "";
  // Claude Code stores per-project sessions under ~/.claude/projects/<encoded>
  // where <encoded> is the absolute project root path with every `/` replaced
  // by `-` (leading slash becomes a leading dash).
  const encoded = projectRoot.replace(/\//g, "-");
  return path.join(home, ".claude", "projects", encoded);
}

function currentClaudeSessionIdsForRunner(state: Map<string, string>, projectRoot: string): Set<string> {
  const ids = new Set<string>();
  const home = process.env.HOME || "";
  const pid = parseInt0(state.get("pid"));
  if (!home || pid <= 0) return ids;

  const sessionFile = path.join(home, ".claude", "sessions", `${pid}.json`);
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
  } catch {
    return ids;
  }

  const cwd = String(parsed?.cwd || "");
  const sessionId = String(parsed?.sessionId || "");
  if (sessionId && path.resolve(cwd || projectRoot) === path.resolve(projectRoot)) {
    ids.add(sessionId);
  }
  return ids;
}

function scopedClaudeSessionTokenEntries(
  runner: string,
  projectRoot: string,
  state: Map<string, string>,
  knownTicks: Set<string>,
  afterMs: number,
  cursorAll: SessionCursorAll,
  useCursor = true,
): TokenEntry[] {
  const root = claudeProjectChatRoot(projectRoot);
  if (!root || !fs.existsSync(root)) return [];

  const entries: TokenEntry[] = [];
  const seenTicks = new Set<string>();
  // Match the same anchor lines that buildInitialPrompt writes into the very
  // first user message, so we can attribute each session jsonl to a runner.
  const sessionNeedles = [`Project root: ${projectRoot}`, `Runner id:    ${runner}`];
  const currentSessionIds = currentClaudeSessionIdsForRunner(state, projectRoot);
  const cursor: SessionCursorMap = cursorAll.claude || (cursorAll.claude = {});

  for (const fileEntry of sessionLogFileEntries(root)) {
    const filePath = fileEntry.filePath;
    const sessionId = path.basename(filePath, ".jsonl");
    const isCurrent = currentSessionIds.has(sessionId);
    const prev = cursor[filePath];
    if (useCursor && !isCurrent && prev && prev.mtimeMs === fileEntry.mtimeMs && prev.size === fileEntry.size) {
      continue;
    }
    const fromOffset = useCursor && prev && prev.size <= fileEntry.size ? prev.size : 0;
    const raw = readSliceUtf8(filePath, fromOffset, fileEntry.size);
    const lines = raw ? raw.split(/\r?\n/) : [];

    let belongsToRunner = isCurrent || prev?.belongsToRunner === true;
    if (!belongsToRunner) {
      const headRaw = fromOffset === 0 ? raw : readSliceUtf8(filePath, 0, Math.min(fileEntry.size, 512 * 1024));
      for (const line of (headRaw ? headRaw.split(/\r?\n/) : [])) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (parsed?.type !== "user") continue;
        const msg = parsed?.message;
        const content = msg && typeof msg === "object" ? (msg as any).content : parsed?.content;
        if (textContentIncludes(content, sessionNeedles)) {
          belongsToRunner = true;
          break;
        }
      }
    }
    if (useCursor) {
      cursor[filePath] = {
        mtimeMs: fileEntry.mtimeMs,
        size: fileEntry.size,
        belongsToRunner,
      };
    }
    if (!belongsToRunner) continue;

    let lineIndex = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      lineIndex += 1;
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (parsed?.type !== "assistant") continue;
      const usage = parsed?.message?.usage;
      if (!usage || typeof usage !== "object") continue;
      const at = String(parsed?.timestamp || "");
      const atMs = Date.parse(at);
      if (!Number.isFinite(atMs) || atMs <= afterMs) continue;
      const input = parseInt0(usage.input_tokens);
      const output = parseInt0(usage.output_tokens);
      const cacheRead = parseInt0(usage.cache_read_input_tokens);
      const cacheCreate = parseInt0(usage.cache_creation_input_tokens);
      const turnTotal = input + output + cacheRead + cacheCreate;
      if (turnTotal <= 0) continue;
      const msgId = String(parsed?.message?.id || `line:${lineIndex}`);
      const tickId = `claude-session:${sessionId}:${msgId}`;
      if (knownTicks.has(tickId) || seenTicks.has(tickId)) continue;
      seenTicks.add(tickId);
      entries.push({ tickId, input, output, cacheRead, cacheCreate, turnTotal, at, atMs });
    }
  }

  return entries.sort((left, right) => left.atMs - right.atMs || left.tickId.localeCompare(right.tickId));
}

export function reportCore(runner: string, opts: ReportOpts): { ok: boolean; message: string } {
  const inputT = parseInt0(opts.input);
  const outputT = parseInt0(opts.output);
  const cacheR = parseInt0(opts.cacheRead);
  const cacheC = parseInt0(opts.cacheCreate);
  const turnTotal = inputT + outputT + cacheR + cacheC;
  const inputSideTotal = inputT + cacheR + cacheC;
  if (turnTotal <= 0) return { ok: false, message: "report ignored: total tokens 0" };
  if (inputSideTotal <= 0 && outputT > 0) {
    return { ok: false, message: "report ignored: output-only token report is incomplete; pass exact input/cache tokens or skip the report" };
  }

  ensureDirs();
  const result = withStateLock(runner, () => {
    const at = NOW();
    const atMs = Date.parse(at);
    const state = readState(runner);
    const map = parseStateLines(state);
    if (!map.has("id")) map.set("id", runner);
    if (!map.has("status")) map.set("status", "idle");
    if (!map.has("active_stage")) map.set("active_stage", "idle");
    for (const [key, value] of tokenDefaults) {
      if (!map.has(key)) map.set(key, value);
    }

    const tickId = String(opts.tickId || "");
    const lastTickId = map.get("last_turn_tick_id") || "";
    if (tickId && tickId === lastTickId) {
      return `[runner-tokens] duplicate tick-id ${tickId}, skipped\n`;
    }

    const visible = Math.max(0, turnTotal - cacheR);
    const prevVisible = map.get("token_source") === "llm_reported" ? parseInt0(map.get("cumulative_tokens")) : 0;
    const prevTotal = map.get("token_source") === "llm_reported"
      ? parseInt0(map.get("cumulative_total_tokens")) || parseInt0(map.get("cumulative_tokens"))
      : 0;
    const prevCacheRead = parseInt0(map.get("cumulative_cache_read_tokens"));
    const prevCacheCreate = parseInt0(map.get("cumulative_cache_create_tokens"));
    const prevRequestCount = parseInt0(map.get("cumulative_llm_request_count"));
    const newVisible = prevVisible + visible;
    const newTotal = prevTotal + turnTotal;
    const newRequestCount = prevRequestCount + 1;
    map.set("last_turn_tokens", String(visible));
    map.set("last_turn_total_tokens", String(turnTotal));
    map.set("last_turn_input_tokens", String(inputT));
    map.set("last_turn_output_tokens", String(outputT));
    map.set("last_turn_cache_read_tokens", String(cacheR));
    map.set("last_turn_cache_create_tokens", String(cacheC));
    map.set("last_turn_llm_request_count", "1");
    map.set("last_turn_at", at);
    if (tickId) map.set("last_turn_tick_id", tickId);
    map.set("last_turn_role", tokenRoleFromState(map));
    map.set("cumulative_tokens", String(newVisible));
    map.set("cumulative_total_tokens", String(newTotal));
    map.set("cumulative_cache_read_tokens", String(prevCacheRead + cacheR));
    map.set("cumulative_cache_create_tokens", String(prevCacheCreate + cacheC));
    map.set("cumulative_llm_request_count", String(newRequestCount));
    map.set("token_source", "llm_reported");
    map.set("last_token_usage_source", "llm_reported");
    map.set("updated_at", at);

    let message = "";
    if (writeState(runner, serializeStateLines(map))) {
      const reportHistoryKeys = readTokenHistoryKeys(runner);
      appendTokenHistoryEntries(
        runner,
        [{ at, tickId, input: inputT, output: outputT, cacheRead: cacheR, cacheCreate: cacheC }],
        reportHistoryKeys,
      );
      pruneTokenHistoryIfLarge(runner, Number.isFinite(atMs) ? atMs : Date.now());
      message = `[runner-tokens] ${runner}: +${visible} (total=${turnTotal}, cum=${newVisible})\n`;
    }

    return message;
  });

  return { ok: true, message: result || "" };
}

function report(runner: string | undefined, opts: ReportOpts): never {
  if (!runner) { warn("report requires --runner"); process.exit(0); }
  const result = reportCore(runner, opts);
  if (!result.ok) {
    if (result.message) warn(result.message);
    process.exit(0);
  }
  if (result.message) process.stdout.write(result.message);
  process.exit(0);
}

export type ImportSessionResult = {
  ok: true;
  imported: number;
  cumulativeTokens: number;
  cumulativeTotalTokens: number;
  cumulativeLlmRequestCount: number;
  lastTurnTickId: string;
  lastTurnTotalTokens: number;
  lastTurnTokens: number;
  lastTurnAt: string;
};

export function importSessionTokenUsageCore(runner: string): ImportSessionResult {
  ensureDirs();
  const result = withStateLock(runner, () => {
    const state = readState(runner);
    const map = parseStateLines(state);
    if (!map.has("id")) map.set("id", runner);
    if (!map.has("status")) map.set("status", "idle");
    if (!map.has("active_stage")) map.set("active_stage", "idle");
    for (const [key, value] of tokenDefaults) {
      if (!map.has(key)) map.set(key, value);
    }

    const lastTurnAt = String(map.get("last_turn_at") || "");
    const afterMs = lastTurnAt ? Date.parse(lastTurnAt) || 0 : 0;
    const projectRoot = projectRootForSessionLogs();
    const cursorAll = loadSessionCursor(runner);
    const agent = String(map.get("agent") || "").toLowerCase();
    const emptyTicks = new Set<string>();
    const knownHistoryKeys = readTokenHistoryKeys(runner);
    const nowMs = Date.now();
    const backfillAfterMs = Math.max(0, nowMs - 24 * 60 * 60 * 1000);
    // backfill 은 이미 cumulative 에 반영된 turn 중 history 파일에서 빠진 항목만
    // 보강한다. session 파일 cursor 를 건드리지 않도록 별도 cursor 객체와
    // useCursor=false 로 24시간 범위를 다시 스캔한다.
    if (afterMs > backfillAfterMs) {
      const backfillCursor: SessionCursorAll = {};
      const backfillTicks = new Set<string>();
      const backfillEntries = [
        ...(agent === "codex"  ? scopedCodexSessionTokenEntries(runner, map, backfillTicks, backfillAfterMs, backfillCursor, false) : []),
        ...(agent === "claude" ? scopedClaudeSessionTokenEntries(runner, projectRoot, map, backfillTicks, backfillAfterMs, backfillCursor, false) : []),
      ].filter((entry) => entry.atMs <= afterMs);
      appendTokenHistoryEntries(
        runner,
        backfillEntries.map((entry) => ({
          at: entry.at,
          tickId: entry.tickId,
          input: entry.input,
          output: entry.output,
          cacheRead: entry.cacheRead,
          cacheCreate: entry.cacheCreate,
        })),
        knownHistoryKeys,
      );
    }
    const entries = [
      ...(agent === "codex"  ? scopedCodexSessionTokenEntries(runner, map, emptyTicks, afterMs, cursorAll) : []),
      ...(agent === "claude" ? scopedClaudeSessionTokenEntries(runner, projectRoot, map, emptyTicks, afterMs, cursorAll) : []),
    ].sort((left, right) => left.atMs - right.atMs || left.tickId.localeCompare(right.tickId));
    saveSessionCursor(runner, cursorAll);
    let cumulative = map.get("token_source") === "llm_reported"
      ? parseInt0(map.get("cumulative_total_tokens")) || parseInt0(map.get("cumulative_tokens"))
      : 0;
    let cumulativeVisible = map.get("token_source") === "llm_reported" ? parseInt0(map.get("cumulative_tokens")) : 0;
    let cumulativeCacheRead = parseInt0(map.get("cumulative_cache_read_tokens"));
    let cumulativeCacheCreate = parseInt0(map.get("cumulative_cache_create_tokens"));
    const previousRequestCount = parseInt0(map.get("cumulative_llm_request_count"));
    let cumulativeRequests = backfillLlmRequestCount(runner, map);
    if (entries.length === 0) {
      if (cumulativeRequests > previousRequestCount) {
        map.set("updated_at", NOW());
        writeState(runner, serializeStateLines(map));
      }
      return { imported: 0, cumulative, cumulativeVisible, cumulativeRequests, last: undefined };
    }

    for (const entry of entries) {
      cumulative += entry.turnTotal;
      cumulativeVisible += Math.max(0, entry.turnTotal - entry.cacheRead);
      cumulativeCacheRead += entry.cacheRead;
      cumulativeCacheCreate += entry.cacheCreate;
    }
    cumulativeRequests = Math.max(cumulativeRequests, previousRequestCount + entries.length);

    const last = entries[entries.length - 1];
    map.set("last_turn_tokens", String(Math.max(0, last.turnTotal - last.cacheRead)));
    map.set("last_turn_total_tokens", String(last.turnTotal));
    map.set("last_turn_input_tokens", String(last.input));
    map.set("last_turn_output_tokens", String(last.output));
    map.set("last_turn_cache_read_tokens", String(last.cacheRead));
    map.set("last_turn_cache_create_tokens", String(last.cacheCreate));
    map.set("last_turn_llm_request_count", "1");
    map.set("last_turn_at", new Date(last.atMs).toISOString().replace(/\.\d+Z$/, "Z"));
    map.set("last_turn_tick_id", last.tickId);
    map.set("last_turn_role", tokenRoleFromState(map));
    map.set("cumulative_tokens", String(cumulativeVisible));
    map.set("cumulative_total_tokens", String(cumulative));
    map.set("cumulative_cache_read_tokens", String(cumulativeCacheRead));
    map.set("cumulative_cache_create_tokens", String(cumulativeCacheCreate));
    map.set("cumulative_llm_request_count", String(cumulativeRequests));
    map.set("token_source", "llm_reported");
    map.set("last_token_usage_source", "llm_reported");
    map.set("updated_at", NOW());
    writeState(runner, serializeStateLines(map));
    appendTokenHistoryEntries(
      runner,
      entries.map((entry) => ({
        at: entry.at,
        tickId: entry.tickId,
        input: entry.input,
        output: entry.output,
        cacheRead: entry.cacheRead,
        cacheCreate: entry.cacheCreate,
      })),
      knownHistoryKeys,
    );
    pruneTokenHistoryIfLarge(runner, nowMs);
    return { imported: entries.length, cumulative, cumulativeVisible, cumulativeRequests, last };
  });

  const last = result?.last;
  return {
    ok: true,
    imported: result?.imported || 0,
    cumulativeTokens: result?.cumulativeVisible || 0,
    cumulativeTotalTokens: result?.cumulative || 0,
    cumulativeLlmRequestCount: result?.cumulativeRequests || 0,
    lastTurnTickId: last?.tickId || "",
    lastTurnTotalTokens: last?.turnTotal || 0,
    lastTurnTokens: last ? Math.max(0, (last.turnTotal || 0) - (last.cacheRead || 0)) : 0,
    lastTurnAt: last?.at || "",
  };
}

function importSessionTokenUsage(runner: string | undefined): never {
  if (!runner) { warn("import-session-token-usage requires --runner"); process.exit(0); }
  const r = importSessionTokenUsageCore(runner);
  process.stdout.write([
    "status=ok",
    `runner=${runner}`,
	    `imported_count=${r.imported}`,
	    `cumulative_tokens=${r.cumulativeTokens}`,
	    `cumulative_total_tokens=${r.cumulativeTotalTokens}`,
	    `cumulative_llm_request_count=${r.cumulativeLlmRequestCount}`,
	    `last_turn_tokens=${r.lastTurnTokens}`,
    `last_turn_total_tokens=${r.lastTurnTotalTokens}`,
    `last_turn_at=${r.lastTurnAt}`,
    "",
  ].join("\n"));
  process.exit(0);
}

function reset(runner: string | undefined, note?: string): never {
  if (!runner) { warn("reset requires --runner"); process.exit(0); }
  ensureDirs();
  const result = withStateLock(runner, () => {
    const state = readState(runner);
    const map = parseStateLines(state);
    if (!map.has("id")) map.set("id", runner);
    if (!map.has("status")) map.set("status", "idle");
    if (!map.has("active_stage")) map.set("active_stage", "idle");
    for (const [key, value] of tokenDefaults) {
      if (!map.has(key)) map.set(key, value);
    }

    const at = NOW();
    const stamp = compactStamp(new Date(at));
    const tickId = `reset:${stamp}`;
    void note;
    try { fs.rmSync(sessionCursorPath(runner), { force: true }); } catch {}

    map.set("last_turn_tokens", "0");
    map.set("last_turn_total_tokens", "0");
    map.set("last_turn_input_tokens", "0");
    map.set("last_turn_output_tokens", "0");
	    map.set("last_turn_cache_read_tokens", "0");
	    map.set("last_turn_cache_create_tokens", "0");
	    map.set("last_turn_llm_request_count", "0");
	    map.set("last_turn_at", at);
    map.set("last_turn_tick_id", tickId);
    map.set("cumulative_tokens", "0");
    map.set("cumulative_total_tokens", "0");
	    map.set("cumulative_cache_read_tokens", "0");
	    map.set("cumulative_cache_create_tokens", "0");
	    map.set("cumulative_llm_request_count", "0");
    map.set("token_source", "none");
    map.set("last_token_usage_source", "none");
    map.set("updated_at", at);
    writeState(runner, serializeStateLines(map));
    return { tickId, at };
  });

  process.stdout.write([
    "status=ok",
    `runner=${runner}`,
	    "cumulative_tokens=0",
	    "cumulative_total_tokens=0",
	    "cumulative_llm_request_count=0",
    `last_turn_tick_id=${result?.tickId || ""}`,
    `reset_at=${result?.at || ""}`,
    "",
  ].join("\n"));
  process.exit(0);
}

function show(runner: string | undefined): never {
  if (!runner) { warn("show requires --runner"); process.exit(0); }
  const state = readState(runner);
  if (!state) {
    process.stdout.write("{}\n");
    process.exit(0);
  }
  const map = parseStateLines(state);
  const out = {
    runner,
    cumulative_tokens: parseInt0(map.get("cumulative_tokens")),
    cumulative_total_tokens: parseInt0(map.get("cumulative_total_tokens")) || parseInt0(map.get("cumulative_tokens")),
	    cumulative_cache_read_tokens: parseInt0(map.get("cumulative_cache_read_tokens")) || parseInt0(map.get("last_turn_cache_read_tokens")),
	    cumulative_cache_create_tokens: parseInt0(map.get("cumulative_cache_create_tokens")) || parseInt0(map.get("last_turn_cache_create_tokens")),
	    cumulative_llm_request_count: parseInt0(map.get("cumulative_llm_request_count")),
	    last_turn_tokens: parseInt0(map.get("last_turn_tokens")),
    last_turn_total_tokens: parseInt0(map.get("last_turn_total_tokens")) || parseInt0(map.get("last_turn_tokens")),
    last_turn_input_tokens: parseInt0(map.get("last_turn_input_tokens")),
    last_turn_output_tokens: parseInt0(map.get("last_turn_output_tokens")),
	    last_turn_cache_read_tokens: parseInt0(map.get("last_turn_cache_read_tokens")),
	    last_turn_cache_create_tokens: parseInt0(map.get("last_turn_cache_create_tokens")),
	    last_turn_llm_request_count: parseInt0(map.get("last_turn_llm_request_count")),
    last_turn_at: map.get("last_turn_at") || "",
    last_turn_tick_id: map.get("last_turn_tick_id") || "",
    token_source: map.get("token_source") || ""
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(0);
}

if (RUNNING_AS_CLI) {
  switch (SUBCMD) {
    case "report":
      report(arg("--runner"), {
        tickId: arg("--tick-id"),
        input: arg("--input"),
        output: arg("--output"),
        cacheRead: arg("--cache-read"),
        cacheCreate: arg("--cache-create"),
        note: arg("--note")
      });
      break;
    case "show":
      show(arg("--runner"));
      break;
    case "import-session-token-usage":
      importSessionTokenUsage(arg("--runner"));
      break;
    case "reset":
      reset(arg("--runner"), arg("--note"));
      break;
    default:
      help();
      process.exit(0);
  }
}
