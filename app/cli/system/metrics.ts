import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function metricsProject(args: string[]): void {
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const counts = countTicketDirs(ctx);
    const workflowMetrics = shared.ticketWorkflowMetrics(ctx);
    out("status=ok");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    for (const [key, value] of Object.entries(counts)) {
        out(`tickets.${key}=${value}`);
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    out(`tickets.total=${total}`);
    for (const [key, value] of Object.entries(workflowMetrics)) {
        out(`${key}=${value}`);
    }
    const codeTotals = codeMetricTotals(ctx);
    out(`autoflow_code_files_changed_count=${codeTotals.files}`);
    out(`autoflow_code_insertions_count=${codeTotals.insertions}`);
    out(`autoflow_code_deletions_count=${codeTotals.deletions}`);
    out(`autoflow_code_volume_count=${codeTotals.volume}`);
    out(`autoflow_code_net_delta_count=${codeTotals.net}`);
    if (hasFlag(parsed, "write")) {
        const metricsFile = path.join(ctx.boardRoot, "metrics", "snapshot.env");
        writeFile(metricsFile, [
            `tickets_total=${total}`,
            ...Object.entries(workflowMetrics).map(([key, value]) => `${key}=${value}`),
            `autoflow_code_files_changed_count=${codeTotals.files}`,
            `autoflow_code_insertions_count=${codeTotals.insertions}`,
            `autoflow_code_deletions_count=${codeTotals.deletions}`,
            `autoflow_code_volume_count=${codeTotals.volume}`,
            `autoflow_code_net_delta_count=${codeTotals.net}`,
            `updated_at=${new Date().toISOString()}`,
            "",
        ].join("\n"), true);
        out(`metrics_file=${metricsFile}`);
    }
}
