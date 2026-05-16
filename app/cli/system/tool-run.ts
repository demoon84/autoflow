import * as shared from "../shared";
const {fs, path, REPO_ROOT, fail, runNodeOrTsScript} = shared;

const runtimeToolPaths: Record<string, string> = {
    "board-guard": "system/board-guard/index.ts",
    "check-stop": "system/check-stop.ts",
    "clear-thread-context": "system/clear-thread-context.ts",
    "install-stop-hook": "system/install-stop-hook.ts",
    "meta-runner": "system/meta-runner.ts",
    "notify-user": "system/notify-user.ts",
    "origin-cli": "system/origin-cli.ts",
    "path-conflict-check": "system/path-conflict-check.ts",
    "run-hook": "system/run-hook.ts",
    "runner-stage": "system/runner-stage.ts",
    "runner-preflight": "system/runner-preflight.ts",
    "runner-tokens": "system/runner-tokens.ts",
    "runner-wake": "system/runner-wake.ts",
    "set-thread-context": "system/set-thread-context.ts",
    "state-db": "system/state-db.ts",
    "watch-board": "system/watch-board.ts",
    "runner-tool": "runners/tool.ts",
    "start-plan": "runners/planner/start/index.ts",
    "start-spec": "runners/planner/spec.ts",
    "lint-ticket": "runners/planner/lint-ticket.ts",
    "promote-order-to-ticket": "runners/planner/promote-order-to-ticket.ts",
    "start-ticket": "runners/worker/start/index.ts",
    "start-todo": "runners/worker/start-todo.ts",
    "finish-ticket": "runners/worker/finish-ticket/index.ts",
    "draft-pr": "runners/worker/draft-pr.ts",
    "handoff-todo": "runners/worker/handoff-todo.ts",
    "integrate-worktree": "runners/worker/integrate-worktree.ts",
    "merge-ready-ticket": "runners/worker/merge-ready-ticket.ts",
    "start-verifier": "runners/verifier/start.ts",
    "verify-ticket": "runners/verifier/legacy-verify/index.ts",
    "curator-run": "runners/wiki/curator-run.ts",
    "update-wiki": "runners/wiki/scripts/update-wiki.ts",
    "wiki-embed": "runners/wiki/scripts/wiki-embed.ts",
    "wiki-query": "runners/wiki/scripts/wiki-query.ts",
    "wiki-search-index": "runners/wiki/scripts/wiki-search-index.ts",
};

function inferredProjectRoot(): string {
    const cwd = process.cwd();
    return path.basename(cwd) === ".autoflow" ? path.dirname(cwd) : cwd;
}

function inferredBoardRoot(projectRoot: string): string {
    if (process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT) {
        return path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || "");
    }
    return path.join(projectRoot, ".autoflow");
}

type RuntimeToolScope = {
    args: string[];
    projectRoot?: string;
    boardRoot?: string;
};

function readScopeFlagValue(argv: string[], index: number, flag: string): {value: string; nextIndex: number} {
    const eq = flag.indexOf("=");
    if (eq > 0) {
        return {value: flag.slice(eq + 1), nextIndex: index};
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
        fail(`Missing value for ${flag}`);
    }
    return {value, nextIndex: index + 1};
}

function isProjectScopeFlag(arg: string): boolean {
    return arg === "--project" || arg === "--project-root" || arg.startsWith("--project=") || arg.startsWith("--project-root=");
}

function isBoardScopeFlag(arg: string): boolean {
    return arg === "--board" || arg === "--board-root" || arg.startsWith("--board=") || arg.startsWith("--board-root=");
}

function extractRuntimeToolScope(argv: string[], options: {allowAnywhere?: boolean} = {}): RuntimeToolScope {
    const forwarded: string[] = [];
    let projectRoot = "";
    let boardRoot = "";
    let scopePrefix = true;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] || "";
        const canReadScope = options.allowAnywhere || scopePrefix;
        if (canReadScope && isProjectScopeFlag(arg)) {
            const read = readScopeFlagValue(argv, index, arg);
            projectRoot = read.value;
            index = read.nextIndex;
            continue;
        }
        if (canReadScope && isBoardScopeFlag(arg)) {
            const read = readScopeFlagValue(argv, index, arg);
            boardRoot = read.value;
            index = read.nextIndex;
            continue;
        }
        forwarded.push(arg);
        scopePrefix = false;
    }

    return {args: forwarded, projectRoot, boardRoot};
}

export function runRuntimeTool(name: string, args: string[]): never {
    if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
        return fail(`Invalid tool name: ${name}`);
    }
    const relativePath = runtimeToolPaths[name];
    const scriptPath = relativePath ? path.join(REPO_ROOT, "app", "runtime", relativePath) : "";
    if (!scriptPath) {
        return fail(`Unknown tool: ${name}. Known tools: ${Object.keys(runtimeToolPaths).sort().join(", ")}`);
    }
    if (!fs.existsSync(scriptPath)) {
        return fail(`Runtime tool file missing: app/runtime/${relativePath}`);
    }
    const scoped = extractRuntimeToolScope(args, {allowAnywhere: name === "runner-tool"});
    const envProjectRoot = process.env.AUTOFLOW_PROJECT_ROOT || process.env.PROJECT_ROOT || "";
    const scopedBoardRoot = scoped.boardRoot
        ? path.resolve(path.isAbsolute(scoped.boardRoot) ? scoped.boardRoot : path.join(scoped.projectRoot || envProjectRoot || inferredProjectRoot(), scoped.boardRoot))
        : "";
    const projectRoot = path.resolve(scoped.projectRoot || envProjectRoot || (scopedBoardRoot ? path.dirname(scopedBoardRoot) : inferredProjectRoot()));
    const boardRoot = scopedBoardRoot || inferredBoardRoot(projectRoot);
    return runNodeOrTsScript(scriptPath, scoped.args, {
        ...process.env,
        AUTOFLOW_PROJECT_ROOT: projectRoot,
        PROJECT_ROOT: projectRoot,
        AUTOFLOW_BOARD_ROOT: boardRoot,
        BOARD_ROOT: boardRoot,
    });
}
