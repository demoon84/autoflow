import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, tokenMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

function syncRunnerTokenStates(ctx: ReturnType<typeof projectContext>, runners: Array<Record<string, string>>): void {
    const script = runtimeScriptPath("system/runner-tokens.ts");
    const tsx = requiredTsxCli();
    for (const runner of runners) {
        const runnerId = runner.id || "";
        if (!runnerId) continue;
        spawnSync(process.execPath, [tsx, script, "sync-codex-sessions", "--runner", runnerId], {
            cwd: ctx.projectRoot,
            env: {
                ...process.env,
                AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
                AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
                BOARD_ROOT: ctx.boardRoot,
                AUTOFLOW_RUNNER_ID: runnerId,
                RUNNER_ID: runnerId,
            },
            stdio: "ignore",
            timeout: 30000,
        });
    }
}

export function metricsProject(args: string[]): void {
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const runners = parseRunnerConfig(ctx);
    syncRunnerTokenStates(ctx, runners);
    const counts = countTicketDirs(ctx);
    const workflowMetrics = shared.ticketWorkflowMetrics(ctx);
    const tokenMetrics = tokenMetricTotals(ctx, runners);
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
    const codeTotals = codeMetricTotals(ctx, runners);
    out(`autoflow_code_files_changed_count=${codeTotals.files}`);
    out(`autoflow_code_insertions_count=${codeTotals.insertions}`);
    out(`autoflow_code_deletions_count=${codeTotals.deletions}`);
    out(`autoflow_code_volume_count=${codeTotals.volume}`);
    out(`autoflow_code_net_delta_count=${codeTotals.net}`);
    for (const [key, value] of Object.entries(tokenMetrics)) {
        out(`${key}=${value}`);
    }
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
            ...Object.entries(tokenMetrics).map(([key, value]) => `${key}=${value}`),
            `updated_at=${new Date().toISOString()}`,
            "",
        ].join("\n"), true);
        out(`metrics_file=${metricsFile}`);
    }
}
