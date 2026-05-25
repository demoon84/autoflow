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
    indexedFiles: number;
    indexedChunks: number;
    sourceHash: string;
    bm25Ready: boolean;
    lexicalBackend: string;
    textStorage: string;
    searchAccelerator: string;
    qmdProvider: string;
};

type VectorMatch = {
    relPath: string;
    title: string;
    text: string;
    startLine: number;
    endLine: number;
    score: number;
    bm25Score?: number;
    contentSha?: string;
};

const WIKI_CHUNK_SIZE = 1024;
const WIKI_CHUNK_OVERLAP = 128;
const WIKI_LEXICAL_BACKEND = "markdown_scan";
const WIKI_TEXT_STORAGE = "markdown_files";
const WIKI_SEARCH_ACCELERATOR = "qmd_optional";

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
        `출처: ${ctx.boardDirName}/runners/config.local.toml 또는 share-root 기본 topology 및 ${ctx.boardDirName}/runners/state/*.state 에서 생성됨.`,
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

function wikiRoot(ctx: WikiProjectContext): string {
    return path.join(ctx.boardRoot, "wiki");
}

function rawRoot(ctx: WikiProjectContext): string {
    return path.join(ctx.boardRoot, "raw");
}

function normalizeWikiRelPath(relPath: string): string {
    return String(relPath || "")
        .replace(/\\/g, "/")
        .replace(/^[.][/]/, "")
        .replace(/^\.autoflow\//, "");
}

function wikiPageAbsPath(ctx: WikiProjectContext, relPath: string): string {
    const target = normalizeWikiRelPath(relPath);
    const boardRoot = path.resolve(ctx.boardRoot);
    const file = path.resolve(ctx.boardRoot, target);
    const relative = path.relative(boardRoot, file);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return "";
    return file;
}

function ensureWikiScaffold(ctx: WikiProjectContext): void {
    for (const dir of [
        wikiRoot(ctx),
        rawRoot(ctx),
        path.join(wikiRoot(ctx), "concepts"),
        path.join(wikiRoot(ctx), "decisions"),
        path.join(wikiRoot(ctx), "sources"),
        path.join(wikiRoot(ctx), "questions"),
        path.join(rawRoot(ctx), "clipped"),
        path.join(rawRoot(ctx), "conversations"),
        path.join(rawRoot(ctx), "evidence"),
        path.join(rawRoot(ctx), "external"),
    ]) {
        ensureDir(dir);
    }
    const indexPath = path.join(wikiRoot(ctx), "index.md");
    if (!fs.existsSync(indexPath)) {
        writeFile(indexPath, "# LLM Wiki Index\n\n이 파일은 위키 러너가 `.autoflow/wiki/**/*.md`를 기준으로 갱신하는 탐색용 목차다.\n", false);
    }
    const logPath = path.join(wikiRoot(ctx), "log.md");
    if (!fs.existsSync(logPath)) {
        writeFile(logPath, "# LLM Wiki Log\n\n", false);
    }
}

function wikiMarkdownFiles(ctx: WikiProjectContext): string[] {
    return walkMarkdownFiles(wikiRoot(ctx))
        .filter((file) => {
            const rel = path.relative(ctx.boardRoot, file).replace(/\\/g, "/");
            return rel !== "wiki/index.md" && rel !== "wiki/log.md" && !rel.endsWith("/README.md") && rel !== "wiki/README.md";
        })
        .sort((a, b) => a.localeCompare(b));
}

function refreshWikiIndexPage(ctx: WikiProjectContext): number {
    ensureDir(wikiRoot(ctx));
    const files = wikiMarkdownFiles(ctx);
    const lines = [
        "# LLM Wiki Index",
        "",
        "이 파일은 `.autoflow/wiki/**/*.md`의 탐색용 목차다. 위키의 원본은 로컬 보드 markdown 파일이며 검색 인덱스는 재생성 가능한 파생물이다.",
        "",
        "## Pages",
        "",
    ];
    if (files.length === 0) {
        lines.push("- 아직 생성된 위키 페이지가 없다.");
    } else {
        for (const file of files) {
            const rel = path.relative(ctx.boardRoot, file).replace(/\\/g, "/");
            const text = fs.readFileSync(file, "utf8");
            const title = firstNonEmptyLine(text).replace(/^#+\s*/, "") || path.basename(file);
            lines.push(`- [${title}](${rel.replace(/^wiki\//, "")}) — \`${rel}\``);
        }
    }
    lines.push("");
    writeFile(path.join(wikiRoot(ctx), "index.md"), lines.join("\n"), false);
    return files.length;
}

function appendWikiLogEntry(ctx: WikiProjectContext, action: string, relPath: string): void {
    ensureDir(wikiRoot(ctx));
    const at = new Date().toISOString();
    const file = path.join(wikiRoot(ctx), "log.md");
    const line = `## [${at.slice(0, 10)}] ${action} | ${relPath}\n\n- at: ${at}\n- path: \`${relPath}\`\n\n`;
    fs.appendFileSync(file, line, "utf8");
}

function qmdAvailable(): boolean {
    const result = spawnSync("qmd", ["--version"], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000});
    return result.status === 0;
}

function qmdCollectionArgs(): string[] {
    const raw = process.env.AUTOFLOW_QMD_COLLECTIONS || process.env.AUTOFLOW_QMD_COLLECTION || process.env.QMD_COLLECTION || "";
    return raw
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .flatMap((collection) => ["-c", collection]);
}

function qmdCommandMode(): "search" | "query" {
    const raw = String(process.env.AUTOFLOW_QMD_MODE || process.env.AUTOFLOW_QMD_COMMAND || "").trim().toLowerCase();
    return raw === "query" || raw === "hybrid" ? "query" : "search";
}

function qmdRelPath(rawPath: string, ctx: WikiProjectContext): string {
    if (rawPath.startsWith("qmd://")) {
        const withoutScheme = rawPath.replace(/^qmd:\/\/[^/]+\/?/, "").replace(/\\/g, "/");
        const boardPrefix = `${ctx.boardDirName}/`;
        return withoutScheme.startsWith(boardPrefix) ? withoutScheme.slice(boardPrefix.length) : withoutScheme;
    }
    const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(ctx.boardRoot, rawPath);
    let relPath = path.relative(ctx.boardRoot, abs).replace(/\\/g, "/");
    if (relPath.startsWith("../") || path.isAbsolute(relPath)) relPath = rawPath.replace(/\\/g, "/");
    return relPath;
}

function parseQmdMatches(raw: string, ctx: WikiProjectContext, limit: number): VectorMatch[] {
    if (!raw.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as {results?: unknown}).results)
            ? (parsed as {results: unknown[]}).results
            : Array.isArray((parsed as {matches?: unknown}).matches)
                ? (parsed as {matches: unknown[]}).matches
                : [];
    const matches: VectorMatch[] = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const rawPath = String(row.path || row.displayPath || row.file || row.docid || row.id || "");
        if (!rawPath) continue;
        const score = Number(row.score ?? row.rank ?? 0);
        matches.push({
            relPath: qmdRelPath(rawPath, ctx),
            title: String(row.title || row.heading || rawPath),
            text: String(row.snippet || row.text || row.content || ""),
            startLine: Number(row.startLine || row.line || 1) || 1,
            endLine: Number(row.endLine || row.line || 1) || 1,
            score: Number.isFinite(score) ? score : 0,
        });
        if (matches.length >= limit) break;
    }
    return matches;
}

