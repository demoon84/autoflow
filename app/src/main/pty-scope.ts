import nodeCrypto from "node:crypto";
import path from "node:path";
import { scaffoldManifestValue } from "./manifest-toml";

export type PtyRunnerMetaEntry = {
  runnerId?: string;
  projectRoot?: string;
  boardDirName?: string;
  agent?: string;
  role?: string;
  [key: string]: unknown;
};

// Shared in-memory map keyed by PTY runner key. Modules read/write this
// directly so any module can look up runner metadata without going through
// the main process entry point.
export const ptyRunnerMeta = new Map<string, PtyRunnerMetaEntry>();

export function ptyRunnerPublicId(runnerKey: string): string {
  const meta = ptyRunnerMeta.get(runnerKey);
  return String(meta?.runnerId || runnerKey || "");
}

type PtyManagerLike = {
  get?: (runnerKey: string) => { cwd?: string; status?: string } | null | undefined;
};

export function ptyRunnerMetaForScope(
  runnerId: string,
  scope: { projectRoot?: string; boardDirName?: string } = {}
): { key: string; meta: PtyRunnerMetaEntry | undefined } {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (requestedProjectRoot) {
    const key = ptyRunnerKeyForScope(scope, runnerId);
    return { key, meta: ptyRunnerMeta.get(key) };
  }
  if (ptyRunnerMeta.has(runnerId)) {
    return { key: runnerId, meta: ptyRunnerMeta.get(runnerId) };
  }
  for (const [key, meta] of ptyRunnerMeta.entries()) {
    if (meta?.runnerId === runnerId) {
      return { key, meta };
    }
  }
  return { key: String(runnerId || ""), meta: undefined };
}

export function getPtyRunnerForScope(
  ptyManager: PtyManagerLike | null | undefined,
  runnerId: string,
  scope: { projectRoot?: string; boardDirName?: string } = {}
): ReturnType<NonNullable<PtyManagerLike["get"]>> | null {
  if (!ptyManager || typeof ptyManager.get !== "function") return null;
  if (ptyRunnerMeta.has(runnerId)) return ptyManager.get(runnerId) || null;
  const { key } = ptyRunnerMetaForScope(runnerId, scope);
  return ptyManager.get(key) || null;
}

export function ptyRunnerMatchesRequestedScope(
  ptyManager: PtyManagerLike | null | undefined,
  runnerId: string,
  scope: { projectRoot?: string; boardDirName?: string } = {}
): boolean {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (!requestedProjectRoot) return true;
  const { key } = ptyRunnerMetaForScope(runnerId, scope);
  const meta = ptyRunnerMeta.get(runnerId) || ptyRunnerMeta.get(key);
  if (meta) {
    return ptyScopeMatches(String(meta.projectRoot || ""), String(meta.boardDirName || ""), scope);
  }
  const runner = ptyManager && typeof ptyManager.get === "function"
    ? ptyManager.get(key) || ptyManager.get(runnerId)
    : null;
  if (runner && runner.cwd) {
    return normalizePtyProjectRoot(runner.cwd) === requestedProjectRoot;
  }
  return false;
}

export function ptyRunnerScopedPayload(
  runnerKey: string,
  payload: Record<string, unknown> = {}
): Record<string, unknown> {
  const meta = ptyRunnerMeta.get(runnerKey);
  return {
    ...payload,
    runnerId: meta?.runnerId || runnerKey,
    projectRoot: meta?.projectRoot || "",
    boardDirName: meta?.boardDirName || defaultBoardDirName()
  };
}

let cachedDefaultBoardDirName: string | null = null;

export function defaultBoardDirName(): string {
  if (cachedDefaultBoardDirName === null) {
    cachedDefaultBoardDirName = scaffoldManifestValue("install", "default_board_dir", ".autoflow");
  }
  return cachedDefaultBoardDirName;
}

export function shortHash(value: unknown, length = 12): string {
  return nodeCrypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

export function normalizePtyProjectRoot(value: unknown): string {
  const raw = String(value || "");
  return raw ? path.resolve(raw) : "";
}

export function normalizePtyBoardDirName(value: unknown): string {
  return String(value || defaultBoardDirName());
}

export function ptyScopeMatches(
  projectRoot: string,
  boardDirName: string,
  scope: { projectRoot?: string; boardDirName?: string } = {}
): boolean {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (!requestedProjectRoot) return true;
  return (
    normalizePtyProjectRoot(projectRoot) === requestedProjectRoot &&
    normalizePtyBoardDirName(boardDirName) === normalizePtyBoardDirName(scope.boardDirName)
  );
}

export function parsePositiveIntegerOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function ptyRunnerKey(projectRoot: string, boardDirName: string, runnerId: string): string {
  const normalizedProjectRoot = normalizePtyProjectRoot(projectRoot);
  const normalizedRunnerId = String(runnerId || "").trim();
  if (!normalizedProjectRoot || !normalizedRunnerId) {
    return normalizedRunnerId;
  }
  const normalizedBoardDirName = normalizePtyBoardDirName(boardDirName);
  return `${shortHash(`${normalizedProjectRoot}\0${normalizedBoardDirName}`, 16)}:${normalizedRunnerId}`;
}

export function ptyRunnerKeyForScope(
  scope: { projectRoot?: string; boardDirName?: string } = {},
  runnerId: string
): string {
  return ptyRunnerKey(scope.projectRoot || "", scope.boardDirName || "", runnerId);
}
