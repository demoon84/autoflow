import path from "node:path";
import { ensureAutoflowCliShim } from "./cli-invocation";
import { autoflowBinPath, useElectronAsNodeRuntime } from "./core-registry";
import { ensureCodexRunnerHome, normalizeCodexHistoryMode, normalizeRunnerReasoningValue } from "./codex";
import { augmentedPathValue, pathWithPrependedEntries, shellQuote, userLoginShell } from "./shell-path";

function repoRoot(): string {
  return process.env.AUTOFLOW_REPO_ROOT || "";
}

export function buildAgentCliCommand(
  agent: string,
  model: string,
  reasoning: string,
  options: { boardDirName?: string; initialPromptFile?: string } = {}
): string {
  const parts: string[] = [];
  const rawSuffix: string[] = [];
  const normalizedAgent = String(agent || "").toLowerCase();
  const normalizedReasoning = normalizeRunnerReasoningValue(normalizedAgent, reasoning);
  switch (normalizedAgent) {
    case "claude": {
      parts.push("claude", "--dangerously-skip-permissions",
        "--permission-mode", "bypassPermissions",
        "--plugin-dir", ".claude/autoflow-plugin");
      if (model) parts.push("--model", model);
      if (normalizedReasoning) parts.push("--effort", normalizedReasoning);
      break;
    }
    case "codex": {
      parts.push(
        "codex",
        "--dangerously-bypass-approvals-and-sandbox",
        "--dangerously-bypass-hook-trust"
      );
      if (model) parts.push("-m", model);
      if (normalizedReasoning) parts.push("-c", `model_reasoning_effort="${normalizedReasoning}"`);
      if (options.initialPromptFile) rawSuffix.push(`"$(cat ${shellQuote(options.initialPromptFile)})"`);
      break;
    }
    default:
      return "";
  }
  return [
    ...parts.map((p) => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(p) ? p : shellQuote(p))),
    ...rawSuffix
  ].join(" ");
}

export function buildRunnerPtyEnv(
  { agent, runnerId, role, projectRoot, boardDirName, codexHistory }:
  { agent: string; runnerId: string; role: string; projectRoot: string; boardDirName: string; codexHistory: string }
): { env: Record<string, string>; codexHome: string; codexHistory: string } {
  const cliShim = ensureAutoflowCliShim({ projectRoot, boardDirName });
  const runnerPath = pathWithPrependedEntries(
    cliShim.ok ? [cliShim.binDir] : [],
    augmentedPathValue(process.env.PATH || "")
  );
  const env: Record<string, string> = {
    AUTOFLOW_WORKER_ID: runnerId,
    AUTOFLOW_RUNNER_ID: runnerId,
    AUTOFLOW_ROLE: role,
    RUNNER_ID: runnerId,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_BOARD_ROOT: path.join(projectRoot, boardDirName),
    BOARD_ROOT: path.join(projectRoot, boardDirName),
    AUTOFLOW_BOARD_DIR_NAME: boardDirName,
    AUTOFLOW_NODE_RUNTIME: useElectronAsNodeRuntime() ? process.execPath : autoflowBinPath(repoRoot()),
    AUTOFLOW_CLI_ENTRY: autoflowBinPath(repoRoot()),
    AUTOFLOW_CLI_NEEDS_ELECTRON: useElectronAsNodeRuntime() ? "1" : "0",
    AUTOFLOW_CLI: cliShim.ok ? cliShim.shimPath : autoflowBinPath(repoRoot()),
    AUTOFLOW_CLI_SHIM_ERROR: cliShim.ok ? "" : cliShim.error,
    PATH: runnerPath,
    SHELL: userLoginShell()
  };
  let codexHome = "";
  const effectiveCodexHistory =
    String(agent || "").toLowerCase() === "codex"
      ? normalizeCodexHistoryMode(codexHistory)
      : "";
  if (effectiveCodexHistory === "isolated") {
    const prepared = ensureCodexRunnerHome({ projectRoot, boardDirName, runnerId });
    codexHome = prepared.codexHome;
    env.CODEX_HOME = codexHome;
    env.AUTOFLOW_CODEX_HOME = codexHome;
    env.AUTOFLOW_CODEX_HISTORY = effectiveCodexHistory;
  }
  return { env, codexHome, codexHistory: effectiveCodexHistory || "" };
}
