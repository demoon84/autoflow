import {fs, path, type ProjectContext} from "../context";
import {ensureDir} from "../fs";

export function runnerConfigBasePath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "config.toml");
}

export function runnerConfigLocalPath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "config.local.toml");
}

export function runnerConfigPath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    return fs.existsSync(local) ? local : runnerConfigBasePath(ctx);
}

export function runnerConfigWritePath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    ensureDir(path.dirname(local));
    return local;
}
