import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import * as crypto from "node:crypto";

export const CLI_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
export const REPO_ROOT = path.resolve(CLI_DIR, "..", "..");

type ParsedArgs = {
    positionals: string[];
    flags: Map<string, string[]>;
    booleans: Set<string>;
};

type ProjectContext = {
    projectRoot: string;
    boardDirName: string;
    boardRoot: string;
};

function out(line = ""): void {
    process.stdout.write(`${line}\n`);
}

function err(line = ""): void {
    process.stderr.write(`${line}\n`);
}

function fail(message: string, code = 1): never {
    err(message);
    process.exit(code);
}

function shellQuoteStrip(value: string): string {
    let outValue = value;
    for (;;) {
        if ((outValue.startsWith("\"") && outValue.endsWith("\"")) || (outValue.startsWith("'") && outValue.endsWith("'"))) {
            outValue = outValue.slice(1, -1);
            continue;
        }
        break;
    }
    return outValue.replace(/^["']+/, "");
}

export function defaultBoardDirName(): string {
    const manifest = path.join(REPO_ROOT, "scaffold", "manifest.toml");
    try {
        const text = fs.readFileSync(manifest, "utf8");
        const section = text.match(/\[install\]([\s\S]*?)(?:\n\[|$)/);
        const value = section?.[1]?.match(/^\s*default_board_dir\s*=\s*"([^"]+)"/m)?.[1];
        return value || ".autoflow";
    } catch {
        return ".autoflow";
    }
}

function parseArgs(argv: string[]): ParsedArgs {
    const positionals: string[] = [];
    const flags = new Map<string, string[]>();
    const booleans = new Set<string>();

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] || "";
        if (!arg.startsWith("--") || arg === "--") {
            positionals.push(arg);
            continue;
        }

        const eq = arg.indexOf("=");
        if (eq > 2) {
            const key = arg.slice(2, eq);
            const value = arg.slice(eq + 1);
            flags.set(key, [...(flags.get(key) || []), value]);
            continue;
        }

        const key = arg.slice(2);
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            flags.set(key, [...(flags.get(key) || []), next]);
            index += 1;
            continue;
        }
        booleans.add(key);
    }

    return {positionals, flags, booleans};
}

function firstFlag(args: ParsedArgs, key: string): string | undefined {
    return args.flags.get(key)?.[0];
}

function allFlags(args: ParsedArgs, key: string): string[] {
    return args.flags.get(key) || [];
}

function hasFlag(args: ParsedArgs, key: string): boolean {
    return args.booleans.has(key) || args.flags.has(key);
}

function resolveProjectRoot(input: string, create = false): string {
    const resolved = path.resolve(shellQuoteStrip(input || "."));
    if (create) {
        fs.mkdirSync(resolved, {recursive: true});
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        fail(`Project root not found: ${resolved}`);
    }
    return resolved;
}

function boardRootPath(projectRoot: string, boardDirName: string): string {
    const clean = shellQuoteStrip(boardDirName || defaultBoardDirName());
    return path.isAbsolute(clean) ? clean : path.join(projectRoot, clean);
}

function projectContext(projectArg = ".", boardArg = defaultBoardDirName(), createProject = false): ProjectContext {
    const projectRoot = resolveProjectRoot(projectArg, createProject);
    const boardDirName = shellQuoteStrip(boardArg || defaultBoardDirName());
    return {
        projectRoot,
        boardDirName,
        boardRoot: boardRootPath(projectRoot, boardDirName),
    };
}

function ensureBoard(ctx: ProjectContext): void {
    if (!fs.existsSync(ctx.boardRoot) || !fs.statSync(ctx.boardRoot).isDirectory()) {
        fail(`Board root not found: ${ctx.boardRoot}`);
    }
}

function ensureDir(dir: string): void {
    fs.mkdirSync(dir, {recursive: true});
}

function writeFile(file: string, content: string, force = true): void {
    ensureDir(path.dirname(file));
    if (!force && fs.existsSync(file)) {
        return;
    }
    fs.writeFileSync(file, content);
}

function copyTree(src: string, dest: string, options: {overwrite: boolean; skipShell: boolean}): void {
    if (!fs.existsSync(src)) {
        return;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        ensureDir(dest);
        for (const name of fs.readdirSync(src)) {
            if (name === "node_modules" || name === ".git") {
                continue;
            }
            copyTree(path.join(src, name), path.join(dest, name), options);
        }
        return;
    }

    if (options.skipShell && src.endsWith(".sh")) {
        return;
    }
    if (!options.overwrite && fs.existsSync(dest)) {
        return;
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    if (src.endsWith(".ts") || src.endsWith(".js")) {
        try {
            fs.chmodSync(dest, 0o755);
        } catch {
            // chmod is best-effort on platforms that support executable bits.
        }
    }
}

function readStdin(): string {
    if (process.stdin.isTTY) {
        return "";
    }
    try {
        return fs.readFileSync(0, "utf8");
    } catch {
        return "";
    }
}

function readRequestText(args: ParsedArgs, flagName: string): string {
    const fromFile = firstFlag(args, "from-file");
    if (fromFile) {
        return fs.readFileSync(path.resolve(fromFile), "utf8").trimEnd();
    }
    const direct = firstFlag(args, flagName);
    if (direct !== undefined) {
        return direct;
    }
    return readStdin().trimEnd();
}

function listMarkdownIds(dir: string, prefix: string): number[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const re = new RegExp(`^${prefix}_(\\d+)\\.md$`, "i");
    return fs.readdirSync(dir)
        .map((name) => name.match(re)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));
}

