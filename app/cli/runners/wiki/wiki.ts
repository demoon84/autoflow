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
    embeddingProvider: string;
};

type VectorRow = {
    chunk_id: number;
    path: string;
    source_group: string;
    title: string;
    chunk_text: string;
    chunk_start_line: number;
    chunk_end_line: number;
    vector_json?: string | null;
};

type Bm25Row = {
    chunk_id: number;
    bm25_score: number;
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
};

const WIKI_CHUNK_SIZE = 1024;
const WIKI_CHUNK_OVERLAP = 128;
const DEFAULT_VECTOR_MODEL = "BAAI/bge-m3";
const DEFAULT_VECTOR_DIM = 1024;
const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_BM25_WEIGHT = 0.3;
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
        return {
            id,
            role,
            agent: stateValue(state, "agent") || config.agent || "",
            model: stateValue(state, "model") || config.model || "",
            reasoning: stateValue(state, "reasoning") || config.reasoning || "",
            mode: stateValue(state, "mode") || config.mode || "",
            enabled: boolish(config.enabled, true),
            intervalSeconds: config.interval_seconds || "",
            effectiveStatus: runnerEffectiveStateStatus(state),
            stateStatus: state.status || "",
            lastResult: stateValue(state, "last_result", "last_stop_reason"),
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
        `Source: generated from ${ctx.boardDirName}/runners/config.toml and ${ctx.boardDirName}/runners/state/*.state.`,
        `Window: ${window}`,
        "",
    ].join("\n");
}

