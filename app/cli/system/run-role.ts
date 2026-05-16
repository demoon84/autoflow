import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;
import {wikiProject} from "../runners/wiki/wiki";

function normalizeRunRole(role: string): string {
    const value = role.toLowerCase();
    if (value === "plan") return "planner";
    if (value === "ticket") return "worker";
    if (value === "prd-author") return "spec";
    if (value === "verify") return "verifier";
    if (value === "wiki-maintainer") return "wiki";
    if (value === "merge" || value === "merge-bot") return "worker";
    return value;
}

function compatibilityRunRoleWarning(requestedRole: string, role: string): string {
    const requested = requestedRole.toLowerCase();
    if ((requested === "merge" || requested === "merge-bot") && role === "worker") {
        return "merge_alias_normalized_to_worker";
    }
    return "";
}

const knownRunRoles = new Set([
    "planner",
    "worker",
    "todo",
    "verifier",
    "wiki",
    "spec",
]);

export function runRole(args: string[]): never | void {
    const requestedRole = args.shift() || "";
    if (!requestedRole) {
        fail("Usage: autoflow run <role> [project-root] [board-dir-name]");
    }
    const role = normalizeRunRole(requestedRole);
    if (!knownRunRoles.has(role)) {
        fail(`Unknown run role: ${role}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    const runner = firstFlag(parsed, "runner");
    const dryRun = hasFlag(parsed, "dry-run");
    const compatibilityWarning = compatibilityRunRoleWarning(requestedRole, role);
    if (dryRun) {
        out("status=ok");
        out("dry_run=true");
        out(`role=${role}`);
        if (requestedRole !== role) {
            out(`requested_role=${requestedRole}`);
        }
        if (compatibilityWarning) {
            out("compatibility_alias=true");
            out(`warning=${compatibilityWarning}`);
        }
        if (runner) {
            out(`runner=${runner}`);
        }
        out(`project_root=${ctx.projectRoot}`);
        out(`board_root=${ctx.boardRoot}`);
        return;
    }
    const runnerEnv = runner ? {
        AUTOFLOW_ROLE: role,
        AUTOFLOW_RUNNER_ID: runner,
        AUTOFLOW_WORKER_ID: runner,
        RUNNER_ID: runner,
        WORKER_ID: runner,
    } : {
        AUTOFLOW_ROLE: role,
    };
    if (compatibilityWarning) {
        out("compatibility_alias=true");
        out(`requested_role=${requestedRole}`);
        out(`role=${role}`);
        out(`warning=${compatibilityWarning}`);
    }
    switch (role) {
        case "planner":
            runRuntimeScript(ctx, "runners/planner/start/index.ts", [], runnerEnv);
            break;
        case "worker":
            runRuntimeScript(ctx, "runners/worker/start/index.ts", [], runnerEnv);
            break;
        case "todo":
            runRuntimeScript(ctx, "runners/worker/start-todo.ts", [], runnerEnv);
            break;
        case "verifier":
            runRuntimeScript(ctx, "runners/verifier/start.ts", [], runnerEnv);
            break;
        case "wiki":
            wikiProject(["update", ctx.projectRoot, ctx.boardDirName]);
            break;
        case "spec":
            runRuntimeScript(ctx, "runners/planner/spec.ts", parsed.positionals.slice(2), runnerEnv);
            break;
        default:
            fail(`Unknown run role: ${role}`);
    }
}
