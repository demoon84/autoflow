import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

const allowedRunnerRoles = new Set([
    "worker",
    "planner",
    "verifier",
    "wiki-maintainer",
    "todo",
    "watcher",
]);

function normalizeRunnerRole(role: string): string {
    const value = role.toLowerCase();
    if (value === "ticket") return "worker";
    if (value === "plan") return "planner";
    if (value === "verify") return "verifier";
    if (value === "wiki") return "wiki-maintainer";
    if (value === "coord") return "coordinator";
    if (value === "merge" || value === "merge-bot") return "worker";
    return value;
}

function requireRunnerRole(role: string): string {
    const raw = role.toLowerCase();
    if (raw === "merge" || raw === "merge-bot") {
        fail(`Deprecated runner role: ${role}. Verifier-approved merge is owned by role=worker; use worker instead.`);
    }
    const normalized = normalizeRunnerRole(role);
    if (normalized === "coordinator") {
        fail(`Unsupported runner role: ${role}. Coordinator is not a runner; use planner, worker, verifier, or wiki-maintainer.`);
    }
    if (!allowedRunnerRoles.has(normalized)) {
        fail(`Unsupported runner role: ${role}`);
    }
    return normalized;
}

function inactiveRunnerState(status: "idle" | "stopped", stoppedBy = ""): Record<string, string> {
    return {
        status,
        runner_status: status,
        pid: "",
        stopped_by: stoppedBy,
        active_item: "",
        active_ticket_id: "",
        active_ticket_title: "",
        active_stage: "",
        active_spec_ref: "",
        active_ticket_path: "",
        active_recovery_reason: "",
        active_recovery_status: "",
        active_recovery_failure_class: "",
        active_recovery_worktree_path: "",
        active_recovery_worktree_status: "",
        active_recovery_board_state: "",
        last_result: status === "idle" ? "runner_started" : "runner_stopped",
    };
}

function printRunnersUsage(): void {
    out(`Autoflow runners

Usage:
  autoflow runners list [project-root] [board-dir-name]
  autoflow runners summary [project-root] [board-dir-name]
  autoflow runners start <runner-id> [project-root] [board-dir-name]
  autoflow runners stop <runner-id> [project-root] [board-dir-name]
  autoflow runners restart <runner-id> [project-root] [board-dir-name]
  autoflow runners artifacts <runner-id> [project-root] [board-dir-name]
  autoflow runners set <runner-id> [project-root] [board-dir-name] key=value...
  autoflow runners add <runner-id> <role> [project-root] [board-dir-name] key=value...
  autoflow runners remove <runner-id> [project-root] [board-dir-name]`);
}

export function runnersProject(args: string[]): void {
    const subcmd = args.shift() || "list";
    if (subcmd === "help" || subcmd === "--help" || subcmd === "-h") {
        printRunnersUsage();
        return;
    }
    const runnerId = (subcmd !== "list" && subcmd !== "summary") ? args.shift() : undefined;
    const addRole = subcmd === "add" ? args.shift() : undefined;
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const runners = parseRunnerConfig(ctx);
    if (subcmd === "list" || subcmd === "summary") {
        out("status=ok");
        out(`runner_count=${runners.length}`);
        runners.forEach((runner, index) => {
            outputRunner(index + 1, ctx, runner);
        });
        return;
    }
    const requiredRunnerId = runnerId || fail(`Runner id required for runners ${subcmd}`);
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    ensureDir(stateDir);
    const stateFile = path.join(stateDir, `${requiredRunnerId}.state`);
    switch (subcmd) {
        case "start":
        case "restart":
            writeRunnerState(ctx, requiredRunnerId, inactiveRunnerState("idle"));
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out("runner_status=idle");
            break;
        case "stop":
            writeRunnerState(ctx, requiredRunnerId, inactiveRunnerState("stopped", "user"));
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out("runner_status=stopped");
            break;
        case "artifacts":
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`state_file=${stateFile}`);
            out(`log_dir=${path.join(ctx.boardRoot, "runners", "logs")}`);
            break;
        case "set": {
            const updates = runnerUpdateEntries(parsed.positionals.slice(2));
            if (updates.role !== undefined) {
                updates.role = requireRunnerRole(updates.role);
            }
            const index = runners.findIndex((runner) => runner.id === requiredRunnerId);
            if (index < 0) {
                fail(`Runner not found: ${runnerId}`);
            }
            runners[index] = {...runners[index], ...updates};
            const configPath = writeRunnerConfig(ctx, runners);
            const fingerprint = runnerConfigFingerprint(runners[index]);
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`operation=${subcmd}`);
            out("config_edit_status=updated");
            out(`config_file=${configPath}`);
            out(`config_fingerprint=${fingerprint}`);
            out(`config_updated_at=${new Date().toISOString()}`);
            break;
        }
        case "add": {
            const requiredAddRole = requireRunnerRole(addRole || fail("Runner role required for runners add"));
            if (runners.some((runner) => runner.id === requiredRunnerId)) {
                fail(`Runner already exists: ${requiredRunnerId}`);
            }
            const updates = runnerUpdateEntries(parsed.positionals.slice(2));
            const runner = {
                id: requiredRunnerId,
                role: requiredAddRole,
                ...runnerStringFieldDefaults,
                ...updates,
            };
            const next = [...runners, runner];
            const configPath = writeRunnerConfig(ctx, next);
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`operation=${subcmd}`);
            out("config_edit_status=updated");
            out(`config_file=${configPath}`);
            out(`config_fingerprint=${runnerConfigFingerprint(runner)}`);
            out(`config_updated_at=${new Date().toISOString()}`);
            break;
        }
        case "remove": {
            const next = runners.filter((runner) => runner.id !== requiredRunnerId);
            if (next.length === runners.length) {
                fail(`Runner not found: ${requiredRunnerId}`);
            }
            const configPath = writeRunnerConfig(ctx, next);
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`operation=${subcmd}`);
            out("config_edit_status=updated");
            out(`config_file=${configPath}`);
            out(`config_updated_at=${new Date().toISOString()}`);
            break;
        }
        default:
            fail(`Unknown runners command: ${subcmd}`);
    }
}
