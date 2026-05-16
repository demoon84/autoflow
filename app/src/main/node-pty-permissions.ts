import fs from "node:fs";
import path from "node:path";

type PermissionRepairResult = {
  checked: string[];
  fixed: string[];
  missing: string[];
  errors: Array<{
    path: string;
    message: string;
  }>;
};

type PermissionRepairOptions = {
  log?: (message: string) => void;
};

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

function modeHasExecutableBits(mode: number) {
  return (mode & 0o111) === 0o111;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function fixNodePtySpawnHelperPermissions(options: PermissionRepairOptions = {}): PermissionRepairResult {
  const log = typeof options.log === "function" ? options.log : null;
  const result: PermissionRepairResult = {
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
        message: errorMessage(error)
      });
    }
  }

  return result;
}

export function nodePtySpawnFailureAdvice() {
  if (process.platform !== "darwin") {
    return "";
  }

  return [
    "node-pty could not start its macOS spawn-helper.",
    "Autoflow attempted to repair the helper executable bit automatically.",
    "If this persists, run: npm run postinstall in the autoflow repo"
  ].join(" ");
}

export function enhanceNodePtySpawnError(error: unknown) {
  const message = errorMessage(error);
  const advice = /posix_spawnp failed/i.test(message) ? nodePtySpawnFailureAdvice() : "";
  if (!advice) {
    return error;
  }

  const enhanced = new Error(`${message}\n${advice}`);
  enhanced.cause = error;
  return enhanced;
}

export {
  nodePtySpawnHelperPaths
};

export default {
  fixNodePtySpawnHelperPermissions,
  enhanceNodePtySpawnError,
  nodePtySpawnFailureAdvice,
  nodePtySpawnHelperPaths
};
