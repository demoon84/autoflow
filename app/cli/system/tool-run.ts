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
    "planner-janitor": "system/janitor/planner-janitor.ts",
    "run-hook": "system/run-hook.ts",
    "runner-stage": "system/runner-stage.ts",
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
    const projectRoot = path.resolve(process.env.AUTOFLOW_PROJECT_ROOT || process.env.PROJECT_ROOT || inferredProjectRoot());
    const boardRoot = inferredBoardRoot(projectRoot);
    return runNodeOrTsScript(scriptPath, args, {
        ...process.env,
        AUTOFLOW_PROJECT_ROOT: projectRoot,
        PROJECT_ROOT: projectRoot,
        AUTOFLOW_BOARD_ROOT: boardRoot,
        BOARD_ROOT: boardRoot,
    });
}
