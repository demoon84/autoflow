import * as shared from "../shared";
const {fs, path, REPO_ROOT, out, err, fail, parseArgs, firstFlag, hasFlag} = shared;

function autoflowBinary(): string {
    return path.join(REPO_ROOT, "app", "bin", "autoflow");
}

function expandHome(p: string): string {
    if (p.startsWith("~/")) return path.join(process.env.HOME || "", p.slice(2));
    if (p === "~") return process.env.HOME || "";
    return p;
}

function pathDirectories(): string[] {
    const raw = String(process.env.PATH || "");
    return raw.split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
}

function isWritableDir(dir: string): boolean {
    try {
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) return false;
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function pickTargetDirectory(explicit?: string): {dir: string; reason: string} {
    if (explicit) {
        const resolved = path.resolve(expandHome(explicit));
        if (!isWritableDir(resolved)) {
            try {
                fs.mkdirSync(resolved, {recursive: true});
            } catch (error: any) {
                fail(`target directory not writable: ${resolved} (${error?.message || error})`);
            }
        }
        return {dir: resolved, reason: "explicit"};
    }

    const candidates = [
        expandHome("~/.local/bin"),
        expandHome("~/bin"),
        "/usr/local/bin",
        "/opt/homebrew/bin",
    ];
    const pathDirs = new Set(pathDirectories().map((d) => path.resolve(expandHome(d))));

    // First pass: candidate already on PATH and writable.
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (pathDirs.has(resolved) && isWritableDir(resolved)) {
            return {dir: resolved, reason: "on_path_writable"};
        }
    }
    // Second pass: writable even if not on PATH yet (we tell the user to add it).
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (isWritableDir(resolved)) {
            return {dir: resolved, reason: "writable_not_on_path"};
        }
    }
    // Third pass: create ~/.local/bin (most portable default).
    const fallback = expandHome("~/.local/bin");
    try {
        fs.mkdirSync(fallback, {recursive: true});
        return {dir: fallback, reason: "created_local_bin"};
    } catch (error: any) {
        fail(`could not locate or create a writable PATH directory: ${error?.message || error}`);
    }
    return {dir: "", reason: ""};
}

function linkTargetExists(link: string): {exists: boolean; type: "symlink" | "file" | "directory" | "missing"} {
    try {
        const stat = fs.lstatSync(link);
        if (stat.isSymbolicLink()) return {exists: true, type: "symlink"};
        if (stat.isFile()) return {exists: true, type: "file"};
        if (stat.isDirectory()) return {exists: true, type: "directory"};
        return {exists: true, type: "file"};
    } catch {
        return {exists: false, type: "missing"};
    }
}

export function installCli(args: string[]): void {
    const parsed = parseArgs(args);
    if (hasFlag(parsed, "help") || args.includes("-h")) {
        out(`Usage: autoflow install-cli [--target <dir>] [--force]

Creates an 'autoflow' symlink in a directory on your PATH so chat-side LLMs
(Claude/Codex app) can invoke 'autoflow ...' without the host shell needing
to know the binary location.

Options:
  --target <dir>   Explicit destination directory. Defaults to the first
                   writable entry among ~/.local/bin, ~/bin, /usr/local/bin,
                   /opt/homebrew/bin. Creates ~/.local/bin if none exist.
  --force          Replace an existing 'autoflow' file/symlink at the target.`);
        return;
    }

    const binary = autoflowBinary();
    if (!fs.existsSync(binary)) {
        fail(`autoflow binary not found: ${binary}`);
    }
    try {
        fs.accessSync(binary, fs.constants.X_OK);
    } catch {
        fail(`autoflow binary is not executable: ${binary}`);
    }

    const target = pickTargetDirectory(firstFlag(parsed, "target"));
    const linkPath = path.join(target.dir, "autoflow");
    const force = hasFlag(parsed, "force");
    const existing = linkTargetExists(linkPath);

    if (existing.exists) {
        if (existing.type === "symlink") {
            let currentTarget = "";
            try { currentTarget = fs.readlinkSync(linkPath); } catch {}
            if (path.resolve(path.dirname(linkPath), currentTarget) === path.resolve(binary)) {
                out(`status=unchanged`);
                out(`target_dir=${target.dir}`);
                out(`link_path=${linkPath}`);
                out(`binary=${binary}`);
                out(`reason=already_linked`);
                emitPathHint(target);
                return;
            }
        }
        if (!force) {
            err(`autoflow already exists at ${linkPath} (${existing.type}). pass --force to replace.`);
            process.exit(1);
        }
        try { fs.rmSync(linkPath, {force: true}); }
        catch (error: any) { fail(`failed to remove existing ${linkPath}: ${error?.message || error}`); }
    }

    try {
        fs.symlinkSync(binary, linkPath);
    } catch (error: any) {
        fail(`failed to create symlink ${linkPath} -> ${binary}: ${error?.message || error}`);
    }

    out(`status=ok`);
    out(`target_dir=${target.dir}`);
    out(`link_path=${linkPath}`);
    out(`binary=${binary}`);
    out(`reason=${existing.exists ? "replaced" : "created"}`);
    emitPathHint(target);
}

function emitPathHint(target: {dir: string; reason: string}): void {
    const onPath = pathDirectories().map((d) => path.resolve(expandHome(d))).includes(path.resolve(target.dir));
    if (onPath) {
        out(`path_status=on_path`);
        return;
    }
    out(`path_status=not_on_path`);
    out(`hint=add the following line to ~/.zshrc or ~/.bashrc, then restart your shell:`);
    out(`hint_line=export PATH="${target.dir}:$PATH"`);
}
