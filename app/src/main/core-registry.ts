import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

function sameResolvedPath(left: string, right: string): boolean {
  const normalize = (value: string) => path.resolve(String(value || "")).replace(/[\\/]+$/, "");
  return normalize(left) === normalize(right);
}

export function autoflowHomeRoot(): string {
  const override = process.env.AUTOFLOW_HOME;
  return override && override.trim() ? path.resolve(override) : path.join(os.homedir(), ".autoflow");
}

export function coreRegistryPath(): string {
  return path.join(autoflowHomeRoot(), "core-registry.json");
}

export function coreBundledShareRoot(coreRoot: string): string {
  return path.join(path.resolve(coreRoot), "install", "share");
}

export function isAutoflowCoreRoot(coreRoot: string): boolean {
  const root = path.resolve(coreRoot || "");
  return fsSync.existsSync(path.join(root, "package.json")) &&
    fsSync.existsSync(path.join(root, "app", "runtime")) &&
    fsSync.existsSync(path.join(root, "install", "manifest.toml"));
}

export function readJsonFileSync<T = unknown>(file: string): T | null {
  try {
    return JSON.parse(fsSync.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function coreVersion(coreRoot: string): string {
  try {
    const parsed = JSON.parse(fsSync.readFileSync(path.join(coreRoot, "package.json"), "utf8"));
    return parsed.version || "0.0.0-dev";
  } catch {
    return "0.0.0-dev";
  }
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export function desktopCoreName(repoRoot: string): string {
  const override = process.env.AUTOFLOW_DESKTOP_CORE_NAME;
  if (override && override.trim()) return override.trim();
  return fsSync.existsSync(path.join(repoRoot, ".git")) ? "dev" : "desktop";
}

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

export function activeCoreRegistryEntry(): CoreRegistryEntry | null {
  const registry = readJsonFileSync<{
    active?: string;
    cores?: Record<string, Partial<CoreRegistryEntry>>;
  }>(coreRegistryPath());
  if (!registry || typeof registry !== "object") return null;
  const active = typeof registry.active === "string" ? registry.active : "";
  const cores = registry.cores && typeof registry.cores === "object" ? registry.cores : {};
  const entry = active ? cores[active] : null;
  if (!entry || typeof entry !== "object" || typeof entry.coreRoot !== "string") return null;
  if (!isAutoflowCoreRoot(entry.coreRoot)) return null;
  const resolvedRoot = path.resolve(entry.coreRoot);
  return {
    name: typeof entry.name === "string" ? entry.name : active,
    kind: typeof entry.kind === "string" ? entry.kind : "global",
    coreRoot: resolvedRoot,
    runtimeRoot: typeof entry.runtimeRoot === "string" ? entry.runtimeRoot : path.join(resolvedRoot, "app", "runtime"),
    installRoot: typeof entry.installRoot === "string" ? entry.installRoot : path.join(resolvedRoot, "install"),
    shareRoot: typeof entry.shareRoot === "string" ? path.resolve(entry.shareRoot) : coreBundledShareRoot(resolvedRoot),
    version: typeof entry.version === "string" ? entry.version : coreVersion(resolvedRoot),
    linkedAt: typeof entry.linkedAt === "string" ? entry.linkedAt : ""
  };
}

export function ensureDesktopCoreRegistered(repoRoot: string): void {
  if (process.env.AUTOFLOW_DESKTOP_REGISTER_CORE === "0") return;
  if (!isAutoflowCoreRoot(repoRoot)) return;
  const name = desktopCoreName(repoRoot);
  const file = coreRegistryPath();
  const registry = readJsonFileSync<{
    format?: number;
    active?: string;
    cores?: Record<string, CoreRegistryEntry>;
  }>(file) || {};
  const cores = registry.cores && typeof registry.cores === "object" ? registry.cores : {};
  const entry: CoreRegistryEntry = {
    name,
    kind: name === "dev" ? "dev" : "app",
    coreRoot: path.resolve(repoRoot),
    runtimeRoot: path.join(repoRoot, "app", "runtime"),
    installRoot: path.join(repoRoot, "install"),
    shareRoot: coreBundledShareRoot(repoRoot),
    version: coreVersion(repoRoot),
    linkedAt: nowIso()
  };
  const previous = cores[name];
  if (
    registry.active === name &&
    previous &&
    sameResolvedPath(previous.coreRoot, entry.coreRoot) &&
    sameResolvedPath(previous.shareRoot, entry.shareRoot) &&
    previous.version === entry.version
  ) {
    return;
  }
  fsSync.mkdirSync(path.dirname(file), { recursive: true });
  fsSync.writeFileSync(file, JSON.stringify({
    format: typeof registry.format === "number" ? registry.format : 1,
    active: name,
    cores: { ...cores, [name]: entry }
  }, null, 2) + "\n");
}

export function autoflowBinPath(repoRoot: string): string {
  return path.join(repoRoot, "app", "bin", "autoflow");
}

export function useElectronAsNodeRuntime(): boolean {
  return Boolean(process.versions && process.versions.electron);
}