function nextNumericId(dir: string, prefix: string, explicit?: string): string {
    if (explicit) {
        return explicit.padStart(3, "0");
    }
    const max = Math.max(0, ...listMarkdownIds(dir, prefix));
    return String(max + 1).padStart(3, "0");
}

function requiredTsxCli(): string {
    try {
        return require.resolve("tsx/cli", {paths: [REPO_ROOT]});
    } catch {
        fail("tsx is required to run Autoflow TypeScript scripts. Run npm install in the Autoflow repo.");
    }
}

function runNodeOrTsScript(scriptPath: string, args: string[], env: NodeJS.ProcessEnv = process.env): never {
    const ext = path.extname(scriptPath);
    const commandArgs = ext === ".ts"
        ? [requiredTsxCli(), scriptPath, ...args]
        : [scriptPath, ...args];
    const result = spawnSync(process.execPath, commandArgs, {
        stdio: "inherit",
        env,
    });
    if (result.error) {
        fail(result.error.message);
    }
    process.exit(typeof result.status === "number" ? result.status : 1);
}

function boardScriptPath(ctx: ProjectContext, scriptName: string): string {
    const boardCandidate = path.join(ctx.boardRoot, "scripts", scriptName);
    if (fs.existsSync(boardCandidate)) {
        return boardCandidate;
    }
    const runtimeCandidate = path.join(REPO_ROOT, "runtime", "board-scripts", scriptName);
    if (fs.existsSync(runtimeCandidate)) {
        return runtimeCandidate;
    }
    fail(`Runtime script not found: ${scriptName}`);
}

function runBoardScript(ctx: ProjectContext, scriptName: string, args: string[] = []): never {
    ensureBoard(ctx);
    runNodeOrTsScript(boardScriptPath(ctx, scriptName), args, {
        ...process.env,
        AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
        AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
    });
}

function countFiles(dir: string, pattern: RegExp): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    let count = 0;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            count += countFiles(full, pattern);
        } else if (pattern.test(name)) {
            count += 1;
        }
    }
    return count;
}

function countTicketDirs(ctx: ProjectContext): Record<string, number> {
    const root = path.join(ctx.boardRoot, "tickets");
    const names = ["inbox", "backlog", "todo", "inprogress", "verifier", "done"];
    const counts: Record<string, number> = {};
    for (const name of names) {
        counts[name] = countFiles(path.join(root, name), /\.md$/);
    }
    return counts;
}

function countTopLevelMarkdown(dir: string, pattern: RegExp): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    return fs.readdirSync(dir).filter((name) => pattern.test(name) && fs.statSync(path.join(dir, name)).isFile()).length;
}

function fileContainsTicketStage(file: string, wantedStage: string): boolean {
    try {
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        let inTicket = false;
        for (const line of lines) {
            if (/^## Ticket\b/.test(line)) {
                inTicket = true;
                continue;
            }
            if (/^## /.test(line) && inTicket) {
                inTicket = false;
            }
            if (inTicket && line.trim() === `- Stage: ${wantedStage}`) {
                return true;
            }
        }
    } catch {
        return false;
    }
    return false;
}

function countTicketStage(dir: string, wantedStage: string): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    return fs.readdirSync(dir)
        .filter((name) => /^(Todo-\d+|tickets_\d+)\.md$/.test(name))
        .filter((name) => fileContainsTicketStage(path.join(dir, name), wantedStage))
        .length;
}

function readSingleLine(file: string): string {
    try {
        return fs.readFileSync(file, "utf8").replace(/[\r\n]+/g, "");
    } catch {
        return "";
    }
}

function packageVersion(): string {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {version?: string};
        return parsed.version || "0.0.0-dev";
    } catch {
        return "0.0.0-dev";
    }
}

function walkMarkdownFiles(dir: string, files: string[] = []): string[] {
    if (!fs.existsSync(dir)) {
        return files;
    }
    for (const name of fs.readdirSync(dir)) {
        if (name === ".git" || name === "node_modules") {
            continue;
        }
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walkMarkdownFiles(full, files);
        } else if (name.endsWith(".md")) {
            files.push(full);
        }
    }
    return files;
}

const runnerConfigFieldOrder = [
    "id",
    "role",
    "agent",
    "model",
    "reasoning",
    "mode",
    "interval_seconds",
    "enabled",
    "realtime_enabled",
    "command",
];

const runnerStringFieldDefaults: Record<string, string> = {
    agent: "codex",
    model: "",
    reasoning: "",
    mode: "loop",
    interval_seconds: "60",
    enabled: "true",
    realtime_enabled: "true",
    command: "",
};

function runnerConfigBasePath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "config.toml");
}

function runnerConfigLocalPath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "config.local.toml");
}

function runnerConfigPath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    return fs.existsSync(local) ? local : runnerConfigBasePath(ctx);
}

function runnerConfigWritePath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    ensureDir(path.dirname(local));
    return local;
}

