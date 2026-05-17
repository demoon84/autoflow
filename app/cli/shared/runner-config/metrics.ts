import {fs, path, type ProjectContext} from "../context";
import {parseRunnerConfig} from "./parse";
import {intState, readRunnerState} from "./state";

const nonCodeMetricBasenames = new Set([
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "composer.lock",
    "poetry.lock",
    "Cargo.lock",
]);

const nonCodeMetricExtensions = new Set([
    ".3gp", ".7z", ".aac", ".aiff", ".apk", ".avi", ".avif", ".bin", ".bmp", ".bz2",
    ".class", ".dmg", ".eot", ".exe", ".flac", ".gif", ".gz", ".heic", ".icns", ".ico",
    ".jar", ".jpeg", ".jpg", ".m4a", ".m4v", ".mov", ".mp3", ".mp4", ".mpeg", ".mpg",
    ".ogg", ".otf", ".pdf", ".png", ".rar", ".so", ".tar", ".tgz", ".tif", ".tiff",
    ".ttf", ".wav", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);

function safeSegment(value: string): string {
    return String(value || "").replace(/[^A-Za-z0-9_.-]+/g, "_") || "runner";
}

function codeMetricPathIsCountable(file: string): boolean {
    const normalized = String(file || "").replace(/\\/g, "/").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
    const basename = path.basename(normalized);
    if (!basename || nonCodeMetricBasenames.has(basename)) return false;
    const ext = path.extname(basename).toLowerCase();
    return !nonCodeMetricExtensions.has(ext);
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function markerCodeFiles(marker: Record<string, unknown>): string[] {
    const explicit = stringArray(marker.code_changed_files);
    const source = explicit.length > 0 ? explicit : stringArray(marker.product_changed_files).filter(codeMetricPathIsCountable);
    return [...new Set(source.map((item) => item.replace(/\\/g, "/").replace(/^[.][/]/, "").replace(/\/+$/, "").trim()).filter(Boolean))].sort();
}

function intMarker(marker: Record<string, unknown>, key: string): number {
    const parsed = Number.parseInt(String(marker[key] || "0"), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

type CodeTotals = {
    files: number;
    insertions: number;
    deletions: number;
    volume: number;
    net: number;
};

function readMarkerTotals(ctx: ProjectContext, runnerId: string): { found: boolean; totals: CodeTotals; files: Set<string> } {
    const dir = path.join(ctx.boardRoot, "runners", "state", "code-metrics", safeSegment(runnerId));
    const totals: CodeTotals = {files: 0, insertions: 0, deletions: 0, volume: 0, net: 0};
    const files = new Set<string>();
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(dir).filter((entry) => entry.endsWith(".json"));
    } catch {
        return {found: false, totals, files};
    }
    let fallbackFileCount = 0;
    for (const entry of entries) {
        let marker: Record<string, unknown> = {};
        try {
            marker = JSON.parse(fs.readFileSync(path.join(dir, entry), "utf8")) as Record<string, unknown>;
        } catch {
            continue;
        }
        const markerFiles = markerCodeFiles(marker);
        if (markerFiles.length > 0) {
            for (const file of markerFiles) files.add(file);
        } else {
            fallbackFileCount += intMarker(marker, "code_files_changed_count");
        }
        totals.insertions += intMarker(marker, "code_insertions_count");
        totals.deletions += intMarker(marker, "code_deletions_count");
        totals.volume += intMarker(marker, "code_volume_count");
        totals.net += intMarker(marker, "code_net_delta_count");
    }
    totals.files = files.size + fallbackFileCount;
    return {found: entries.length > 0, totals, files};
}

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
    const uniqueFiles = new Set<string>();
    let fallbackFileCount = 0;
    for (const runner of runners) {
        if (!runnerOwnsCodeMetrics(runner)) continue;
        const markers = readMarkerTotals(ctx, runner.id || "");
        if (markers.found) {
            for (const file of markers.files) uniqueFiles.add(file);
            fallbackFileCount += markers.totals.files - markers.files.size;
            totals.insertions += markers.totals.insertions;
            totals.deletions += markers.totals.deletions;
            totals.volume += markers.totals.volume;
            totals.net += markers.totals.net;
            continue;
        }
        const state = readRunnerState(ctx, runner.id || "");
        fallbackFileCount += intState(state, "cumulative_code_files_changed");
        totals.insertions += intState(state, "cumulative_code_insertions");
        totals.deletions += intState(state, "cumulative_code_deletions");
        totals.volume += intState(state, "cumulative_code_volume");
        totals.net += intState(state, "cumulative_code_net_delta");
    }
    totals.files = uniqueFiles.size + fallbackFileCount;
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
    cumulativeTotalTokens: number;
    cumulativeCacheReadTokens: number;
    cumulativeCacheCreateTokens: number;
    lastTurnTokens: number;
    lastTurnTotalTokens: number;
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

function visibleTokenUsage(entry: TokenLogEntry): number {
    return Math.max(0, entry.turnTotal - entry.cacheRead);
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

function runnerTokenEntries(ctx: ProjectContext, runnerId: string): TokenLogReadResult {
    const tokenLog = readTrustedTokenLogEntries(ctx, runnerId);
    return {
        hasTokenLog: tokenLog.hasTokenLog,
        entries: tokenLog.entries.sort(tokenEntrySort),
    };
}

export function runnerTokenAccounting(ctx: ProjectContext, runnerId: string): RunnerTokenAccounting {
    const tokenLog = runnerTokenEntries(ctx, runnerId);
    if (tokenLog.hasTokenLog) {
        const last = tokenLog.entries.at(-1);
        const source = last ? "llm_reported" : "none";
        const cumulativeTotalTokens = tokenLog.entries.reduce((total, entry) => total + entry.turnTotal, 0);
        const cumulativeCacheReadTokens = tokenLog.entries.reduce((total, entry) => total + entry.cacheRead, 0);
        const cumulativeCacheCreateTokens = tokenLog.entries.reduce((total, entry) => total + entry.cacheCreate, 0);
        return {
            cumulativeTokens: tokenLog.entries.reduce((total, entry) => total + visibleTokenUsage(entry), 0),
            cumulativeTotalTokens,
            cumulativeCacheReadTokens,
            cumulativeCacheCreateTokens,
            lastTurnTokens: last ? visibleTokenUsage(last) : 0,
            lastTurnTotalTokens: last?.turnTotal || 0,
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
    const stateCumulative = state.token_source === "llm_reported" ? intState(state, "cumulative_tokens") : 0;
    const stateCumulativeTotal = intState(state, "cumulative_total_tokens") || stateCumulative;
    const stateCumulativeCacheRead = intState(state, "cumulative_cache_read_tokens") || intState(state, "last_turn_cache_read_tokens");
    const stateCumulativeCacheCreate = intState(state, "cumulative_cache_create_tokens") || intState(state, "last_turn_cache_create_tokens");
    const stateLastTurn = intState(state, "last_turn_tokens");
    const stateLastTurnTotal = intState(state, "last_turn_total_tokens") || stateLastTurn;
    const stateLastCacheRead = intState(state, "last_turn_cache_read_tokens");
    const stateLastCacheCreate = intState(state, "last_turn_cache_create_tokens");
    return {
        cumulativeTokens: stateCumulative,
        cumulativeTotalTokens: stateCumulativeTotal,
        cumulativeCacheReadTokens: stateCumulativeCacheRead,
        cumulativeCacheCreateTokens: stateCumulativeCacheCreate,
        lastTurnTokens: stateLastTurn,
        lastTurnTotalTokens: stateLastTurnTotal,
        lastTurnInputTokens: intState(state, "last_turn_input_tokens"),
        lastTurnOutputTokens: intState(state, "last_turn_output_tokens"),
        lastTurnCacheReadTokens: stateLastCacheRead,
        lastTurnCacheCreateTokens: stateLastCacheCreate,
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
    let totalUsage = 0;
    let cacheReadUsage = 0;
    let cacheCreateUsage = 0;
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
        const visibleFromTrustedLog = tokenLog.entries.reduce((total, entry) => total + visibleTokenUsage(entry), 0);
        const cacheReadFromTrustedLog = tokenLog.entries.reduce((total, entry) => total + entry.cacheRead, 0);
        const cacheCreateFromTrustedLog = tokenLog.entries.reduce((total, entry) => total + entry.cacheCreate, 0);
        const state = readRunnerState(ctx, runnerId);
        const stateCumulative = state.token_source === "llm_reported" ? intState(state, "cumulative_tokens") : 0;
        const stateTotal = state.token_source === "llm_reported" ? intState(state, "cumulative_total_tokens") || stateCumulative : 0;
        const stateCacheRead = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_read_tokens") : 0;
        const stateCacheCreate = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_create_tokens") : 0;
        usage += tokenLog.hasTokenLog ? visibleFromTrustedLog : stateCumulative;
        totalUsage += tokenLog.hasTokenLog ? cumulativeFromTrustedLog : stateTotal;
        cacheReadUsage += tokenLog.hasTokenLog ? cacheReadFromTrustedLog : stateCacheRead;
        cacheCreateUsage += tokenLog.hasTokenLog ? cacheCreateFromTrustedLog : stateCacheCreate;
        reportCount += tokenLog.entries.length;

        for (const entry of tokenLog.entries) {
            if (entry.atMs <= 0) continue;
            const cache = entry.cacheRead + entry.cacheCreate;
            const visible = visibleTokenUsage(entry);
            if (entry.atMs >= oneHourAgoMs && entry.atMs <= nowMs + 60000) {
                usage1h += visible;
                input1h += entry.input;
                output1h += entry.output;
                cache1h += cache;
            }
            if (entry.atMs < dayAgoMs || entry.atMs > nowMs + 60000) continue;
            usage24h += visible;
            input24h += entry.input;
            output24h += entry.output;
            cache24h += cache;
            addBreakdownValue(runnerBreakdown24h, runnerId, visible);
            addBreakdownValue(modelBreakdown24h, runnerModels.get(runnerId) || "unknown", visible);
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
        autoflow_token_total_count: totalUsage,
        autoflow_token_cache_read_count: cacheReadUsage,
        autoflow_token_cache_create_count: cacheCreateUsage,
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
