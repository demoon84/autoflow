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

function spawnLegacyScript(scriptPath, argv, options = {}) {
  const legacyScript = resolveLegacyScript(scriptPath);
  const result = spawnSync("bash", [legacyScript, ...argv], {
    stdio: "inherit",
    env: options.env || process.env,
  });

  if (result.error) {
    return {
      ok: false,
      status: 1,
      message: result.error.message,
      legacyScript,
    };
  }

  return {
    ok: typeof result.status === "number" && result.status === 0,
    status: typeof result.status === "number" ? result.status : 1,
    legacyScript,
  };
}

function runAsMain(scriptPath, argv) {
  const result = spawnLegacyScript(scriptPath, argv);
  if (!result.ok && result.message) {
    console.error(result.message);
  }
  process.exit(result.status);
}

module.exports = {
  resolveLegacyScript,
  runAsMain,
  scriptStem,
  spawnLegacyScript,
};
