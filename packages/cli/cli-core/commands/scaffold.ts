import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, migrateQueueDirectoryNames, syncProjectHostInstallAssets, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function scaffoldProject(args: string[], mode: "init" | "upgrade" = "init"): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName(), true);
    const overwrite = mode === "upgrade";
    ensureDir(ctx.boardRoot);
    copyTree(path.join(REPO_ROOT, "scaffold", "board"), ctx.boardRoot, {overwrite, skipShell: true});
    copyTree(path.join(REPO_ROOT, "runtime", "board-scripts"), path.join(ctx.boardRoot, "scripts"), {overwrite: true, skipShell: true});
    const obsoleteRemoved = cleanupObsoleteBoardFiles(ctx);
    const queueDirectoryMigrated = migrateQueueDirectoryNames(ctx);
    const terminologyMigrated = migrateWorkerTerminology(ctx);
    const hostAssets = syncProjectHostInstallAssets(ctx, {overwriteSkills: overwrite});

    const ticketDirs = ["order", "prd", "todo", "inprogress", "verifier", "done", "archive"];
    for (const dir of ticketDirs) {
        ensureDir(path.join(ctx.boardRoot, "tickets", dir));
    }
    for (const dir of ["logs", "state", "state/pr-drafts"]) {
        ensureDir(path.join(ctx.boardRoot, "runners", dir));
    }
    writeFile(path.join(ctx.boardRoot, ".project-root"), `${ctx.projectRoot}\n`, true);
    writeFile(path.join(ctx.boardRoot, ".autoflow-version"), `${packageVersion()}\n`, true);
    const gitInstall = ensureGitBaseline(ctx);

    out("status=ok");
    out(`mode=${mode}`);
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out("runtime_scripts=typescript");
    out(`git_status=${gitInstall.status}`);
    out(`git_available=${gitInstall.available ? "true" : "false"}`);
    out(`git_initialized=${gitInstall.initialized ? "true" : "false"}`);
    out(`git_head_present=${gitInstall.hasHead ? "true" : "false"}`);
    out(`git_head=${gitInstall.head}`);
    out(`git_root=${gitInstall.root}`);
    out(`gitignore_updated=${gitInstall.gitignoreUpdated ? "true" : "false"}`);
    out(`obsolete_removed_count=${obsoleteRemoved.length}`);
    if (obsoleteRemoved.length > 0) {
        out(`obsolete_removed=${obsoleteRemoved.join(",")}`);
    }
    out(`queue_dir_migrated_count=${queueDirectoryMigrated.length}`);
    if (queueDirectoryMigrated.length > 0) {
        out(`queue_dir_migrated=${queueDirectoryMigrated.join(",")}`);
    }
    out(`terminology_migrated_count=${terminologyMigrated.length}`);
    if (terminologyMigrated.length > 0) {
        out(`terminology_migrated=${terminologyMigrated.join(",")}`);
    }
    out(`host_assets_created_count=${hostAssets.created}`);
    out(`host_assets_unchanged_count=${hostAssets.unchanged}`);
    out(`host_assets_preserved_count=${hostAssets.preserved}`);
    out(`host_assets_overwritten_count=${hostAssets.overwritten}`);
    if (hostAssets.files.length > 0) {
        out(`host_assets_changed=${hostAssets.files.join(",")}`);
    }
    if (gitInstall.detail) out(`git_detail=${gitInstall.detail}`);
}
