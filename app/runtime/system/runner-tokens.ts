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
  process.stdout.write(`Usage: tsx runner-tokens.ts <report|show|sync-codex-sessions|reset> [args]
  report  --runner <id> [--tick-id <id>] --input <N> --output <N>
          [--cache-read <N>] [--cache-create <N>] [--note <text>]
  show    --runner <id>
  sync-codex-sessions --runner <id>
  reset   --runner <id> [--note <text>]
`);
}

if (!SUBCMD || SUBCMD === "--help" || SUBCMD === "-h") {
  help();
  process.exit(0);
}

const BOARD_ROOT = path.resolve(
  process.env.AUTOFLOW_BOARD_ROOT ||
  process.env.BOARD_ROOT ||
  path.join(SCRIPT_DIR_HERE, "..")
);
const STATE_DIR = path.join(BOARD_ROOT, "runners", "state");
const LOG_DIR = path.join(BOARD_ROOT, "runners", "logs");
const NOW = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

function warn(msg: string): void {
  process.stderr.write(`[runner-tokens] ${msg}\n`);
}

function ensureDirs(): void {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function statePath(runner: string): string {
  return path.join(STATE_DIR, `${runner}.state`);
}
function tokenLogPath(runner: string): string {
  return path.join(LOG_DIR, `${runner}-tokens.log`);
}
function stateLockPath(runner: string): string {
  return `${statePath(runner)}.lock`;
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

type TrustedTokenLogState = {
  hasLog: boolean;
  total: number;
  ticks: Set<string>;
  last?: {
    tickId: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate: number;
    turnTotal: number;
    at: string;
    atMs: number;
  };
};

function trustedLogCumulative(runner: string): TrustedTokenLogState {
  const file = tokenLogPath(runner);
  if (!fs.existsSync(file)) return { hasLog: false, total: 0, ticks: new Set<string>() };
  const seen = new Set<string>();
  let total = 0;
  let last: TrustedTokenLogState["last"];
  let lineIndex = 0;
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      lineIndex += 1;
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (String(parsed?.note || "").startsWith("host_session_log:")) continue;
      const tickId = String(parsed?.tickId || `line:${lineIndex}`);
      if (seen.has(tickId)) continue;
      seen.add(tickId);
      const turnTotal =
        parseInt0(parsed?.turnTotal) ||
        parseInt0(parsed?.input) +
          parseInt0(parsed?.output) +
          parseInt0(parsed?.cacheRead) +
          parseInt0(parsed?.cacheCreate);
      total += turnTotal;
      const at = String(parsed?.at || "");
      const atMs = Date.parse(at);
      const entry = {
        tickId,
        input: parseInt0(parsed?.input),
        output: parseInt0(parsed?.output),
        cacheRead: parseInt0(parsed?.cacheRead),
        cacheCreate: parseInt0(parsed?.cacheCreate),
        turnTotal,
        at,
        atMs: Number.isFinite(atMs) ? atMs : 0,
      };
      if (!last || entry.atMs >= last.atMs) {
        last = entry;
      }
    }
  } catch {}
  return { hasLog: true, total, ticks: seen, last };
}

const tokenDefaults = new Map<string, string>([
  ["cumulative_tokens", "0"],
  ["last_turn_tokens", "0"],
  ["last_turn_input_tokens", "0"],
  ["last_turn_output_tokens", "0"],
  ["last_turn_cache_read_tokens", "0"],
  ["last_turn_cache_create_tokens", "0"],
  ["last_turn_at", ""],
  ["last_turn_tick_id", ""],
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

function sessionLogFiles(root: string, limit = 500): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    if (out.length >= limit) return;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (out.length >= limit) return;
      const filePath = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (stat.isFile() && name.endsWith(".jsonl")) {
        out.push(filePath);
      }
    }
  };
  visit(root);
  return out.sort();
}

