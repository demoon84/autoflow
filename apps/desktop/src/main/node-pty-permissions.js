const fs = require("node:fs");
const path = require("node:path");

function nodePtyPackageRoot() {
  try {
    return path.dirname(require.resolve("node-pty/package.json"));
  } catch {
    return "";
  }
}

function nodePtySpawnHelperPaths() {
  if (process.platform !== "darwin") {
    return [];
  }

  const packageRoot = nodePtyPackageRoot();
  if (!packageRoot) {
    return [];
  }

  return ["darwin-arm64", "darwin-x64"].map((arch) =>
    path.join(packageRoot, "prebuilds", arch, "spawn-helper")
  );
}

function modeHasExecutableBits(mode) {
  return (mode & 0o111) === 0o111;
}

function fixNodePtySpawnHelperPermissions(options = {}) {
  const log = typeof options.log === "function" ? options.log : null;
  const result = {
    checked: [],
    fixed: [],
    missing: [],
    errors: []
  };

  for (const helperPath of nodePtySpawnHelperPaths()) {
    result.checked.push(helperPath);
    if (!fs.existsSync(helperPath)) {
      result.missing.push(helperPath);
      continue;
    }

    try {
      const mode = fs.statSync(helperPath).mode;
      if (modeHasExecutableBits(mode)) {
        continue;
      }

      fs.chmodSync(helperPath, mode | 0o755);
      result.fixed.push(helperPath);
      if (log) {
        log(`fixed node-pty executable bit: ${path.relative(process.cwd(), helperPath)}`);
      }
    } catch (error) {
      result.errors.push({
        path: helperPath,
        message: String(error && error.message ? error.message : error)
      });
    }
  }

  return result;
}

function nodePtySpawnFailureAdvice() {
  if (process.platform !== "darwin") {
    return "";
  }

  return [
    "node-pty could not start its macOS spawn-helper.",
    "Autoflow attempted to repair the helper executable bit automatically.",
    "If this persists, run: npm --prefix apps/desktop run postinstall"
  ].join(" ");
}

function enhanceNodePtySpawnError(error) {
  const message = String(error && error.message ? error.message : error);
  const advice = /posix_spawnp failed/i.test(message) ? nodePtySpawnFailureAdvice() : "";
  if (!advice) {
    return error;
  }

  const enhanced = new Error(`${message}\n${advice}`);
  enhanced.cause = error;
  return enhanced;
}

module.exports = {
  fixNodePtySpawnHelperPermissions,
  enhanceNodePtySpawnError,
  nodePtySpawnFailureAdvice,
  nodePtySpawnHelperPaths
};
