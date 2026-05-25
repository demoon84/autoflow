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

type CodeMetricEntry = {
    key: string;
    totals: CodeTotals;
    files: Set<string>;
    reportedAtMs: number;
    source: string;
};

function codeMetricKey(rawTicketId: unknown, fallback: string): string {
    const ticketId = String(rawTicketId || "").trim();
    return ticketId ? `ticket:${ticketId}` : fallback;
}

function codeMetricEntryIsBetter(candidate: CodeMetricEntry, current: CodeMetricEntry): boolean {
    if (candidate.reportedAtMs !== current.reportedAtMs) return candidate.reportedAtMs > current.reportedAtMs;
    if (candidate.totals.volume !== current.totals.volume) return candidate.totals.volume > current.totals.volume;
    return candidate.source.localeCompare(current.source) > 0;
}

function upsertCodeMetricEntry(entries: Map<string, CodeMetricEntry>, entry: CodeMetricEntry): void {
    const current = entries.get(entry.key);
    if (!current || codeMetricEntryIsBetter(entry, current)) {
        entries.set(entry.key, entry);
    }
}

function markerReportedAtMs(marker: Record<string, unknown>): number {
    const parsed = Date.parse(String(marker.reported_at || marker.created_at || marker.updated_at || ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

function markerCodeEntry(marker: Record<string, unknown>, markerPath: string): CodeMetricEntry {
    const files = new Set(markerCodeFiles(marker));
    const fallbackFiles = files.size > 0 ? 0 : Math.max(0, intMarker(marker, "code_files_changed_count"));
    return {
        key: codeMetricKey(marker.ticket_id, `marker:${markerPath}`),
        totals: {
            files: files.size + fallbackFiles,
            insertions: Math.max(0, intMarker(marker, "code_insertions_count")),
            deletions: Math.max(0, intMarker(marker, "code_deletions_count")),
            volume: Math.max(0, intMarker(marker, "code_volume_count")),
            net: intMarker(marker, "code_net_delta_count"),
        },
        files,
        reportedAtMs: markerReportedAtMs(marker),
        source: markerPath,
    };
}

function collectMarkerCodeEntries(ctx: ProjectContext): Map<string, CodeMetricEntry> {
    const root = path.join(ctx.boardRoot, "runners", "state", "code-metrics");
    const entries = new Map<string, CodeMetricEntry>();
    let runnerDirs: string[] = [];
    try {
        runnerDirs = fs.readdirSync(root, {withFileTypes: true})
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    } catch {
        return entries;
    }
    for (const runnerDir of runnerDirs) {
        const dir = path.join(root, runnerDir);
        let markerFiles: string[] = [];
        try {
            markerFiles = fs.readdirSync(dir).filter((entry) => entry.endsWith(".json"));
        } catch {
            continue;
        }
        for (const markerFile of markerFiles) {
            const markerPath = path.join(dir, markerFile);
            try {
                const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as Record<string, unknown>;
                upsertCodeMetricEntry(entries, markerCodeEntry(marker, markerPath));
            } catch {
                continue;
            }
        }
    }
    return entries;
}

function runnerIdsWithState(ctx: ProjectContext, runners: Record<string, string>[]): string[] {
    const ids = new Set<string>();
    for (const runner of runners) {
        const id = String(runner.id || "").trim();
        if (id) ids.add(id);
    }
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    try {
        for (const entry of fs.readdirSync(stateDir)) {
            if (entry.endsWith(".state")) ids.add(entry.replace(/\.state$/, ""));
        }
    } catch {}
    return [...ids].sort();
}

function stateCodeEntry(runnerId: string, state: Record<string, string>): CodeMetricEntry | null {
    const totals = {
        files: Math.max(0, intState(state, "cumulative_code_files_changed")),
        insertions: Math.max(0, intState(state, "cumulative_code_insertions")),
        deletions: Math.max(0, intState(state, "cumulative_code_deletions")),
        volume: Math.max(0, intState(state, "cumulative_code_volume")),
        net: intState(state, "cumulative_code_net_delta"),
    };
    const hasPositiveCode = totals.files > 0 || totals.insertions > 0 || totals.deletions > 0 || totals.volume > 0;
    if (!hasPositiveCode && (state.code_source || "none") === "none") return null;
    const reportedAtMs = Date.parse(String(state.last_code_reported_at || ""));
    return {
        key: codeMetricKey(state.last_code_ticket_id, `state:${runnerId}`),
        totals,
        files: new Set<string>(),
        reportedAtMs: Number.isFinite(reportedAtMs) ? reportedAtMs : 0,
        source: `state:${runnerId}`,
    };
}

function addCodeMetricEntryToTotals(entry: CodeMetricEntry, totals: CodeTotals, uniqueFiles: Set<string>): void {
    for (const file of entry.files) uniqueFiles.add(file);
    totals.files += Math.max(0, entry.totals.files - entry.files.size);
    totals.insertions += entry.totals.insertions;
    totals.deletions += entry.totals.deletions;
    totals.volume += entry.totals.volume;
    totals.net += entry.totals.net;
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
    const markerEntries = collectMarkerCodeEntries(ctx);
    const stateEntries = new Map<string, CodeMetricEntry>();
    for (const runnerId of runnerIdsWithState(ctx, runners)) {
        const entry = stateCodeEntry(runnerId, readRunnerState(ctx, runnerId));
        if (!entry || markerEntries.has(entry.key)) continue;
        upsertCodeMetricEntry(stateEntries, entry);
    }
    for (const entry of [...markerEntries.values(), ...stateEntries.values()]) {
        addCodeMetricEntryToTotals(entry, totals, uniqueFiles);
    }
    totals.files += uniqueFiles.size;
    return totals;
}

export type RunnerTokenAccounting = {
    cumulativeTokens: number;
    cumulativeTotalTokens: number;
    cumulativeCacheReadTokens: number;
    cumulativeCacheCreateTokens: number;
    cumulativeLlmRequestCount: number;
    lastTurnTokens: number;
    lastTurnTotalTokens: number;
    lastTurnInputTokens: number;
    lastTurnOutputTokens: number;
    lastTurnCacheReadTokens: number;
    lastTurnCacheCreateTokens: number;
    lastTurnLlmRequestCount: number;
    lastTurnAt: string;
    lastTurnTickId: string;
    tokenSource: string;
    lastTokenUsageSource: string;
};

export function runnerTokenAccounting(ctx: ProjectContext, runnerId: string): RunnerTokenAccounting {
    const state = readRunnerState(ctx, runnerId);
    const hasAccumulatedLlmUsage = state.token_source === "llm_reported";
    const stateCumulative = hasAccumulatedLlmUsage ? intState(state, "cumulative_tokens") : 0;
    const stateCumulativeTotal = hasAccumulatedLlmUsage ? intState(state, "cumulative_total_tokens") || stateCumulative : 0;
    const stateCumulativeCacheRead = hasAccumulatedLlmUsage ? intState(state, "cumulative_cache_read_tokens") || intState(state, "last_turn_cache_read_tokens") : 0;
    const stateCumulativeCacheCreate = hasAccumulatedLlmUsage ? intState(state, "cumulative_cache_create_tokens") || intState(state, "last_turn_cache_create_tokens") : 0;
    const stateRequestCount = hasAccumulatedLlmUsage ? intState(state, "cumulative_llm_request_count") : 0;
    const stateLastTurn = hasAccumulatedLlmUsage ? intState(state, "last_turn_tokens") : 0;
    const stateLastTurnTotal = hasAccumulatedLlmUsage ? intState(state, "last_turn_total_tokens") || stateLastTurn : 0;
    const stateLastCacheRead = hasAccumulatedLlmUsage ? intState(state, "last_turn_cache_read_tokens") : 0;
    const stateLastCacheCreate = hasAccumulatedLlmUsage ? intState(state, "last_turn_cache_create_tokens") : 0;
    return {
        cumulativeTokens: stateCumulative,
        cumulativeTotalTokens: stateCumulativeTotal,
        cumulativeCacheReadTokens: stateCumulativeCacheRead,
        cumulativeCacheCreateTokens: stateCumulativeCacheCreate,
        cumulativeLlmRequestCount: stateRequestCount,
        lastTurnTokens: stateLastTurn,
        lastTurnTotalTokens: stateLastTurnTotal,
        lastTurnInputTokens: hasAccumulatedLlmUsage ? intState(state, "last_turn_input_tokens") : 0,
        lastTurnOutputTokens: hasAccumulatedLlmUsage ? intState(state, "last_turn_output_tokens") : 0,
        lastTurnCacheReadTokens: stateLastCacheRead,
        lastTurnCacheCreateTokens: stateLastCacheCreate,
        lastTurnLlmRequestCount: hasAccumulatedLlmUsage ? intState(state, "last_turn_llm_request_count") : 0,
        lastTurnAt: hasAccumulatedLlmUsage ? state.last_turn_at || "" : "",
        lastTurnTickId: hasAccumulatedLlmUsage ? state.last_turn_tick_id || "" : "",
        tokenSource: hasAccumulatedLlmUsage ? state.token_source || "none" : "none",
        lastTokenUsageSource: hasAccumulatedLlmUsage ? state.last_token_usage_source || state.token_source || "none" : "none",
    };
}

function canonicalTokenRole(value: string): string {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "planner" || normalized === "plan" || /^(planner|plan)-/.test(normalized)) return "planner";
    if (normalized === "worker" || normalized === "ticket" || /^(worker|ai)-/.test(normalized)) return "worker";
    if (normalized === "verifier" || normalized === "verify" || /^verifier-/.test(normalized)) return "verifier";
    if (normalized === "wiki" || normalized === "wiki-maintainer" || /^(wiki|wiki-maintainer)-/.test(normalized)) {
        return "wiki";
    }
    return "";
}

function inferTokenRoleFromState(runner: Record<string, string>, state: Record<string, string>): string {
    const candidates = [
        state.last_turn_role,
        state.active_role,
        state.assignment_role,
        state.role,
        runner.role,
    ];
    for (const candidate of candidates) {
        const role = canonicalTokenRole(candidate || "");
        if (role) return role;
    }

    const stage = String(state.active_stage || "").toLowerCase();
    const signal = [
        state.last_result,
        state.last_log_line,
        state.active_item,
        state.active_ticket_id,
        state.active_ticket_path,
        state.assigned_item_ref,
    ].join(" ").toLowerCase();
    if (/^verifier[_-]/.test(stage) || /\bverifier[_-]|\bverifier\b/.test(signal)) return "verifier";
    if (/^(planning|generating-todo)$/.test(stage) || /\bplanner[_-]|\bprd-to-todo\b|\btodo_ticket=/.test(signal)) {
        return "planner";
    }
    if (/\bwiki[_-]|\bwiki-maintainer\b|\bllm wiki\b/.test(signal)) return "wiki";
    if (/^(claimed|executing|inprogress|verify_pending|verifier_pending|merging)$/.test(stage)) {
        return "worker";
    }
    if (String(state.active_ticket_id || "").startsWith("PRD-")) return "planner";
    if (String(state.active_ticket_id || "")) return "worker";
    return "unknown";
}

type TokenHistoryEntry = {
    atMs: number;
    visible: number;
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate: number;
};

function nonNegativeInt(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? "0"), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function tokenHistoryPath(ctx: ProjectContext, runnerId: string): string {
    return path.join(ctx.boardRoot, "runners", "state", `${safeSegment(runnerId)}.tokens-history.jsonl`);
}

function readTokenHistoryEntries(ctx: ProjectContext, runnerId: string): TokenHistoryEntry[] {
    let raw = "";
    try {
        raw = fs.readFileSync(tokenHistoryPath(ctx, runnerId), "utf8");
    } catch {
        return [];
    }

    const entries: TokenHistoryEntry[] = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const atMs = Date.parse(String(parsed.at || ""));
            if (!Number.isFinite(atMs) || atMs <= 0) continue;
            const input = nonNegativeInt(parsed.input);
            const output = nonNegativeInt(parsed.output);
            entries.push({
                atMs,
                visible: input + output,
                input,
                output,
                cacheRead: nonNegativeInt(parsed.cacheRead),
                cacheCreate: nonNegativeInt(parsed.cacheCreate),
            });
        } catch {
            continue;
        }
    }
    return entries;
}

