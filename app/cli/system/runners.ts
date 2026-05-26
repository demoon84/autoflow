import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

const allowedRunnerRoles = new Set([
    "worker",
    "planner",
    "verifier",
    "wiki-maintainer",
]);

function normalizeRunnerRole(role: string): string {
    const value = role.toLowerCase();
    if (value === "ticket") return "worker";
    if (value === "plan") return "planner";
    if (value === "verify") return "verifier";
    if (value === "wiki") return "wiki-maintainer";
    if (value === "coord") return "coordinator";
    return value;
}

function requireRunnerRole(role: string): string {
    const raw = role.toLowerCase();
    const normalized = normalizeRunnerRole(role);
    if (normalized === "coordinator") {
        fail(`Unsupported runner role: ${role}. Coordinator is not a runner; use planner, worker, or wiki-maintainer.`);
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
        last_result: status === "idle" ? "runner_started" : "runner_stopped",
    };
}

function nowIso(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function pidAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function childPids(pid: number): number[] {
    if (process.platform === "win32") return [];
    const result = spawnSync("pgrep", ["-P", String(pid)], {encoding: "utf8"});
    if (result.status !== 0) return [];
    return String(result.stdout || "")
        .split(/\s+/)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0);
}

function processTree(pid: number, seen = new Set<number>()): number[] {
    if (!Number.isInteger(pid) || pid <= 0 || seen.has(pid)) return [];
    seen.add(pid);
    const children = childPids(pid).flatMap((child) => processTree(child, seen));
    return [pid, ...children];
}

function stopRunnerPid(pidValue: string, force = false) {
    const pid = Number.parseInt(pidValue || "", 10);
    if (!Number.isInteger(pid) || pid <= 0) {
        return {pid: "", signal: "", process_stop_status: "no_pid"};
    }
    if (!pidAlive(pid)) {
        return {pid: String(pid), signal: "", process_stop_status: "not_running"};
    }

    const signal = force ? "SIGKILL" : "SIGTERM";
    const targets = processTree(pid).reverse();
    for (const target of targets.length ? targets : [pid]) {
        try {
            process.kill(target, signal);
        } catch {}
    }

    return {pid: String(pid), signal, process_stop_status: "signal_sent"};
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
        case "restart": {
            const index = runners.findIndex((runner) => runner.id === requiredRunnerId);
            if (index >= 0 && (runners[index].enabled || "true") !== "true") {
                runners[index] = {...runners[index], enabled: "true"};
                writeRunnerConfig(ctx, runners);
            }
            const currentState = readRunnerState(ctx, requiredRunnerId);
            const currentStatus = runnerEffectiveStateStatus(currentState);
            const requestedAt = nowIso();
            writeRunnerState(ctx, requiredRunnerId, {
                ...(currentStatus === "running" ? {} : {status: "starting", runner_status: "starting", pid: ""}),
                stopped_by: "",
                last_stop_reason: "",
                last_process_result: "",
                last_result: subcmd === "restart" ? "runner_restart_requested" : "runner_start_requested",
                control_action: subcmd,
                control_source: "cli",
                control_requested_at: requestedAt,
            });
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`runner_status=${currentStatus === "running" ? "running" : "starting"}`);
            out("desktop_start_status=requested");
            out(`control_action=${subcmd}`);
            out(`control_source=cli`);
            out(`control_requested_at=${requestedAt}`);
            break;
        }
        case "stop": {
            const force = hasFlag(parsed, "force");
            const currentState = readRunnerState(ctx, requiredRunnerId);
            const stopResult = stopRunnerPid(currentState.pid || "", force);
            const requestedAt = nowIso();
            writeRunnerState(ctx, requiredRunnerId, {
                ...inactiveRunnerState("stopped", "user"),
                last_process_result: stopResult.signal ? `signal_${stopResult.signal}` : stopResult.process_stop_status,
                last_stop_reason: stopResult.process_stop_status,
                control_action: "stop",
                control_source: "cli",
                control_force: force ? "true" : "false",
                control_requested_at: requestedAt,
            });
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out("runner_status=stopped");
            out(`pid=${stopResult.pid}`);
            out(`stop_signal=${stopResult.signal}`);
            out(`process_stop_status=${stopResult.process_stop_status}`);
            out(`control_action=stop`);
            out(`control_source=cli`);
            out(`control_requested_at=${requestedAt}`);
            break;
        }
        case "artifacts":
            out("status=ok");
            out(`runner_id=${requiredRunnerId}`);
            out(`state_file=${stateFile}`);
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
