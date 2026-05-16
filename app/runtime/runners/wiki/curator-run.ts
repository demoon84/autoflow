#!/usr/bin/env npx tsx
/*
 * curator-run.ts — runtime wrapper for `autoflow skill curator-run`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const boardDirName = path.basename(boardRoot);
const repoRoot = path.resolve(scriptDir, "..", "..");
const cliPath = path.join(repoRoot, "app", "bin", process.platform === "win32" ? "autoflow.cmd" : "autoflow");

if (!fs.existsSync(cliPath)) {
  process.stdout.write(`status=fail\nreason=autoflow_cli_missing\ncli_path=${cliPath}\n`);
  process.exit(1);
}

const result = spawnSync(cliPath, ["skill", "curator-run", projectRoot, boardDirName, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, AUTOFLOW_BOARD_ROOT: boardRoot, AUTOFLOW_PROJECT_ROOT: projectRoot },
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(typeof result.status === "number" ? result.status : 1);