function qmdSearch(ctx: WikiProjectContext, terms: string[], limit: number): {available: boolean; matches: VectorMatch[]; reason: string; command: string} {
    if (!qmdAvailable()) return {available: false, matches: [], reason: "qmd_missing", command: "qmd"};
    const query = terms.join(" ").trim();
    const mode = qmdCommandMode();
    if (!query) return {available: true, matches: [], reason: "empty_query", command: `qmd ${mode}`};
    const args = [mode, query, "--json", "-n", String(limit), ...qmdCollectionArgs()];
    const timeout = mode === "query" ? 30000 : 10000;
    const result = spawnSync("qmd", args, {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout, maxBuffer: 16 * 1024 * 1024});
    const command = ["qmd", ...args].join(" ");
    if (result.status !== 0) {
        return {available: true, matches: [], reason: oneLine(result.stderr || result.stdout || "qmd_failed"), command};
    }
    const matches = parseQmdMatches(result.stdout || "", ctx, limit);
    return {available: true, matches, reason: matches.length > 0 ? "" : "qmd_no_matches", command};
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
    if (relPath.startsWith("tickets/done/")) return "tickets_done";
    if (relPath.startsWith("raw/")) return "raw";
    if (relPath.startsWith("conversations/")) return "conversations";
    return "wiki";
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
        ...walkMarkdownFiles(path.join(ctx.boardRoot, "wiki")),
        ...walkMarkdownFiles(path.join(ctx.boardRoot, "raw")),
        ...walkMarkdownFiles(path.join(ctx.boardRoot, "conversations")),
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

type WikiUpsertResult = {
    status: "ok" | "skipped" | "error";
    reason?: string;
    path: string;
    chunks: number;
    replaced: number;
};

export function upsertWikiPage(ctx: WikiProjectContext, relPath: string, content: string): WikiUpsertResult {
    const target = normalizeWikiRelPath(relPath);
    if (!target.startsWith("wiki/") || !target.endsWith(".md")) {
        return {status: "error", reason: "invalid_path", path: target, chunks: 0, replaced: 0};
    }
    const trimmed = String(content || "").trim();
    if (!trimmed) {
        return {status: "error", reason: "empty_content", path: target, chunks: 0, replaced: 0};
    }
    const file = wikiPageAbsPath(ctx, target);
    if (!file) return {status: "error", reason: "unsafe_path", path: target, chunks: 0, replaced: 0};
    ensureWikiScaffold(ctx);
    ensureDir(path.dirname(file));
    const replaced = fs.existsSync(file) ? 1 : 0;
    const body = `${trimmed}\n`;
    writeFileAtomic(file, body);
    const chunks = chunkifyContent(body, target).length;
    refreshWikiIndexPage(ctx);
    appendWikiLogEntry(ctx, replaced ? "update" : "create", target);
    return {status: "ok", path: target, chunks, replaced};
}

export function deleteWikiPage(ctx: WikiProjectContext, relPath: string): {status: string; path: string; removed: number} {
    const target = normalizeWikiRelPath(relPath);
    if (!target.startsWith("wiki/") || !target.endsWith(".md")) {
        return {status: "invalid_path", path: target, removed: 0};
    }
    if (target === "wiki/index.md" || target === "wiki/log.md") {
        return {status: "protected_page", path: target, removed: 0};
    }
    const file = wikiPageAbsPath(ctx, target);
    if (!file) return {status: "unsafe_path", path: target, removed: 0};
    if (!fs.existsSync(file)) return {status: "not_found", path: target, removed: 0};
    fs.rmSync(file, {force: true});
    refreshWikiIndexPage(ctx);
    appendWikiLogEntry(ctx, "delete", target);
    return {status: "ok", path: target, removed: 1};
}

export function refreshWikiSearchIndex(ctx: WikiProjectContext, includeTickets: boolean): WikiIndexStats {
    ensureWikiScaffold(ctx);
    const qmd = qmdAvailable();
    const {chunks, fileCount, sourceHash} = collectWikiChunks(ctx, includeTickets);
    refreshWikiIndexPage(ctx);
    return {
        status: "ok",
        reason: qmd ? undefined : "qmd_missing_using_markdown_scan",
        indexedFiles: fileCount,
        indexedChunks: chunks.length,
        sourceHash,
        bm25Ready: true,
        lexicalBackend: qmd ? "qmd_optional" : WIKI_LEXICAL_BACKEND,
        textStorage: WIKI_TEXT_STORAGE,
        searchAccelerator: WIKI_SEARCH_ACCELERATOR,
        qmdProvider: qmd ? "qmd" : "",
    };
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
            ensureWikiScaffold(ctx);
            refreshWikiIndexPage(ctx);
            out("status=deprecated");
            out(`removed_command=wiki ${subcmd}`);
            out("hint='autoflow wiki write-page --path wiki/<category>/<slug>.md --content-file <file>'로 로컬 markdown wiki page를 작성한다");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "query": {
            ensureBoard(ctx);
            const terms = allFlags(parsed, "term").map((term) => term.toLowerCase()).filter(Boolean);
            const limit = Number.parseInt(firstFlag(parsed, "limit") || "10", 10) || 10;
            const includeTickets = !hasFlag(parsed, "no-tickets");
            if (hasFlag(parsed, "rag")) {
                const qmd = qmdSearch(ctx, terms, limit);
                const fallback = qmd.matches.length > 0 ? [] : markdownScanSearch(ctx, terms, limit, includeTickets);
                out("status=ok");
                out(`rag_backend=${qmd.matches.length > 0 ? "qmd" : "markdown_scan"}`);
                out(`qmd_available=${qmd.available ? "true" : "false"}`);
                if (qmd.command) out(`qmd_command=${qmd.command}`);
                if (qmd.reason) out(`qmd_reason=${qmd.reason}`);
                out(`text_storage=${WIKI_TEXT_STORAGE}`);
                out(`search_accelerator=${WIKI_SEARCH_ACCELERATOR}`);
                printMatches(qmd.matches.length > 0 ? qmd.matches : fallback);
                break;
            }
            out("status=ok");
            out("query_backend=markdown_scan");
            out(`qmd_available=${qmdAvailable() ? "true" : "false"}`);
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
                const stats = refreshWikiSearchIndex(ctx, includeTickets);
                out(`status=${stats.status}`);
                if (stats.reason) out(`reason=${stats.reason}`);
                out("index_backend=markdown");
                out(`search_provider=${stats.qmdProvider ? "qmd_optional" : "markdown_scan"}`);
                out(`qmd_available=${stats.qmdProvider ? "true" : "false"}`);
                out(`lexical_backend=${stats.lexicalBackend}`);
                out(`text_storage=${stats.textStorage}`);
                out(`search_accelerator=${stats.searchAccelerator}`);
                out(`indexed_files=${stats.indexedFiles}`);
                out(`indexed_chunks=${stats.indexedChunks}`);
                out(`qmd_provider_configured=${stats.qmdProvider ? "true" : "false"}`);
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
