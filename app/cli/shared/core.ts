import * as os from "node:os";
import {fs, path, REPO_ROOT, SHARE_ROOT, packageVersion, type ProjectContext} from "./context";
import {writeFileAtomic} from "./fs";

export const BOARD_SCHEMA_VERSION = "1";
export const BOARD_MANIFEST_FILE = "manifest.toml";

export type CoreRegistryEntry = {
    name: string;
    kind: string;
    coreRoot: string;
    runtimeRoot: string;
    installRoot: string;
    shareRoot: string;
    version: string;
    linkedAt: string;
};

export type CoreRegistry = {
    format: number;
    active: string;
    cores: Record<string, CoreRegistryEntry>;
};

export type BoardCoreManifest = {
    board: Record<string, string>;
    core: Record<string, string>;
    migration: Record<string, string>;
};

export type ResolvedAutoflowCore = {
    source: "env" | "board_pin" | "registry" | "board_manifest" | "current";
    ref: string;
    coreRoot: string;
    runtimeRoot: string;
    installRoot: string;
    shareRoot: string;
    version: string;
    requiredVersion: string;
    pinnedVersion: string;
    pinnedRoot: string;
    boardSchemaVersion: string;
    boardManifestPath: string;
    registryPath: string;
    available: boolean;
};

function nowIso(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function autoflowHomeRoot(): string {
    const override = process.env.AUTOFLOW_HOME;
    return override && override.trim() ? path.resolve(override) : path.join(os.homedir(), ".autoflow");
}

export function coreRegistryPath(): string {
    return path.join(autoflowHomeRoot(), "core-registry.json");
}

export function coreBundledShareRoot(coreRoot = REPO_ROOT): string {
    return path.join(path.resolve(coreRoot || REPO_ROOT), "install", "share");
}

function normalizeCoreName(name: string): string {
    const value = String(name || "").trim().replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
    return value || "dev";
}

function readJsonFile(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function registryEntryFromUnknown(name: string, value: unknown): CoreRegistryEntry | null {
    if (!value || typeof value !== "object") return null;
    const entry = value as Record<string, unknown>;
    const coreRoot = typeof entry.coreRoot === "string" ? entry.coreRoot : "";
    if (!coreRoot) return null;
    const resolvedRoot = path.resolve(coreRoot);
    return {
        name: normalizeCoreName(typeof entry.name === "string" ? entry.name : name),
        kind: typeof entry.kind === "string" ? entry.kind : "global",
        coreRoot: resolvedRoot,
        runtimeRoot: typeof entry.runtimeRoot === "string" ? entry.runtimeRoot : path.join(resolvedRoot, "app", "runtime"),
        installRoot: typeof entry.installRoot === "string" ? entry.installRoot : path.join(resolvedRoot, "install"),
        shareRoot: typeof entry.shareRoot === "string" ? entry.shareRoot : coreBundledShareRoot(resolvedRoot),
        version: typeof entry.version === "string" ? entry.version : coreVersion(resolvedRoot),
        linkedAt: typeof entry.linkedAt === "string" ? entry.linkedAt : "",
    };
}

export function readCoreRegistry(): CoreRegistry {
    const raw = readJsonFile(coreRegistryPath());
    const registry: CoreRegistry = {format: 1, active: "", cores: {}};
    if (!raw || typeof raw !== "object") {
        return registry;
    }
    const data = raw as Record<string, unknown>;
    registry.format = typeof data.format === "number" ? data.format : 1;
    registry.active = normalizeCoreName(typeof data.active === "string" ? data.active : "");
    const cores = data.cores && typeof data.cores === "object" ? data.cores as Record<string, unknown> : {};
    for (const [name, value] of Object.entries(cores)) {
        const entry = registryEntryFromUnknown(name, value);
        if (entry) {
            registry.cores[entry.name] = entry;
        }
    }
    if (registry.active && !registry.cores[registry.active]) {
        registry.active = "";
    }
    return registry;
}

function writeCoreRegistry(registry: CoreRegistry): void {
    const file = coreRegistryPath();
    fs.mkdirSync(path.dirname(file), {recursive: true});
    writeFileAtomic(file, JSON.stringify(registry, null, 2) + "\n");
}

export function isAutoflowCoreRoot(coreRoot: string): boolean {
    const root = path.resolve(coreRoot || "");
    return fs.existsSync(path.join(root, "package.json")) &&
        fs.existsSync(path.join(root, "app", "runtime")) &&
        fs.existsSync(path.join(root, "install", "manifest.toml"));
}

export function coreVersion(coreRoot = REPO_ROOT): string {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(coreRoot, "package.json"), "utf8")) as {version?: string};
        return parsed.version || packageVersion();
    } catch {
        return packageVersion();
    }
}

