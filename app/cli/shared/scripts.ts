import {fs, path, spawnSync, fail, REPO_ROOT, type ProjectContext} from "./context";
import {ensureBoard} from "./project";

export function requiredTsxCli(): string {
    try {
        return require.resolve("tsx/cli", {paths: [REPO_ROOT]});
    } catch {
        fail("tsx is required to run Autoflow TypeScript scripts. Run npm install in the Autoflow repo.");
    }
}

export function runNodeOrTsScript(scriptPath: string, args: string[], env: NodeJS.ProcessEnv = process.env): never {
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

export function runtimeScriptPath(scriptName: string): string {
    if (!scriptName || scriptName.includes("..")) {
        fail(`Invalid runtime script path: ${scriptName}`);
    }
    // Runtime scripts live exclusively under `<repo>/app/runtime/`. The board
    // only holds data — see install/manifest.toml `[sources]` comment.
    const runtimePath = path.join(REPO_ROOT, "app", "runtime", scriptName);
    if (fs.existsSync(runtimePath)) {
        return runtimePath;
    }
    fail(`Runtime script not found: ${scriptName}`);
}

export function runRuntimeScript(ctx: ProjectContext, scriptName: string, args: string[] = [], envOverrides: NodeJS.ProcessEnv = {}): never {
    ensureBoard(ctx);
    runNodeOrTsScript(runtimeScriptPath(scriptName), args, {
        ...process.env,
        AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
        AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
        ...envOverrides,
    });
}
