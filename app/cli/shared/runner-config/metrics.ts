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

function isLegacySessionLogTokenEntry(entry: Record<string, unknown>): boolean {
    return String(entry.note || "").startsWith("host_session_log:");
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
        if (turnTotal <= 0) continue;
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

function tokenStateCumulative(ctx: ProjectContext, runnerId: string): number {
    const state = readRunnerState(ctx, runnerId);
    if (state.token_source !== "llm_reported") return 0;
    return intState(state, "cumulative_tokens");
}

export function runnerTokenAccounting(ctx: ProjectContext, runnerId: string): RunnerTokenAccounting {
    const tokenLog = readTrustedTokenLogEntries(ctx, runnerId);
    if (tokenLog.hasTokenLog) {
        const last = tokenLog.entries
            .slice()
            .sort((left, right) => left.atMs - right.atMs || left.tickId.localeCompare(right.tickId))
            .at(-1);
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
        const tokenLog = readTrustedTokenLogEntries(ctx, runnerId);
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
