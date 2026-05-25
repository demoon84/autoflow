import {fs, path, spawnSync, fail, REPO_ROOT, type ProjectContext} from "./context";
import {ensureBoard} from "./project";
import {resolveAutoflowCore} from "./core";

export function requiredTsxCli(coreRoot = REPO_ROOT): string {
    try {
        return require.resolve("tsx/cli", {paths: [coreRoot]});
    } catch {
        fail("Autoflow TypeScript 스크립트를 실행하려면 tsx가 필요합니다. Autoflow core에서 npm install을 실행해 주세요.");
    }
}

export function runNodeOrTsScript(scriptPath: string, args: string[], env: NodeJS.ProcessEnv = process.env, coreRoot = REPO_ROOT): never {
    const ext = path.extname(scriptPath);
    const commandArgs = ext === ".ts"
        ? [requiredTsxCli(coreRoot), scriptPath, ...args]
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

export function runtimeScriptPath(scriptName: string, coreRoot = REPO_ROOT): string {
    if (!scriptName || scriptName.includes("..")) {
        fail(`Invalid runtime script path: ${scriptName}`);
    }
    // Runtime scripts live under the resolved Autoflow core. The board only
    // holds data and records the core reference in `.autoflow/manifest.toml`.
    const runtimePath = path.join(coreRoot, "app", "runtime", scriptName);
    if (fs.existsSync(runtimePath)) {
        return runtimePath;
    }
    fail(`Runtime script not found: ${scriptName}`);
}

export function runRuntimeScript(ctx: ProjectContext, scriptName: string, args: string[] = [], envOverrides: NodeJS.ProcessEnv = {}): never {
    ensureBoard(ctx);
    const core = resolveAutoflowCore(ctx);
    runNodeOrTsScript(runtimeScriptPath(scriptName, core.coreRoot), args, {
        ...process.env,
        AUTOFLOW_CORE_ROOT: core.coreRoot,
        AUTOFLOW_RUNTIME_ROOT: core.runtimeRoot,
        AUTOFLOW_SHARE_ROOT: core.shareRoot,
        AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
        AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
        ...envOverrides,
    }, core.coreRoot);
}
