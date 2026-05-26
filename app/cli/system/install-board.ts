import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, cleanupObsoleteHostFiles, cleanupObsoleteUserShareFiles, migrateQueueDirectoryNames, archiveLegacyOrderQueue, migrateStaleVerifyPendingDecisionFields, migrateLegacyVerifierTicketsToInprogress, migrateTicketNaming, migratePreviousWorkflowTerminology, cleanupPreviousRunnerResidue, syncBoardInstallAssets, syncProjectHostInstallAssets, syncUserShareInstallAssets, syncUserHomeInstallAssets, migrateRunnerConfigToLocal, userShareRoot, ensureViteSidecarWatchIgnores, detectHostGuidanceDrift, writeBoardCoreManifest, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;
import {refreshWikiSearchIndex} from "../runners/wiki/wiki";

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
    const overwrite = mode === "upgrade";
    ensureDir(ctx.boardRoot);
    const boardAssets = (() => {
        try {
            return syncBoardInstallAssets(ctx, {overwrite});
        } catch (error) {
            return fail(`Install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();
    const shareAssets = (() => {
        try {
            return syncUserShareInstallAssets(ctx, {overwrite: true});
        } catch (error) {
            return fail(`User-share install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();
    const userHomeAssets = (() => {
        try {
            return syncUserHomeInstallAssets(ctx, {overwrite});
        } catch (error) {
            return fail(`User-home install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();
    const runnerConfigMigrated = migrateRunnerConfigToLocal(ctx);
    const obsoleteRemoved = cleanupObsoleteBoardFiles(ctx);
    const obsoleteHostRemoved = cleanupObsoleteHostFiles(ctx);
    const obsoleteShareRemoved = cleanupObsoleteUserShareFiles(ctx);
    const queueDirectoryMigrated = migrateQueueDirectoryNames(ctx);
    const legacyOrdersArchived = archiveLegacyOrderQueue(ctx);
    const staleVerifyPendingDecisionMigrated = migrateStaleVerifyPendingDecisionFields(ctx);
    const ticketNamingMigration = migrateTicketNaming(ctx);
    const previousWorkflowTerminology = migratePreviousWorkflowTerminology(ctx);
    const previousRunnerResidue = cleanupPreviousRunnerResidue(ctx);
    const terminologyMigrated = migrateWorkerTerminology(ctx);
    const hostAssets = (() => {
        try {
            return syncProjectHostInstallAssets(ctx, {overwriteSkills: overwrite, overwriteHostGuidance: refreshHostGuidance});
        } catch (error) {
            return fail(`Host install source sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    })();

    const ticketDirs = ["prd", "todo", "inprogress", "done", "archive"];
    for (const dir of ticketDirs) {
        ensureDir(path.join(ctx.boardRoot, "tickets", dir));
    }
    migrateLegacyVerifierTicketsToInprogress(ctx.boardRoot);
    for (const dir of ["state", "state/pr-drafts"]) {
        ensureDir(path.join(ctx.boardRoot, "runners", dir));
    }
    writeFile(path.join(ctx.boardRoot, ".project-root"), `${ctx.projectRoot}\n`, true);
    writeFile(path.join(ctx.boardRoot, ".autoflow-version"), `${packageVersion()}\n`, true);
    const boardManifestCore = writeBoardCoreManifest(ctx, {mode});
    const gitInstall = ensureGitBaseline(ctx);
    // Ensure sidecar/worktree .gitignore patterns even when the project already
    // has a git HEAD (ensureGitBaseline only writes .gitignore during initial
    // baseline commit). This keeps the local board out of product history
    // across both fresh-init and existing-repo upgrade paths.
    const gitignoreRefreshed = ensureInstallGitignore(ctx);
    const viteWatchIgnore = (() => {
        try {
            return ensureViteSidecarWatchIgnores(ctx);
        } catch (error) {
            return {
                status: "error" as const,
                files: [],
                skipped: [error instanceof Error ? error.message : String(error)],
                patterns: [],
                reason: "vite_watch_ignore_failed",
            };
        }
    })();
    const wikiIndex = refreshWikiSearchIndex(ctx, true);
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
    out(`board_manifest=${boardManifestCore.boardManifestPath}`);
    out(`board_schema_version=${boardManifestCore.boardSchemaVersion || "1"}`);
    out(`core_ref=${boardManifestCore.ref}`);
    out(`core_source=${boardManifestCore.source}`);
    out(`core_root=${boardManifestCore.coreRoot}`);
    out(`core_available=${boardManifestCore.available ? "true" : "false"}`);
    out(`core_version=${boardManifestCore.version}`);
    out(`core_required_version=${boardManifestCore.requiredVersion}`);
    out(`core_runtime_root=${boardManifestCore.runtimeRoot}`);
    out(`core_install_root=${boardManifestCore.installRoot}`);
    out(`core_registry=${boardManifestCore.registryPath}`);
    out("runtime_scripts=typescript");
    out(`git_status=${gitInstall.status}`);
    out(`git_available=${gitInstall.available ? "true" : "false"}`);
    out(`git_initialized=${gitInstall.initialized ? "true" : "false"}`);
    out(`git_head_present=${gitInstall.hasHead ? "true" : "false"}`);
    out(`git_head=${gitInstall.head}`);
    out(`git_root=${gitInstall.root}`);
    out(`gitignore_updated=${gitInstall.gitignoreUpdated || gitignoreRefreshed ? "true" : "false"}`);
    const boardIgnore = shared.detectBoardIgnore(ctx);
    if (boardIgnore) {
        out(`board_ignore_configured=true`);
        out(`board_ignore_pattern=${boardIgnore}`);
    } else {
        out(`board_ignore_configured=false`);
    }
    const trackedBoardFiles = shared.listTrackedBoardFiles(ctx);
    out(`board_tracked_sample_count=${trackedBoardFiles.length}`);
    if (trackedBoardFiles.length > 0) {
        out(`board_tracked_sample=${trackedBoardFiles.join(",")}`);
        out(`board_tracked_hint=보드는 개인 로컬 실행 원장이므로 Git 추적 대상이 아니다. 기존에 추적된 보드 파일은 필요하면 백업한 뒤 git rm --cached -r ${ctx.boardDirName} 로 인덱스에서 제거한다.`);
    }
    out(`vite_watch_ignore_status=${viteWatchIgnore.status}`);
    out(`vite_watch_ignore_reason=${viteWatchIgnore.reason}`);
    if (viteWatchIgnore.files.length > 0) {
        out(`vite_watch_ignore_files=${viteWatchIgnore.files.join(",")}`);
    }
    if (viteWatchIgnore.skipped.length > 0) {
        out(`vite_watch_ignore_skipped=${viteWatchIgnore.skipped.join(",")}`);
    }
    if (viteWatchIgnore.patterns.length > 0) {
        out(`vite_watch_ignore_patterns=${viteWatchIgnore.patterns.join(",")}`);
    }
    out(`board_assets_created_count=${boardAssets.created}`);
    out(`board_assets_unchanged_count=${boardAssets.unchanged}`);
    out(`board_assets_preserved_count=${boardAssets.preserved}`);
    out(`board_assets_overwritten_count=${boardAssets.overwritten}`);
    out(`share_root=${boardManifestCore.shareRoot}`);
    out(`share_assets_created_count=${shareAssets.created}`);
    out(`share_assets_unchanged_count=${shareAssets.unchanged}`);
    out(`share_assets_preserved_count=${shareAssets.preserved}`);
    out(`share_assets_overwritten_count=${shareAssets.overwritten}`);
    out(`runner_config_migrated_count=${runnerConfigMigrated.length}`);
    if (runnerConfigMigrated.length > 0) {
        out(`runner_config_migrated=${runnerConfigMigrated.join(",")}`);
    }
    out(`user_home_assets_created_count=${userHomeAssets.created}`);
    out(`user_home_assets_unchanged_count=${userHomeAssets.unchanged}`);
    out(`user_home_assets_preserved_count=${userHomeAssets.preserved}`);
    out(`user_home_assets_overwritten_count=${userHomeAssets.overwritten}`);
    if (userHomeAssets.files.length > 0) {
        out(`user_home_assets_changed=${userHomeAssets.files.join(",")}`);
    }
    out(`obsolete_removed_count=${obsoleteRemoved.length}`);
    if (obsoleteRemoved.length > 0) {
        out(`obsolete_removed=${obsoleteRemoved.join(",")}`);
    }
    out(`obsolete_host_removed_count=${obsoleteHostRemoved.length}`);
    if (obsoleteHostRemoved.length > 0) {
        out(`obsolete_host_removed=${obsoleteHostRemoved.join(",")}`);
    }
    out(`obsolete_share_removed_count=${obsoleteShareRemoved.length}`);
    if (obsoleteShareRemoved.length > 0) {
        out(`obsolete_share_removed=${obsoleteShareRemoved.join(",")}`);
    }
    out(`queue_dir_migrated_count=${queueDirectoryMigrated.length}`);
    if (queueDirectoryMigrated.length > 0) {
        out(`queue_dir_migrated=${queueDirectoryMigrated.join(",")}`);
    }
    out(`legacy_orders_archived_count=${legacyOrdersArchived.length}`);
    if (legacyOrdersArchived.length > 0) {
        out(`legacy_orders_archived=${legacyOrdersArchived.join(",")}`);
    }
    out(`stale_verify_pending_decision_migrated_count=${staleVerifyPendingDecisionMigrated.length}`);
    if (staleVerifyPendingDecisionMigrated.length > 0) {
        out(`stale_verify_pending_decision_migrated=${staleVerifyPendingDecisionMigrated.join(",")}`);
    }
    out(`ticket_naming_visited_count=${ticketNamingMigration.visited}`);
    out(`ticket_naming_content_changed_count=${ticketNamingMigration.contentChanged.length}`);
    out(`ticket_naming_replacements=${ticketNamingMigration.replacements}`);
    out(`ticket_naming_files_renamed_count=${ticketNamingMigration.filesRenamed.length}`);
    out(`ticket_naming_dirs_renamed_count=${ticketNamingMigration.dirsRenamed.length}`);
    if (ticketNamingMigration.filesRenamed.length > 0) {
        out(`ticket_naming_files_renamed=${ticketNamingMigration.filesRenamed.map((r) => `${r.from}->${r.to}`).slice(0, 50).join(",")}`);
    }
    if (ticketNamingMigration.dirsRenamed.length > 0) {
        out(`ticket_naming_dirs_renamed=${ticketNamingMigration.dirsRenamed.map((r) => `${r.from}->${r.to}`).slice(0, 50).join(",")}`);
    }
    out(`previous_workflow_terms_changed_count=${previousWorkflowTerminology.filesChanged.length}`);
    out(`previous_workflow_terms_replacements=${previousWorkflowTerminology.replacements}`);
    if (previousWorkflowTerminology.filesChanged.length > 0) {
        out(`previous_workflow_terms_changed=${previousWorkflowTerminology.filesChanged.slice(0, 50).join(",")}`);
    }
    out(`previous_runner_residue_changed_count=${previousRunnerResidue.filesChanged.length}`);
    out(`previous_runner_residue_replacements=${previousRunnerResidue.replacements}`);
    if (previousRunnerResidue.filesChanged.length > 0) {
        out(`previous_runner_residue_changed=${previousRunnerResidue.filesChanged.slice(0, 50).join(",")}`);
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
    out(`wiki_index_status=${wikiIndex.status}`);
    if (wikiIndex.reason) out(`wiki_index_reason=${wikiIndex.reason}`);
    out("wiki_index_backend=markdown");
    out(`wiki_search_provider=${wikiIndex.qmdProvider ? "qmd_optional" : "markdown_scan"}`);
    out(`wiki_qmd_available=${wikiIndex.qmdProvider ? "true" : "false"}`);
    out(`wiki_lexical_backend=${wikiIndex.lexicalBackend}`);
    out(`wiki_text_storage=${wikiIndex.textStorage}`);
    out(`wiki_search_accelerator=${wikiIndex.searchAccelerator}`);
    out(`wiki_index_chunks=${wikiIndex.indexedChunks}`);
    if (gitInstall.detail) out(`git_detail=${gitInstall.detail}`);
}
