import {path} from "./context";

// ─── Roots ──────────────────────────────────────────────────────────
export function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT) return path.resolve(process.env.PROJECT_ROOT);
  if (process.env.AUTOFLOW_PROJECT_ROOT) return path.resolve(process.env.AUTOFLOW_PROJECT_ROOT);
  const cwd = process.cwd();
  return path.basename(cwd) === ".autoflow" ? path.dirname(cwd) : cwd;
}

export function resolveBoardRoot(): string {
  if (process.env.AUTOFLOW_BOARD_ROOT) return path.resolve(process.env.AUTOFLOW_BOARD_ROOT);
  if (process.env.BOARD_ROOT) return path.resolve(process.env.BOARD_ROOT);
  if (path.basename(process.cwd()) === ".autoflow") return process.cwd();
  return path.join(resolveProjectRoot(), ".autoflow");
}

export function boardRelativePath(absPath: string, boardRoot?: string): string {
  const root = boardRoot || resolveBoardRoot();
  const rel = path.relative(root, absPath);
  return rel.startsWith("..") ? absPath : rel;
}

export function normalizeRuntimePath(p: string): string {
  if (!p) return "";
  if (path.isAbsolute(p)) return p;
  return p.replace(/^[.][/]/, "");
}
