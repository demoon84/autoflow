#!/usr/bin/env npx tsx
/*
 * start-todo.ts — legacy todo alias routed to runners/worker/start/index.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const startTicket = path.join(scriptDir, "start", "index.ts");
const runner = tsxCommand();
const result = spawnSync(runner.command, [...runner.args, startTicket, ...process.argv.slice(2)], {
  cwd: boardRoot,
  env: {
    ...process.env,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    AUTOFLOW_ROLE: "worker",
    AUTOFLOW_WORKER_ID: process.env.AUTOFLOW_WORKER_ID || process.env.RUNNER_ID || "todo-1",
  },
  stdio: "inherit",
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(typeof result.status === "number" ? result.status : 1);

function tsxCommand(): { command: string; args: string[] } {
  const local = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  if (fs.existsSync(local)) return { command: local, args: [] };
  return { command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["tsx"] };
}