function renderRunnerHealth(ctx: WikiProjectContext, window: string, snapshots: RunnerTelemetrySnapshot[]): string {
    return `${summaryHeader("Runner Health", ctx, window)}${markdownTable(
        ["Runner", "Role", "Enabled", "Effective Status", "State Status", "Last Result", "Active", "Last Event"],
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
    return `${summaryHeader("Runner Timing", ctx, window)}${markdownTable(
        ["Runner", "Mode", "Interval Seconds", "Started At", "Updated At", "Last Event At", "Last Stop Reason"],
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
    return `${summaryHeader("Prompt Evolution", ctx, window)}${markdownTable(
        ["Runner", "Agent", "Model", "Reasoning", "Last Turn At", "Last Turn Tokens", "Cumulative Tokens", "Token Source", "Code Volume"],
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
            return "wiki/operations/runner-health.md";
        case "runner-timing":
            return "wiki/operations/runner-timing.md";
        case "prompt-evolution":
            return "wiki/agents/prompt-evolution.md";
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
        maxBuffer: 128 * 1024 * 1024,
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

function collectWikiFiles(ctx: WikiProjectContext, includeTickets: boolean): string[] {
    return [
        ...walkMarkdownFiles(path.join(ctx.boardRoot, "wiki")),
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

export function buildWikiVectorIndex(ctx: WikiProjectContext, includeTickets: boolean): WikiIndexStats {
    const dbPath = wikiIndexDbPath(ctx);
    const dim = vectorDim();
    const model = vectorModel();
    const {chunks, fileCount, sourceHash} = collectWikiChunks(ctx, includeTickets);
    const provider = resolveEmbeddingProvider(ctx);

    if (!sqliteAvailable()) {
        return {status: "skipped", reason: "sqlite3_missing", dbPath, indexedFiles: fileCount, indexedChunks: chunks.length, vectorCount: 0, sourceHash, vectorDim: dim, vectorModel: model, bm25Ready: false, embeddingProvider: provider};
    }

    ensureDir(path.dirname(dbPath));
    const vectors = provider ? embedTexts(provider, chunks.map((chunk) => chunk.text), dim, embeddingEnv(ctx)) : chunks.map(() => null);
    const vectorCount = vectors.filter(Boolean).length;

    const statements: string[] = [
        "PRAGMA journal_mode=WAL;",
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
            chunk_text TEXT NOT NULL,
            chunk_start_line INTEGER NOT NULL,
            chunk_end_line INTEGER NOT NULL,
            content_sha TEXT NOT NULL
        );`,
        `CREATE VIRTUAL TABLE wiki_chunks_fts USING fts5(
            chunk_id UNINDEXED,
            path UNINDEXED,
            title,
            chunk_text
        );`,
        `CREATE TABLE wiki_vectors (
            chunk_id INTEGER PRIMARY KEY,
            dim INTEGER NOT NULL,
            vector_json TEXT NOT NULL,
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
        statements.push(`INSERT INTO wiki_chunks (chunk_id, path, source_group, title, chunk_text, chunk_start_line, chunk_end_line, content_sha) VALUES (${chunk.chunkId}, '${sqlEsc(chunk.relPath)}', '${sqlEsc(chunk.sourceGroup)}', '${sqlEsc(chunk.title)}', '${sqlEsc(chunk.text)}', ${chunk.startLine}, ${chunk.endLine}, '${sqlEsc(chunk.contentSha)}');`);
        statements.push(`INSERT INTO wiki_chunks_fts (chunk_id, path, title, chunk_text) VALUES (${chunk.chunkId}, '${sqlEsc(chunk.relPath)}', '${sqlEsc(chunk.title)}', '${sqlEsc(chunk.text)}');`);
        const vector = vectors[index];
        if (vector) {
            statements.push(`INSERT INTO wiki_vectors (chunk_id, dim, vector_json, model, indexed_at) VALUES (${chunk.chunkId}, ${dim}, '${sqlEsc(JSON.stringify(vector))}', '${sqlEsc(model)}', '${sqlEsc(indexedAt)}');`);
        }
    }

    const meta: Record<string, string> = {
        schema_version: "1",
        backend: "hybrid",
        bm25_backend: "fts5",
        source_hash: sourceHash,
        include_tickets: includeTickets ? "true" : "false",
        indexed_at: indexedAt,
        indexed_files: String(fileCount),
        indexed_chunks: String(chunks.length),
        vector_count: String(vectorCount),
        vector_dim: String(dim),
        vector_model: model,
        embedding_provider_configured: provider ? "true" : "false",
    };
    for (const [key, value] of Object.entries(meta)) {
        statements.push(`INSERT INTO wiki_index_meta (key, value) VALUES ('${sqlEsc(key)}', '${sqlEsc(value)}');`);
    }
    statements.push("COMMIT;");

    const ok = sqliteExec(dbPath, statements.join("\n"));
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
        indexedChunks: chunks.length,
        vectorCount: ok ? vectorCount : 0,
        sourceHash,
        vectorDim: dim,
        vectorModel: model,
        bm25Ready: ok,
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
    if (meta.backend !== "hybrid" || meta.bm25_backend !== "fts5") {
        return {status: "skipped", reason: "hybrid_index_schema_missing_upgrade_required", ...baseStats};
    }
    if (meta.source_hash !== sourceHash) {
        return {status: "skipped", reason: "vector_index_stale_upgrade_required", ...baseStats};
    }
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
        embeddingProvider: resolveEmbeddingProvider(ctx),
    };
}

function ftsPhrase(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

function ftsQueryFromTerms(terms: string[]): string {
    const tokens = Array.from(new Set(terms
        .flatMap((term) => term.split(/[\s,./\\:;()[\]{}<>|]+/))
        .map((term) => term.trim())
        .filter(Boolean)));
    return tokens.map(ftsPhrase).join(" OR ");
}

function bm25Score(raw: unknown): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? -value : 1 / (1 + value);
}

function bm25Scores(dbPath: string, terms: string[], limit: number): Map<number, number> {
    const query = ftsQueryFromTerms(terms);
    if (!query) return new Map();
    const rows = sqliteJson<Bm25Row>(
        dbPath,
        `SELECT chunk_id, bm25(wiki_chunks_fts) AS bm25_score FROM wiki_chunks_fts WHERE wiki_chunks_fts MATCH '${sqlEsc(query)}' ORDER BY bm25_score LIMIT ${Math.max(1, limit)}`
    );
    const scores = new Map<number, number>();
    for (const row of rows) {
        const id = Number(row.chunk_id);
        if (Number.isFinite(id)) scores.set(id, bm25Score(row.bm25_score));
    }
    return scores;
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

    const rows = sqliteJson<VectorRow>(stats.dbPath, `SELECT c.chunk_id, c.path, c.source_group, c.title, c.chunk_text, c.chunk_start_line, c.chunk_end_line, v.vector_json FROM wiki_chunks c LEFT JOIN wiki_vectors v ON v.chunk_id = c.chunk_id AND v.dim = ${stats.vectorDim}`);
    const chunkById = new Map<number, VectorRow>();
    const vectorScores = new Map<number, number>();
    for (const row of rows) {
        const id = Number(row.chunk_id);
        if (!Number.isFinite(id)) continue;
        chunkById.set(id, row);
        if (!queryVector || !row.vector_json) continue;
        let vector: number[] | null = null;
        try {
            vector = validVector(JSON.parse(row.vector_json) as unknown, stats.vectorDim);
        } catch {
            vector = null;
        }
        if (!vector) continue;
        vectorScores.set(id, Math.max(0, (cosineSimilarity(queryVector, vector) + 1) / 2));
    }

    const lexicalScores = bm25Scores(stats.dbPath, terms, Math.max(limit * 8, 50));
    const normalizedVector = normalizedScores(vectorScores);
    const normalizedBm25 = normalizedScores(lexicalScores);
    const candidateIds = new Set<number>([...normalizedVector.keys(), ...normalizedBm25.keys()]);
    const vectorWeight = normalizedVector.size > 0 ? HYBRID_VECTOR_WEIGHT : 0;
    const bm25Weight = normalizedBm25.size > 0 ? HYBRID_BM25_WEIGHT : 0;
    const totalWeight = vectorWeight + bm25Weight || 1;
    const matches: VectorMatch[] = [];
    for (const id of candidateIds) {
        const row = chunkById.get(id);
        if (!row) continue;
        const vectorScore = normalizedVector.get(id) || 0;
        const lexicalScore = normalizedBm25.get(id) || 0;
        matches.push({
            relPath: row.path,
            title: row.title,
            text: row.chunk_text,
            startLine: Number(row.chunk_start_line) || 1,
            endLine: Number(row.chunk_end_line) || 1,
            score: ((vectorScore * vectorWeight) + (lexicalScore * bm25Weight)) / totalWeight,
            vectorScore,
            bm25Score: lexicalScore,
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
    return {stats, matches: matches.slice(0, limit), reason, bm25Count: lexicalScores.size, vectorScoredCount: vectorScores.size};
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
            runRuntimeScript(ctx, "runners/wiki/scripts/update-wiki.ts", args.slice(2));
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
                    out("bm25_backend=fts5");
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
                out("bm25_backend=fts5");
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
            out("semantic_lint=skipped");
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
                out("bm25_backend=fts5");
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
        default:
            fail(`Unknown wiki command: ${subcmd}`);
    }
}
