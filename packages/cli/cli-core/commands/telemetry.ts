import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function telemetryProject(args: string[]): void {
    const maybeSubcmd = args[2] || args[0] || "summary";
    const projectArg = args[0] && !args[0].startsWith("-") ? args[0] : ".";
    const boardArg = args[1] && !args[1].startsWith("-") ? args[1] : defaultBoardDirName();
    const ctx = projectContext(projectArg, boardArg);
    ensureBoard(ctx);
    const telemetryDir = path.join(ctx.boardRoot, "runners", "telemetry");
    ensureDir(telemetryDir);
    out("status=ok");
    out(`telemetry_command=${maybeSubcmd}`);
    out(`telemetry_dir=${telemetryDir}`);
    out("event_count=0");
    if (maybeSubcmd === "token-usage") {
        out("token_total=0");
        out("token_source=none");
    }
}
