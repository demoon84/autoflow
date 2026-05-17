import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, migrateQueueDirectoryNames, migratePromotedOrderQueueItems, syncBoardInstallAssets, syncProjectHostInstallAssets, detectHostGuidanceDrift, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;
import {buildWikiVectorIndex} from "../runners/wiki/wiki";

function hasInstallHelpFlag(args: string[]): boolean {
    return args.includes("--help") || args.includes("-h");
}

function printInstallUsage(mode: "init" | "upgrade"): void {
    out(`Usage: autoflow ${mode} [project-root] [board-dir-name] [--refresh-host-guidance]

Options:
  --refresh-host-guidance  Overwrite target AGENTS.md and CLAUDE.md from the current Autoflow host templates.`);
}

export function installBoard(args: string[], mode: "init" | "upgrade" = "init"): void {
    if (hasInstallHelpFlag(args)) {
        printInstallUsage(mode);
        return;
    }
    const refreshHostGuidance = args.includes("--refresh-host-guidance");
    const positionalArgs = args.filter((arg) => arg !== "--refresh-host-guidance");
    const ctx = projectContext(positionalArgs[0] || ".", positionalArgs[1] || defaultBoardDirName(), true);
    if (samePath(ctx.projectRoot, REPO_ROOT)) {
        fail("Refusing to install a board into the Autoflow source repository root. Choose a separate target project instead.");
    }
    const overwrite = mode === "upgrade";
    ensureDir(ctx.boardRoot);
    const boardAssets = (() => {
        try {
            return syncBoardInstallAssets(ctx, {overwrite});
        } catch (error) {
            return fail(`Install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();
    const obsoleteRemoved = cleanupObsoleteBoardFiles(ctx);
    const queueDirectoryMigrated = migrateQueueDirectoryNames(ctx);
    const promotedOrderMigrated = migratePromotedOrderQueueItems(ctx);
    const terminologyMigrated = migrateWorkerTerminology(ctx);
    const hostAssets = (() => {
        try {
            return syncProjectHostInstallAssets(ctx, {overwriteSkills: overwrite, overwriteHostGuidance: refreshHostGuidance});
        } catch (error) {
            return fail(`Host install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();

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
    const wikiVectorIndex = buildWikiVectorIndex(ctx, true);
    const hostGuidanceDrift = detectHostGuidanceDrift(ctx);
    const hostGuidanceCustom = hostGuidanceDrift.filter((item) => item.status === "custom");
    const hostGuidanceStale = hostGuidanceDrift.filter((item) => item.status === "stale");
    const hostGuidanceMissing = hostGuidanceDrift.filter((item) => item.status === "missing");
    const hostGuidanceStatus = hostGuidanceStale.length > 0 || hostGuidanceMissing.length > 0
        ? "warning"
        : hostGuidanceCustom.length > 0 ? "custom" : "ok";

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
    out(`board_assets_created_count=${boardAssets.created}`);
    out(`board_assets_unchanged_count=${boardAssets.unchanged}`);
    out(`board_assets_preserved_count=${boardAssets.preserved}`);
    out(`board_assets_overwritten_count=${boardAssets.overwritten}`);
    out(`obsolete_removed_count=${obsoleteRemoved.length}`);
    if (obsoleteRemoved.length > 0) {
        out(`obsolete_removed=${obsoleteRemoved.join(",")}`);
    }
    out(`queue_dir_migrated_count=${queueDirectoryMigrated.length}`);
    if (queueDirectoryMigrated.length > 0) {
        out(`queue_dir_migrated=${queueDirectoryMigrated.join(",")}`);
    }
    out(`promoted_order_migrated_count=${promotedOrderMigrated.length}`);
    if (promotedOrderMigrated.length > 0) {
        out(`promoted_order_migrated=${promotedOrderMigrated.join(",")}`);
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
    out(`host_guidance_refresh_requested=${refreshHostGuidance ? "true" : "false"}`);
    out(`host_guidance_status=${hostGuidanceStatus}`);
    out(`host_guidance_custom_count=${hostGuidanceCustom.length}`);
    out(`host_guidance_stale_count=${hostGuidanceStale.length}`);
    out(`host_guidance_missing_count=${hostGuidanceMissing.length}`);
    hostGuidanceDrift
        .filter((item) => item.status !== "ok")
        .forEach((item, index) => {
            const reasons = item.staleMatches.length > 0 ? item.staleMatches.join("+") : item.status;
            out(`host_guidance.${index + 1}=${item.file}:${item.status}:${reasons}`);
        });
    out(`wiki_vector_index_status=${wikiVectorIndex.status}`);
    if (wikiVectorIndex.reason) out(`wiki_vector_index_reason=${wikiVectorIndex.reason}`);
    out("wiki_index_backend=hybrid");
    out(`wiki_bm25_backend=${wikiVectorIndex.bm25Ready ? "fts5" : "unavailable"}`);
    out(`wiki_vector_index_db=${wikiVectorIndex.dbPath}`);
    out(`wiki_vector_index_chunks=${wikiVectorIndex.indexedChunks}`);
    out(`wiki_vector_index_vectors=${wikiVectorIndex.vectorCount}`);
    out(`wiki_vector_model=${wikiVectorIndex.vectorModel}`);
    out(`wiki_vector_dim=${wikiVectorIndex.vectorDim}`);
    if (gitInstall.detail) out(`git_detail=${gitInstall.detail}`);
}
