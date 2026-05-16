import * as shared from "../../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function specProject(args: string[]): void {
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown spec command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const prdDir = path.join(ctx.boardRoot, "tickets", "prd");
    ensureDir(prdDir);
    const id = nextNumericId(prdDir, "prd", firstFlag(parsed, "id"));
    const title = firstFlag(parsed, "title") || `PRD ${id}`;
    const goal = firstFlag(parsed, "goal") || readRequestText(parsed, "goal") || title;
    const file = path.join(prdDir, `prd_${id}.md`);
    if (fs.existsSync(file) && !hasFlag(parsed, "force")) {
        fail(`PRD already exists: ${file}`);
    }
    const content = hasFlag(parsed, "raw")
        ? `${goal.trim()}\n`
        : `# PRD ${id}: ${title}

## Goal
${goal.trim()}

## Scope
- 요청 내용을 기반으로 planner가 todo로 승격한다.

## Done When
- [ ] todo ticket이 생성된다.

## Conversation Handoff
${goal.trim()}
`;
    writeFile(file, content, true);
    out("status=ok");
    if (hasFlag(parsed, "save-handoff")) {
        const handoffFile = path.join(ctx.boardRoot, "conversations", `prd_${id}`, "spec-handoff.md");
        writeFile(handoffFile, content, true);
        out(`handoff_path=${handoffFile}`);
    }
    out(`prd_id=${id}`);
    out(`path=${file}`);
}
