import {fs, path, fail, shellQuoteStrip, type ProjectContext} from "./context";
import {installManifestValue} from "./manifest";

export function defaultBoardDirName(): string {
    return installManifestValue("install", "default_board_dir", ".autoflow");
}

export function resolveProjectRoot(input: string, create = false): string {
    const resolved = path.resolve(shellQuoteStrip(input || "."));
    if (create) {
        fs.mkdirSync(resolved, {recursive: true});
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        fail(`Project root not found: ${resolved}`);
    }
    return resolved;
}

export function boardRootPath(projectRoot: string, boardDirName: string): string {
    const clean = shellQuoteStrip(boardDirName || defaultBoardDirName());
    return path.isAbsolute(clean) ? clean : path.join(projectRoot, clean);
}

export function projectContext(projectArg = ".", boardArg = defaultBoardDirName(), createProject = false): ProjectContext {
    const projectRoot = resolveProjectRoot(projectArg, createProject);
    const boardDirName = shellQuoteStrip(boardArg || defaultBoardDirName());
    return {
        projectRoot,
        boardDirName,
        boardRoot: boardRootPath(projectRoot, boardDirName),
    };
}

export function ensureBoard(ctx: ProjectContext): void {
    if (!fs.existsSync(ctx.boardRoot) || !fs.statSync(ctx.boardRoot).isDirectory()) {
        fail(`Board root not found: ${ctx.boardRoot}`);
    }
}
