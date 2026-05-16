import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

type RunnerMeta = {
  role?: string;
  agent?: string;
  projectRoot?: string;
  boardDirName?: string;
  codexHome?: string;
  codexHistory?: string;
  startedAt?: string;
};

type UsageReport = {
  source: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
};

type UsageEvent = {
  tickId: string;
  eventMs: number;
  usage: UsageReport;
};

type BridgeOptions = {
  getRunnerMetaEntries: () => Array<[string, RunnerMeta]>;
  reportUsage: (runnerId: string, usage: UsageReport, options?: { tickId?: string; note?: string }) => void;
  intervalMs?: number;
  logger?: Pick<Console, "warn" | "log">;
};

type RunnerScanState = {
  inFlight: boolean;
  timer?: ReturnType<typeof setTimeout>;
  reportedTicks: Set<string>;
};

const SESSION_SCAN_LOOKBACK_MS = 10 * 60 * 1000;
const DEFAULT_SCAN_INTERVAL_MS = 8000;
const MAX_CANDIDATE_FILES = 80;
const MAX_REMEMBERED_TICKS = 500;

function positiveIntegerValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function timestampMs(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashToken(value: string, length = 16): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, length);
}

function safeHomeDir(): string {
  return os.homedir() || process.env.HOME || "";
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory: string, recursive = false): Promise<string[]> {
  if (!(await pathExists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      out.push(...(await listFiles(absolute, true)));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      out.push(absolute);
    }
  }
  return out;
}

function dateDirPartsBetween(startMs: number, endMs: number): string[][] {
  const out: string[][] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(startMs - dayMs);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endMs + dayMs);
  end.setUTCHours(0, 0, 0, 0);
  for (let at = start.getTime(); at <= end.getTime(); at += dayMs) {
    const d = new Date(at);
    out.push([
      String(d.getUTCFullYear()),
      String(d.getUTCMonth() + 1).padStart(2, "0"),
      String(d.getUTCDate()).padStart(2, "0")
    ]);
  }
  return out;
}

