import fs from "node:fs/promises";
import path from "node:path";
import { defaultBoardDirName, ptyRunnerKey } from "./pty-scope";
import { removePtySessionPid } from "./process-control";

type Scope = { projectRoot?: string; boardDirName?: string };
type RunnerState = Record<string, string>;

type CliRunnerControlDeps = {
  spawnRunnerPtySession: (opts: { runnerId: string; projectRoot: string; boardDirName: string; freshSession: boolean }, source: string) => Promise<{ ok: boolean; error?: string }>;
  readRunnerStateValues: (filePath: string) => Promise<RunnerState>;
  writeRunnerStateAtomic: (filePath: string, values: RunnerState, explicitKeys?: Set<string>) => Promise<void>;
  killPidForcefully: (pid: number) => void;
  clearReadBoardCachesForScope: (scope: Scope) => void;
  publishBoardChange: (scope: Scope, reason: string) => void;
};

let deps: CliRunnerControlDeps | null = null;

export function initCliRunnerControl(injected: CliRunnerControlDeps): void {
  deps = injected;
}

const cliRunnerControlRequestsInFlight = new Set<string>();
const staleCliRunnerControlRequestMs = 120_000;

export function cliRunnerControlRequestKey(scope: Scope, runnerId: string, state: RunnerState): string {
  return [
    scope?.projectRoot || "",
    scope?.boardDirName || defaultBoardDirName(),
    runnerId || "",
    state.control_action || state.last_result || "",
    state.control_requested_at || state.updated_at || state.last_event_at || ""
  ].join("\0");
}

export function stateHasCliRunnerControlRequest(state: RunnerState): boolean {
  const controlSource = String(state.control_source || "").toLowerCase();
  if (controlSource !== "cli") return false;
  const action = String(state.control_action || "").toLowerCase();
  const lastResult = String(state.last_result || "").toLowerCase();
  const startLike =
    action === "start" ||
    action === "restart" ||
    lastResult === "runner_start_requested" ||
    lastResult === "runner_restart_requested";
  if (startLike && !String(state.pid || "").trim()) {
    const requestedMs = Date.parse(state.control_requested_at || state.updated_at || state.last_event_at || "");
    if (!Number.isFinite(requestedMs) || Date.now() - requestedMs > staleCliRunnerControlRequestMs) {
      return false;
    }
  }
  return (
    startLike ||
    action === "stop" ||
    lastResult === "runner_stopped"
  );
}

export async function markCliRunnerControlFailed(scope: Scope, runnerId: string, message: string): Promise<void> {
  if (!deps) return;
  const boardDirName = scope?.boardDirName || defaultBoardDirName();
  const statePath = path.join(String(scope.projectRoot || ""), boardDirName, "runners", "state", `${runnerId}.state`);
  try {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    const current = await deps.readRunnerStateValues(statePath);
    await deps.writeRunnerStateAtomic(statePath, {
      ...current,
      id: runnerId,
      status: "stopped",
      runner_status: "stopped",
      pid: "",
      last_result: "runner_start_failed",
      control_action: "",
      control_source: "",
      control_requested_at: "",
      control_force: "",
      last_log_line: String(message || "runner start failed").slice(0, 2000),
      last_event_at: new Date().toISOString().replace(/\.\d+Z$/, "Z")
    });
  } catch {}
}

export async function processCliRunnerControlRequest(scope: Scope, runnerId: string, state: RunnerState): Promise<void> {
  if (!deps) return;
  const boardDirName = scope?.boardDirName || defaultBoardDirName();
  const ptyManager = (globalThis as any).__autoflowPtyManager;
  const action = String(state.control_action || "").toLowerCase();
  const lastResult = String(state.last_result || "").toLowerCase();
  const runnerKey = ptyRunnerKey(String(scope.projectRoot || ""), boardDirName, runnerId);

  if (action === "stop" || lastResult === "runner_stopped") {
    const runner = ptyManager && typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
    if (runner && runner.status === "running") {
      const force = String(state.control_force || "").toLowerCase() === "true";
      if (force && Number.isInteger(runner.pid) && runner.pid > 0) {
        deps.killPidForcefully(runner.pid);
        removePtySessionPid(runner.pid);
      }
      ptyManager.stop(runnerKey, { force });
    }
    const statePath = path.join(String(scope.projectRoot || ""), boardDirName, "runners", "state", `${runnerId}.state`);
    try {
      const current = await deps.readRunnerStateValues(statePath);
      await deps.writeRunnerStateAtomic(statePath, {
        ...current,
        id: runnerId,
        status: "stopped",
        runner_status: "stopped",
        pid: "",
        control_action: "",
        control_source: "",
        control_requested_at: "",
        control_force: "",
        last_result: current.last_result === "runner_stopped" ? "loop_stopped" : current.last_result || "loop_stopped",
        last_event_at: new Date().toISOString().replace(/\.\d+Z$/, "Z")
      });
    } catch {}
    return;
  }

  if (action === "start" || action === "restart" || lastResult === "runner_start_requested" || lastResult === "runner_restart_requested") {
    const result = await deps.spawnRunnerPtySession({
      runnerId,
      projectRoot: String(scope.projectRoot || ""),
      boardDirName,
      freshSession: action === "restart" || lastResult === "runner_restart_requested"
    }, "cli-control");
    if (!result?.ok) {
      await markCliRunnerControlFailed(scope, runnerId, result?.error || "runner start failed");
    }
  }
}

export async function reconcileCliRunnerControlRequestsForScope(scope: Scope, reasons: string[] = []): Promise<void> {
  if (!deps || !scope?.projectRoot) return;
  const boardDirName = scope.boardDirName || defaultBoardDirName();
  const stateDir = path.join(String(scope.projectRoot), boardDirName, "runners", "state");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(stateDir);
  } catch {
    return;
  }
  await Promise.all(entries.filter((name) => name.endsWith(".state")).map(async (name) => {
    const runnerId = path.basename(name, ".state");
    if (!runnerId || runnerId === "parcel-watcher") return;
    const statePath = path.join(stateDir, name);
    const state = await deps!.readRunnerStateValues(statePath);
    if (!stateHasCliRunnerControlRequest(state)) return;
    const requestKey = cliRunnerControlRequestKey({ projectRoot: scope.projectRoot, boardDirName }, runnerId, state);
    if (cliRunnerControlRequestsInFlight.has(requestKey)) return;
    cliRunnerControlRequestsInFlight.add(requestKey);
    try {
      await processCliRunnerControlRequest({ projectRoot: scope.projectRoot, boardDirName }, runnerId, state);
      deps!.clearReadBoardCachesForScope({ projectRoot: scope.projectRoot, boardDirName });
      deps!.publishBoardChange({ projectRoot: scope.projectRoot, boardDirName }, reasons[reasons.length - 1] || "cli-runner-control");
    } finally {
      cliRunnerControlRequestsInFlight.delete(requestKey);
    }
  }));
}
