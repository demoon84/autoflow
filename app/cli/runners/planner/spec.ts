import * as shared from "../../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, nextNamespacedId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function specProject(args: string[]): void {
    if (args.includes("--help") || args.includes("-h")) {
        out(`Usage: autoflow prd create [project-root] [board-dir-name] [--title text] [--goal text] [--from-file path] [--save-handoff]

Aliases:
  autoflow spec create [project-root] [board-dir-name] [options]

Options:
  --id NNN             Use an explicit PRD id.
  --title text         PRD title. Defaults to PRD <id>.
  --goal text          Goal body. Defaults to title or stdin.
  --from-file path     Read PRD body from a file.
  --raw                Write raw body instead of the minimal PRD wrapper.
  --save-handoff       Also save conversation handoff.
  --force              Overwrite an existing PRD id.`);
        return;
    }
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown spec command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const prdDir = path.join(ctx.boardRoot, "tickets", "prd");
    ensureDir(prdDir);
    const id = nextNamespacedId(path.join(ctx.boardRoot, "tickets"), "prd", ctx.projectRoot, firstFlag(parsed, "id"));
    const title = firstFlag(parsed, "title") || `PRD ${id}`;
    const goal = firstFlag(parsed, "goal") || readRequestText(parsed, "goal") || title;
    const file = path.join(prdDir, `PRD-${id}.md`);
    if (fs.existsSync(file) && !hasFlag(parsed, "force")) {
        fail(`PRD already exists: ${file}`);
    }
    const content = hasFlag(parsed, "raw")
        ? `${goal.trim()}\n`
        : `# PRD PRD-${id}: ${title}

## Project

- ID: PRD-${id}
- Title: ${title}
- AI: autoflow
- Status: approved
- Change Type: code
- Requires Secrets: []
- Branch:
- Base Commit:

## Source

- Origin: cli
- User Request: "${oneLine(goal.trim(), 240)}"
- Related Work: none

## Problem

${goal.trim()}

## Goal

${goal.trim()}

## Scope

- In Scope: 플래너 역할이 이 요청을 구체적인 work item으로 분해합니다.
- Out of Scope: TBD
- Assumptions: TBD
- Remaining Unknowns: 구체적인 Allowed Paths는 필요하면 PRD 저장 후 보강합니다.

## Main Screens / Modules

- Module: TBD
- Path: TBD

## Allowed Paths

- TBD

## Global Acceptance Criteria

- [ ] 플래너 역할이 이 PRD를 하나 이상의 work item으로 분해한다.

## Done When

- [ ] work item이 하나 이상 생성된다.

## Verification

- Command: none-shell
- Notes: 구체적인 검증 명령은 work item 작성 시 확정한다.

## Conversation Handoff

${goal.trim()}

## Notes

- \`autoflow spec create\`가 생성한 기본 PRD다. work item 분해 전에 \`Allowed Paths\`와 검증 조건을 구체화해야 할 수 있다.
`;
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    ensureDir(stateDir);
    const contentFile = path.join(stateDir, `.spec-create-${process.pid}-${id}.md`);
    fs.writeFileSync(contentFile, content, "utf8");
    const toolScript = runtimeScriptPath("runners/tool.ts");
    const toolArgs = [
        requiredTsxCli(),
        toolScript,
        "planner",
        "write-prd",
        "--id",
        id,
        "--content-file",
        contentFile,
    ];
    if (hasFlag(parsed, "force")) toolArgs.push("--overwrite");
    const result = spawnSync(process.execPath, toolArgs, {
        cwd: ctx.projectRoot,
        encoding: "utf8",
        env: {
            ...process.env,
            AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
            AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
        },
    });
    try { fs.unlinkSync(contentFile); } catch {}
    if (result.status !== 0) {
        const detail = oneLine(`${result.stdout || ""} ${result.stderr || ""}`, 1200);
        fail(detail || `planner write-prd failed with exit ${result.status ?? 1}`);
    }
    let parsedResult: Record<string, unknown> = {};
    try {
        parsedResult = JSON.parse(result.stdout || "{}") as Record<string, unknown>;
    } catch {
        parsedResult = {};
    }
    out("status=ok");
    if (hasFlag(parsed, "save-handoff")) {
        const handoffFile = path.join(ctx.boardRoot, "conversations", `PRD-${id}`, "spec-handoff.md");
        writeFile(handoffFile, content, true);
        out(`handoff_path=${handoffFile}`);
    }
    out(`prd_id=${id}`);
    out(`path=${file}`);
    out(`branch=${String(parsedResult.branch || "")}`);
    out(`base_commit=${String(parsedResult.base_commit || "")}`);
    out(`worktree_path=${String(parsedResult.worktree_path || "")}`);
    out(`worktree_status=${String(parsedResult.branch_status || "")}`);
    out(`worktree_commit=${String(parsedResult.worktree_commit || "")}`);
}