export function registerCoreLink(options: {
    name?: string;
    kind?: string;
    coreRoot?: string;
    shareRoot?: string;
    active?: boolean;
} = {}): CoreRegistryEntry {
    const name = normalizeCoreName(options.name || "dev");
    const coreRoot = path.resolve(options.coreRoot || REPO_ROOT);
    if (!isAutoflowCoreRoot(coreRoot)) {
        throw new Error(`Autoflow core root가 아닙니다: ${coreRoot}`);
    }
    const entry: CoreRegistryEntry = {
        name,
        kind: options.kind || "dev",
        coreRoot,
        runtimeRoot: path.join(coreRoot, "app", "runtime"),
        installRoot: path.join(coreRoot, "install"),
        shareRoot: path.resolve(options.shareRoot || coreBundledShareRoot(coreRoot)),
        version: coreVersion(coreRoot),
        linkedAt: nowIso(),
    };
    const registry = readCoreRegistry();
    registry.cores[name] = entry;
    if (options.active !== false) {
        registry.active = name;
    }
    writeCoreRegistry(registry);
    return entry;
}

function stripTomlComment(line: string): string {
    let quote = "";
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (quote) {
            if (char === "\\") escaped = true;
            else if (char === quote) quote = "";
            continue;
        }
        if (char === "\"" || char === "'") quote = char;
        else if (char === "#") return line.slice(0, index);
    }
    return line;
}

function parseTomlString(raw: string): string {
    const value = raw.trim();
    const quoted = value.match(/^"((?:\\"|[^"])*)"|^'([^']*)'/);
    if (quoted) return (quoted[1] || quoted[2] || "").replace(/\\"/g, "\"");
    return value.split(/\s+/)[0] || "";
}

function readTomlSections(file: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let current = "";
    let text = "";
    try {
        text = fs.readFileSync(file, "utf8");
    } catch {
        return sections;
    }
    for (const rawLine of text.split(/\r?\n/)) {
        const line = stripTomlComment(rawLine).trim();
        if (!line) continue;
        const section = line.match(/^\[([^\]]+)\]$/);
        if (section) {
            current = section[1].trim();
            sections[current] = sections[current] || {};
            continue;
        }
        if (!current) continue;
        const value = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
        if (!value) continue;
        sections[current][value[1]] = parseTomlString(value[2]);
    }
    return sections;
}

