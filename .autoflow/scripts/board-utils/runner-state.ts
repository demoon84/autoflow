import {path} from "./context";
import {nowIso} from "./format";
import {readFileSafe, writeFileSafe} from "./files";
import {resolveBoardRoot} from "./roots";

// ─── Runner state file IO ───────────────────────────────────────────
export function runnerStatePath(runnerId: string, boardRoot?: string): string {
  return path.join(boardRoot || resolveBoardRoot(), "runners", "state", `${runnerId}.state`);
}

export function readRunnerState(runnerId: string, boardRoot?: string): Map<string, string> {
  const map = new Map<string, string>();
  const text = readFileSafe(runnerStatePath(runnerId, boardRoot));
  if (!text) return map;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    map.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return map;
}

export function writeRunnerState(
  runnerId: string,
  map: Map<string, string>,
  boardRoot?: string
): boolean {
  const out = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  return writeFileSafe(runnerStatePath(runnerId, boardRoot), out);
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

// ─── PID liveness (used by janitor + claim lock) ────────────────
export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err && err.code === "EPERM";
  }
}