function stripTomlInlineComment(line: string): string {
    let quote = "";
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index] || "";
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = "";
            }
            continue;
        }
        if (char === "\"" || char === "'") {
            quote = char;
        } else if (char === "#") {
            return line.slice(0, index);
        }
    }
    return line;
}

function parseTomlScalar(raw: string): string {
    const value = stripTomlInlineComment(raw).trim();
    const doubleQuoted = value.match(/^"((?:\\"|[^"])*)"/);
    if (doubleQuoted) {
        return (doubleQuoted[1] || "").replace(/\\"/g, "\"");
    }
    const singleQuoted = value.match(/^'([^']*)'/);
    if (singleQuoted) {
        return singleQuoted[1] || "";
    }
    return value.split(/\s+/)[0] || "";
}

function parseRunnerConfig(ctx: ProjectContext): Array<Record<string, string>> {
    const config = runnerConfigPath(ctx);
    if (!fs.existsSync(config)) {
        return [];
    }
    const text = fs.readFileSync(config, "utf8");
    const blocks = text.split(/\[\[runners\]\]/g).slice(1);
    return blocks.map((block) => {
        const item: Record<string, string> = {};
        for (const line of block.split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/);
            if (!match) {
                continue;
            }
            item[match[1] || ""] = parseTomlScalar(match[2] || "");
        }
        return item;
    }).filter((item) => item.id);
}

function readRunnerState(ctx: ProjectContext, runnerId: string): Record<string, string> {
    const stateFile = path.join(ctx.boardRoot, "runners", "state", `${runnerId}.state`);
    if (!fs.existsSync(stateFile)) {
        return {};
    }
    const state: Record<string, string> = {};
    for (const line of fs.readFileSync(stateFile, "utf8").split(/\r?\n/)) {
        const index = line.indexOf("=");
        if (index <= 0) {
            continue;
        }
        state[line.slice(0, index)] = line.slice(index + 1);
    }
    return state;
}

function pidIsRunning(pidValue: string): boolean {
    const pid = Number.parseInt(pidValue || "", 10);
    if (!Number.isFinite(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException)?.code === "EPERM";
    }
}

function runnerEffectiveStateStatus(state: Record<string, string>): string {
    const status = state.status || "idle";
    if (status === "running" && !pidIsRunning(state.pid || "")) {
        return "stopped";
    }
    return status;
}

function runnerConfigFingerprint(runner: Record<string, string>): string {
    const body = runnerConfigFieldOrder
        .map((key) => `${key}=${runner[key] ?? ""}`)
        .join("\n");
    return crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
}

function formatTomlValue(key: string, value: string): string {
    if ((key === "enabled" || key === "realtime_enabled") && /^(true|false)$/i.test(value)) {
        return value.toLowerCase();
    }
    if (key === "interval_seconds" && /^\d+$/.test(value)) {
        return value;
    }
    return JSON.stringify(value);
}

function serializeRunnerConfig(runners: Array<Record<string, string>>): string {
    const lines = [
        "# Autoflow runner configuration (local override).",
        "# Generated by `autoflow runners set/add/remove`; project-local and gitignored by default.",
        "",
    ];
    for (const runner of runners) {
        lines.push("[[runners]]");
        const known = new Set(runnerConfigFieldOrder);
        for (const key of runnerConfigFieldOrder) {
            if (runner[key] === undefined && runnerStringFieldDefaults[key] === undefined) {
                continue;
            }
            const value = runner[key] ?? runnerStringFieldDefaults[key] ?? "";
            lines.push(`${key} = ${formatTomlValue(key, value)}`);
        }
        const extraKeys = Object.keys(runner)
            .filter((key) => !known.has(key))
            .sort();
        for (const key of extraKeys) {
            lines.push(`${key} = ${formatTomlValue(key, runner[key] || "")}`);
        }
        lines.push("");
    }
    return `${lines.join("\n").trimEnd()}\n`;
}

function writeRunnerConfig(ctx: ProjectContext, runners: Array<Record<string, string>>): string {
    const target = runnerConfigWritePath(ctx);
    fs.writeFileSync(target, serializeRunnerConfig(runners));
    return target;
}

function runnerUpdateEntries(values: string[]): Record<string, string> {
    const updates: Record<string, string> = {};
    for (const value of values) {
        const index = value.indexOf("=");
        if (index <= 0) {
            fail(`Invalid runner config update: ${value}`);
        }
        const key = value.slice(0, index);
        updates[key] = value.slice(index + 1);
    }
    return updates;
}

