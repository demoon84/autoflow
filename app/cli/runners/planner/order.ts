import * as shared from "../../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function orderProject(args: string[]): void {
    if (args.includes("--help") || args.includes("-h")) {
        out(`Usage: autoflow order create [project-root] [board-dir-name] [--title text] [--request text] [--allowed-path path]... [--verification command]

Options:
  --id NNN                    Use an explicit order id.
  --title text                Set the order title.
  --request text              Set the order request body.
  --from-file path            Read the request body from a file.
  --allowed-path path         Add an allowed path hint. May be repeated.
  --verification command      Add a verification command hint. May be repeated.
  --priority value            Set priority. Defaults to normal.
  --express                   Deprecated compatibility flag; records a direct-TODO hint for the planner runner.
  --force                     Overwrite an existing order id.`);
        return;
    }
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown order command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const orderDir = path.join(ctx.boardRoot, "tickets", "order");
    ensureDir(orderDir);
    const id = nextNumericId(path.join(ctx.boardRoot, "tickets"), "order", firstFlag(parsed, "id"));
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
        "- Express: false",
        hasFlag(parsed, "express") ? "- Planner Direct-TODO Hint: true" : "- Planner Direct-TODO Hint: false",
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
