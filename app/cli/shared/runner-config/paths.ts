import {fs, path, type ProjectContext} from "../context";
import {resolveAutoflowCore} from "../core";
import {ensureDir} from "../fs";

export function runnerConfigTemplatePath(ctx: ProjectContext): string {
    return path.join(resolveAutoflowCore(ctx).shareRoot, "reference", "runners", "config.toml");
}

export function runnerConfigBasePath(ctx: ProjectContext): string {
    return runnerConfigTemplatePath(ctx);
}

export function runnerConfigLocalPath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, "runners", "config.local.toml");
}

export function runnerConfigPath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    if (fs.existsSync(local)) return local;
    const template = runnerConfigTemplatePath(ctx);
    return template;
}

export function runnerConfigWritePath(ctx: ProjectContext): string {
    const local = runnerConfigLocalPath(ctx);
    ensureDir(path.dirname(local));
    if (!fs.existsSync(local)) {
        const source = runnerConfigPath(ctx);
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, local);
        }
    }
    return local;
}
