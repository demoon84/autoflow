import {fs, path, type ProjectContext} from "../context";
import {parseRunnerConfig} from "./parse";
import {intState, readRunnerState} from "./state";

export function runnerOwnsCodeMetrics(runner: Record<string, string>): boolean {
    const id = runner.id || "";
    const role = runner.role || "";
    return role === "worker" || role === "ticket" || id === "worker" || id.startsWith("worker-");
}

export function codeMetricTotals(ctx: ProjectContext, runners = parseRunnerConfig(ctx)): Record<string, number> {
    const totals = {
        files: 0,
        insertions: 0,
        deletions: 0,
        volume: 0,
        net: 0,
    };
    for (const runner of runners) {
        if (!runnerOwnsCodeMetrics(runner)) continue;
        const state = readRunnerState(ctx, runner.id || "");
        totals.files += intState(state, "cumulative_code_files_changed");
        totals.insertions += intState(state, "cumulative_code_insertions");
        totals.deletions += intState(state, "cumulative_code_deletions");
        totals.volume += intState(state, "cumulative_code_volume");
        totals.net += intState(state, "cumulative_code_net_delta");
    }
    return totals;
}

type TokenLogEntry = {
    runner: string;
    tickId: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate: number;
    turnTotal: number;
    atMs: number;
};

type TokenLogReadResult = {
    hasTokenLog: boolean;
    entries: TokenLogEntry[];
};

export type RunnerTokenAccounting = {
    cumulativeTokens: number;
    lastTurnTokens: number;
    lastTurnInputTokens: number;
    lastTurnOutputTokens: number;
    lastTurnCacheReadTokens: number;
    lastTurnCacheCreateTokens: number;
    lastTurnAt: string;
    lastTurnTickId: string;
    tokenSource: string;
    lastTokenUsageSource: string;
};

function positiveIntegerValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function tokenLogPath(ctx: ProjectContext, runnerId: string): string {
    return path.join(ctx.boardRoot, "runners", "logs", `${runnerId}-tokens.log`);
}

function tokenEntrySort(left: TokenLogEntry, right: TokenLogEntry): number {
    return left.atMs - right.atMs || left.tickId.localeCompare(right.tickId);
}

function isLegacySessionLogTokenEntry(entry: Record<string, unknown>): boolean {
    return String(entry.note || "").startsWith("host_session_log:");
}

function isTokenResetEntry(entry: Record<string, unknown>): boolean {
    return String(entry.note || "").startsWith("token_reset:");
}

function readTrustedTokenLogEntries(ctx: ProjectContext, runnerId: string): TokenLogReadResult {
    const filePath = tokenLogPath(ctx, runnerId);
    if (!fs.existsSync(filePath)) {
        return {hasTokenLog: false, entries: []};
    }

    const entries: TokenLogEntry[] = [];
    const seenTicks = new Set<string>();
    const raw = fs.readFileSync(filePath, "utf8");
    let lineIndex = 0;
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        lineIndex += 1;
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (isLegacySessionLogTokenEntry(parsed)) continue;

        const tickId = String(parsed.tickId || `line:${lineIndex}`);
        const key = `${runnerId}:${tickId}`;
        if (seenTicks.has(key)) continue;
        seenTicks.add(key);

        const input = positiveIntegerValue(parsed.input);
        let output = positiveIntegerValue(parsed.output);
        const cacheRead = positiveIntegerValue(parsed.cacheRead);
        const cacheCreate = positiveIntegerValue(parsed.cacheCreate);
        const computedTotal = input + output + cacheRead + cacheCreate;
        const reportedTotal = positiveIntegerValue(parsed.turnTotal);
        const turnTotal = reportedTotal || computedTotal;
        if (turnTotal <= 0 && !isTokenResetEntry(parsed)) continue;
        if (turnTotal > computedTotal) {
            output += turnTotal - computedTotal;
        }

        const atMs = Date.parse(String(parsed.at || ""));
        entries.push({
            runner: String(parsed.runner || runnerId),
            tickId,
            input,
            output,
            cacheRead,
            cacheCreate,
            turnTotal,
            atMs: Number.isFinite(atMs) ? atMs : 0,
        });
    }
    return {hasTokenLog: true, entries};
}

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

