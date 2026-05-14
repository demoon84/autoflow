import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function orderProject(args: string[]): void {
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown order command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const orderDir = path.join(ctx.boardRoot, "tickets", "order");
    ensureDir(orderDir);
    const id = nextNumericId(orderDir, "order", firstFlag(parsed, "id"));
    const title = firstFlag(parsed, "title") || `Order ${id}`;
    const request = readRequestText(parsed, "request") || title;
    const allowedPaths = allFlags(parsed, "allowed-path");
    const verification = allFlags(parsed, "verification");
    const file = path.join(orderDir, `order_${id}.md`);
    if (fs.existsSync(file) && !hasFlag(parsed, "force")) {
        fail(`Order already exists: ${file}`);
    }
    const lines = [
        `# Order ${id}: ${title}`,
        "",
        "## Order",
        `- Priority: ${firstFlag(parsed, "priority") || "normal"}`,
        hasFlag(parsed, "express") ? "- Express: true" : "- Express: false",
        "",
        "## Request",
        request.trim(),
        "",
        "## Scope",
        firstFlag(parsed, "scope") || "- planner가 가장 좁은 구현 범위로 정리한다.",
        "",
        "## Allowed Paths",
        ...(allowedPaths.length > 0 ? allowedPaths.map((item) => `- ${item}`) : ["- TBD"]),
        "",
        "## Verification",
        ...(verification.length > 0 ? verification.map((item) => `- ${item}`) : ["- TBD"]),
        "",
    ];
    writeFile(file, `${lines.join("\n")}\n`, true);
    out("status=ok");
    out(`order_id=${id}`);
    out(`path=${file}`);
}
