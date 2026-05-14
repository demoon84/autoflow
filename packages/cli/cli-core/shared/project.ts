import {fs, path, fail, shellQuoteStrip, REPO_ROOT, type ProjectContext} from "./context";

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
