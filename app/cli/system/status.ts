import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function statusProject(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    const boardExists = fs.existsSync(ctx.boardRoot) && fs.statSync(ctx.boardRoot).isDirectory();
    const initialized = boardExists && fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) && fs.existsSync(path.join(ctx.boardRoot, "tickets"));
    const counts = countTicketDirs(ctx);
    const boardVersion = readSingleLine(path.join(ctx.boardRoot, ".autoflow-version"));
    const pkgVersion = packageVersion();
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
    out(`git_available=${projectGit.available ? "true" : "false"}`);
    out(`git_initialized=${projectGit.inside ? "true" : "false"}`);
    out(`git_root=${projectGit.root}`);
    out(`git_head_present=${projectGit.hasHead ? "true" : "false"}`);
    out(`git_head=${projectGit.head}`);
    if (projectGit.detail) out(`git_detail=${projectGit.detail}`);
    out(`initialized=${initialized ? "true" : "false"}`);
    out(`host_agents_present=${fs.existsSync(path.join(ctx.projectRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`host_claude_present=${fs.existsSync(path.join(ctx.projectRoot, "CLAUDE.md")) ? "true" : "false"}`);
    out(`host_claude_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`host_claude_skill_order_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "skills", "order", "SKILL.md")) ? "true" : "false"}`);
    out(`host_claude_plugin_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "autoflow-plugin", ".claude-plugin", "plugin.json")) ? "true" : "false"}`);
    out(`host_claude_plugin_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`host_claude_plugin_skill_order_present=${fs.existsSync(path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "order", "SKILL.md")) ? "true" : "false"}`);
    out(`host_codex_skill_autoflow_present=${fs.existsSync(path.join(ctx.projectRoot, ".codex", "skills", "autoflow", "SKILL.md")) ? "true" : "false"}`);
    out(`host_codex_skill_order_present=${fs.existsSync(path.join(ctx.projectRoot, ".codex", "skills", "order", "SKILL.md")) ? "true" : "false"}`);
    out(`board_agents_present=${fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`board_readme_present=${fs.existsSync(path.join(ctx.boardRoot, "README.md")) ? "true" : "false"}`);
    out(`project_root_marker_present=${fs.existsSync(path.join(ctx.boardRoot, ".project-root")) ? "true" : "false"}`);
    out(`project_root_marker_value=${readSingleLine(path.join(ctx.boardRoot, ".project-root"))}`);
    out(`project_root_marker_resolved=${ctx.projectRoot}`);
    out(`spec_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "prd"), /^prd_\d+\.md$/)}`);
    out("plan_count=0");
    out("plan_draft_count=0");
    out("plan_ready_count=0");
    out("plan_ticketed_count=0");
    out(`plan_done_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "done"), /^prd_\d+\.md$/)}`);
    out(`ticket_todo_count=${counts.todo}`);
    out(`ticket_inprogress_count=${counts.inprogress}`);
    out(`ticket_done_count=${counts.done}`);
    out(`ticket_claimed_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "claimed")}`);
    out(`ticket_executing_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "executing")}`);
    out(`ticket_ready_for_verification_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "ready_for_verification")}`);
    out(`ticket_verifying_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "verifying")}`);
    out(`ticket_blocked_count=${countTicketStage(path.join(ctx.boardRoot, "tickets", "inprogress"), "blocked")}`);
    out(`verify_run_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "inprogress"), /^verify_\d+\.md$/)}`);
    out(`runner_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "runners", "config.toml")) ? "true" : "false"}`);
    out(`wiki_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "wiki", "index.md")) ? "true" : "false"}`);
    out(`metrics_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "metrics", "README.md")) ? "true" : "false"}`);
    out(`conversation_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "conversations", "README.md")) ? "true" : "false"}`);
    out(`adapter_scaffold_present=${fs.existsSync(path.join(ctx.boardRoot, "agents", "adapters", "README.md")) ? "true" : "false"}`);
    out("ticket_planning_count=0");
    out("ticket_ready_to_merge_count=0");
    out("ticket_merge_blocked_count=0");
    out(`ticket_worker_active_count=${counts.inprogress}`);
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`todo=${counts.todo}`);
    out(`inprogress=${counts.inprogress}`);
    out(`verifier=${counts.verifier}`);
    out(`done=${counts.done}`);
}
