import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, detectHostGuidanceDrift, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function doctorProject(args: string[]): void {
    const parsed = parseArgs(args);
    const positionals = parsed.positionals.filter((item) => item !== "--fix");
    const ctx = projectContext(positionals[0] || ".", positionals[1] || defaultBoardDirName());
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!fs.existsSync(ctx.boardRoot)) {
        errors.push(`missing_board_root=${ctx.boardRoot}`);
    }
    const requiredHostAssets = [
        path.join(ctx.projectRoot, "AGENTS.md"),
        path.join(ctx.projectRoot, "CLAUDE.md"),
        path.join(ctx.projectRoot, ".claude", "skills", "autoflow", "SKILL.md"),
        path.join(ctx.projectRoot, ".claude", "skills", "order", "SKILL.md"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", ".claude-plugin", "plugin.json"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "autoflow", "SKILL.md"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "order", "SKILL.md"),
        path.join(ctx.projectRoot, ".codex", "skills", "autoflow", "SKILL.md"),
        path.join(ctx.projectRoot, ".codex", "skills", "autoflow", "agents", "openai.yaml"),
        path.join(ctx.projectRoot, ".codex", "skills", "order", "SKILL.md"),
        path.join(ctx.projectRoot, ".codex", "skills", "order", "agents", "openai.yaml"),
    ];
    for (const file of requiredHostAssets) {
        if (!fs.existsSync(file)) {
            errors.push(`missing_host_asset=${path.relative(ctx.projectRoot, file).split(path.sep).join("/")}`);
        }
    }
    const requiredScripts = [
        "runners/planner/start/index.ts",
        "runners/worker/start/index.ts",
        "runners/worker/finish-ticket/index.ts",
        "runners/worker/merge-ready-ticket.ts",
        "runners/verifier/legacy-verify/index.ts",
        "runners/wiki/scripts/update-wiki.ts",
    ];
    let runtimeScriptMissing = false;
    for (const script of requiredScripts) {
        if (!fs.existsSync(path.join(REPO_ROOT, "app", "runtime", script))) {
            runtimeScriptMissing = true;
            errors.push(`missing_runtime_script=${script}`);
        }
    }
    const hostGuidanceDrift = detectHostGuidanceDrift(ctx);
    for (const item of hostGuidanceDrift) {
        if (item.status === "stale") {
            warnings.push(`stale_host_guidance=${item.file}:${item.staleMatches.join("+")}`);
        } else if (item.status === "custom") {
            warnings.push(`custom_host_guidance=${item.file}`);
        } else if (item.status === "missing") {
            warnings.push(`missing_host_guidance=${item.file}`);
        }
    }
    out(errors.length === 0 ? "status=ok" : "status=fail");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`error_count=${errors.length}`);
    out(`warning_count=${warnings.length}`);
    errors.forEach((item, index) => out(`error.${index + 1}=${item}`));
    warnings.forEach((item, index) => out(`warning.${index + 1}=${item}`));
    out(runtimeScriptMissing ? "check.runtime_script_companions=fail" : "check.runtime_script_companions=ok");
    out(requiredHostAssets.every((file) => fs.existsSync(file)) ? "check.host_assets=ok" : "check.host_assets=fail");
    out(hostGuidanceDrift.some((item) => item.status === "stale" || item.status === "missing") ? "check.host_guidance=warning" : "check.host_guidance=ok");
    out("doctor.typescript_migration.cli=ok");
}