export function tokenMetricTotals(ctx: ProjectContext, runners = parseRunnerConfig(ctx)): Record<string, number | string> {
    let usage = 0;
    let totalUsage = 0;
    let cacheReadUsage = 0;
    let cacheCreateUsage = 0;
    let requestCount = 0;
    let usage1h = 0;
    let usage24h = 0;
    let input1h = 0;
    let output1h = 0;
    let cache1h = 0;
    let input24h = 0;
    let output24h = 0;
    let cache24h = 0;
    const runnerBreakdown24h: Record<string, number> = {};
    const roleBreakdown24h: Record<string, number> = {};
    const modelBreakdown24h: Record<string, number> = {};
    const hourly24h = new Map<number, { hour: number; input: number; output: number; cache: number }>();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    for (const runner of runners) {
        const runnerId = runner.id || "";
        if (!runnerId) continue;
        const state = readRunnerState(ctx, runnerId);
        const stateCumulative = state.token_source === "llm_reported" ? intState(state, "cumulative_tokens") : 0;
        const stateTotal = state.token_source === "llm_reported" ? intState(state, "cumulative_total_tokens") || stateCumulative : 0;
        const stateCacheRead = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_read_tokens") : 0;
        const stateCacheCreate = state.token_source === "llm_reported" ? intState(state, "cumulative_cache_create_tokens") : 0;
        const stateRequestCount = state.token_source === "llm_reported" ? intState(state, "cumulative_llm_request_count") : 0;
        usage += stateCumulative;
        totalUsage += stateTotal;
        cacheReadUsage += stateCacheRead;
        cacheCreateUsage += stateCacheCreate;
        if (stateRequestCount > 0) {
            requestCount += stateRequestCount;
        } else if (state.token_source === "llm_reported" && (state.last_turn_tick_id || stateCumulative > 0)) {
            requestCount += 1;
        }

        const historyEntries = readTokenHistoryEntries(ctx, runnerId);
        const windowEntries = historyEntries.length > 0
            ? historyEntries
            : (() => {
                const lastTurnAtMs = Date.parse(state.last_turn_at || "");
                if (!Number.isFinite(lastTurnAtMs) || lastTurnAtMs <= 0) return [];
                return [{
                    atMs: lastTurnAtMs,
                    visible: intState(state, "last_turn_tokens"),
                    input: intState(state, "last_turn_input_tokens"),
                    output: intState(state, "last_turn_output_tokens"),
                    cacheRead: intState(state, "last_turn_cache_read_tokens"),
                    cacheCreate: intState(state, "last_turn_cache_create_tokens"),
                }];
            })();

        for (const entry of windowEntries) {
            if (entry.atMs < twentyFourHoursAgo || entry.atMs > now + 60_000) continue;

            const entryVisible = entry.visible;
            const entryCache = entry.cacheRead + entry.cacheCreate;
            usage24h += entryVisible;
            input24h += entry.input;
            output24h += entry.output;
            cache24h += entryCache;

            runnerBreakdown24h[runnerId] = (runnerBreakdown24h[runnerId] || 0) + entryVisible;
            const role = inferTokenRoleFromState(runner, state);
            roleBreakdown24h[role] = (roleBreakdown24h[role] || 0) + entryVisible;
            const model = runner.model || state.model || "unknown";
            modelBreakdown24h[model] = (modelBreakdown24h[model] || 0) + entryVisible;

            const hour = Math.floor(entry.atMs / (60 * 60 * 1000)) * 3600;
            const bucket = hourly24h.get(hour) || {hour, input: 0, output: 0, cache: 0};
            bucket.input += entry.input;
            bucket.output += entry.output;
            bucket.cache += entryCache;
            hourly24h.set(hour, bucket);

            if (entry.atMs >= oneHourAgo) {
                usage1h += entryVisible;
                input1h += entry.input;
                output1h += entry.output;
                cache1h += entryCache;
            }
        }
    }

    return {
        autoflow_token_usage_count: usage,
        autoflow_token_total_count: totalUsage,
        autoflow_token_cache_read_count: cacheReadUsage,
        autoflow_token_cache_create_count: cacheCreateUsage,
        autoflow_token_report_count: requestCount,
        autoflow_llm_request_count: requestCount,
        autoflow_token_usage_1h_count: usage1h,
        autoflow_token_usage_24h_count: usage24h,
        autoflow_token_input_1h_count: input1h,
        autoflow_token_output_1h_count: output1h,
        autoflow_token_cache_1h_count: cache1h,
        autoflow_token_input_24h_count: input24h,
        autoflow_token_output_24h_count: output24h,
        autoflow_token_cache_24h_count: cache24h,
        autoflow_token_runner_breakdown_24h_json: JSON.stringify(runnerBreakdown24h),
        autoflow_token_role_breakdown_24h_json: JSON.stringify(roleBreakdown24h),
        autoflow_token_model_breakdown_24h_json: JSON.stringify(modelBreakdown24h),
        autoflow_token_hourly_24h_json: JSON.stringify([...hourly24h.values()].sort((left, right) => left.hour - right.hour)),
    };
}
