#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

function scriptStem(scriptPath) {
  return path.basename(String(scriptPath || ""), path.extname(String(scriptPath || "")));
}

function resolveLegacyScript(scriptPath) {
  const dir = path.dirname(scriptPath);
  return path.join(dir, `${scriptStem(scriptPath)}.legacy.sh`);
}

function runAsMain(scriptPath, argv) {
  const legacyScript = resolveLegacyScript(scriptPath);
  const result = spawnSync("bash", [legacyScript, ...argv], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

module.exports = {
  resolveLegacyScript,
  runAsMain,
  scriptStem,
};
