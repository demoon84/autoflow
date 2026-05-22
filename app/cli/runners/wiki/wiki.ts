import * as shared from "../../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

type WikiProjectContext = {
    projectRoot: string;
    boardDirName: string;
    boardRoot: string;
};

type WikiChunk = {
    chunkId: number;
    relPath: string;
    sourceGroup: string;
    title: string;
    text: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
    contentSha: string;
};

type WikiIndexStats = {
    status: "ok" | "skipped";
    reason?: string;
    dbPath: string;
    indexedFiles: number;
    indexedChunks: number;
    vectorCount: number;
    sourceHash: string;
    vectorDim: number;
    vectorModel: string;
    bm25Ready: boolean;
    lexicalBackend: string;
    textStorage: string;
    vectorStorage: string;
    embeddingProvider: string;
};

type VectorRow = {
    chunk_id: number;
    path: string;
    source_group: string;
    title: string;
    chunk_start_offset: number;
    chunk_end_offset: number;
    chunk_start_line: number;
    chunk_end_line: number;
    content_sha: string;
    chunk_text?: string | null;
    vector_hex?: string | null;
};

type StoredVectorRow = {
    chunk_id: number;
    path?: string;
    chunk_start_offset?: number;
    chunk_end_offset?: number;
    content_sha?: string;
    vector_json?: string | null;
    vector_hex?: string | null;
};

type VectorMatch = {
    relPath: string;
    title: string;
    text: string;
    startLine: number;
    endLine: number;
    score: number;
    vectorScore?: number;
    bm25Score?: number;
    contentSha?: string;
};

const WIKI_CHUNK_SIZE = 1024;
const WIKI_CHUNK_OVERLAP = 128;
const DEFAULT_VECTOR_MODEL = "BAAI/bge-m3";
const DEFAULT_VECTOR_DIM = 1024;
const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_LEXICAL_WEIGHT = 0.3;
const HYBRID_SCHEMA_VERSION = "2";
const HYBRID_LEXICAL_BACKEND = "source_scan";
const HYBRID_TEXT_STORAGE = "db_inline";
const HYBRID_VECTOR_STORAGE = "float32_blob";

function recencyEnabled(): boolean {
    return (process.env.AUTOFLOW_WIKI_RECENCY_ENABLED ?? "1") !== "0";
}

