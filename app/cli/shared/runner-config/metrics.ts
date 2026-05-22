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

export function runnerTokenAccounting(ctx: ProjectContext, runnerId: string): RunnerTokenAccounting {
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

export function tokenMetricTotals(ctx: ProjectContext, runners = parseRunnerConfig(ctx)): Record<string, number | string> {
    let usage = 0;
    let totalUsage = 0;
    let cacheReadUsage = 0;
    let cacheCreateUsage = 0;

    for (const runner of runners) {
        const runnerId = runner.id || "";
        if (!runnerId) continue;
        const state = readRunnerState(ctx, runnerId);
        const stateCumulative = state.token_source === "llm_reported" ? intState(state, "cumulative_tokens") : 0;
        const stateTotal = state.token_source === "llm_reported" ? intState(state, "cumulative_total_tokens") || stateCumulative : 0;
        const stateCacheRead = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_read_tokens") : 0;
        const stateCacheCreate = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_create_tokens") : 0;
        usage += stateCumulative;
        totalUsage += stateTotal;
        cacheReadUsage += stateCacheRead;
        cacheCreateUsage += stateCacheCreate;
    }

    return {
        autoflow_token_usage_count: usage,
        autoflow_token_total_count: totalUsage,
        autoflow_token_cache_read_count: cacheReadUsage,
        autoflow_token_cache_create_count: cacheCreateUsage,
    };
}