function outputRunner(index: number, ctx: ProjectContext, runner: Record<string, string>): void {
    const prefix = `runner.${index}.`;
    const state = readRunnerState(ctx, runner.id || "");
    const stateStatus = runnerEffectiveStateStatus(state);
    const configFingerprint = runnerConfigFingerprint(runner);
    const field = (key: string, fallback = "") => runner[key] ?? fallback;

    out(`${prefix}id=${field("id")}`);
    out(`${prefix}role=${field("role")}`);
    out(`${prefix}agent=${field("agent", runnerStringFieldDefaults.agent)}`);
    out(`${prefix}model=${field("model", runnerStringFieldDefaults.model)}`);
    out(`${prefix}reasoning=${field("reasoning", runnerStringFieldDefaults.reasoning)}`);
    out(`${prefix}mode=${field("mode", runnerStringFieldDefaults.mode)}`);
    out(`${prefix}interval_seconds=${field("interval_seconds", runnerStringFieldDefaults.interval_seconds)}`);
    out(`${prefix}interval_effective_seconds=${field("interval_seconds", runnerStringFieldDefaults.interval_seconds)}`);
    out(`${prefix}enabled=${field("enabled", runnerStringFieldDefaults.enabled)}`);
    out(`${prefix}realtime_enabled=${field("realtime_enabled", runnerStringFieldDefaults.realtime_enabled)}`);
    out(`${prefix}command=${field("command", "")}`);
    out(`${prefix}command_preview=${field("command", "")}`);
    out(`${prefix}config_fingerprint=${configFingerprint}`);
    out(`${prefix}applied_config_fingerprint=${state.applied_config_fingerprint || state.config_fingerprint || configFingerprint}`);
    out(`${prefix}config_applied_at=${state.config_applied_at || state.updated_at || state.last_event_at || ""}`);
    out(`${prefix}state_status=${stateStatus}`);
    out(`${prefix}pid=${stateStatus === "running" ? state.pid || "" : ""}`);
    out(`${prefix}started_at=${state.started_at || ""}`);
    out(`${prefix}last_event_at=${state.last_event_at || state.updated_at || ""}`);
    out(`${prefix}last_adapter_chunk_at=${state.last_adapter_chunk_at || ""}`);
    out(`${prefix}active_item=${state.active_item || ""}`);
    out(`${prefix}active_ticket_id=${state.active_ticket_id || ""}`);
    out(`${prefix}active_ticket_title=${state.active_ticket_title || ""}`);
    out(`${prefix}active_stage=${state.active_stage || ""}`);
    out(`${prefix}active_spec_ref=${state.active_spec_ref || ""}`);
    out(`${prefix}active_recovery_reason=${state.active_recovery_reason || ""}`);
    out(`${prefix}active_recovery_status=${state.active_recovery_status || ""}`);
    out(`${prefix}active_recovery_failure_class=${state.active_recovery_failure_class || ""}`);
    out(`${prefix}last_result=${state.last_result || ""}`);
    out(`${prefix}last_runtime_log=${state.last_runtime_log || ""}`);
    out(`${prefix}last_prompt_log=${state.last_prompt_log || ""}`);
    out(`${prefix}last_stdout_log=${state.last_stdout_log || ""}`);
    out(`${prefix}last_stderr_log=${state.last_stderr_log || ""}`);
    out(`${prefix}artifact_status=${state.artifact_status || ""}`);
    out(`${prefix}artifact_runtime_status=${state.artifact_runtime_status || ""}`);
    out(`${prefix}artifact_prompt_status=${state.artifact_prompt_status || ""}`);
    out(`${prefix}artifact_stdout_status=${state.artifact_stdout_status || ""}`);
    out(`${prefix}artifact_stderr_status=${state.artifact_stderr_status || ""}`);
    out(`${prefix}last_log_line=${state.last_log_line || ""}`);
    out(`${prefix}state_path=${path.join(ctx.boardRoot, "runners", "state", `${runner.id}.state`)}`);
    out(`${prefix}log_path=${path.join(ctx.boardRoot, "runners", "logs")}`);
}

function usage(): void {
    out(`Autoflow CLI

Usage:
  autoflow tool list [project-root] [board-dir-name]
  autoflow init [project-root] [board-dir-name]
  autoflow upgrade [project-root] [board-dir-name]
  autoflow order create [project-root] [board-dir-name] [--title text] [--request text] [--allowed-path path]... [--verification command]
  autoflow prd create [project-root] [board-dir-name] [--title text] [--goal text] [--from-file path]
  autoflow run <planner|ticket|worker|verifier|wiki|todo|self-improve> [project-root] [board-dir-name]
  autoflow wiki <update|query|lint> [project-root] [board-dir-name]
  autoflow runners <list|start|stop|restart|artifacts|set|add|remove> ...
  autoflow metrics [project-root] [board-dir-name]
  autoflow status [project-root] [board-dir-name]
  autoflow doctor [--fix] [project-root] [board-dir-name]
  autoflow origin <status|list|search|of-ticket|of-commit|sync> [args...]
  autoflow help`);
}

