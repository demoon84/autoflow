import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, codexHomeRoot, claudeHomeRoot, resolveAutoflowCore, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function statusProject(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    const boardExists = fs.existsSync(ctx.boardRoot) && fs.statSync(ctx.boardRoot).isDirectory();
    const initialized = boardExists && fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) && fs.existsSync(path.join(ctx.boardRoot, "tickets"));
    const counts = countTicketDirs(ctx);
    const boardVersion = readSingleLine(path.join(ctx.boardRoot, ".autoflow-version"));
    const pkgVersion = packageVersion();
    const core = resolveAutoflowCore(ctx);
    const projectGit = gitState(ctx.projectRoot);
    const versionStatus = !boardExists
        ? "missing_board"
        : !boardVersion
            ? "missing_board_version"
            : boardVersion === pkgVersion
                ? "up_to_date"
                : "different";
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`board_dir_name=${ctx.boardDirName}`);
    out(`status=${initialized ? "initialized" : boardExists ? "partial_board" : "missing_board"}`);
    out(`package_version=${pkgVersion}`);
    out(`board_version=${boardVersion}`);
    out(`version_status=${versionStatus}`);
    out(`board_manifest_present=${fs.existsSync(core.boardManifestPath) ? "true" : "false"}`);
    out(`board_manifest=${core.boardManifestPath}`);
    out(`board_schema_version=${core.boardSchemaVersion}`);
    out(`board_schema_status=${core.boardSchemaVersion === "1" ? "ok" : core.boardSchemaVersion ? "different" : "missing"}`);
    out(`core_ref=${core.ref}`);
    out(`core_source=${core.source}`);
    out(`core_root=${core.coreRoot}`);
    out(`core_available=${core.available ? "true" : "false"}`);
    out(`core_version=${core.version}`);
    out(`core_required_version=${core.requiredVersion}`);
    out(`core_runtime_root=${core.runtimeRoot}`);
    out(`core_install_root=${core.installRoot}`);
    out(`core_registry=${core.registryPath}`);
    out(`core_pinned_root=${core.pinnedRoot}`);
    out(`core_pinned_version=${core.pinnedVersion}`);
    out(`git_available=${projectGit.available ? "true" : "false"}`);
    out(`git_initialized=${projectGit.inside ? "true" : "false"}`);
    out(`git_root=${projectGit.root}`);
    out(`git_head_present=${projectGit.hasHead ? "true" : "false"}`);
    out(`git_head=${projectGit.head}`);
    if (projectGit.detail) out(`git_detail=${projectGit.detail}`);
    out(`initialized=${initialized ? "true" : "false"}`);
    out(`host_agents_present=${fs.existsSync(path.join(ctx.projectRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`host_claude_present=${fs.existsSync(path.join(ctx.projectRoot, "CLAUDE.md")) ? "true" : "false"}`);
    const claudeHome = claudeHomeRoot();
    const codexHome = codexHomeRoot();
    out(`global_claude_home=${claudeHome}`);
    out(`global_codex_home=${codexHome}`);
    out(`global_claude_skill_autoflow_present=${fs.existsSync(path.join(claudeHome, "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`global_codex_skill_autoflow_present=${fs.existsSync(path.join(codexHome, "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`project_claude_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`host_claude_plugin_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "autoflow-plugin", ".claude-plugin", "plugin.json")) ? "true" : "false"}`);
    out(`project_claude_plugin_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`project_codex_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".codex", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`board_agents_present=${fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`board_readme_present=${fs.existsSync(path.join(ctx.boardRoot, "README.md")) ? "true" : "false"}`);
    out(`project_root_marker_present=${fs.existsSync(path.join(ctx.boardRoot, ".project-root")) ? "true" : "false"}`);
    out(`project_root_marker_value=${readSingleLine(path.join(ctx.boardRoot, ".project-root"))}`);
    out(`project_root_marker_resolved=${ctx.projectRoot}`);
    out(`spec_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "prd"), /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/)}`);
    out("plan_count=0");
    out("plan_draft_count=0");
    out("plan_ready_count=0");
    out("plan_ticketed_count=0");
    out(`plan_done_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "done"), /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/)}`);
    out(`work_item_pending_count=${counts.todo}`);
    out(`ticket_inprogress_count=${counts.inprogress}`);
    out(`ticket_done_count=${counts.done}`);
    out(`ticket_claimed_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "claimed")}`);
    out(`ticket_executing_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "executing")}`);
    out(`ticket_ready_for_verification_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "ready_for_verification")}`);
    out(`ticket_verifying_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "verifying")}`);
    out(`ticket_blocked_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "blocked")}`);
    out(`verify_run_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "inprogress"), /^verify_\d+\.md$/)}`);
    out(`runner_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "runners", "config.local.toml")) || fs.existsSync(path.join(core.shareRoot, "reference", "runners", "config.toml")) ? "true" : "false"}`);
    out(`wiki_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "wiki")) ? "true" : "false"}`);
    out(`metrics_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "metrics")) ? "true" : "false"}`);
    out(`conversation_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "conversations", "README.md")) ? "true" : "false"}`);
    out(`adapter_scaffold_present=${fs.existsSync(path.join(core.shareRoot, "agents", "adapters", "claude-cli.md")) ? "true" : "false"}`);
    out(`share_root=${core.shareRoot}`);
    out("ticket_planning_count=0");
    out(`ticket_worker_active_count=${counts.inprogress}`);
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`work_item_pending=${counts.todo}`);
    out(`inprogress=${counts.inprogress}`);
    out(`verifier=${counts.verifier}`);
    out(`done=${counts.done}`);
}