function scopedCodexSessionTokenEntries(
  runner: string,
  state: Map<string, string>,
  knownTicks: Set<string>,
  afterMs: number,
): TokenEntry[] {
  const codexHome = state.get("codex_home") || "";
  if (!path.isAbsolute(codexHome)) return [];
  const sessionsRoot = path.join(codexHome, "sessions");
  if (!fs.existsSync(sessionsRoot)) return [];

  const entries: TokenEntry[] = [];
  const seen = new Set<string>();
  for (const filePath of sessionLogFiles(sessionsRoot)) {
    let raw = "";
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
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

function report(runner: string | undefined, opts: ReportOpts): never {
  if (!runner) { warn("report requires --runner"); process.exit(0); }
  const inputT = parseInt0(opts.input);
  const outputT = parseInt0(opts.output);
  const cacheR = parseInt0(opts.cacheRead);
  const cacheC = parseInt0(opts.cacheCreate);
  const turnTotal = inputT + outputT + cacheR + cacheC;
  const inputSideTotal = inputT + cacheR + cacheC;
  if (turnTotal <= 0) {
    warn("report ignored: total tokens 0");
    process.exit(0);
  }
  if (inputSideTotal <= 0 && outputT > 0) {
    warn("report ignored: output-only token report is incomplete; pass exact input/cache tokens or skip the report");
    process.exit(0);
  }

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

    const tickId = String(opts.tickId || "");
    const trustedLog = trustedLogCumulative(runner);
    const lastTickId = map.get("last_turn_tick_id") || "";
    if (tickId && (tickId === lastTickId || trustedLog.ticks.has(tickId))) {
      return `[runner-tokens] duplicate tick-id ${tickId}, skipped\n`;
    }

    const prevCumulative = trustedLog.hasLog
      ? trustedLog.total
      : (map.get("token_source") === "llm_reported" ? parseInt0(map.get("cumulative_tokens")) : 0);
    const newCumulative = prevCumulative + turnTotal;
    map.set("last_turn_tokens", String(turnTotal));
    map.set("last_turn_input_tokens", String(inputT));
    map.set("last_turn_output_tokens", String(outputT));
    map.set("last_turn_cache_read_tokens", String(cacheR));
    map.set("last_turn_cache_create_tokens", String(cacheC));
    map.set("last_turn_at", NOW());
    if (tickId) map.set("last_turn_tick_id", tickId);
    map.set("cumulative_tokens", String(newCumulative));
    map.set("token_source", "llm_reported");
    map.set("last_token_usage_source", "llm_reported");
    map.set("updated_at", NOW());

    let message = "";
    if (writeState(runner, serializeStateLines(map))) {
      message = `[runner-tokens] ${runner}: +${turnTotal} (cum=${newCumulative})\n`;
    }

    try {
      const entry = JSON.stringify({
        runner, tickId,
        input: inputT, output: outputT, cacheRead: cacheR, cacheCreate: cacheC,
        turnTotal, cumulative: newCumulative,
        note: String(opts.note || ""),
        at: NOW()
      }) + "\n";
      fs.appendFileSync(tokenLogPath(runner), entry);
    } catch {}

    return message;
  });

  if (result) process.stdout.write(result);

  process.exit(0);
}