export function printToolCatalog(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    out("status=ok");
    out("catalog_version=2");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out("tool_count=11");
    out("tool.1.id=autoflow-tool-list");
    out("tool.1.roles=planner,worker,wiki");
    out("tool.1.kind=cli");
    out("tool.1.entrypoint=bin/autoflow tool list");
    out("tool.2.id=start-plan");
    out("tool.2.roles=planner");
    out("tool.2.kind=runtime_script");
    out(`tool.2.entrypoint=${ctx.boardRoot}/scripts/start-plan.ts`);
    out("tool.3.id=start-ticket-owner");
    out("tool.3.roles=worker");
    out("tool.3.kind=runtime_script");
    out(`tool.3.entrypoint=${ctx.boardRoot}/scripts/start-ticket-owner.ts`);
    out("tool.4.id=verify-ticket-owner");
    out("tool.4.roles=worker");
    out("tool.4.kind=runtime_script");
    out(`tool.4.entrypoint=${ctx.boardRoot}/scripts/verify-ticket-owner.ts`);
    out("tool.5.id=finish-ticket-owner");
    out("tool.5.roles=worker");
    out("tool.5.kind=runtime_script");
    out(`tool.5.entrypoint=${ctx.boardRoot}/scripts/finish-ticket-owner.ts`);
    out("tool.6.id=autoflow-guard");
    out("tool.6.roles=planner,worker");
    out("tool.6.kind=cli");
    out("tool.6.entrypoint=bin/autoflow guard");
    out("tool.7.id=autoflow-wiki-query");
    out("tool.7.roles=planner,worker,wiki");
    out("tool.7.kind=cli");
    out("tool.7.entrypoint=bin/autoflow wiki query --term <text> --rag");
    out("tool.8.id=run-role");
    out("tool.8.roles=planner,worker,wiki");
    out("tool.8.kind=cli");
    out("tool.8.entrypoint=packages/cli/run-role.ts");
    out("tool.9.id=board-helpers");
    out("tool.9.roles=planner,worker,wiki");
    out("tool.9.kind=library");
    out("tool.9.entrypoint=runtime/board-scripts/board-utils.ts");
    out("tool.10.id=runner-helpers");
    out("tool.10.roles=planner,worker,wiki");
    out("tool.10.kind=runtime_script");
    out("tool.10.entrypoint=runtime/board-scripts/runner-tool.ts");
    out("tool.11.id=telemetry");
    out("tool.11.roles=planner,worker,wiki");
    out("tool.11.kind=cli");
    out("tool.11.entrypoint=packages/cli/telemetry-project.ts");
}

function scaffoldProject(args: string[], mode: "init" | "upgrade" = "init"): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName(), true);
    const overwrite = mode === "upgrade";
    ensureDir(ctx.boardRoot);
    copyTree(path.join(REPO_ROOT, "scaffold", "board"), ctx.boardRoot, {overwrite, skipShell: true});
    copyTree(path.join(REPO_ROOT, "runtime", "board-scripts"), path.join(ctx.boardRoot, "scripts"), {overwrite: true, skipShell: true});

    const ticketDirs = ["inbox", "backlog", "todo", "inprogress", "verifier", "done", "archive"];
    for (const dir of ticketDirs) {
        ensureDir(path.join(ctx.boardRoot, "tickets", dir));
    }
    for (const dir of ["logs", "state", "state/pr-drafts"]) {
        ensureDir(path.join(ctx.boardRoot, "runners", dir));
    }
    writeFile(path.join(ctx.boardRoot, ".project-root"), `${ctx.projectRoot}\n`, true);
    writeFile(path.join(ctx.boardRoot, ".autoflow-version"), "typescript-cli\n", true);

    out("status=ok");
    out(`mode=${mode}`);
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out("runtime_scripts=typescript");
}

function stopHookProject(args: string[]): never {
    const action = args[0] || "status";
    const ctx = projectContext(args[1] || ".", args[2] || defaultBoardDirName());
    runBoardScript(ctx, "install-stop-hook.ts", [action]);
}

function watchProject(args: string[]): never | void {
    const parsed = parseArgs(args);
    const status = hasFlag(parsed, "status");
    const stop = hasFlag(parsed, "stop");
    const background = hasFlag(parsed, "background");
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    if (status || stop) {
        out("status=ok");
        out(`watch_status=${status ? "idle" : "stopped"}`);
        out(`project_root=${ctx.projectRoot}`);
        out(`board_root=${ctx.boardRoot}`);
        return;
    }
    runBoardScript(ctx, "watch-board.ts", background ? ["--background", ...parsed.positionals.slice(2)] : parsed.positionals.slice(2));
}

function specProject(args: string[]): void {
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown spec command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const backlogDir = path.join(ctx.boardRoot, "tickets", "backlog");
    ensureDir(backlogDir);
    const id = nextNumericId(backlogDir, "prd", firstFlag(parsed, "id"));
    const title = firstFlag(parsed, "title") || `PRD ${id}`;
    const goal = firstFlag(parsed, "goal") || readRequestText(parsed, "goal") || title;
    const file = path.join(backlogDir, `prd_${id}.md`);
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
`;
    writeFile(file, content, true);
    out("status=ok");
    out(`prd_id=${id}`);
    out(`path=${file}`);
}

function orderProject(args: string[]): void {
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown order command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const inboxDir = path.join(ctx.boardRoot, "tickets", "inbox");
    ensureDir(inboxDir);
    const id = nextNumericId(inboxDir, "order", firstFlag(parsed, "id"));
    const title = firstFlag(parsed, "title") || `Order ${id}`;
    const request = readRequestText(parsed, "request") || title;
    const allowedPaths = allFlags(parsed, "allowed-path");
    const verification = allFlags(parsed, "verification");
    const file = path.join(inboxDir, `order_${id}.md`);
    if (fs.existsSync(file) && !hasFlag(parsed, "force")) {
        fail(`Order already exists: ${file}`);
    }
    const lines = [
        `# Order ${id}: ${title}`,
        "",
        "## Order",
        `- Priority: ${firstFlag(parsed, "priority") || "normal"}`,
        hasFlag(parsed, "express") ? "- Express: true" : "- Express: false",
        "",
        "## Request",
        request.trim(),
        "",
        "## Scope",
        firstFlag(parsed, "scope") || "- planner가 가장 좁은 구현 범위로 정리한다.",
        "",
        "## Allowed Paths",
        ...(allowedPaths.length > 0 ? allowedPaths.map((item) => `- ${item}`) : ["- TBD"]),
        "",
        "## Verification",
        ...(verification.length > 0 ? verification.map((item) => `- ${item}`) : ["- TBD"]),
        "",
    ];
    writeFile(file, `${lines.join("\n")}\n`, true);
    out("status=ok");
    out(`order_id=${id}`);
    out(`path=${file}`);
}

