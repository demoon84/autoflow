import * as fs from "node:fs";
import * as path from "node:path";

export interface TsxCommand {
  command: string;
  args: string[];
}

function isAutoflowRepoRoot(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, "package.json"))
    && fs.existsSync(path.join(candidate, "app", "runtime"));
}

export function resolveAutoflowRepoRoot(startDir: string): string {
  const explicit = process.env.AUTOFLOW_REPO_ROOT ? path.resolve(process.env.AUTOFLOW_REPO_ROOT) : "";
  if (explicit && isAutoflowRepoRoot(explicit)) return explicit;

  let cursor = path.resolve(startDir || process.cwd());
  while (true) {
    if (isAutoflowRepoRoot(cursor)) return cursor;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return path.resolve(startDir || process.cwd(), "..", "..");
}

export function resolveTsxCommand(startDir: string): TsxCommand {
  const repoRoot = resolveAutoflowRepoRoot(startDir);
  try {
    return {
      command: process.execPath,
      args: [require.resolve("tsx/cli", { paths: [repoRoot] })],
    };
  } catch {}

  const local = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  if (fs.existsSync(local)) return { command: local, args: [] };

  return { command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["tsx"] };
}
