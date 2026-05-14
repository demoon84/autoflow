import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;
import {wikiProject} from "./wiki";

export function runRole(args: string[]): never | void {
    const role = args.shift() || "";
    if (!role) {
        fail("Usage: run-role.ts <role> [project-root] [board-dir-name]");
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    const runner = firstFlag(parsed, "runner");
    const dryRun = hasFlag(parsed, "dry-run");
    if (dryRun) {
        out("status=ok");
        out("dry_run=true");
        out(`role=${role}`);
        out(`project_root=${ctx.projectRoot}`);
        out(`board_root=${ctx.boardRoot}`);
        return;
    }
    const extra = runner ? ["--runner", runner] : [];
    switch (role) {
        case "planner":
        case "plan":
            runBoardScript(ctx, "start-plan.ts", extra);
            break;
        case "ticket":
        case "worker":
            runBoardScript(ctx, "start-ticket.ts", extra);
            break;
        case "todo":
            runBoardScript(ctx, "start-todo.ts", extra);
            break;
        case "verifier":
        case "verify":
            runBoardScript(ctx, "start-verifier.ts", extra);
            break;
        case "wiki":
        case "wiki-maintainer":
            wikiProject(["update", ctx.projectRoot, ctx.boardDirName]);
            break;
        case "self-improve":
            runBoardScript(ctx, "start-self-improve.ts", extra);
            break;
        case "coordinator":
        case "monitor":
            out("status=ok");
            out(`role=${role}`);
            out("runner_status=idle");
            out("reason=role_removed_or_idle");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        default:
            fail(`Unknown run role: ${role}`);
    }
}