function tomlString(value: string): string {
    return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

export function boardCoreManifestPath(ctx: ProjectContext): string {
    return path.join(ctx.boardRoot, BOARD_MANIFEST_FILE);
}

export function readBoardCoreManifest(ctx: ProjectContext): BoardCoreManifest {
    const sections = readTomlSections(boardCoreManifestPath(ctx));
    return {
        board: sections.board || {},
        core: sections.core || {},
        migration: sections.migration || {},
    };
}

function registryActiveCore(): CoreRegistryEntry | null {
    const registry = readCoreRegistry();
    const entry = registry.active ? registry.cores[registry.active] : null;
    if (!entry || !isAutoflowCoreRoot(entry.coreRoot)) return null;
    return entry;
}

function coreFrom(root: string, source: ResolvedAutoflowCore["source"], ref: string, options: {
    shareRoot?: string;
    requiredVersion?: string;
    pinnedVersion?: string;
    pinnedRoot?: string;
    boardSchemaVersion?: string;
    boardManifestPath?: string;
} = {}): ResolvedAutoflowCore {
    const coreRoot = path.resolve(root || REPO_ROOT);
    return {
        source,
        ref,
        coreRoot,
        runtimeRoot: path.join(coreRoot, "app", "runtime"),
        installRoot: path.join(coreRoot, "install"),
        shareRoot: path.resolve(options.shareRoot || coreBundledShareRoot(coreRoot)),
        version: coreVersion(coreRoot),
        requiredVersion: options.requiredVersion || packageVersion(),
        pinnedVersion: options.pinnedVersion || "",
        pinnedRoot: options.pinnedRoot || "",
        boardSchemaVersion: options.boardSchemaVersion || "",
        boardManifestPath: options.boardManifestPath || "",
        registryPath: coreRegistryPath(),
        available: isAutoflowCoreRoot(coreRoot),
    };
}

export function resolveAutoflowCore(ctx?: ProjectContext): ResolvedAutoflowCore {
    const manifest = ctx ? readBoardCoreManifest(ctx) : {board: {}, core: {}, migration: {}};
    const envCoreRoot = process.env.AUTOFLOW_CORE_ROOT && process.env.AUTOFLOW_CORE_ROOT.trim()
        ? path.resolve(process.env.AUTOFLOW_CORE_ROOT)
        : "";
    const envShareRoot = process.env.AUTOFLOW_SHARE_ROOT && process.env.AUTOFLOW_SHARE_ROOT.trim()
        ? path.resolve(process.env.AUTOFLOW_SHARE_ROOT)
        : "";
    const manifestPath = ctx ? boardCoreManifestPath(ctx) : "";
    const pinnedRoot = manifest.core.pinned_core_root || "";
    const pinnedVersion = manifest.core.pinned_core_version || "";
    const boardShareRoot = manifest.core.share_root || "";
    const requiredVersion = manifest.core.required_core_version || packageVersion();
    const boardSchemaVersion = manifest.board.schema_version || "";
    const registryEntry = registryActiveCore();

    if (envCoreRoot) {
        const shareRoot = envShareRoot || coreBundledShareRoot(envCoreRoot);
        return coreFrom(envCoreRoot, "env", "env", {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
    }
    if (pinnedRoot) {
        const shareRoot = envShareRoot || boardShareRoot || coreBundledShareRoot(pinnedRoot);
        return coreFrom(pinnedRoot, "board_pin", "pinned", {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
    }
    if (registryEntry) {
        const shareRoot = envShareRoot || registryEntry.shareRoot || boardShareRoot || coreBundledShareRoot(registryEntry.coreRoot);
        return coreFrom(registryEntry.coreRoot, "registry", registryEntry.name, {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
    }
    if (isAutoflowCoreRoot(REPO_ROOT)) {
        const shareRoot = envShareRoot || coreBundledShareRoot(REPO_ROOT);
        return coreFrom(REPO_ROOT, "current", "current", {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
    }
    const manifestRoot = manifest.core.last_resolved_root || "";
    if (manifestRoot && isAutoflowCoreRoot(manifestRoot)) {
        const shareRoot = envShareRoot || boardShareRoot || coreBundledShareRoot(manifestRoot);
        return coreFrom(manifestRoot, "board_manifest", manifest.core.ref || "global", {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
    }
    const shareRoot = envShareRoot || boardShareRoot || SHARE_ROOT;
    return coreFrom(REPO_ROOT, "current", "current", {shareRoot, requiredVersion, pinnedVersion, pinnedRoot, boardSchemaVersion, boardManifestPath: manifestPath});
}

export function writeBoardCoreManifest(ctx: ProjectContext, options: {mode?: "init" | "upgrade"} = {}): ResolvedAutoflowCore {
    const existing = readBoardCoreManifest(ctx);
    const resolved = resolveAutoflowCore(ctx);
    const now = nowIso();
    const createdAt = existing.board.created_at || now;
    const lastMigratedAt = options.mode === "upgrade" ? now : (existing.migration.last_migrated_at || now);
    const content = [
        "format = 1",
        "",
        "[board]",
        `schema_version = ${tomlString(BOARD_SCHEMA_VERSION)}`,
        `project_root = ${tomlString(ctx.projectRoot)}`,
        `board_root = ${tomlString(ctx.boardRoot)}`,
        `board_dir_name = ${tomlString(ctx.boardDirName)}`,
        `created_by = ${tomlString("autoflow")}`,
        `created_at = ${tomlString(createdAt)}`,
        `updated_at = ${tomlString(now)}`,
        "",
        "[core]",
        `ref = ${tomlString(resolved.ref || existing.core.ref || "global")}`,
        `required_core_version = ${tomlString(existing.core.required_core_version || packageVersion())}`,
        `last_resolved_root = ${tomlString(resolved.coreRoot)}`,
        `last_resolved_version = ${tomlString(resolved.version)}`,
        `runtime_root = ${tomlString(resolved.runtimeRoot)}`,
        `install_root = ${tomlString(resolved.installRoot)}`,
        `share_root = ${tomlString(resolved.shareRoot)}`,
        `pinned_core_root = ${tomlString(existing.core.pinned_core_root || "")}`,
        `pinned_core_version = ${tomlString(existing.core.pinned_core_version || "")}`,
        "",
        "[migration]",
        `last_migrated_at = ${tomlString(lastMigratedAt)}`,
        `last_migrated_by = ${tomlString("autoflow " + (options.mode || "init"))}`,
        "",
    ].join("\n");
    writeFileAtomic(boardCoreManifestPath(ctx), content);
    return resolveAutoflowCore(ctx);
}