function runRole(args: string[]): never | void {
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
        case "ticket-owner":
            runBoardScript(ctx, "start-ticket-owner.ts", extra);
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

function wikiProject(args: string[]): never | void {
    const subcmd = args.shift() || "query";
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    switch (subcmd) {
        case "update":
            runBoardScript(ctx, "update-wiki.ts", args.slice(2));
            break;
        case "query": {
            ensureBoard(ctx);
            const terms = allFlags(parsed, "term").map((term) => term.toLowerCase()).filter(Boolean);
            const limit = Number.parseInt(firstFlag(parsed, "limit") || "10", 10) || 10;
            const candidates = [
                ...walkMarkdownFiles(path.join(ctx.boardRoot, "wiki")),
                ...(hasFlag(parsed, "no-tickets") ? [] : walkMarkdownFiles(path.join(ctx.boardRoot, "tickets", "done"))),
            ];
            const matches: Array<{file: string; score: number; line: string}> = [];
            for (const file of candidates) {
                const text = fs.readFileSync(file, "utf8");
                const lower = text.toLowerCase();
                if (terms.length > 0 && !terms.every((term) => lower.includes(term))) {
                    continue;
                }
                const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
                const score = terms.reduce((sum, term) => sum + (lower.split(term).length - 1), 0);
                matches.push({file, score, line: firstLine.trim()});
            }
            matches.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
            out("status=ok");
            out(hasFlag(parsed, "rag") ? "rag_backend=chunk_grep" : "query_backend=markdown_scan");
            out(`result_count=${Math.min(matches.length, limit)}`);
            matches.slice(0, limit).forEach((match, index) => {
                out(`match.${index + 1}.path=${path.relative(ctx.boardRoot, match.file)}`);
                out(`match.${index + 1}.score=${match.score}`);
                out(`match.${index + 1}.title=${match.line}`);
            });
            break;
        }
        case "lint":
            out("status=ok");
            out("semantic_lint=skipped");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "ingest":
            out("status=ok");
            out("ingest_status=skipped");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "summarize-telemetry":
            telemetryProject([ctx.projectRoot, ctx.boardDirName, "token-usage"]);
            break;
        default:
            fail(`Unknown wiki command: ${subcmd}`);
    }
}

function runnersProject(args: string[]): void {
    const subcmd = args.shift() || "list";
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
    if (!runnerId) {
        fail(`Runner id required for runners ${subcmd}`);
    }
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    ensureDir(stateDir);
    const stateFile = path.join(stateDir, `${runnerId}.state`);
    switch (subcmd) {
        case "start":
        case "restart":
            writeFile(stateFile, `id=${runnerId}\nrunner_id=${runnerId}\nstatus=idle\nupdated_at=${new Date().toISOString()}\n`, true);
            out("status=ok");
            out(`runner_id=${runnerId}`);
            out("runner_status=idle");
            break;
        case "stop":
            writeFile(stateFile, `id=${runnerId}\nrunner_id=${runnerId}\nstatus=stopped\nstopped_by=user\nupdated_at=${new Date().toISOString()}\n`, true);
            out("status=ok");
            out(`runner_id=${runnerId}`);
            out("runner_status=stopped");
            break;
        case "artifacts":
            out("status=ok");
            out(`runner_id=${runnerId}`);
            out(`state_file=${stateFile}`);
            out(`log_dir=${path.join(ctx.boardRoot, "runners", "logs")}`);
            break;
        case "set": {
            const updates = runnerUpdateEntries(parsed.positionals.slice(2));
            const index = runners.findIndex((runner) => runner.id === runnerId);
            if (index < 0) {
                fail(`Runner not found: ${runnerId}`);
            }
            runners[index] = {...runners[index], ...updates};
            const configPath = writeRunnerConfig(ctx, runners);
            const fingerprint = runnerConfigFingerprint(runners[index]);
            out("status=ok");
            out(`runner_id=${runnerId}`);
            out(`operation=${subcmd}`);
            out("config_edit_status=updated");
            out(`config_file=${configPath}`);
            out(`config_fingerprint=${fingerprint}`);
            out(`config_updated_at=${new Date().toISOString()}`);
            break;
        }
        case "add": {
            if (!addRole) {
                fail("Runner role required for runners add");
            }
            if (runners.some((runner) => runner.id === runnerId)) {
                fail(`Runner already exists: ${runnerId}`);
            }
            const updates = runnerUpdateEntries(parsed.positionals.slice(2));
            const runner = {
                id: runnerId,
                role: addRole,
                ...runnerStringFieldDefaults,
                ...updates,
            };
            const next = [...runners, runner];
            const configPath = writeRunnerConfig(ctx, next);
            out("status=ok");
            out(`runner_id=${runnerId}`);
            out(`operation=${subcmd}`);
            out("config_edit_status=updated");
            out(`config_file=${configPath}`);
            out(`config_fingerprint=${runnerConfigFingerprint(runner)}`);
            out(`config_updated_at=${new Date().toISOString()}`);
            break;
        }
        case "remove": {
            const next = runners.filter((runner) => runner.id !== runnerId);
            if (next.length === runners.length) {
                fail(`Runner not found: ${runnerId}`);
            }
            const configPath = writeRunnerConfig(ctx, next);
            out("status=ok");
            out(`runner_id=${runnerId}`);
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

function metricsProject(args: string[]): void {
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const counts = countTicketDirs(ctx);
    out("status=ok");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    for (const [key, value] of Object.entries(counts)) {
        out(`tickets.${key}=${value}`);
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    out(`tickets.total=${total}`);
    if (hasFlag(parsed, "write")) {
        const metricsFile = path.join(ctx.boardRoot, "metrics", "snapshot.env");
        writeFile(metricsFile, `tickets_total=${total}\nupdated_at=${new Date().toISOString()}\n`, true);
        out(`metrics_file=${metricsFile}`);
    }
}

function statusProject(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    const boardExists = fs.existsSync(ctx.boardRoot) && fs.statSync(ctx.boardRoot).isDirectory();
    const initialized = boardExists && fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) && fs.existsSync(path.join(ctx.boardRoot, "tickets"));
    const counts = countTicketDirs(ctx);
    const boardVersion = readSingleLine(path.join(ctx.boardRoot, ".autoflow-version"));
    const pkgVersion = packageVersion();
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
    out(`initialized=${initialized ? "true" : "false"}`);
    out(`host_agents_present=${fs.existsSync(path.join(ctx.projectRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`board_agents_present=${fs.existsSync(path.join(ctx.boardRoot, "AGENTS.md")) ? "true" : "false"}`);
    out(`board_readme_present=${fs.existsSync(path.join(ctx.boardRoot, "README.md")) ? "true" : "false"}`);
    out(`project_root_marker_present=${fs.existsSync(path.join(ctx.boardRoot, ".project-root")) ? "true" : "false"}`);
    out(`project_root_marker_value=${readSingleLine(path.join(ctx.boardRoot, ".project-root"))}`);
    out(`project_root_marker_resolved=${ctx.projectRoot}`);
    out(`spec_count=${countTopLevelMarkdown(path.join(ctx.boardRoot, "tickets", "backlog"), /^prd_\d+\.md$/)}`);
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
    out(`ticket_owner_active_count=${counts.inprogress}`);
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`todo=${counts.todo}`);
    out(`inprogress=${counts.inprogress}`);
    out(`verifier=${counts.verifier}`);
    out(`done=${counts.done}`);
}

function doctorProject(args: string[]): void {
    const parsed = parseArgs(args);
    const positionals = parsed.positionals.filter((item) => item !== "--fix");
    const ctx = projectContext(positionals[0] || ".", positionals[1] || defaultBoardDirName());
    const errors: string[] = [];
    if (!fs.existsSync(ctx.boardRoot)) {
        errors.push(`missing_board_root=${ctx.boardRoot}`);
    }
    const requiredScripts = [
        "start-plan.ts",
        "start-ticket-owner.ts",
        "finish-ticket-owner.ts",
        "merge-ready-ticket.ts",
        "verify-ticket-owner.ts",
        "update-wiki.ts",
    ];
    for (const script of requiredScripts) {
        if (!fs.existsSync(path.join(ctx.boardRoot, "scripts", script)) && !fs.existsSync(path.join(REPO_ROOT, "runtime", "board-scripts", script))) {
            errors.push(`missing_runtime_script=${script}`);
        }
    }
    out(errors.length === 0 ? "status=ok" : "status=fail");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
    out(`error_count=${errors.length}`);
    errors.forEach((item, index) => out(`error.${index + 1}=${item}`));
    out(errors.length === 0 ? "check.runtime_script_companions=ok" : "check.runtime_script_companions=fail");
    out("doctor.typescript_migration.cli=ok");
}

function originProject(args: string[]): never {
    const ctx = projectContext(process.env.AUTOFLOW_PROJECT_ROOT || ".", process.env.AUTOFLOW_BOARD_DIR_NAME || defaultBoardDirName());
    runBoardScript(ctx, "origin-cli.ts", args);
}

function cleanupRunnerLogs(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const logs = path.join(ctx.boardRoot, "runners", "logs");
    let removed = 0;
    if (fs.existsSync(logs)) {
        for (const name of fs.readdirSync(logs)) {
            if (name.endsWith(".tmp") || name.endsWith(".old")) {
                fs.rmSync(path.join(logs, name), {force: true});
                removed += 1;
            }
        }
    }
    out("status=ok");
    out(`removed_count=${removed}`);
    out(`log_dir=${logs}`);
}

function renderHeartbeats(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    ensureBoard(ctx);
    const runners = parseRunnerConfig(ctx);
    out("status=ok");
    out(`runner_count=${runners.length}`);
    runners.forEach((runner, index) => {
        out(`heartbeat.${index + 1}.runner_id=${runner.id || ""}`);
        out(`heartbeat.${index + 1}.role=${runner.role || ""}`);
        out(`heartbeat.${index + 1}.interval_seconds=${runner.interval_seconds || "1800"}`);
    });
}

function coordinatorProject(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    out("status=ok");
    out("coordinator_status=idle");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
}

function telemetryProject(args: string[]): void {
    const maybeSubcmd = args[2] || args[0] || "summary";
    const projectArg = args[0] && !args[0].startsWith("-") ? args[0] : ".";
    const boardArg = args[1] && !args[1].startsWith("-") ? args[1] : defaultBoardDirName();
    const ctx = projectContext(projectArg, boardArg);
    ensureBoard(ctx);
    const telemetryDir = path.join(ctx.boardRoot, "runners", "telemetry");
    ensureDir(telemetryDir);
    out("status=ok");
    out(`telemetry_command=${maybeSubcmd}`);
    out(`telemetry_dir=${telemetryDir}`);
    out("event_count=0");
    if (maybeSubcmd === "token-usage") {
        out("token_total=0");
        out("token_source=none");
    }
}

function packageBoardCommon(args: string[]): void {
    const ctx = projectContext(args[0] || ".", args[1] || defaultBoardDirName());
    out("status=ok");
    out(`project_root=${ctx.projectRoot}`);
    out(`board_root=${ctx.boardRoot}`);
}

export function runPackageCommand(command: string, argv: string[]): void {
    switch (command) {
        case "scaffold-project":
            scaffoldProject(argv, "init");
            break;
        case "upgrade-project":
            scaffoldProject(argv, "upgrade");
            break;
        case "stop-hook-project":
            stopHookProject(argv);
            break;
        case "watch-project":
            watchProject(argv);
            break;
        case "spec-project":
            specProject([...argv]);
            break;
        case "order-project":
            orderProject([...argv]);
            break;
        case "run-role":
            runRole([...argv]);
            break;
        case "wiki-project":
            wikiProject([...argv]);
            break;
        case "runners-project":
            runnersProject([...argv]);
            break;
        case "metrics-project":
            metricsProject(argv);
            break;
        case "status-project":
            statusProject(argv);
            break;
        case "doctor-project":
            doctorProject(argv);
            break;
        case "origin-project":
            originProject(argv);
            break;
        case "cleanup-runner-logs":
            cleanupRunnerLogs(argv);
            break;
        case "render-heartbeats":
            renderHeartbeats(argv);
            break;
        case "coordinator-project":
            coordinatorProject(argv);
            break;
        case "telemetry-project":
            telemetryProject(argv);
            break;
        case "package-board-common":
        case "cli-common":
            packageBoardCommon(argv);
            break;
        default:
            fail(`Unknown package command: ${command}`);
    }
}

export function runAutoflow(argv: string[]): void {
    const cmd = argv.shift() || "help";
    switch (cmd) {
        case "tool": {
            const subcmd = argv.shift() || "";
            if (subcmd !== "list") {
                fail(`Unknown tool command: ${subcmd}`);
            }
            printToolCatalog(argv);
            break;
        }
        case "init":
            runPackageCommand("scaffold-project", argv);
            break;
        case "upgrade":
            runPackageCommand("upgrade-project", argv);
            break;
        case "install-stop-hook":
            runPackageCommand("stop-hook-project", ["install", ...argv]);
            break;
        case "remove-stop-hook":
            runPackageCommand("stop-hook-project", ["remove", ...argv]);
            break;
        case "stop-hook-status":
            runPackageCommand("stop-hook-project", ["status", ...argv]);
            break;
        case "watch":
            runPackageCommand("watch-project", argv);
            break;
        case "watch-bg":
            runPackageCommand("watch-project", ["--background", ...argv]);
            break;
        case "watch-status":
            runPackageCommand("watch-project", ["--status", ...argv]);
            break;
        case "watch-stop":
            runPackageCommand("watch-project", ["--stop", ...argv]);
            break;
        case "prd":
        case "spec":
            runPackageCommand("spec-project", argv);
            break;
        case "order":
            runPackageCommand("order-project", argv);
            break;
        case "run":
            runPackageCommand("run-role", argv);
            break;
        case "wiki":
            runPackageCommand("wiki-project", argv);
            break;
        case "monitor":
            runPackageCommand("run-role", ["monitor", ...argv]);
            break;
        case "runners":
            runPackageCommand("runners-project", argv);
            break;
        case "metrics":
            runPackageCommand("metrics-project", argv);
            break;
        case "status":
            runPackageCommand("status-project", argv);
            break;
        case "guard":
            runNodeOrTsScript(path.join(REPO_ROOT, "packages", "cli", "guard-project.ts"), argv);
            break;
        case "render-heartbeats":
            runPackageCommand("render-heartbeats", argv);
            break;
        case "doctor":
            runPackageCommand("doctor-project", argv);
            break;
        case "origin":
            runPackageCommand("origin-project", argv);
            break;
        case "cleanup-runner-logs":
            runPackageCommand("cleanup-runner-logs", argv);
            break;
        case "telemetry":
            runPackageCommand("telemetry-project", argv);
            break;
        case "help":
        case "-h":
        case "--help":
            usage();
            break;
        default:
            fail(`Unknown command: ${cmd}`);
    }
}