async function collectCandidateFiles(directories: string[], startedMs: number, recursive = false): Promise<string[]> {
  const minMtime = Math.max(0, startedMs - SESSION_SCAN_LOOKBACK_MS);
  const seen = new Set<string>();
  const rows: Array<{ filePath: string; mtimeMs: number; size: number }> = [];
  for (const directory of directories) {
    for (const filePath of await listFiles(directory, recursive)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) continue;
        if (stat.mtimeMs < minMtime && stat.ctimeMs < minMtime && stat.birthtimeMs < minMtime) continue;
        rows.push({ filePath, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {}
    }
  }
  return rows
    .sort((left, right) => left.mtimeMs - right.mtimeMs || left.filePath.localeCompare(right.filePath))
    .slice(-MAX_CANDIDATE_FILES)
    .map((row) => row.filePath);
}

function runnerPromptMatch(text: string, runnerId: string, meta: RunnerMeta): boolean {
  if (!text || !runnerId) return false;
  const projectRoot = String(meta.projectRoot || "");
  const agent = String(meta.agent || "");
  const hasRunnerId =
    text.includes(`Runner id:    ${runnerId}`) ||
    text.includes(`Autoflow ${String(meta.role || "").trim()} runner started (id=${runnerId}, agent=${agent})`) ||
    text.includes(`started (id=${runnerId}, agent=${agent})`);
  if (!hasRunnerId) return false;
  return !projectRoot || text.includes(`Project root: ${projectRoot}`) || text.includes(projectRoot);
}

function codexUsageFromRecord(record: any, filePath: string, lineIndex: number, sessionId: string): UsageEvent | null {
  if (record?.type !== "event_msg" || record?.payload?.type !== "token_count") return null;
  const usage = record.payload.info?.last_token_usage;
  if (!usage || typeof usage !== "object") return null;
  const inputTotal = positiveIntegerValue(usage.input_tokens);
  const cacheRead = positiveIntegerValue(usage.cached_input_tokens);
  const output = positiveIntegerValue(usage.output_tokens);
  const input = Math.max(0, inputTotal - cacheRead);
  if (input + output + cacheRead <= 0) return null;
  const eventMs = timestampMs(record.timestamp);
  const base = [
    sessionId || path.basename(filePath),
    inputTotal,
    cacheRead,
    output,
    positiveIntegerValue(usage.total_tokens)
  ].join(":");
  return {
    tickId: `codex-${hashToken(base)}`,
    eventMs,
    usage: {
      source: "codex_session_token_count",
      input,
      output,
      cacheRead,
      cacheCreate: 0
    }
  };
}

function claudeUsageFromRecord(record: any, filePath: string, lineIndex: number): UsageEvent | null {
  const usage = record?.message?.usage || record?.usage;
  if (!usage || typeof usage !== "object") return null;
  const input = positiveIntegerValue(usage.input_tokens);
  const output = positiveIntegerValue(usage.output_tokens);
  const cacheRead = positiveIntegerValue(usage.cache_read_input_tokens);
  const cacheCreate = positiveIntegerValue(usage.cache_creation_input_tokens);
  if (input + output + cacheRead + cacheCreate <= 0) return null;
  const stableId = record.requestId || record.message?.id || record.uuid || `${record.timestamp || ""}:${lineIndex}`;
  return {
    tickId: `claude-${hashToken(`${path.basename(filePath)}:${stableId}`)}`,
    eventMs: timestampMs(record.timestamp),
    usage: {
      source: "claude_session_usage",
      input,
      output,
      cacheRead,
      cacheCreate
    }
  };
}

function geminiTokensUsage(tokens: any): UsageReport | null {
  if (!tokens || typeof tokens !== "object") return null;
  const inputTotal = positiveIntegerValue(tokens.input ?? tokens.promptTokenCount ?? tokens.prompt_token_count);
  const cacheRead = positiveIntegerValue(tokens.cached ?? tokens.cachedContentTokenCount ?? tokens.cached_content_token_count);
  const input = Math.max(0, inputTotal - cacheRead);
  let output =
    positiveIntegerValue(tokens.output ?? tokens.candidatesTokenCount ?? tokens.candidates_token_count) +
    positiveIntegerValue(tokens.thoughts) +
    positiveIntegerValue(tokens.tool);
  const total = positiveIntegerValue(tokens.total ?? tokens.totalTokenCount ?? tokens.total_token_count);
  const computed = input + output + cacheRead;
  if (total > computed) {
    output += total - computed;
  }
  if (input + output + cacheRead <= 0) return null;
  return {
    source: "gemini_session_tokens",
    input,
    output,
    cacheRead,
    cacheCreate: 0
  };
}

function geminiUsageFromRecord(record: any, filePath: string, lineIndex: number): UsageEvent | null {
  if (record?.type !== "gemini") return null;
  const usage = geminiTokensUsage(record.tokens || record.usageMetadata || record.usage_metadata);
  if (!usage) return null;
  const stableId = record.id || `${record.timestamp || ""}:${lineIndex}`;
  return {
    tickId: `gemini-${hashToken(`${path.basename(filePath)}:${stableId}`)}`,
    eventMs: timestampMs(record.timestamp),
    usage
  };
}

async function extractUsageEventsFromFile(provider: string, filePath: string, runnerId: string, meta: RunnerMeta): Promise<UsageEvent[]> {
  const input = fsSync.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const events: UsageEvent[] = [];
  const seenTicks = new Set<string>();
  let matched = false;
  let codexSessionId = "";
  let codexSessionCwd = "";
  let lineIndex = 0;

  try {
    for await (const rawLine of rl) {
      lineIndex += 1;
      const line = String(rawLine || "");
      if (!matched && runnerPromptMatch(line, runnerId, meta)) {
        matched = true;
      }
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      let record: any;
      try {
        record = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (provider === "codex" && record?.type === "session_meta") {
        if (record?.payload?.id) codexSessionId = String(record.payload.id);
        if (record?.payload?.cwd) codexSessionCwd = String(record.payload.cwd);
      }
      const event =
        provider === "codex" ? codexUsageFromRecord(record, filePath, lineIndex, codexSessionId) :
        provider === "claude" ? claudeUsageFromRecord(record, filePath, lineIndex) :
        provider === "gemini" ? geminiUsageFromRecord(record, filePath, lineIndex) :
        null;
      if (!event || seenTicks.has(event.tickId)) continue;
      seenTicks.add(event.tickId);
      events.push(event);
    }
  } finally {
    rl.close();
    input.destroy();
  }

  const projectRoot = String(meta.projectRoot || "");
  const codexCwdMatches =
    provider !== "codex" ||
    !projectRoot ||
    !codexSessionCwd ||
    path.resolve(codexSessionCwd) === path.resolve(projectRoot);
  return matched && codexCwdMatches ? events.sort((left, right) => left.eventMs - right.eventMs) : [];
}

function encodeClaudeProjectPath(projectRoot: string): string {
  return path.resolve(projectRoot).replace(/[^A-Za-z0-9._-]/g, "-");
}

async function codexSessionDirectories(meta: RunnerMeta, startedMs: number, nowMs: number): Promise<string[]> {
  const codexHome = String(meta.codexHome || "").trim() || path.join(safeHomeDir(), ".codex");
  const root = path.join(codexHome, "sessions");
  return dateDirPartsBetween(startedMs, nowMs)
    .map((parts) => path.join(root, ...parts))
    .filter((dir) => fsSync.existsSync(dir));
}

async function claudeSessionDirectories(projectRoot: string): Promise<string[]> {
  const dir = path.join(safeHomeDir(), ".claude", "projects", encodeClaudeProjectPath(projectRoot));
  return fsSync.existsSync(dir) ? [dir] : [];
}

async function geminiSessionDirectories(projectRoot: string): Promise<string[]> {
  const tmpRoot = path.join(safeHomeDir(), ".gemini", "tmp");
  const preferred = path.join(tmpRoot, path.basename(projectRoot), "chats");
  const dirs = new Set<string>();
  if (fsSync.existsSync(preferred)) return [preferred];
  try {
    const entries = await fs.readdir(tmpRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const chats = path.join(tmpRoot, entry.name, "chats");
      if (fsSync.existsSync(chats)) dirs.add(chats);
    }
  } catch {}
  return Array.from(dirs);
}

async function candidateFilesForProvider(provider: string, meta: RunnerMeta, startedMs: number, nowMs: number): Promise<string[]> {
  if (provider === "codex") {
    return collectCandidateFiles(await codexSessionDirectories(meta, startedMs, nowMs), startedMs, false);
  }
  if (provider === "claude") {
    return collectCandidateFiles(await claudeSessionDirectories(String(meta.projectRoot || "")), startedMs, false);
  }
  if (provider === "gemini") {
    return collectCandidateFiles(await geminiSessionDirectories(String(meta.projectRoot || "")), startedMs, true);
  }
  return [];
}

async function readRunnerLastTurnMs(runnerId: string, meta: RunnerMeta): Promise<number> {
  const projectRoot = String(meta.projectRoot || "");
  const boardDirName = String(meta.boardDirName || ".autoflow");
  if (!projectRoot) return 0;
  const statePath = path.join(projectRoot, boardDirName, "runners", "state", `${runnerId}.state`);
  try {
    const raw = await fs.readFile(statePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      if (line.slice(0, eq) === "last_turn_at") {
        return timestampMs(line.slice(eq + 1));
      }
    }
  } catch {}
  return 0;
}

function rememberTick(state: RunnerScanState, tickId: string): void {
  state.reportedTicks.add(tickId);
  if (state.reportedTicks.size <= MAX_REMEMBERED_TICKS) return;
  const overflow = state.reportedTicks.size - MAX_REMEMBERED_TICKS;
  let removed = 0;
  for (const item of state.reportedTicks) {
    state.reportedTicks.delete(item);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function createCliUsageLogBridge(options: BridgeOptions) {
  const logger = options.logger || console;
  const intervalMs = options.intervalMs || DEFAULT_SCAN_INTERVAL_MS;
  const runnerStates = new Map<string, RunnerScanState>();
  let interval: ReturnType<typeof setInterval> | undefined;

  function stateFor(runnerId: string): RunnerScanState {
    let state = runnerStates.get(runnerId);
    if (!state) {
      state = { inFlight: false, reportedTicks: new Set<string>() };
      runnerStates.set(runnerId, state);
    }
    return state;
  }

  async function scanRunnerNow(runnerId: string, meta: RunnerMeta): Promise<void> {
    const provider = String(meta.agent || "").toLowerCase();
    if (!["codex", "claude", "gemini"].includes(provider)) return;
    const startedMs = timestampMs(meta.startedAt) || Date.now() - (12 * 60 * 60 * 1000);
    const lastTurnMs = await readRunnerLastTurnMs(runnerId, meta);
    const minEventMs = Math.max(lastTurnMs, startedMs - 5000);
    const files = await candidateFilesForProvider(provider, meta, startedMs, Date.now());
    const state = stateFor(runnerId);
    for (const filePath of files) {
      let events: UsageEvent[] = [];
      try {
        events = await extractUsageEventsFromFile(provider, filePath, runnerId, meta);
      } catch {
        continue;
      }
      for (const event of events) {
        if (event.eventMs > 0 && event.eventMs <= minEventMs) continue;
        if (state.reportedTicks.has(event.tickId)) continue;
        rememberTick(state, event.tickId);
        options.reportUsage(runnerId, event.usage, {
          tickId: `${runnerId}-${event.tickId}`,
          note: `host_session_log:${event.usage.source}`
        });
      }
    }
  }

  function scanRunner(runnerId: string, reason = "manual"): void {
    const meta = options.getRunnerMetaEntries().find(([id]) => id === runnerId)?.[1];
    if (!meta) return;
    const state = stateFor(runnerId);
    if (state.inFlight) return;
    state.inFlight = true;
    scanRunnerNow(runnerId, meta)
      .catch((error) => {
        logger.warn(`[runner-tokens] session usage scan failed runner=${runnerId} reason=${reason}:`, error?.message || error);
      })
      .finally(() => {
        state.inFlight = false;
      });
  }

  function scheduleRunner(runnerId: string, delayMs = 1200): void {
    const state = stateFor(runnerId);
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = undefined;
      scanRunner(runnerId, "scheduled");
    }, delayMs);
    state.timer.unref?.();
  }

  function scanAll(reason = "interval"): void {
    for (const [runnerId] of options.getRunnerMetaEntries()) {
      scanRunner(runnerId, reason);
    }
  }

  function start(): void {
    if (interval) return;
    interval = setInterval(() => scanAll("interval"), intervalMs);
    interval.unref?.();
  }

  function stop(): void {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
    for (const state of runnerStates.values()) {
      if (state.timer) clearTimeout(state.timer);
    }
    runnerStates.clear();
  }

  function forgetRunner(runnerId: string): void {
    const state = runnerStates.get(runnerId);
    if (state?.timer) clearTimeout(state.timer);
    runnerStates.delete(runnerId);
  }

  return { start, stop, scanAll, scanRunner, scheduleRunner, forgetRunner };
}