function syncCodexSessions(runner: string | undefined): never {
  if (!runner) { warn("sync-codex-sessions requires --runner"); process.exit(0); }
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

    const trustedLog = trustedLogCumulative(runner);
    const afterMs = trustedLog.last?.atMs || 0;
    const entries = scopedCodexSessionTokenEntries(runner, map, trustedLog.ticks, afterMs);
    let cumulative = trustedLog.hasLog
      ? trustedLog.total
      : (map.get("token_source") === "llm_reported" ? parseInt0(map.get("cumulative_tokens")) : 0);
    if (entries.length === 0) {
      return { imported: 0, cumulative, last: trustedLog.last };
    }

    let payload = "";
    for (const entry of entries) {
      cumulative += entry.turnTotal;
      payload += JSON.stringify({
        runner,
        tickId: entry.tickId,
        input: entry.input,
        output: entry.output,
        cacheRead: entry.cacheRead,
        cacheCreate: entry.cacheCreate,
        turnTotal: entry.turnTotal,
        cumulative,
        note: "codex_session_log:scoped_runner_home",
        at: entry.at,
      }) + "\n";
    }
    fs.appendFileSync(tokenLogPath(runner), payload, "utf8");

    const last = entries[entries.length - 1];
    map.set("last_turn_tokens", String(last.turnTotal));
    map.set("last_turn_input_tokens", String(last.input));
    map.set("last_turn_output_tokens", String(last.output));
    map.set("last_turn_cache_read_tokens", String(last.cacheRead));
    map.set("last_turn_cache_create_tokens", String(last.cacheCreate));
    map.set("last_turn_at", new Date(last.atMs).toISOString().replace(/\.\d+Z$/, "Z"));
    map.set("last_turn_tick_id", last.tickId);
    map.set("cumulative_tokens", String(cumulative));
    map.set("token_source", "llm_reported");
    map.set("last_token_usage_source", "llm_reported");
    map.set("updated_at", NOW());
    writeState(runner, serializeStateLines(map));
    return { imported: entries.length, cumulative, last };
  });

  const imported = result?.imported || 0;
  const cumulative = result?.cumulative || 0;
  process.stdout.write([
    "status=ok",
    `runner=${runner}`,
    `imported_count=${imported}`,
    `cumulative_tokens=${cumulative}`,
    `last_turn_tokens=${result?.last?.turnTotal || 0}`,
    `last_turn_at=${result?.last?.at || ""}`,
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
    const file = tokenLogPath(runner);
    let backup = "";
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        backup = `${file}.${stamp}.bak`;
        fs.renameSync(file, backup);
      }
    } catch (error: any) {
      warn(`token log backup failed: ${error?.message || error}`);
    }

    const tickId = `reset:${stamp}`;
    const entry = JSON.stringify({
      runner,
      tickId,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
      turnTotal: 0,
      cumulative: 0,
      note: `token_reset:${String(note || "manual")}`,
      at,
    }) + "\n";
    fs.writeFileSync(file, entry, "utf8");

    map.set("last_turn_tokens", "0");
    map.set("last_turn_input_tokens", "0");
    map.set("last_turn_output_tokens", "0");
    map.set("last_turn_cache_read_tokens", "0");
    map.set("last_turn_cache_create_tokens", "0");
    map.set("last_turn_at", at);
    map.set("last_turn_tick_id", tickId);
    map.set("cumulative_tokens", "0");
    map.set("token_source", "none");
    map.set("last_token_usage_source", "none");
    map.set("updated_at", at);
    writeState(runner, serializeStateLines(map));
    return { backup, tickId, at };
  });

  process.stdout.write([
    "status=ok",
    `runner=${runner}`,
    "cumulative_tokens=0",
    `last_turn_tick_id=${result?.tickId || ""}`,
    `reset_at=${result?.at || ""}`,
    `backup=${result?.backup || ""}`,
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
  const trustedLog = trustedLogCumulative(runner);
  const useTrustedLog = trustedLog.hasLog;
  const last = trustedLog.last;
  const out = {
    runner,
    cumulative_tokens: useTrustedLog ? trustedLog.total : parseInt0(map.get("cumulative_tokens")),
    last_turn_tokens: useTrustedLog ? (last?.turnTotal || 0) : parseInt0(map.get("last_turn_tokens")),
    last_turn_input_tokens: useTrustedLog ? (last?.input || 0) : parseInt0(map.get("last_turn_input_tokens")),
    last_turn_output_tokens: useTrustedLog ? (last?.output || 0) : parseInt0(map.get("last_turn_output_tokens")),
    last_turn_cache_read_tokens: useTrustedLog ? (last?.cacheRead || 0) : parseInt0(map.get("last_turn_cache_read_tokens")),
    last_turn_cache_create_tokens: useTrustedLog ? (last?.cacheCreate || 0) : parseInt0(map.get("last_turn_cache_create_tokens")),
    last_turn_at: useTrustedLog ? (last?.at || "") : (map.get("last_turn_at") || ""),
    last_turn_tick_id: useTrustedLog ? (last?.tickId || "") : (map.get("last_turn_tick_id") || ""),
    token_source: map.get("token_source") || ""
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(0);
}

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
  case "sync-codex-sessions":
    syncCodexSessions(arg("--runner"));
    break;
  case "reset":
    reset(arg("--runner"), arg("--note"));
    break;
  default:
    help();
    process.exit(0);
}
