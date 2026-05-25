import {fs, path, spawnSync, type ProjectContext, type GitInstallStatus, oneLine} from "./context";
import {writeFile} from "./fs";

export function gitRun(args: string[], cwd: string): {status: number; stdout: string; stderr: string; error?: string} {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    return {
        status: typeof result.status === "number" ? result.status : result.error ? 127 : 1,
        stdout: String(result.stdout || ""),
        stderr: String(result.stderr || ""),
        error: result.error?.message,
    };
}

export function realPathSafe(file: string): string {
    try {
        return fs.realpathSync.native(file);
    } catch {
        return path.resolve(file);
    }
}

export function samePath(a: string, b: string): boolean {
    return realPathSafe(a) === realPathSafe(b);
}

export function gitState(projectRoot: string): {available: boolean; inside: boolean; root: string; hasHead: boolean; head: string; detail: string} {
    const version = gitRun(["--version"], projectRoot);
    if (version.status !== 0) {
        return {
            available: false,
            inside: false,
            root: "",
            hasHead: false,
            head: "",
            detail: oneLine(version.error || version.stderr || version.stdout || "git unavailable"),
        };
    }

    const inside = gitRun(["rev-parse", "--is-inside-work-tree"], projectRoot);
    if (inside.status !== 0 || inside.stdout.trim() !== "true") {
        return {available: true, inside: false, root: "", hasHead: false, head: "", detail: oneLine(inside.stderr || inside.stdout)};
    }

    const root = gitRun(["rev-parse", "--show-toplevel"], projectRoot).stdout.trim();
    const head = gitRun(["rev-parse", "--verify", "HEAD"], projectRoot);
    return {
        available: true,
        inside: true,
        root,
        hasHead: head.status === 0,
        head: head.status === 0 ? head.stdout.trim() : "",
        detail: head.status === 0 ? "" : oneLine(head.stderr || head.stdout),
    };
}

export function appendGitignorePatterns(file: string, patterns: string[]): boolean {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    const existingCanonical = new Set(Array.from(existingLines).map((line) => line.replace(/\/+$/, "")));
    const missing = patterns.filter((pattern) => {
        const canonical = pattern.replace(/\/+$/, "");
        return !existingLines.has(pattern) && !existingCanonical.has(canonical);
    });
    if (missing.length === 0) {
        return false;
    }
    const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
    const separator = existing.trimEnd() ? "\n" : "";
    const body = `${existing}${prefix}${separator}# Autoflow local harness\n${missing.join("\n")}\n`;
    writeFile(file, body, true);
    return true;
}

export function boardGitignorePattern(ctx: ProjectContext): string | undefined {
    const rel = path.relative(ctx.projectRoot, ctx.boardRoot).split(path.sep).join("/");
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
        return undefined;
    }
    return rel.endsWith("/") ? rel : `${rel}/`;
}

export function detectBoardIgnore(ctx: ProjectContext): string {
    const file = path.join(ctx.projectRoot, ".gitignore");
    if (!fs.existsSync(file)) return "";
    let raw = "";
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch {
        return "";
    }
    const expected = boardGitignorePattern(ctx);
    const candidates = new Set<string>();
    if (expected) {
        candidates.add(expected);
        candidates.add(expected.replace(/\/+$/, ""));
    }
    candidates.add(".autoflow/");
    candidates.add(".autoflow");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (candidates.has(trimmed)) return trimmed;
    }
    return "";
}

export function detectLegacyBoardIgnore(ctx: ProjectContext): string {
    return detectBoardIgnore(ctx);
}

export function listTrackedBoardFiles(ctx: ProjectContext, limit = 10): string[] {
    const state = gitState(ctx.projectRoot);
    if (!state.available || !state.inside || !state.root || !samePath(state.root, ctx.projectRoot)) {
        return [];
    }
    const expected = boardGitignorePattern(ctx);
    const rel = (expected || ".autoflow/").replace(/\/+$/, "");
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return [];
    const result = gitRun(["ls-files", "--", rel], ctx.projectRoot);
    if (result.status !== 0) return [];
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, Math.max(0, limit));
}

export function ensureInstallGitignore(ctx: ProjectContext): boolean {
    const boardPattern = boardGitignorePattern(ctx);
    const patterns = [
        ...(boardPattern ? [boardPattern] : []),
        ".autoflow-worktrees/",
        "node_modules/",
        "dist/",
        ".DS_Store",
        "*.local",
        "npm-debug.log*",
    ];
    return appendGitignorePatterns(path.join(ctx.projectRoot, ".gitignore"), patterns);
}

export function ensureGitBaseline(ctx: ProjectContext): GitInstallStatus {
    let state = gitState(ctx.projectRoot);
    if (!state.available) {
        return {
            status: "git_unavailable",
            available: false,
            initialized: false,
            hasHead: false,
            head: "",
            root: "",
            gitignoreUpdated: false,
            detail: state.detail,
        };
    }

    let initialized = false;
    let gitignoreUpdated = false;
    if (!state.inside) {
        const init = gitRun(["init"], ctx.projectRoot);
        if (init.status !== 0) {
            return {
                status: "git_init_failed",
                available: true,
                initialized: false,
                hasHead: false,
                head: "",
                root: "",
                gitignoreUpdated: false,
                detail: oneLine(init.stderr || init.stdout || init.error || "git init failed"),
            };
        }
        initialized = true;
        state = gitState(ctx.projectRoot);
    }

    if (state.root && !samePath(state.root, ctx.projectRoot)) {
        return {
            status: state.hasHead ? "existing_parent_repo" : "existing_parent_repo_no_head",
            available: true,
            initialized,
            hasHead: state.hasHead,
            head: state.head,
            root: state.root,
            gitignoreUpdated,
            detail: state.detail,
        };
    }

    if (state.hasHead) {
        return {
            status: initialized ? "initialized_existing_head" : "already_ready",
            available: true,
            initialized,
            hasHead: true,
            head: state.head,
            root: state.root,
            gitignoreUpdated,
            detail: "",
        };
    }

    gitignoreUpdated = ensureInstallGitignore(ctx);
    const add = gitRun(["add", "-A"], ctx.projectRoot);
    if (add.status !== 0) {
        return {
            status: "git_add_failed",
            available: true,
            initialized,
            hasHead: false,
            head: "",
            root: state.root || ctx.projectRoot,
            gitignoreUpdated,
            detail: oneLine(add.stderr || add.stdout || add.error || "git add failed"),
        };
    }

    const commit = gitRun([
        "-c",
        "user.name=Autoflow",
        "-c",
        "user.email=autoflow@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "[autoflow] initialize project baseline",
    ], ctx.projectRoot);
    if (commit.status !== 0) {
        return {
            status: "git_commit_failed",
            available: true,
            initialized,
            hasHead: false,
            head: "",
            root: state.root || ctx.projectRoot,
            gitignoreUpdated,
            detail: oneLine(commit.stderr || commit.stdout || commit.error || "git commit failed"),
        };
    }

    state = gitState(ctx.projectRoot);
    return {
        status: initialized ? "initialized_baseline_committed" : "baseline_committed",
        available: true,
        initialized,
        hasHead: state.hasHead,
        head: state.head,
        root: state.root,
        gitignoreUpdated,
        detail: "",
    };
}