function recencyHalfLifeDays(): number {
    const parsed = Number.parseInt(process.env.AUTOFLOW_WIKI_RECENCY_HALF_LIFE_DAYS || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
}

function recencyFloor(): number {
    const parsed = Number.parseFloat(process.env.AUTOFLOW_WIKI_RECENCY_FLOOR || "");
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    return 0.3;
}

function frontmatterUpdatedMs(file: string): number {
    try {
        const head = fs.readFileSync(file, "utf8").slice(0, 4096);
        if (!head.startsWith("---")) return 0;
        const end = head.indexOf("\n---", 3);
        if (end < 0) return 0;
        const block = head.slice(3, end);
        const match = block.match(/^updated\s*:\s*['"]?(\S+?)['"]?\s*$/m);
        if (!match) return 0;
        const parsed = Date.parse(match[1]);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
}

type PageStatus = {
    superseded: boolean;
    supersededBy: string;
    status: string;
};

function readPageStatus(file: string): PageStatus {
    const empty: PageStatus = {superseded: false, supersededBy: "", status: ""};
    try {
        const head = fs.readFileSync(file, "utf8").slice(0, 4096);
        if (!head.startsWith("---")) return empty;
        const end = head.indexOf("\n---", 3);
        if (end < 0) return empty;
        const block = head.slice(3, end);
        const supersededByMatch = block.match(/^superseded_by\s*:\s*['"]?(.+?)['"]?\s*$/m);
        const statusMatch = block.match(/^status\s*:\s*['"]?(.+?)['"]?\s*$/m);
        const supersededBy = supersededByMatch ? supersededByMatch[1].trim() : "";
        const status = statusMatch ? statusMatch[1].trim().toLowerCase() : "";
        return {
            superseded: Boolean(supersededBy) || status === "superseded" || status === "deprecated",
            supersededBy,
            status,
        };
    } catch {
        return empty;
    }
}

function supersedeEnabled(): boolean {
    return (process.env.AUTOFLOW_WIKI_SUPERSEDE_ENABLED ?? "1") !== "0";
}

function supersedePenalty(): number {
    const parsed = Number.parseFloat(process.env.AUTOFLOW_WIKI_SUPERSEDE_PENALTY || "");
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    return 0.15;
}

function usageTrackingEnabled(): boolean {
    return (process.env.AUTOFLOW_WIKI_USAGE_TRACKING_ENABLED ?? "1") !== "0";
}

function usageBoostThreshold(): number {
    const parsed = Number.parseInt(process.env.AUTOFLOW_WIKI_USAGE_BOOST_THRESHOLD || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

function usageBoostWeight(): number {
    const parsed = Number.parseFloat(process.env.AUTOFLOW_WIKI_USAGE_BOOST_WEIGHT || "");
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    return 0.15;
}

function readChunkUsageMap(dbPath: string): Map<string, number> {
    const out = new Map<string, number>();
    if (!fs.existsSync(dbPath) || !sqliteAvailable()) return out;
    try {
        const rows = sqliteJson<{content_sha: string; hit_count: number}>(dbPath,
            "SELECT content_sha, hit_count FROM wiki_chunk_usage");
        for (const row of rows) {
            const sha = String(row.content_sha || "");
            const count = Number(row.hit_count) || 0;
            if (sha) out.set(sha, count);
        }
    } catch {
        // table may not exist yet; treat as empty
    }
    return out;
}

function recordChunkUsage(dbPath: string, shas: string[]): void {
    if (!shas.length || !sqliteAvailable()) return;
    const unique = Array.from(new Set(shas.filter(Boolean)));
    if (!unique.length) return;
    const at = new Date().toISOString();
    const stmts: string[] = [
        "CREATE TABLE IF NOT EXISTS wiki_chunk_usage (content_sha TEXT PRIMARY KEY, hit_count INTEGER NOT NULL DEFAULT 0, last_retrieved_at TEXT);",
        "BEGIN;",
    ];
    for (const sha of unique) {
        const escSha = sqlEsc(sha);
        const escAt = sqlEsc(at);
        stmts.push(
            `INSERT INTO wiki_chunk_usage (content_sha, hit_count, last_retrieved_at) VALUES ('${escSha}', 1, '${escAt}') ON CONFLICT(content_sha) DO UPDATE SET hit_count = hit_count + 1, last_retrieved_at = '${escAt}';`
        );
    }
    stmts.push("COMMIT;");
    sqliteExec(dbPath, stmts.join("\n"));
}

function usageWeight(hitCount: number, threshold: number, boostWeight: number): number {
    if (hitCount <= 0 || threshold <= 0 || boostWeight <= 0) return 1;
    const ratio = Math.log(1 + hitCount) / Math.log(1 + threshold);
    return 1 + boostWeight * Math.min(1, ratio);
}

function dedupEnabled(): boolean {
    return (process.env.AUTOFLOW_WIKI_DEDUP_ENABLED ?? "1") !== "0";
}

function dedupThreshold(): number {
    const parsed = Number.parseFloat(process.env.AUTOFLOW_WIKI_DEDUP_THRESHOLD || "");
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    return 0.85;
}

function pageRecencyWeight(absPath: string, halfLifeDays: number, floor: number, cache: Map<string, number>): number {
    if (cache.has(absPath)) return cache.get(absPath) as number;
    let ms = frontmatterUpdatedMs(absPath);
    if (!ms) {
        try { ms = fs.statSync(absPath).mtimeMs || 0; } catch { ms = 0; }
    }
    let weight = 1;
    if (ms > 0) {
        const ageDays = Math.max(0, (Date.now() - ms) / (24 * 60 * 60 * 1000));
        const decayed = halfLifeDays > 0 ? halfLifeDays / (halfLifeDays + ageDays) : 1;
        weight = floor + (1 - floor) * decayed;
    }
    cache.set(absPath, weight);
    return weight;
}
const TELEMETRY_DEFAULT_SLUGS = ["runner-health", "runner-timing", "prompt-evolution"];

type RunnerTelemetrySnapshot = {
    id: string;
    role: string;
    agent: string;
    model: string;
    reasoning: string;
    mode: string;
    enabled: string;
    intervalSeconds: string;
    effectiveStatus: string;
    stateStatus: string;
    lastResult: string;
    lastEventAt: string;
    lastTurnAt: string;
    lastTurnTokens: number;
    cumulativeTokens: number;
    tokenSource: string;
    startedAt: string;
    updatedAt: string;
    lastStopReason: string;
    activeItem: string;
    activeTicketId: string;
    activeStage: string;
    codeFilesChanged: number;
    codeVolume: number;
};

type TelemetrySummaryResult = {
    slug: string;
    relPath: string;
    file: string;
    summaryStatus: "updated" | "skipped_unchanged";
};

function boolish(value: string, defaultValue: boolean): string {
    const raw = String(value || "").trim();
    if (!raw) return defaultValue ? "true" : "false";
    return /^(1|true|yes|on)$/i.test(raw) ? "true" : "false";
}

function stateValue(state: Record<string, string>, ...keys: string[]): string {
    for (const key of keys) {
        const value = state[key];
        if (value) return value;
    }
    return "";
}

function lastResultForTelemetry(state: Record<string, string>, effectiveStatus: string): string {
    const value = stateValue(state, "last_result", "last_stop_reason");
    if (effectiveStatus === "stopped" && /^signal_/i.test(value)) {
        return "loop_stopped";
    }
    return value;
}

function isRemovedLegacyRunner(id: string, role: string): boolean {
    return id === "self-improve-1" || role === "self-improve";
}

function runnerRoleLabel(role: string): string {
    switch (role) {
        case "planner":
            return "planner (플래너 러너)";
        case "worker":
        case "ticket":
            return "worker (워커 러너)";
        case "verifier":
            return "verifier (검증 러너)";
        case "wiki":
        case "wiki-maintainer":
            return "wiki (위키 러너)";
        default:
            return role || "unknown";
    }
}

function tableCell(value: unknown): string {
    const text = String(value ?? "");
    return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim() || "-";
}

function markdownTable(headers: string[], rows: unknown[][]): string {
    const header = `| ${headers.map(tableCell).join(" | ")} |`;
    const divider = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.length > 0
        ? rows.map((row) => `| ${row.map(tableCell).join(" | ")} |`).join("\n")
        : `| ${headers.map((_, index) => index === 0 ? "No runners found" : "-").join(" | ")} |`;
    return `${header}\n${divider}\n${body}`;
}

function runnerSnapshots(ctx: WikiProjectContext): RunnerTelemetrySnapshot[] {
    const configs = parseRunnerConfig(ctx);
    const configById = new Map(configs.map((item) => [item.id, item]));
    const ids = new Set(configs.map((item) => item.id).filter(Boolean));
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    try {
        for (const name of fs.readdirSync(stateDir)) {
            if (name.endsWith(".state")) ids.add(path.basename(name, ".state"));
        }
    } catch {
        // Missing runner state is valid for a fresh board.
    }

    return [...ids].sort((a, b) => {
        const left = configs.findIndex((item) => item.id === a);
        const right = configs.findIndex((item) => item.id === b);
        if (left >= 0 && right >= 0) return left - right;
        if (left >= 0) return -1;
        if (right >= 0) return 1;
        return a.localeCompare(b);
    }).map((id) => {
        const config = configById.get(id) || {};
        const state = readRunnerState(ctx, id);
        const role = stateValue(state, "role") || config.role || "";
        const effectiveStatus = runnerEffectiveStateStatus(state);
        return {
            id,
            role,
            agent: stateValue(state, "agent") || config.agent || "",
            model: stateValue(state, "model") || config.model || "",
            reasoning: stateValue(state, "reasoning") || config.reasoning || "",
            mode: stateValue(state, "mode") || config.mode || "",
            enabled: boolish(config.enabled, true),
            intervalSeconds: config.interval_seconds || "",
            effectiveStatus,
            stateStatus: state.status || "",
            lastResult: lastResultForTelemetry(state, effectiveStatus),
            lastEventAt: stateValue(state, "last_event_at", "updated_at"),
            lastTurnAt: state.last_turn_at || "",
            lastTurnTokens: intState(state, "last_turn_tokens"),
            cumulativeTokens: intState(state, "cumulative_tokens"),
            tokenSource: stateValue(state, "token_source", "last_token_usage_source"),
            startedAt: state.started_at || "",
            updatedAt: state.updated_at || "",
            lastStopReason: state.last_stop_reason || "",
            activeItem: stateValue(state, "active_item", "active_ticket_title"),
            activeTicketId: state.active_ticket_id || "",
            activeStage: state.active_stage || "",
            codeFilesChanged: intState(state, "cumulative_code_files_changed"),
            codeVolume: intState(state, "cumulative_code_volume"),
        };
    }).filter((runner) => !isRemovedLegacyRunner(runner.id, runner.role));
}

function summaryHeader(title: string, ctx: WikiProjectContext, window: string): string {
    return [
        `# ${title}`,
        "",
        `출처: ${ctx.boardDirName}/runners/config.toml 및 ${ctx.boardDirName}/runners/state/*.state 에서 생성됨.`,
        `기간: ${window}`,
        "",
    ].join("\n");
}

function renderRunnerHealth(ctx: WikiProjectContext, window: string, snapshots: RunnerTelemetrySnapshot[]): string {
    return `${summaryHeader("러너 상태", ctx, window)}${markdownTable(
        ["러너", "역할", "활성화", "유효 상태", "상태 파일", "최근 결과", "진행 중", "최근 이벤트"],
        snapshots.map((runner) => [
            runner.id,
            runnerRoleLabel(runner.role),
            runner.enabled,
            runner.effectiveStatus,
            runner.stateStatus,
            runner.lastResult,
            [runner.activeTicketId, runner.activeStage, runner.activeItem].filter(Boolean).join(" / "),
            runner.lastEventAt,
        ])
    )}\n`;
}

function renderRunnerTiming(ctx: WikiProjectContext, window: string, snapshots: RunnerTelemetrySnapshot[]): string {
    return `${summaryHeader("러너 타이밍", ctx, window)}${markdownTable(
        ["러너", "모드", "간격(초)", "시작 시각", "갱신 시각", "최근 이벤트", "최근 중지 사유"],
        snapshots.map((runner) => [
            runner.id,
            runner.mode,
            runner.intervalSeconds,
            runner.startedAt,
            runner.updatedAt,
            runner.lastEventAt,
            runner.lastStopReason,
        ])
    )}\n`;
}

function renderPromptEvolution(ctx: WikiProjectContext, window: string, snapshots: RunnerTelemetrySnapshot[]): string {
    return `${summaryHeader("프롬프트 변화", ctx, window)}${markdownTable(
        ["러너", "에이전트", "모델", "추론", "최근 턴", "최근 턴 토큰", "누적 토큰", "토큰 출처", "코드 변경량"],
        snapshots.map((runner) => [
            runner.id,
            runner.agent,
            runner.model,
            runner.reasoning,
            runner.lastTurnAt,
            runner.lastTurnTokens,
            runner.cumulativeTokens,
            runner.tokenSource,
            runner.codeVolume || runner.codeFilesChanged ? `${runner.codeVolume} volume / ${runner.codeFilesChanged} files` : "",
        ])
    )}\n`;
}

function telemetrySummaryRelPath(slug: string): string {
    switch (slug) {
        case "runner-health":
            return "metrics/wiki/runner-health.md";
        case "runner-timing":
            return "metrics/wiki/runner-timing.md";
        case "prompt-evolution":
            return "metrics/wiki/prompt-evolution.md";
        default:
            return fail(`Unknown telemetry summary slug: ${slug}`);
    }
}

function renderTelemetrySummary(slug: string, ctx: WikiProjectContext, window: string, snapshots: RunnerTelemetrySnapshot[]): string {
    switch (slug) {
        case "runner-health":
            return renderRunnerHealth(ctx, window, snapshots);
        case "runner-timing":
            return renderRunnerTiming(ctx, window, snapshots);
        case "prompt-evolution":
            return renderPromptEvolution(ctx, window, snapshots);
        default:
            return fail(`Unknown telemetry summary slug: ${slug}`);
    }
}

function writeTelemetrySummary(ctx: WikiProjectContext, slug: string, content: string): TelemetrySummaryResult {
    const relPath = telemetrySummaryRelPath(slug);
    const file = path.join(ctx.boardRoot, relPath);
    let existing = "";
    try {
        existing = fs.readFileSync(file, "utf8");
    } catch {
        existing = "";
    }
    if (existing === content) {
        return {slug, relPath, file, summaryStatus: "skipped_unchanged"};
    }
    writeFileAtomic(file, content);
    return {slug, relPath, file, summaryStatus: "updated"};
}

function telemetrySlugs(parsed: shared.ParsedArgs): {slugSet: string; slugs: string[]} {
    const explicit = allFlags(parsed, "slug")
        .flatMap((value) => value.split(/[,\s]+/))
        .map((value) => value.trim())
        .filter(Boolean);
    const slugSet = firstFlag(parsed, "slug-set") || (explicit.length > 0 ? "custom" : "telemetry-default");
    if (slugSet !== "telemetry-default" && slugSet !== "custom") {
        fail(`Unknown telemetry summary slug set: ${slugSet}`);
    }
    const slugs = explicit.length > 0 ? explicit : TELEMETRY_DEFAULT_SLUGS;
    for (const slug of slugs) telemetrySummaryRelPath(slug);
    return {slugSet, slugs: [...new Set(slugs)]};
}

function summarizeTelemetry(ctx: WikiProjectContext, parsed: shared.ParsedArgs): void {
    ensureBoard(ctx);
    const window = firstFlag(parsed, "window") || "7d";
    const {slugSet, slugs} = telemetrySlugs(parsed);
    const snapshots = runnerSnapshots(ctx);
    const results = slugs.map((slug) => writeTelemetrySummary(
        ctx,
        slug,
        renderTelemetrySummary(slug, ctx, window, snapshots)
    ));

    out("status=ok");
    out("telemetry_command=summarize-telemetry");
    out(`slug_set=${slugSet}`);
    out(`window=${window}`);
    out(`summary_count=${results.length}`);
    results.forEach((result, index) => {
        const prefix = `summary.${index + 1}`;
        out(`${prefix}.slug=${result.slug}`);
        out(`${prefix}.path=${result.file}`);
        out(`${prefix}.rel_path=${result.relPath}`);
        out(`${prefix}.summary_status=${result.summaryStatus}`);
    });
}

function vectorDim(): number {
    const parsed = Number.parseInt(process.env.AUTOFLOW_WIKI_VECTOR_DIM || "", 10);
    return parsed > 0 ? parsed : DEFAULT_VECTOR_DIM;
}

function vectorModel(): string {
    return process.env.AUTOFLOW_WIKI_VECTOR_MODEL || DEFAULT_VECTOR_MODEL;
}

function wikiIndexDbPath(ctx: WikiProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "state", "wiki-search.db");
}

function sqliteAvailable(): boolean {
    const result = spawnSync("sqlite3", ["-version"], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000});
    return result.status === 0;
}

function sqlEsc(value: unknown): string {
    return String(value ?? "").replace(/'/g, "''");
}

function sqliteExec(dbPath: string, sql: string): boolean {
    const result = spawnSync("sqlite3", [dbPath], {
        input: sql,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 128 * 1024 * 1024,
    });
    if (result.status !== 0) {
        const detail = oneLine(result.stderr || result.stdout || "sqlite3 failed");
        if (detail) err(`wiki_index_sqlite_error=${detail}`);
        return false;
    }
    return true;
}

function sqliteJson<T>(dbPath: string, sql: string): T[] {
    const result = spawnSync("sqlite3", ["-json", dbPath, sql], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 512 * 1024 * 1024,
    });
    if (result.status !== 0 || !result.stdout.trim()) return [];
    try {
        const parsed = JSON.parse(result.stdout) as unknown;
        return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
        return [];
    }
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
}

function resolveTsxCli(): string {
    try {
        return require.resolve("tsx/cli", {paths: [REPO_ROOT]}) as string;
    } catch {
        return "";
    }
}

function resolveEmbeddingProvider(ctx: WikiProjectContext): string {
    if (process.env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER) {
        return process.env.AUTOFLOW_WIKI_EMBEDDING_PROVIDER;
    }

    const scriptPath = path.join(REPO_ROOT, "app", "runtime", "runners", "wiki", "scripts", "wiki-embed.ts");
    if (!fs.existsSync(scriptPath)) return "";

    const tsxCli = resolveTsxCli();
    if (tsxCli) {
        return `${shellQuote(process.execPath)} ${shellQuote(tsxCli)} ${shellQuote(scriptPath)}`;
    }

    const npxProbe = spawnSync("npx", ["tsx", "--version"], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000});
    if (npxProbe.status === 0) {
        return `npx tsx ${shellQuote(scriptPath)}`;
    }
    return "";
}

function embeddingEnv(ctx: WikiProjectContext): NodeJS.ProcessEnv {
    return {
        AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
        AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
        BOARD_ROOT: ctx.boardRoot,
        PROJECT_ROOT: ctx.projectRoot,
    };
}

function runEmbeddingProvider(command: string, input: string, extraArgs: string[] = [], timeoutMs = 60000, outputFile = false, envExtra: NodeJS.ProcessEnv = {}): string {
    if (!command) return "";
    const fullCommand = [command, ...extraArgs.map(shellQuote)].join(" ");
    const tempOut = outputFile
        ? path.join(process.env.TMPDIR || "/tmp", `autoflow-wiki-embed-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
        : "";
    const result = spawnSync(fullCommand, {
        shell: true,
        input,
        env: tempOut ? {...process.env, ...envExtra, AUTOFLOW_WIKI_EMBED_OUTPUT_FILE: tempOut} : {...process.env, ...envExtra},
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeoutMs,
        maxBuffer: 128 * 1024 * 1024,
    });
    try {
        if (result.status !== 0) return "";
        if (tempOut && fs.existsSync(tempOut)) {
            return fs.readFileSync(tempOut, "utf8").trim();
        }
        return (result.stdout || "").trim();
    } finally {
        if (tempOut) {
            try {
                fs.rmSync(tempOut, {force: true});
            } catch {
                // Best-effort cleanup for temp embedding output.
            }
        }
    }
}

function validVector(value: unknown, expectedDim: number): number[] | null {
    if (!Array.isArray(value) || value.length !== expectedDim) return null;
    const vector = value.map((item) => Number(item));
    return vector.every((item) => Number.isFinite(item)) ? vector : null;
}

function vectorToBlobHex(vector: number[]): string {
    const buffer = Buffer.allocUnsafe(vector.length * 4);
    for (let index = 0; index < vector.length; index += 1) {
        buffer.writeFloatLE(vector[index], index * 4);
    }
    return buffer.toString("hex");
}

function vectorFromBlobHex(hex: string | null | undefined, expectedDim: number): number[] | null {
    const normalized = String(hex || "").trim();
    if (!normalized || normalized.length !== expectedDim * 8 || /[^0-9a-f]/i.test(normalized)) return null;
    const buffer = Buffer.from(normalized, "hex");
    if (buffer.length !== expectedDim * 4) return null;
    const vector: number[] = [];
    for (let index = 0; index < expectedDim; index += 1) {
        const value = buffer.readFloatLE(index * 4);
        if (!Number.isFinite(value)) return null;
        vector.push(value);
    }
    return vector;
}

function embedTexts(command: string, texts: string[], expectedDim: number, envExtra: NodeJS.ProcessEnv = {}): (number[] | null)[] {
    if (!command || texts.length === 0) return texts.map(() => null);

    if (texts.length === 1) {
        const singleOut = runEmbeddingProvider(command, texts[0], [], 60000, false, envExtra);
        if (!singleOut) return [null];
        try {
            return [validVector(JSON.parse(singleOut) as unknown, expectedDim)];
        } catch {
            return [null];
        }
    }

    const batchOut = runEmbeddingProvider(command, JSON.stringify(texts), ["--batch"], Math.max(60000, texts.length * 5000), true, envExtra);
    if (batchOut) {
        try {
            const parsed = JSON.parse(batchOut) as unknown;
            if (Array.isArray(parsed) && parsed.length === texts.length) {
                return parsed.map((item) => validVector(item, expectedDim));
            }
        } catch {
            return texts.map(() => null);
        }
    }
    return texts.map(() => null);
}

function embedQuery(command: string, terms: string[], expectedDim: number, envExtra: NodeJS.ProcessEnv = {}): number[] | null {
    const text = terms.join("\n").trim();
    if (!text) return null;
    return embedTexts(command, [text], expectedDim, envExtra)[0] || null;
}

function lineStarts(text: string): number[] {
    const starts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === "\n") starts.push(index + 1);
    }
    return starts;
}

function lineAtOffset(starts: number[], offset: number): number {
    let low = 0;
    let high = starts.length - 1;
    let found = 0;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (starts[mid] <= offset) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return found + 1;
}

function firstNonEmptyLine(text: string): string {
    return text.split(/\r?\n/).find((line) => line.trim())?.trim() || "";
}

function sourceGroupForRelPath(relPath: string): string {
    return relPath.startsWith("tickets/done/") ? "tickets_done" : "wiki";
}

function chunkifyContent(text: string, relPath: string): Omit<WikiChunk, "chunkId">[] {
    if (!text.trim()) return [];
    const title = firstNonEmptyLine(text);
    const contentSha = crypto.createHash("sha256").update(text).digest("hex");
    const starts = lineStarts(text);
    const chunks: Omit<WikiChunk, "chunkId">[] = [];
    const step = Math.max(1, WIKI_CHUNK_SIZE - WIKI_CHUNK_OVERLAP);
    for (let start = 0; start < text.length; start += step) {
        const end = Math.min(text.length, start + WIKI_CHUNK_SIZE);
        const chunkContent = text.slice(start, end).trim();
        if (!chunkContent) {
            if (end >= text.length) break;
            continue;
        }
        chunks.push({
            relPath,
            sourceGroup: sourceGroupForRelPath(relPath),
            title,
            text: chunkContent,
            startOffset: start,
            endOffset: end,
            startLine: lineAtOffset(starts, start),
            endLine: lineAtOffset(starts, Math.max(start, end - 1)),
            contentSha,
        });
        if (end >= text.length) break;
    }
    return chunks;
}

function collectWikiFiles(ctx: WikiProjectContext, includeTickets: boolean): string[] {
    return [
        ...(includeTickets ? walkMarkdownFiles(path.join(ctx.boardRoot, "tickets", "done")) : []),
    ].sort((a, b) => a.localeCompare(b));
}

function collectWikiChunks(ctx: WikiProjectContext, includeTickets: boolean): {chunks: WikiChunk[]; fileCount: number; sourceHash: string} {
    const files = collectWikiFiles(ctx, includeTickets);
    const chunks: WikiChunk[] = [];
    const hash = crypto.createHash("sha256");
    let chunkId = 1;

    for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        if (!text.trim()) continue;
        const relPath = path.relative(ctx.boardRoot, file);
        const title = firstNonEmptyLine(text);
        const contentSha = crypto.createHash("sha256").update(text).digest("hex");
        const starts = lineStarts(text);
        hash.update(relPath).update("\0").update(contentSha).update("\0");

        const step = Math.max(1, WIKI_CHUNK_SIZE - WIKI_CHUNK_OVERLAP);
        for (let start = 0; start < text.length; start += step) {
            const end = Math.min(text.length, start + WIKI_CHUNK_SIZE);
            const chunkText = text.slice(start, end).trim();
            if (!chunkText) continue;
            chunks.push({
                chunkId,
                relPath,
                sourceGroup: sourceGroupForRelPath(relPath),
                title,
                text: chunkText,
                startOffset: start,
                endOffset: end,
                startLine: lineAtOffset(starts, start),
                endLine: lineAtOffset(starts, Math.max(start, end - 1)),
                contentSha,
            });
            chunkId += 1;
            if (end >= text.length) break;
        }
    }

    return {chunks, fileCount: files.length, sourceHash: hash.digest("hex")};
}

function readIndexMeta(dbPath: string): Record<string, string> {
    if (!fs.existsSync(dbPath) || !sqliteAvailable()) return {};
    const rows = sqliteJson<{key: string; value: string}>(dbPath, "SELECT key, value FROM wiki_index_meta");
    const meta: Record<string, string> = {};
    for (const row of rows) meta[String(row.key)] = String(row.value);
    return meta;
}

function chunkReuseKey(chunk: Pick<WikiChunk, "relPath" | "startOffset" | "endOffset" | "contentSha">): string {
    return [chunk.relPath, chunk.startOffset, chunk.endOffset, chunk.contentSha].join("\0");
}

function rowReuseKey(row: StoredVectorRow): string {
    return [String(row.path || ""), Number(row.chunk_start_offset) || 0, Number(row.chunk_end_offset) || 0, String(row.content_sha || "")].join("\0");
}

function reusableStoredVectors(ctx: WikiProjectContext, chunks: WikiChunk[], includeTickets: boolean, expectedDim: number, expectedModel: string): {vectors: (number[] | null)[]; reusedCount: number} | null {
    const dbPath = wikiIndexDbPath(ctx);
    if (!fs.existsSync(dbPath) || !sqliteAvailable()) return null;
    const meta = readIndexMeta(dbPath);
    if (meta.backend !== "hybrid") return null;
    if ((meta.include_tickets || "") !== (includeTickets ? "true" : "false")) return null;
    if (Number(meta.vector_dim) !== expectedDim) return null;
    if ((meta.vector_model || "") !== expectedModel) return null;

    const rows = meta.vector_storage === HYBRID_VECTOR_STORAGE
        ? sqliteJson<StoredVectorRow>(dbPath, `SELECT c.path, c.chunk_start_offset, c.chunk_end_offset, c.content_sha, hex(v.vector_blob) AS vector_hex FROM wiki_chunks c JOIN wiki_vectors v ON v.chunk_id = c.chunk_id WHERE v.dim = ${expectedDim}`)
        : sqliteJson<StoredVectorRow>(dbPath, `SELECT c.path, c.chunk_start_offset, c.chunk_end_offset, c.content_sha, v.vector_json FROM wiki_chunks c JOIN wiki_vectors v ON v.chunk_id = c.chunk_id WHERE v.dim = ${expectedDim}`);
    if (rows.length === 0) return null;

    const vectorsByKey = new Map<string, number[]>();
    for (const row of rows) {
        let vector: number[] | null = null;
        try {
            vector = row.vector_hex
                ? vectorFromBlobHex(row.vector_hex, expectedDim)
                : validVector(JSON.parse(String(row.vector_json || "null")) as unknown, expectedDim);
        } catch {
            vector = null;
        }
        if (vector) vectorsByKey.set(rowReuseKey(row), vector);
    }
    const vectors = chunks.map((chunk) => vectorsByKey.get(chunkReuseKey(chunk)) || null);
    const reusedCount = vectors.filter(Boolean).length;
    return reusedCount > 0 ? {vectors, reusedCount} : null;
}

type PreservedWikiChunk = {
    relPath: string;
    sourceGroup: string;
    title: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
    contentSha: string;
    text: string;
    vectorHex: string | null;
};

type WikiUpsertResult = {
    status: "ok" | "skipped" | "error";
    reason?: string;
    path: string;
    chunks: number;
    replaced: number;
    vectorsEmbedded: number;
};

export function upsertWikiPage(ctx: WikiProjectContext, relPath: string, content: string): WikiUpsertResult {
    const target = String(relPath || "").replace(/\\/g, "/").replace(/^\.autoflow\//, "");
    if (!target.startsWith("wiki/") || !target.endsWith(".md")) {
        return {status: "error", reason: "invalid_path", path: target, chunks: 0, replaced: 0, vectorsEmbedded: 0};
    }
    const trimmed = String(content || "").trim();
    if (!trimmed) {
        return {status: "error", reason: "empty_content", path: target, chunks: 0, replaced: 0, vectorsEmbedded: 0};
    }
    const dbPath = wikiIndexDbPath(ctx);
    if (!sqliteAvailable()) {
        return {status: "skipped", reason: "sqlite3_missing", path: target, chunks: 0, replaced: 0, vectorsEmbedded: 0};
    }
    ensureDir(path.dirname(dbPath));

    const dim = vectorDim();
    const model = vectorModel();

    // Bootstrap schema if DB does not yet exist (first wiki turn on a fresh board).
    if (!fs.existsSync(dbPath)) {
        const ok = sqliteExec(dbPath, [
            "PRAGMA journal_mode=DELETE;",
            "PRAGMA synchronous=NORMAL;",
            `CREATE TABLE wiki_chunks (
                chunk_id INTEGER PRIMARY KEY,
                path TEXT NOT NULL,
                source_group TEXT NOT NULL,
                title TEXT NOT NULL,
                chunk_start_offset INTEGER NOT NULL,
                chunk_end_offset INTEGER NOT NULL,
                chunk_start_line INTEGER NOT NULL,
                chunk_end_line INTEGER NOT NULL,
                content_sha TEXT NOT NULL,
                chunk_text TEXT NOT NULL DEFAULT ''
            );`,
            `CREATE TABLE wiki_vectors (
                chunk_id INTEGER PRIMARY KEY,
                dim INTEGER NOT NULL,
                vector_blob BLOB NOT NULL,
                model TEXT NOT NULL,
                indexed_at TEXT NOT NULL,
                FOREIGN KEY(chunk_id) REFERENCES wiki_chunks(chunk_id) ON DELETE CASCADE
            );`,
            "CREATE INDEX idx_wiki_chunks_path ON wiki_chunks(path);",
            "CREATE INDEX idx_wiki_vectors_dim ON wiki_vectors(dim);",
            "CREATE TABLE wiki_index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
            `INSERT INTO wiki_index_meta (key, value) VALUES ('backend', 'hybrid'), ('schema_version', '${HYBRID_SCHEMA_VERSION}'), ('text_storage', '${HYBRID_TEXT_STORAGE}'), ('vector_storage', '${HYBRID_VECTOR_STORAGE}'), ('vector_dim', '${dim}'), ('vector_model', '${sqlEsc(model)}'), ('include_tickets', 'true'), ('lexical_backend', '${HYBRID_LEXICAL_BACKEND}'), ('bm25_backend', '${HYBRID_LEXICAL_BACKEND}');`,
        ].join("\n"));
        if (!ok) return {status: "error", reason: "schema_init_failed", path: target, chunks: 0, replaced: 0, vectorsEmbedded: 0};
    }

    const newChunks = chunkifyContent(trimmed, target);
    if (!newChunks.length) {
        return {status: "error", reason: "no_chunks", path: target, chunks: 0, replaced: 0, vectorsEmbedded: 0};
    }

    const provider = resolveEmbeddingProvider(ctx);
    const vectors = provider
        ? embedTexts(provider, newChunks.map((c) => c.text), dim, embeddingEnv(ctx))
        : newChunks.map(() => null);
    const vectorsEmbedded = vectors.filter(Boolean).length;

    const oldCountRows = sqliteJson<{count: number}>(dbPath,
        `SELECT COUNT(*) AS count FROM wiki_chunks WHERE path = '${sqlEsc(target)}'`);
    const replaced = Number(oldCountRows[0]?.count) || 0;

    const maxIdRows = sqliteJson<{max_id: number}>(dbPath, "SELECT COALESCE(MAX(chunk_id), 0) AS max_id FROM wiki_chunks");
    let nextId = (Number(maxIdRows[0]?.max_id) || 0) + 1;

    const indexedAt = new Date().toISOString();
    const stmts: string[] = [
        "BEGIN;",
        `DELETE FROM wiki_chunks WHERE path = '${sqlEsc(target)}';`,
    ];
    for (let i = 0; i < newChunks.length; i++) {
        const c = newChunks[i];
        const id = nextId++;
        stmts.push(`INSERT INTO wiki_chunks (chunk_id, path, source_group, title, chunk_start_offset, chunk_end_offset, chunk_start_line, chunk_end_line, content_sha, chunk_text) VALUES (${id}, '${sqlEsc(c.relPath)}', '${sqlEsc(c.sourceGroup)}', '${sqlEsc(c.title)}', ${c.startOffset}, ${c.endOffset}, ${c.startLine}, ${c.endLine}, '${sqlEsc(c.contentSha)}', '${sqlEsc(c.text)}');`);
        const vector = vectors[i];
        if (vector) {
            stmts.push(`INSERT INTO wiki_vectors (chunk_id, dim, vector_blob, model, indexed_at) VALUES (${id}, ${dim}, X'${vectorToBlobHex(vector)}', '${sqlEsc(model)}', '${sqlEsc(indexedAt)}');`);
        }
    }
    stmts.push("COMMIT;");

    const ok = sqliteExec(dbPath, stmts.join("\n"));
    if (!ok) return {status: "error", reason: "exec_failed", path: target, chunks: newChunks.length, replaced, vectorsEmbedded};
    return {status: "ok", path: target, chunks: newChunks.length, replaced, vectorsEmbedded};
}

export function deleteWikiPage(ctx: WikiProjectContext, relPath: string): {status: string; path: string; removed: number} {
    const target = String(relPath || "").replace(/\\/g, "/").replace(/^\.autoflow\//, "");
    if (!target.startsWith("wiki/") || !target.endsWith(".md")) {
        return {status: "invalid_path", path: target, removed: 0};
    }
    const dbPath = wikiIndexDbPath(ctx);
    if (!fs.existsSync(dbPath) || !sqliteAvailable()) {
        return {status: "no_index", path: target, removed: 0};
    }
    const countRows = sqliteJson<{count: number}>(dbPath,
        `SELECT COUNT(*) AS count FROM wiki_chunks WHERE path = '${sqlEsc(target)}'`);
    const removed = Number(countRows[0]?.count) || 0;
    if (removed === 0) return {status: "not_found", path: target, removed: 0};
    const ok = sqliteExec(dbPath, `DELETE FROM wiki_chunks WHERE path = '${sqlEsc(target)}';`);
    return {status: ok ? "ok" : "exec_failed", path: target, removed};
}

function readPreservedWikiChunks(dbPath: string, dim: number): PreservedWikiChunk[] {
    if (!fs.existsSync(dbPath) || !sqliteAvailable()) return [];
    try {
        const rows = sqliteJson<VectorRow>(dbPath,
            `SELECT c.chunk_id, c.path, c.source_group, c.title, c.chunk_start_offset, c.chunk_end_offset, c.chunk_start_line, c.chunk_end_line, c.content_sha, c.chunk_text, hex(v.vector_blob) AS vector_hex FROM wiki_chunks c LEFT JOIN wiki_vectors v ON v.chunk_id = c.chunk_id AND v.dim = ${dim} WHERE c.source_group = 'wiki'`);
        return rows.map((row) => ({
            relPath: String(row.path || ""),
            sourceGroup: String(row.source_group || "wiki"),
            title: String(row.title || ""),
            startOffset: Number(row.chunk_start_offset) || 0,
            endOffset: Number(row.chunk_end_offset) || 0,
            startLine: Number(row.chunk_start_line) || 1,
            endLine: Number(row.chunk_end_line) || 1,
            contentSha: String(row.content_sha || ""),
            text: String(row.chunk_text || ""),
            vectorHex: row.vector_hex ? String(row.vector_hex) : null,
        }));
    } catch {
        return [];
    }
}

export function buildWikiVectorIndex(ctx: WikiProjectContext, includeTickets: boolean): WikiIndexStats {
    const dbPath = wikiIndexDbPath(ctx);
    const dim = vectorDim();
    const model = vectorModel();
    const {chunks, fileCount, sourceHash} = collectWikiChunks(ctx, includeTickets);
    const provider = resolveEmbeddingProvider(ctx);

    if (!sqliteAvailable()) {
        return {status: "skipped", reason: "sqlite3_missing", dbPath, indexedFiles: fileCount, indexedChunks: chunks.length, vectorCount: 0, sourceHash, vectorDim: dim, vectorModel: model, bm25Ready: false, lexicalBackend: HYBRID_LEXICAL_BACKEND, textStorage: HYBRID_TEXT_STORAGE, vectorStorage: HYBRID_VECTOR_STORAGE, embeddingProvider: provider};
    }

    ensureDir(path.dirname(dbPath));
    // Preserve DB-only wiki chunks (created via write-page upsert) so that
    // ingest from external sources (tickets/done/, conversations/) does not
    // wipe wiki entries that have no on-disk markdown.
    const preservedWiki = readPreservedWikiChunks(dbPath, dim);
    const reused = reusableStoredVectors(ctx, chunks, includeTickets, dim, model);
    const vectors = reused?.vectors || chunks.map(() => null);
    const missing = chunks
        .map((chunk, index) => ({chunk, index}))
        .filter((item) => !vectors[item.index]);
    if (provider && missing.length > 0) {
        const embedded = embedTexts(provider, missing.map((item) => item.chunk.text), dim, embeddingEnv(ctx));
        for (let index = 0; index < missing.length; index += 1) {
            vectors[missing[index].index] = embedded[index];
        }
    }
    const vectorCount = vectors.filter(Boolean).length + preservedWiki.filter((c) => c.vectorHex).length;
    const tempDbPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
    for (const suffix of ["", "-wal", "-shm"]) {
        try {
            fs.rmSync(`${tempDbPath}${suffix}`, {force: true});
        } catch {
            // Rebuild can continue if SQLite overwrites the temp file.
        }
    }

    const statements: string[] = [
        "PRAGMA journal_mode=DELETE;",
        "PRAGMA synchronous=NORMAL;",
        "DROP TABLE IF EXISTS wiki_chunks_fts;",
        "DROP TABLE IF EXISTS wiki_vectors;",
        "DROP TABLE IF EXISTS wiki_chunks;",
        "DROP TABLE IF EXISTS wiki_index_meta;",
        `CREATE TABLE wiki_chunks (
            chunk_id INTEGER PRIMARY KEY,
            path TEXT NOT NULL,
            source_group TEXT NOT NULL,
            title TEXT NOT NULL,
            chunk_start_offset INTEGER NOT NULL,
            chunk_end_offset INTEGER NOT NULL,
            chunk_start_line INTEGER NOT NULL,
            chunk_end_line INTEGER NOT NULL,
            content_sha TEXT NOT NULL,
            chunk_text TEXT NOT NULL DEFAULT ''
        );`,
        `CREATE TABLE wiki_vectors (
            chunk_id INTEGER PRIMARY KEY,
            dim INTEGER NOT NULL,
            vector_blob BLOB NOT NULL,
            model TEXT NOT NULL,
            indexed_at TEXT NOT NULL,
            FOREIGN KEY(chunk_id) REFERENCES wiki_chunks(chunk_id) ON DELETE CASCADE
        );`,
        "CREATE INDEX idx_wiki_chunks_path ON wiki_chunks(path);",
        "CREATE INDEX idx_wiki_vectors_dim ON wiki_vectors(dim);",
        "CREATE TABLE wiki_index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        "BEGIN;",
    ];

    const indexedAt = new Date().toISOString();
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        statements.push(`INSERT INTO wiki_chunks (chunk_id, path, source_group, title, chunk_start_offset, chunk_end_offset, chunk_start_line, chunk_end_line, content_sha, chunk_text) VALUES (${chunk.chunkId}, '${sqlEsc(chunk.relPath)}', '${sqlEsc(chunk.sourceGroup)}', '${sqlEsc(chunk.title)}', ${chunk.startOffset}, ${chunk.endOffset}, ${chunk.startLine}, ${chunk.endLine}, '${sqlEsc(chunk.contentSha)}', '${sqlEsc(chunk.text)}');`);
        const vector = vectors[index];
        if (vector) {
            statements.push(`INSERT INTO wiki_vectors (chunk_id, dim, vector_blob, model, indexed_at) VALUES (${chunk.chunkId}, ${dim}, X'${vectorToBlobHex(vector)}', '${sqlEsc(model)}', '${sqlEsc(indexedAt)}');`);
        }
    }
    // Re-insert preserved DB-only wiki chunks (no on-disk markdown to scan).
    let preservedNextId = chunks.length + 1;
    for (const pc of preservedWiki) {
        const id = preservedNextId++;
        statements.push(`INSERT INTO wiki_chunks (chunk_id, path, source_group, title, chunk_start_offset, chunk_end_offset, chunk_start_line, chunk_end_line, content_sha, chunk_text) VALUES (${id}, '${sqlEsc(pc.relPath)}', '${sqlEsc(pc.sourceGroup)}', '${sqlEsc(pc.title)}', ${pc.startOffset}, ${pc.endOffset}, ${pc.startLine}, ${pc.endLine}, '${sqlEsc(pc.contentSha)}', '${sqlEsc(pc.text)}');`);
        if (pc.vectorHex) {
            statements.push(`INSERT INTO wiki_vectors (chunk_id, dim, vector_blob, model, indexed_at) VALUES (${id}, ${dim}, X'${pc.vectorHex}', '${sqlEsc(model)}', '${sqlEsc(indexedAt)}');`);
        }
    }

    const meta: Record<string, string> = {
        schema_version: HYBRID_SCHEMA_VERSION,
        backend: "hybrid",
        bm25_backend: HYBRID_LEXICAL_BACKEND,
        lexical_backend: HYBRID_LEXICAL_BACKEND,
        text_storage: HYBRID_TEXT_STORAGE,
        vector_storage: HYBRID_VECTOR_STORAGE,
        source_hash: sourceHash,
        include_tickets: includeTickets ? "true" : "false",
        indexed_at: indexedAt,
        indexed_files: String(fileCount),
        indexed_chunks: String(chunks.length),
        vector_count: String(vectorCount),
        vector_dim: String(dim),
        vector_model: model,
        vector_reuse_source: reused ? "existing_index" : "",
        vector_reuse_count: String(reused?.reusedCount || 0),
        vector_embed_count: String(missing.length),
        embedding_provider_configured: provider ? "true" : "false",
    };
    for (const [key, value] of Object.entries(meta)) {
        statements.push(`INSERT INTO wiki_index_meta (key, value) VALUES ('${sqlEsc(key)}', '${sqlEsc(value)}');`);
    }
    statements.push("COMMIT;");

    const ok = sqliteExec(tempDbPath, statements.join("\n"));
    if (ok) {
        for (const suffix of ["", "-wal", "-shm"]) {
            try {
                fs.rmSync(`${dbPath}${suffix}`, {force: true});
            } catch {
                // Best-effort cleanup before atomic replacement.
            }
        }
        fs.renameSync(tempDbPath, dbPath);
    } else {
        for (const suffix of ["", "-wal", "-shm"]) {
            try {
                fs.rmSync(`${tempDbPath}${suffix}`, {force: true});
            } catch {
                // Best-effort cleanup for failed temp index.
            }
        }
    }
    const ready = ok && (chunks.length === 0 || vectorCount > 0);
    const reason = !ok
        ? "sqlite_write_failed"
        : chunks.length === 0
            ? undefined
            : !provider
                ? "embedding_provider_missing"
                : vectorCount <= 0
                    ? "embedding_failed"
                    : undefined;
    return {
        status: ready ? "ok" : "skipped",
        reason,
        dbPath,
        indexedFiles: fileCount,
        indexedChunks: chunks.length + preservedWiki.length,
        vectorCount: ok ? vectorCount : 0,
        sourceHash,
        vectorDim: dim,
        vectorModel: model,
        bm25Ready: ok,
        lexicalBackend: HYBRID_LEXICAL_BACKEND,
        textStorage: HYBRID_TEXT_STORAGE,
        vectorStorage: HYBRID_VECTOR_STORAGE,
        embeddingProvider: provider,
    };
}

function readExistingHybridIndex(ctx: WikiProjectContext, includeTickets: boolean): WikiIndexStats {
    const dbPath = wikiIndexDbPath(ctx);
    const dim = vectorDim();
    const model = vectorModel();
    const {chunks, fileCount, sourceHash} = collectWikiChunks(ctx, includeTickets);
    const baseStats = {
        dbPath,
        indexedFiles: fileCount,
        indexedChunks: chunks.length,
        vectorCount: 0,
        sourceHash,
        vectorDim: dim,
        vectorModel: model,
        bm25Ready: false,
        lexicalBackend: HYBRID_LEXICAL_BACKEND,
        textStorage: HYBRID_TEXT_STORAGE,
        vectorStorage: HYBRID_VECTOR_STORAGE,
        embeddingProvider: resolveEmbeddingProvider(ctx),
    };
    if (!sqliteAvailable()) {
        return {status: "skipped", reason: "sqlite3_missing", ...baseStats};
    }
    if (!fs.existsSync(dbPath)) {
        return {status: "skipped", reason: "vector_index_missing_upgrade_required", ...baseStats};
    }
    const meta = readIndexMeta(dbPath);
    const existingVectorCount = Number.parseInt(meta.vector_count || "0", 10) || 0;
    if (meta.backend !== "hybrid" || meta.schema_version !== HYBRID_SCHEMA_VERSION || meta.text_storage !== HYBRID_TEXT_STORAGE || meta.vector_storage !== HYBRID_VECTOR_STORAGE) {
        return {status: "skipped", reason: "hybrid_index_schema_missing_upgrade_required", ...baseStats};
    }
    // source_hash mismatch no longer blocks query — DB-only upserts intentionally
    // diverge from external source hash. ingest still rebuilds when needed.
    if (Number(meta.vector_dim) !== dim) {
        return {status: "skipped", reason: "vector_index_dim_mismatch_upgrade_required", ...baseStats};
    }
    if ((meta.vector_model || "") !== model) {
        return {status: "skipped", reason: "vector_index_model_mismatch_upgrade_required", ...baseStats};
    }
    if (existingVectorCount <= 0) {
        return {status: "skipped", reason: "vector_index_empty_upgrade_required", ...baseStats};
    }
    return {
        status: "ok",
        dbPath,
        indexedFiles: Number.parseInt(meta.indexed_files || String(fileCount), 10) || fileCount,
        indexedChunks: Number.parseInt(meta.indexed_chunks || String(chunks.length), 10) || chunks.length,
        vectorCount: existingVectorCount,
        sourceHash,
        vectorDim: dim,
        vectorModel: model,
        bm25Ready: true,
        lexicalBackend: meta.lexical_backend || meta.bm25_backend || HYBRID_LEXICAL_BACKEND,
        textStorage: meta.text_storage || HYBRID_TEXT_STORAGE,
        vectorStorage: meta.vector_storage || HYBRID_VECTOR_STORAGE,
        embeddingProvider: resolveEmbeddingProvider(ctx),
    };
}

function lexicalTokensFromTerms(terms: string[]): string[] {
    return Array.from(new Set(terms
        .flatMap((term) => term.toLowerCase().split(/[\s,./\\:;()[\]{}<>|]+/))
        .map((term) => term.trim())
        .filter(Boolean)));
}

function countOccurrences(text: string, token: string): number {
    if (!token) return 0;
    let count = 0;
    let index = 0;
    while (index < text.length) {
        const found = text.indexOf(token, index);
        if (found < 0) break;
        count += 1;
        index = found + token.length;
    }
    return count;
}

function sourceFileForRelPath(ctx: WikiProjectContext, relPath: string): string {
    const root = realPathSafe(ctx.boardRoot);
    const file = realPathSafe(path.resolve(ctx.boardRoot, relPath));
    const relative = path.relative(root, file);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return file;
    return "";
}

function makeSourceTextReader(ctx: WikiProjectContext): (row: VectorRow) => {text: string; sha: string} | null {
    const cache = new Map<string, {text: string; sha: string} | null>();
    return (row: VectorRow) => {
        const relPath = String(row.path || "");
        if (!relPath) return null;
        if (cache.has(relPath)) return cache.get(relPath) || null;
        const file = sourceFileForRelPath(ctx, relPath);
        if (!file || !fs.existsSync(file)) {
            cache.set(relPath, null);
            return null;
        }
        const text = fs.readFileSync(file, "utf8");
        const value = {text, sha: crypto.createHash("sha256").update(text).digest("hex")};
        cache.set(relPath, value);
        return value;
    };
}

function chunkTextFromSource(row: VectorRow, readSource: (row: VectorRow) => {text: string; sha: string} | null): string {
    // Prefer DB-stored text when present (avoids markdown re-read; survives source removal).
    const stored = String(row.chunk_text || "").trim();
    if (stored) return stored;
    const source = readSource(row);
    if (!source) return "";
    if (row.content_sha && row.content_sha !== source.sha) return "";
    const start = Math.max(0, Number(row.chunk_start_offset) || 0);
    const endRaw = Number(row.chunk_end_offset) || source.text.length;
    const end = Math.min(source.text.length, Math.max(start, endRaw));
    return source.text.slice(start, end).trim();
}

function sourceLexicalScores(rows: VectorRow[], terms: string[], limit: number, readSource: (row: VectorRow) => {text: string; sha: string} | null): Map<number, number> {
    const tokens = lexicalTokensFromTerms(terms);
    if (tokens.length === 0) return new Map();
    const scored: {id: number; score: number}[] = [];
    for (const row of rows) {
        const id = Number(row.chunk_id);
        if (!Number.isFinite(id)) continue;
        const text = chunkTextFromSource(row, readSource).toLowerCase();
        if (!text) continue;
        let hits = 0;
        let coverage = 0;
        for (const token of tokens) {
            const count = countOccurrences(text, token);
            hits += count;
            if (count > 0) coverage += 1;
        }
        if (hits > 0) scored.push({id, score: hits + (coverage / tokens.length)});
    }
    scored.sort((a, b) => b.score - a.score || a.id - b.id);
    return new Map(scored.slice(0, Math.max(1, limit)).map((item) => [item.id, item.score]));
}

function normalizedScores(scores: Map<number, number>): Map<number, number> {
    const values = [...scores.values()].map((value) => Math.max(0, value));
    const max = Math.max(0, ...values);
    if (max <= 0) return new Map([...scores.keys()].map((key) => [key, 0]));
    return new Map([...scores.entries()].map(([key, value]) => [key, Math.max(0, value) / max]));
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
        dot += a[index] * b[index];
        normA += a[index] * a[index];
        normB += b[index] * b[index];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function hybridSearch(ctx: WikiProjectContext, terms: string[], limit: number, includeTickets: boolean): {stats: WikiIndexStats; matches: VectorMatch[]; reason?: string; bm25Count: number; vectorScoredCount: number} {
    const stats = readExistingHybridIndex(ctx, includeTickets);
    if (stats.status !== "ok" || stats.vectorCount <= 0) {
        return {stats, matches: [], reason: stats.reason || "hybrid_index_empty", bm25Count: 0, vectorScoredCount: 0};
    }
    const provider = resolveEmbeddingProvider(ctx);
    const queryVector = embedQuery(provider, terms, stats.vectorDim, embeddingEnv(ctx));

    const rows = sqliteJson<VectorRow>(stats.dbPath, `SELECT c.chunk_id, c.path, c.source_group, c.title, c.chunk_start_offset, c.chunk_end_offset, c.chunk_start_line, c.chunk_end_line, c.content_sha, c.chunk_text, hex(v.vector_blob) AS vector_hex FROM wiki_chunks c LEFT JOIN wiki_vectors v ON v.chunk_id = c.chunk_id AND v.dim = ${stats.vectorDim}`);
    const chunkById = new Map<number, VectorRow>();
    const vectorScores = new Map<number, number>();
    for (const row of rows) {
        const id = Number(row.chunk_id);
        if (!Number.isFinite(id)) continue;
        chunkById.set(id, row);
        if (!queryVector || !row.vector_hex) continue;
        const vector = vectorFromBlobHex(row.vector_hex, stats.vectorDim);
        if (!vector) continue;
        vectorScores.set(id, Math.max(0, (cosineSimilarity(queryVector, vector) + 1) / 2));
    }

    const readSource = makeSourceTextReader(ctx);
    const lexicalScores = sourceLexicalScores(rows, terms, Math.max(limit * 8, 50), readSource);
    const normalizedVector = normalizedScores(vectorScores);
    const normalizedBm25 = normalizedScores(lexicalScores);
    const candidateIds = new Set<number>([...normalizedVector.keys(), ...normalizedBm25.keys()]);
    const vectorWeight = normalizedVector.size > 0 ? HYBRID_VECTOR_WEIGHT : 0;
    const bm25Weight = normalizedBm25.size > 0 ? HYBRID_LEXICAL_WEIGHT : 0;
    const totalWeight = vectorWeight + bm25Weight || 1;
    const useRecency = recencyEnabled();
    const halfLifeDays = recencyHalfLifeDays();
    const floor = recencyFloor();
    const recencyCache = new Map<string, number>();
    const useSupersede = supersedeEnabled();
    const penalty = supersedePenalty();
    const statusCache = new Map<string, PageStatus>();
    const useUsage = usageTrackingEnabled();
    const usageThreshold = usageBoostThreshold();
    const usageBoost = usageBoostWeight();
    const usageMap = useUsage ? readChunkUsageMap(stats.dbPath) : new Map<string, number>();
    const matches: VectorMatch[] = [];
    for (const id of candidateIds) {
        const row = chunkById.get(id);
        if (!row) continue;
        const vectorScore = normalizedVector.get(id) || 0;
        const lexicalScore = normalizedBm25.get(id) || 0;
        const baseScore = ((vectorScore * vectorWeight) + (lexicalScore * bm25Weight)) / totalWeight;
        const absPath = path.resolve(ctx.boardRoot, row.path.replace(/^\.autoflow\//, ""));
        let recencyWeight = 1;
        if (useRecency) {
            recencyWeight = pageRecencyWeight(absPath, halfLifeDays, floor, recencyCache);
        }
        let pageStatus: PageStatus = {superseded: false, supersededBy: "", status: ""};
        if (useSupersede) {
            if (!statusCache.has(absPath)) statusCache.set(absPath, readPageStatus(absPath));
            pageStatus = statusCache.get(absPath) as PageStatus;
        }
        const statusFactor = pageStatus.superseded ? penalty : 1;
        const hitCount = useUsage ? (usageMap.get(String(row.content_sha || "")) || 0) : 0;
        const usageFactor = useUsage ? usageWeight(hitCount, usageThreshold, usageBoost) : 1;
        matches.push({
            relPath: row.path,
            title: pageStatus.supersededBy
                ? `${row.title} (superseded by ${pageStatus.supersededBy})`
                : row.title,
            text: chunkTextFromSource(row, readSource),
            startLine: Number(row.chunk_start_line) || 1,
            endLine: Number(row.chunk_end_line) || 1,
            score: baseScore * recencyWeight * statusFactor * usageFactor,
            vectorScore,
            bm25Score: lexicalScore,
            contentSha: String(row.content_sha || ""),
        });
    }
    matches.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath) || a.startLine - b.startLine);
    const reason = matches.length > 0
        ? undefined
        : queryVector
            ? "no_hybrid_matches"
            : provider
                ? "query_embedding_failed"
                : "embedding_provider_missing";

    // Semantic dedup: skip chunks that are highly similar to an already-included
    // higher-scored match. Avoids returning near-duplicate retrievals (e.g. the
    // same decision restated across multiple pages).
    const useDedup = dedupEnabled();
    const threshold = dedupThreshold();
    const finalMatches: VectorMatch[] = [];
    const dedupVectors: number[][] = [];
    const shaSeen = new Set<string>();
    let dropped = 0;
    for (const m of matches) {
        if (finalMatches.length >= limit) break;
        if (m.contentSha && shaSeen.has(m.contentSha)) { dropped += 1; continue; }
        let duplicate = false;
        if (useDedup && dedupVectors.length > 0) {
            const row = matches.indexOf(m) >= 0 ? null : null;
            void row;
            // Reconstruct chunk vector from stored row via chunkById lookup by relPath+offset.
            // We re-derive id by scanning candidateIds; cheaper to keep the score-sorted
            // matches keyed back to their row through relPath+startLine equality.
            const chunkRow = Array.from(chunkById.values()).find((r) =>
                r.path === m.relPath && Number(r.chunk_start_line) === m.startLine
            );
            if (chunkRow && chunkRow.vector_hex) {
                const myVec = vectorFromBlobHex(chunkRow.vector_hex, stats.vectorDim);
                if (myVec) {
                    for (const v of dedupVectors) {
                        if (cosineSimilarity(myVec, v) >= threshold) { duplicate = true; break; }
                    }
                    if (!duplicate) dedupVectors.push(myVec);
                }
            }
        }
        if (duplicate) { dropped += 1; continue; }
        if (m.contentSha) shaSeen.add(m.contentSha);
        finalMatches.push(m);
    }
    void dropped;

    if (useUsage && finalMatches.length > 0) {
        recordChunkUsage(stats.dbPath, finalMatches.map((m) => m.contentSha || ""));
    }
    return {stats, matches: finalMatches, reason, bm25Count: lexicalScores.size, vectorScoredCount: vectorScores.size};
}

function markdownScanSearch(ctx: WikiProjectContext, terms: string[], limit: number, includeTickets: boolean): VectorMatch[] {
    const candidates = collectWikiFiles(ctx, includeTickets);
    const matches: VectorMatch[] = [];
    for (const file of candidates) {
        const text = fs.readFileSync(file, "utf8");
        const lower = text.toLowerCase();
        if (terms.length > 0 && !terms.every((term) => lower.includes(term))) {
            continue;
        }
        const score = terms.reduce((sum, term) => sum + (lower.split(term).length - 1), 0);
        matches.push({
            relPath: path.relative(ctx.boardRoot, file),
            title: firstNonEmptyLine(text),
            text,
            startLine: 1,
            endLine: text.split(/\r?\n/).length,
            score,
        });
    }
    matches.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));
    return matches.slice(0, limit);
}

function printMatches(matches: VectorMatch[]): void {
    out(`result_count=${matches.length}`);
    matches.forEach((match, index) => {
        const prefix = `match.${index + 1}`;
        out(`${prefix}.path=${match.relPath}`);
        out(`${prefix}.score=${Number.isFinite(match.score) ? match.score.toFixed(6) : "0"}`);
        if (typeof match.vectorScore === "number") out(`${prefix}.vector_score=${match.vectorScore.toFixed(6)}`);
        if (typeof match.bm25Score === "number") out(`${prefix}.bm25_score=${match.bm25Score.toFixed(6)}`);
        out(`${prefix}.title=${match.title}`);
        out(`${prefix}.chunk_start_line=${match.startLine}`);
        out(`${prefix}.chunk_end_line=${match.endLine}`);
    });
}

export function wikiProject(args: string[]): never | void {
    const subcmd = args.shift() || "query";
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    switch (subcmd) {
        case "update":
        case "retrofit-frontmatter":
            // Removed in DB-only migration; kept as no-op alias so legacy callers
            // (LLM conversation memory, old prompts) don't crash. Emit a hint
            // pointing to the current entrypoint.
            out("status=deprecated");
            out(`removed_command=wiki ${subcmd}`);
            out("hint=use 'autoflow wiki write-page --path wiki/<slug>.md --content-file <file>' to upsert into wiki-search.db (markdown is no longer written to disk)");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "query": {
            ensureBoard(ctx);
            const terms = allFlags(parsed, "term").map((term) => term.toLowerCase()).filter(Boolean);
            const limit = Number.parseInt(firstFlag(parsed, "limit") || "10", 10) || 10;
            const includeTickets = !hasFlag(parsed, "no-tickets");
            if (hasFlag(parsed, "rag")) {
                const {stats, matches, reason, bm25Count, vectorScoredCount} = hybridSearch(ctx, terms, limit, includeTickets);
                if (matches.length > 0) {
                    out("status=ok");
                    out("rag_backend=hybrid");
                    out(`bm25_backend=${stats.lexicalBackend}`);
                    out(`lexical_backend=${stats.lexicalBackend}`);
                    out(`text_storage=${stats.textStorage}`);
                    out(`vector_storage=${stats.vectorStorage}`);
                    out(`index_db=${stats.dbPath}`);
                    out(`indexed_chunks=${stats.indexedChunks}`);
                    out(`vector_count=${stats.vectorCount}`);
                    out(`vector_model=${stats.vectorModel}`);
                    out(`vector_scored_count=${vectorScoredCount}`);
                    out(`bm25_count=${bm25Count}`);
                    printMatches(matches);
                    break;
                }
                out("status=needs_hybrid_index");
                out("rag_backend=hybrid");
                out(`bm25_backend=${stats.lexicalBackend}`);
                out(`lexical_backend=${stats.lexicalBackend}`);
                out(`text_storage=${stats.textStorage}`);
                out(`vector_storage=${stats.vectorStorage}`);
                out(`reason=${reason || "no_hybrid_matches"}`);
                if (stats.dbPath) out(`index_db=${stats.dbPath}`);
                out(`indexed_chunks=${stats.indexedChunks}`);
                out(`vector_count=${stats.vectorCount}`);
                out(`vector_model=${stats.vectorModel}`);
                out(`vector_scored_count=${vectorScoredCount}`);
                out(`bm25_count=${bm25Count}`);
                out("result_count=0");
                break;
            }
            out("status=ok");
            out("query_backend=markdown_scan");
            printMatches(markdownScanSearch(ctx, terms, limit, includeTickets));
            break;
        }
        case "lint":
            out("status=ok");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "ingest":
            ensureBoard(ctx);
            {
                const includeTickets = !hasFlag(parsed, "no-tickets");
                const stats = buildWikiVectorIndex(ctx, includeTickets);
                out(`status=${stats.status}`);
                if (stats.reason) out(`reason=${stats.reason}`);
                out("index_backend=hybrid");
                out(`bm25_backend=${stats.lexicalBackend}`);
                out(`lexical_backend=${stats.lexicalBackend}`);
                out(`text_storage=${stats.textStorage}`);
                out(`vector_storage=${stats.vectorStorage}`);
                out(`index_db=${stats.dbPath}`);
                out(`indexed_files=${stats.indexedFiles}`);
                out(`indexed_chunks=${stats.indexedChunks}`);
                out(`vector_count=${stats.vectorCount}`);
                out(`vector_dim=${stats.vectorDim}`);
                out(`vector_model=${stats.vectorModel}`);
                out(`embedding_provider_configured=${stats.embeddingProvider ? "true" : "false"}`);
                out(`project_root=${ctx.projectRoot}`);
                out(`board_root=${ctx.boardRoot}`);
            }
            break;
        case "summarize-telemetry":
            summarizeTelemetry(ctx, parsed);
            break;
        case "upsert": {
            ensureBoard(ctx);
            const targetPath = firstFlag(parsed, "path") || "";
            const contentFile = firstFlag(parsed, "content-file") || "";
            let body = "";
            if (contentFile) {
                try { body = fs.readFileSync(contentFile, "utf8"); }
                catch (error: any) { fail(`failed to read content file: ${error?.message || error}`); }
            } else {
                try { body = fs.readFileSync(0, "utf8"); } catch {}
            }
            if (!body || !body.trim()) fail("wiki upsert requires --content-file or stdin markdown");
            const result = upsertWikiPage(ctx, targetPath, body);
            out(`status=${result.status}`);
            if (result.reason) out(`reason=${result.reason}`);
            out(`path=${result.path}`);
            out(`chunks=${result.chunks}`);
            out(`replaced=${result.replaced}`);
            out(`vectors_embedded=${result.vectorsEmbedded}`);
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        }
        case "delete-page": {
            ensureBoard(ctx);
            const targetPath = firstFlag(parsed, "path") || "";
            const result = deleteWikiPage(ctx, targetPath);
            out(`status=${result.status}`);
            out(`path=${result.path}`);
            out(`removed=${result.removed}`);
            break;
        }
        default:
            fail(`Unknown wiki command: ${subcmd}`);
    }
}
