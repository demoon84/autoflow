import {execFileSync, fs, path, projectRoot, spawnSync} from "./context";
import {unique} from "./io";
import { resolveTsxCommand } from "../../../shared/tsx";

export function isGitWorktree(cwd: string): boolean {
  return git(cwd, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

export function gitRootPath(cwd: string): string {
  return gitOut(cwd, ["rev-parse", "--show-toplevel"]);
}

export function headContainsCommit(cwd: string, commit: string): boolean {
  if (!commit) return false;
  return git(cwd, ["merge-base", "--is-ancestor", commit, "HEAD"]).status === 0;
}

export function gitLines(cwd: string, args: string[]): string[] {
  return gitOut(cwd, args).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function gitOut(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function gitRawOut(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

export function git(cwd: string, args: string[]): { status: number } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: typeof result.status === "number" ? result.status : 1 };
}

export function gitWithInput(cwd: string, args: string[], input: string): { status: number } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", input });
  return { status: typeof result.status === "number" ? result.status : 1 };
}

export function spawnTsScript(scriptPath: string, scriptArgs: string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  const runner = resolveTsxCommand(path.dirname(scriptPath));
  return spawnSync(runner.command, [...runner.args, scriptPath, ...scriptArgs], { encoding: "utf8", env });
}

export function spawnOutputText(value: string | Buffer | null | undefined): string {
  if (typeof value === "string") return value;
  return value ? value.toString("utf8") : "";
}

export function pathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = aRaw.replace(/\/+$/, "");
  const b = bRaw.replace(/\/+$/, "");
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function changedFiles(cwd: string, baseCommit: string): string[] {
  return unique([
    ...gitLines(cwd, ["diff", "--name-only", `${baseCommit}..HEAD`]),
    ...gitLines(cwd, ["diff", "--name-only"]),
    ...gitLines(cwd, ["diff", "--cached", "--name-only"]),
    ...statusPaths(cwd),
  ]);
}

export function statusPaths(cwd: string): string[] {
  return gitOut(cwd, ["status", "--porcelain", "--untracked-files=all"])
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3))
    .map((name) => name.includes(" -> ") ? name.split(" -> ").pop() || "" : name)
    .filter(Boolean);
}

export function diffLineCount(cwd: string, baseCommit: string): number {
  const raw = [
    gitOut(cwd, ["diff", "--numstat", `${baseCommit}..HEAD`]),
    gitOut(cwd, ["diff", "--numstat"]),
    gitOut(cwd, ["diff", "--cached", "--numstat"]),
  ].join("\n");
  let total = 0;
  for (const line of raw.split(/\r?\n/)) {
    const [addRaw, delRaw] = line.trim().split(/\s+/);
    for (const value of [addRaw, delRaw]) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) total += parsed;
    }
  }
  return total;
}

export function projectRootPathMatchesWorktree(worktreePath: string, relPath: string): boolean {
  const rootPath = path.join(projectRoot, relPath);
  const workPath = path.join(worktreePath, relPath);
  const rootExists = fs.existsSync(rootPath);
  const workExists = fs.existsSync(workPath);
  if (!rootExists && !workExists) return true;
  if (rootExists !== workExists) return false;
  if (fs.statSync(rootPath).isDirectory() && fs.statSync(workPath).isDirectory()) {
    const result = spawnSync("diff", ["-qr", rootPath, workPath], { encoding: "utf8" });
    return result.status === 0;
  }
  try {
    return fs.readFileSync(rootPath).equals(fs.readFileSync(workPath));
  } catch {
    return false;
  }
}

export function projectRootContainsWorktreeChange(worktreePath: string, baseCommit: string, relPath: string): boolean {
  if (!baseCommit) return projectRootPathMatchesWorktree(worktreePath, relPath);
  const patch = gitRawOut(worktreePath, ["diff", "--binary", `${baseCommit}..HEAD`, "--", relPath]);
  if (!patch.trim()) return projectRootPathMatchesWorktree(worktreePath, relPath);

  const reverseCheckArgs = ["apply", "--reverse", "--check", "--3way", "--whitespace=nowarn"];
  if (gitWithInput(projectRoot, reverseCheckArgs, patch).status === 0) return true;

  const plainReverseCheckArgs = ["apply", "--reverse", "--check", "--whitespace=nowarn"];
  if (gitWithInput(projectRoot, plainReverseCheckArgs, patch).status === 0) return true;

  const zeroContextPatch = gitRawOut(worktreePath, ["diff", "--binary", "--unified=0", `${baseCommit}..HEAD`, "--", relPath]);
  const zeroContextReverseCheckArgs = ["apply", "--reverse", "--check", "--unidiff-zero", "--whitespace=nowarn"];
  if (zeroContextPatch.trim() && gitWithInput(projectRoot, zeroContextReverseCheckArgs, zeroContextPatch).status === 0) return true;

  return projectRootPathMatchesWorktree(worktreePath, relPath);
}
