import {execFileSync} from "./context";
import {resolveProjectRoot} from "./roots";

export function gitRootPath(cwd?: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export function gitHeadCommit(cwd?: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

// ─── git helpers ────────────────────────────────────────────────────
export function gitOutput(args: string[], cwd?: string): string {
  try {
    return execFileSync("git", args, {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}
