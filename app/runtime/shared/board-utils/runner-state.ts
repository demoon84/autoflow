import {path} from "./context";
import {nowIso} from "./format";
import {resolveBoardRoot} from "./roots";
import {isRunnerProcessAlive, readRunnerStateFile, writeRunnerStateFile} from "../../../shared/runner-state-store";

// ─── Runner state file IO ───────────────────────────────────────────
export function runnerStatePath(runnerId: string, boardRoot?: string): string {
  return path.join(boardRoot || resolveBoardRoot(), "runners", "state", `${runnerId}.state`);
}

export function readRunnerState(runnerId: string, boardRoot?: string): Map<string, string> {
  return new Map(Object.entries(readRunnerStateFile(runnerStatePath(runnerId, boardRoot))));
}

export function writeRunnerState(
  runnerId: string,
  map: Map<string, string>,
  boardRoot?: string
): boolean {
  try {
    writeRunnerStateFile(runnerStatePath(runnerId, boardRoot), Object.fromEntries(map));
    return true;
  } catch {
    return false;
  }
}

export function updateRunnerState(
  runnerId: string,
  fields: Record<string, string | number | undefined | null>,
  boardRoot?: string
): boolean {
  const map = readRunnerState(runnerId, boardRoot);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    map.set(k, String(v));
  }
  map.set("updated_at", nowIso());
  return writeRunnerState(runnerId, map, boardRoot);
}

// ─── PID liveness (used by claim lock) ─────────────────────────
export function pidAlive(pid: number): boolean {
  return isRunnerProcessAlive(pid);
}
