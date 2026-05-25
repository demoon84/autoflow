import fsSync from "node:fs";
import path from "node:path";
import { readJsonFileSync } from "./core-registry";
import { parsePositiveIntegerOrDefault, ptyRunnerMeta } from "./pty-scope";
import { queueHasPendingWork } from "./board-queue";

const { app } = require("electron");

const desktopSessionStateFileName = "desktop-session-state.json";

export const DEFAULT_MEMORY_CEILING_MB = 4096;
export const DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS = 30;
export const DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS = 300;
export const BYTES_PER_MEGABYTE = 1024 * 1024;

export function readMemoryCeilingConfig(): {
  ceilingMb: number;
  checkIntervalSeconds: number;
  restartCooldownSeconds: number;
  disabled: boolean;
} {
  const explicitlyEnabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_ENABLED || "");
  const explicitlyDisabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_DISABLED || "");
  const ceilingMb = parsePositiveIntegerOrDefault(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_MB, DEFAULT_MEMORY_CEILING_MB);
  const checkIntervalSeconds = parsePositiveIntegerOrDefault(
    process.env.AUTOFLOW_DESKTOP_MEMORY_CHECK_INTERVAL_SECONDS,
    DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS
  );
  const restartCooldownSeconds = parsePositiveIntegerOrDefault(
    process.env.AUTOFLOW_DESKTOP_MEMORY_RESTART_COOLDOWN_SECONDS,
    DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS
  );
  return {
    ceilingMb,
    checkIntervalSeconds,
    restartCooldownSeconds,
    disabled: explicitlyDisabled || !explicitlyEnabled
  };
}

export function bytesToMegabytes(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value / BYTES_PER_MEGABYTE;
}

export const cancellableInvocations = new Map<string, unknown>();

export function registerCancellableInvocation(invocationId: string, child: unknown): void {
  if (typeof invocationId !== "string" || !invocationId) return;
  cancellableInvocations.set(invocationId, child);
}

export function clearCancellableInvocation(invocationId: string): void {
  if (typeof invocationId !== "string" || !invocationId) return;
  cancellableInvocations.delete(invocationId);
}

export function desktopSessionStatePath(): string {
  return path.join(app.getPath("userData"), desktopSessionStateFileName);
}

function writeJsonFileSyncLocal(filePath: string, value: unknown): void {
  try {
    fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
    fsSync.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch {}
}

export const writeJsonFileSync = writeJsonFileSyncLocal;

export function markDesktopSessionStarted(): void {
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  writeJsonFileSyncLocal(desktopSessionStatePath(), {
    cleanShutdown: false,
    startedAt: timestamp,
    updatedAt: timestamp
  });
}

export function markDesktopSessionClean(reason: string): void {
  const previous = (readJsonFileSync<Record<string, unknown>>(desktopSessionStatePath()) || {}) as Record<string, unknown>;
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  writeJsonFileSyncLocal(desktopSessionStatePath(), {
    ...previous,
    cleanShutdown: true,
    cleanShutdownReason: reason || "quit",
    updatedAt: timestamp
  });
}

export type PtySessionPidEntry = {
  pid: number;
  runnerId: string;
  role: string;
  agent: string;
  spawnedAt: string;
};

export function ptySessionPidsPath(): string {
  return path.join(app.getPath("userData"), "active-pty-pids.json");
}

export function readPtySessionPids(): PtySessionPidEntry[] {
  const data = readJsonFileSync<{ pids?: unknown[] }>(ptySessionPidsPath());
  if (!data || !Array.isArray(data.pids)) return [];
  return (data.pids as Partial<PtySessionPidEntry>[])
    .filter((entry): entry is PtySessionPidEntry => Boolean(entry && Number.isInteger(entry.pid) && (entry.pid || 0) > 0));
}

export function writePtySessionPids(pids: PtySessionPidEntry[]): void {
  writeJsonFileSyncLocal(ptySessionPidsPath(), {
    pids,
    updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z")
  });
}

export function addPtySessionPid(entry: Partial<PtySessionPidEntry>): void {
  if (!entry || !Number.isInteger(entry.pid) || (entry.pid || 0) <= 0) return;
  const current = readPtySessionPids().filter((e) => e.pid !== entry.pid);
  current.push({
    pid: entry.pid as number,
    runnerId: String(entry.runnerId || ""),
    role: String(entry.role || ""),
    agent: String(entry.agent || ""),
    spawnedAt: entry.spawnedAt || new Date().toISOString().replace(/\.\d+Z$/, "Z")
  });
  writePtySessionPids(current);
}

export function removePtySessionPid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) return;
  const remaining = readPtySessionPids().filter((e) => e.pid !== pid);
  writePtySessionPids(remaining);
}

export function clearPtySessionPids(): void {
  writePtySessionPids([]);
}

export function reapPreviousPtySessionPids(): number {
  if (process.platform === "win32") return 0;
  const survivors = readPtySessionPids();
  if (survivors.length === 0) return 0;
  let killed = 0;
  for (const { pid } of survivors) {
    try { process.kill(pid, 0); } catch {
      continue;
    }
    try { process.kill(-pid, "SIGTERM"); } catch {}
    try { process.kill(pid, "SIGTERM"); } catch {}
    killed += 1;
  }
  if (killed > 0) {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const stillAlive = survivors.filter(({ pid }) => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      });
      if (stillAlive.length === 0) break;
      const waitUntil = Date.now() + 100;
      while (Date.now() < waitUntil) {}
    }
    for (const { pid } of survivors) {
      try { process.kill(pid, 0); } catch { continue; }
      try { process.kill(-pid, "SIGKILL"); } catch {}
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  }
  clearPtySessionPids();
  return killed;
}

