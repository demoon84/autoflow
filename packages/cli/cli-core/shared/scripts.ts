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

export function boardScriptPath(ctx: ProjectContext, scriptName: string): string {
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

export function runBoardScript(ctx: ProjectContext, scriptName: string, args: string[] = []): never {
    ensureBoard(ctx);
    runNodeOrTsScript(boardScriptPath(ctx, scriptName), args, {
        ...process.env,
        AUTOFLOW_PROJECT_ROOT: ctx.projectRoot,
        AUTOFLOW_BOARD_ROOT: ctx.boardRoot,
    });
}