function scopedCodexSessionTokenEntries(ctx: ProjectContext, runnerId: string, afterMs: number): TokenLogEntry[] {
    const state = readRunnerState(ctx, runnerId);
    const codexHome = state.codex_home || "";
    if (!path.isAbsolute(codexHome)) return [];
    const sessionsRoot = path.join(codexHome, "sessions");
    if (!fs.existsSync(sessionsRoot)) return [];

    const entries: TokenLogEntry[] = [];
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
            let parsed: Record<string, unknown>;
            try {
                parsed = JSON.parse(trimmed) as Record<string, unknown>;
            } catch {
                continue;
            }
            const payload = parsed.payload as Record<string, unknown> | undefined;
            if (parsed.type !== "event_msg" || payload?.type !== "token_count") continue;
            const info = payload.info as Record<string, unknown> | undefined;
            const usage = info?.last_token_usage as Record<string, unknown> | undefined;
            if (!usage) continue;

            const atMs = Date.parse(String(parsed.timestamp || ""));
            if (!Number.isFinite(atMs) || atMs <= afterMs) continue;
            const inputTotal = positiveIntegerValue(usage.input_tokens);
            const cacheRead = positiveIntegerValue(usage.cached_input_tokens);
            const output = positiveIntegerValue(usage.output_tokens);
            const reportedTurnTotal = positiveIntegerValue(usage.total_tokens) || inputTotal + output;
            const sessionUsage = info?.total_token_usage as Record<string, unknown> | undefined;
            const sessionTotal = sessionUsage ? positiveIntegerValue(sessionUsage.total_tokens) : 0;
            if (sessionTotal > 0) {
                if (sessionTotal <= lastSessionTotal) continue;
                lastSessionTotal = sessionTotal;
            }
            const turnTotal = reportedTurnTotal;
            if (turnTotal <= 0) continue;

            const tickId = sessionTotal > 0
                ? `codex-session:${rel}:total:${sessionTotal}`
                : `codex-session:${rel}:${lineIndex}`;
            const key = `${runnerId}:${tickId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({
                runner: runnerId,
                tickId,
                input: Math.max(0, inputTotal - cacheRead),
                output,
                cacheRead,
                cacheCreate: 0,
                turnTotal,
                atMs,
            });
        }
    }
    return entries;
}

function runnerTokenEntries(ctx: ProjectContext, runnerId: string): TokenLogReadResult {
    const tokenLog = readTrustedTokenLogEntries(ctx, runnerId);
    const latestTrustedAtMs = tokenLog.entries.reduce((max, entry) => Math.max(max, entry.atMs), 0);
    const sessionEntries = scopedCodexSessionTokenEntries(ctx, runnerId, latestTrustedAtMs);
    return {
        hasTokenLog: tokenLog.hasTokenLog || sessionEntries.length > 0,
        entries: [...tokenLog.entries, ...sessionEntries].sort(tokenEntrySort),
    };
}

function tokenStateCumulative(ctx: ProjectContext, runnerId: string): number {
    const state = readRunnerState(ctx, runnerId);
    if (state.token_source !== "llm_reported") return 0;
    return intState(state, "cumulative_tokens");
}

export function runnerTokenAccounting(ctx: ProjectContext, runnerId: string): RunnerTokenAccounting {
    const tokenLog = runnerTokenEntries(ctx, runnerId);
    if (tokenLog.hasTokenLog) {
        const last = tokenLog.entries.at(-1);
        const source = last ? "llm_reported" : "none";
        return {
            cumulativeTokens: tokenLog.entries.reduce((total, entry) => total + entry.turnTotal, 0),
            lastTurnTokens: last?.turnTotal || 0,
            lastTurnInputTokens: last?.input || 0,
            lastTurnOutputTokens: last?.output || 0,
            lastTurnCacheReadTokens: last?.cacheRead || 0,
            lastTurnCacheCreateTokens: last?.cacheCreate || 0,
            lastTurnAt: last && last.atMs > 0 ? new Date(last.atMs).toISOString().replace(/\.\d+Z$/, "Z") : "",
            lastTurnTickId: last?.tickId || "",
            tokenSource: source,
            lastTokenUsageSource: source,
        };
    }

    const state = readRunnerState(ctx, runnerId);
    return {
        cumulativeTokens: state.token_source === "llm_reported" ? intState(state, "cumulative_tokens") : 0,
        lastTurnTokens: intState(state, "last_turn_tokens"),
        lastTurnInputTokens: intState(state, "last_turn_input_tokens"),
        lastTurnOutputTokens: intState(state, "last_turn_output_tokens"),
        lastTurnCacheReadTokens: intState(state, "last_turn_cache_read_tokens"),
        lastTurnCacheCreateTokens: intState(state, "last_turn_cache_create_tokens"),
        lastTurnAt: state.last_turn_at || "",
        lastTurnTickId: state.last_turn_tick_id || "",
        tokenSource: state.token_source || "none",
        lastTokenUsageSource: state.last_token_usage_source || state.token_source || "none",
    };
}

function addBreakdownValue(target: Record<string, number>, key: string, value: number): void {
    if (!key || value <= 0) return;
    target[key] = (target[key] || 0) + value;
}

function floorHourSeconds(ms: number): number {
    return Math.floor(ms / 3600000) * 3600;
}

export function tokenMetricTotals(ctx: ProjectContext, runners = parseRunnerConfig(ctx), now = new Date()): Record<string, number | string> {
    const nowMs = now.getTime();
    const oneHourAgoMs = nowMs - 60 * 60 * 1000;
    const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
    const runnerModels = new Map(runners.map((runner) => [runner.id || "", runner.model || "unknown"]));
    const runnerBreakdown24h: Record<string, number> = {};
    const modelBreakdown24h: Record<string, number> = {};
    const hourly24h = new Map<number, {hour: number; input: number; output: number; cache: number}>();

    let usage = 0;
    let reportCount = 0;
    let usage1h = 0;
    let usage24h = 0;
    let input1h = 0;
    let output1h = 0;
    let cache1h = 0;
    let input24h = 0;
    let output24h = 0;
    let cache24h = 0;

    for (const runner of runners) {
        const runnerId = runner.id || "";
        if (!runnerId) continue;
        const tokenLog = runnerTokenEntries(ctx, runnerId);
        const cumulativeFromTrustedLog = tokenLog.entries.reduce((total, entry) => total + entry.turnTotal, 0);
        usage += tokenLog.hasTokenLog ? cumulativeFromTrustedLog : tokenStateCumulative(ctx, runnerId);
        reportCount += tokenLog.entries.length;

        for (const entry of tokenLog.entries) {
            if (entry.atMs <= 0) continue;
            const cache = entry.cacheRead + entry.cacheCreate;
            if (entry.atMs >= oneHourAgoMs && entry.atMs <= nowMs + 60000) {
                usage1h += entry.turnTotal;
                input1h += entry.input;
                output1h += entry.output;
                cache1h += cache;
            }
            if (entry.atMs < dayAgoMs || entry.atMs > nowMs + 60000) continue;
            usage24h += entry.turnTotal;
            input24h += entry.input;
            output24h += entry.output;
            cache24h += cache;
            addBreakdownValue(runnerBreakdown24h, runnerId, entry.turnTotal);
            addBreakdownValue(modelBreakdown24h, runnerModels.get(runnerId) || "unknown", entry.turnTotal);
            const hour = floorHourSeconds(entry.atMs);
            const bucket = hourly24h.get(hour) || {hour, input: 0, output: 0, cache: 0};
            bucket.input += entry.input;
            bucket.output += entry.output;
            bucket.cache += cache;
            hourly24h.set(hour, bucket);
        }
    }

    return {
        autoflow_token_usage_count: usage,
        autoflow_token_report_count: reportCount,
        autoflow_token_usage_1h_count: usage1h,
        autoflow_token_usage_24h_count: usage24h,
        autoflow_token_input_1h_count: input1h,
        autoflow_token_output_1h_count: output1h,
        autoflow_token_cache_1h_count: cache1h,
        autoflow_token_input_24h_count: input24h,
        autoflow_token_output_24h_count: output24h,
        autoflow_token_cache_24h_count: cache24h,
        autoflow_token_runner_breakdown_24h_json: JSON.stringify(runnerBreakdown24h),
        autoflow_token_model_breakdown_24h_json: JSON.stringify(modelBreakdown24h),
        autoflow_token_hourly_24h_json: JSON.stringify(Array.from(hourly24h.values()).sort((a, b) => a.hour - b.hour)),
    };
}
