#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

function tsxCommandFor(scriptDir) {
  const projectRoot = path.resolve(scriptDir, "..", "..");
  const localTsx = path.join(projectRoot, "node_modules", ".bin", "tsx");
  if (fs.existsSync(localTsx)) return { command: localTsx, prefixArgs: [] };
  return { command: "npx", prefixArgs: ["tsx"] };
}

function looksLikeBoardRoot(dir) {
  return fs.existsSync(path.join(dir, "scripts")) && fs.existsSync(path.join(dir, "tickets"));
}

function envWithRoots(scriptDir) {
  const env = { ...process.env };
  if (!env.AUTOFLOW_BOARD_ROOT && !env.BOARD_ROOT) {
    const cwd = process.cwd();
    const scriptBoardRoot = path.resolve(scriptDir, "..");
    if (looksLikeBoardRoot(cwd)) {
      env.AUTOFLOW_BOARD_ROOT = cwd;
    } else if (looksLikeBoardRoot(scriptBoardRoot)) {
      env.AUTOFLOW_BOARD_ROOT = scriptBoardRoot;
    }
  }
  if (!env.AUTOFLOW_PROJECT_ROOT && !env.PROJECT_ROOT && env.AUTOFLOW_BOARD_ROOT) {
    env.AUTOFLOW_PROJECT_ROOT = path.resolve(env.AUTOFLOW_BOARD_ROOT, "..");
  }
  return env;
}

function runTsSibling(scriptPath, argv) {
  const scriptDir = path.dirname(scriptPath);
  const stem = path.basename(scriptPath, path.extname(scriptPath));
  const tsFile = path.join(scriptDir, `${stem}.ts`);
  const runner = tsxCommandFor(scriptDir);
  const result = cp.spawnSync(runner.command, [...runner.prefixArgs, tsFile, ...argv], {
    stdio: "inherit",
    env: envWithRoots(scriptDir),
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(typeof result.status === "number" ? result.status : 1);
}

module.exports = { runTsSibling, tsxCommandFor, envWithRoots };

if (require.main === module) {
  runTsSibling(process.argv[1], process.argv.slice(2));
}
