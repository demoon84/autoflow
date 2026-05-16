import {fs, path, spawnSync, boardRoot, projectRoot, runnerId, scriptDir, type ToolJson} from "./context";
import { resolveTsxCommand } from "../../../shared/tsx";

export function tool(...args: string[]): ToolJson {
  const runnerTool = path.join(scriptDir, "..", "..", "tool.ts");
  const runner = tsxCommand();
  const env = {
    ...process.env,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_ROLE: process.env.AUTOFLOW_ROLE || "worker",
    AUTOFLOW_WORKER_ID: runnerId,
  };
  const result = spawnSync(runner.command, [...runner.args, runnerTool, ...args], {
    cwd: boardRoot,
    env,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  const stdout = result.stdout || "";
  let parsed: ToolJson = {};
  try {
    parsed = JSON.parse(stdout) as ToolJson;
  } catch {
    throw new Error(`runner-tool returned non-json output for ${args.join(" ")}: ${stdout || result.stderr}`);
  }
  if (result.status !== 0 || parsed.status === "error") {
    throw new Error(String(parsed.error || result.stderr || `runner-tool failed: ${args.join(" ")}`));
  }
  return parsed;
}

export function tsxCommand(): { command: string; args: string[] } {
  return resolveTsxCommand(scriptDir);
}
