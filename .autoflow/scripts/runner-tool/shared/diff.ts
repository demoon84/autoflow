import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { isGitWorktree, normalizeRelPath, pathsOverlap, readWorktreeStatus } from "./worktree";
import { safeLineCount } from "./wiki";

export function diffCheck(ticket: string): JsonObject {
  const stats = diffStats(ticket);
  return {
    passed: numberValue(stats.changed_file_count) > 0 && Boolean(stats.in_scope),
    ...stats,
  };
}

export function diffStats(ticket: string): JsonObject {
  const status = readWorktreeStatus(ticket);
  const workingRoot = stringValue(status.working_root) || PROJECT_ROOT;
  if (!isGitWorktree(workingRoot)) {
    return {
      reason: "working_root_not_git",
      working_root: workingRoot,
      changed_file_count: 0,
      changed_files: [],
      changed_line_count: 0,
      code_files_changed_count: 0,
      code_insertions_count: 0,
      code_deletions_count: 0,
      code_volume_count: 0,
      code_net_delta_count: 0,
      product_changed_files: [],
      in_scope: false,
      out_of_scope_files: [],
    };
  }
  const base = stringValue(status.base_commit) || git(["rev-parse", "--verify", "HEAD"], workingRoot).stdout.trim();
  const changedFiles = unique([
    ...gitLines(["diff", "--name-only", `${base}..HEAD`], workingRoot),
    ...gitLines(["diff", "--name-only"], workingRoot),
    ...gitLines(["diff", "--cached", "--name-only"], workingRoot),
    ...statusPorcelainPaths(workingRoot),
  ]);
  const allowed = utils.ticketConcreteAllowedPaths(ticket);
  const outOfScope = changedFiles.filter((file) => !allowed.some((allowedPath) => pathsOverlap(file, allowedPath)));
  const statsByFile = numstatByFile([
    git(["diff", "--numstat", `${base}..HEAD`], workingRoot).stdout,
    git(["diff", "--numstat"], workingRoot).stdout,
    git(["diff", "--cached", "--numstat"], workingRoot).stdout,
  ].join("\n"));
  const productFiles = changedFiles
    .filter((file) => !normalizeRelPath(file).startsWith(".autoflow/"))
    .filter((file) => allowed.length === 0 || allowed.some((allowedPath) => pathsOverlap(file, allowedPath)));
  let insertions = 0;
  let deletions = 0;
  for (const file of productFiles) {
    const stat = statsByFile.get(file);
    if (stat) {
      insertions += stat.additions;
      deletions += stat.deletions;
      continue;
    }
    const abs = path.resolve(workingRoot, file);
    if (fs.existsSync(abs) && statusPorcelainPaths(workingRoot).includes(file)) {
      insertions += safeLineCount(abs);
    }
  }
  const lineCount = Array.from(statsByFile.values()).reduce((sum, item) => sum + item.additions + item.deletions, 0);
  return {
    working_root: workingRoot,
    base_commit: base,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    changed_line_count: lineCount,
    code_files_changed_count: productFiles.length,
    code_insertions_count: insertions,
    code_deletions_count: deletions,
    code_volume_count: insertions + deletions,
    code_net_delta_count: insertions - deletions,
    product_changed_files: productFiles,
    allowed_paths: allowed,
    in_scope: outOfScope.length === 0,
    out_of_scope_files: outOfScope,
  };
}

export function diffPatch(workingRoot: string, baseCommit: string, allowedPaths: string[], maxBytes: number): { text: string; bytes: number; truncated: boolean } {
  if (!workingRoot || !isGitWorktree(workingRoot)) return { text: "", bytes: 0, truncated: false };
  const pathArgs = allowedPaths.length > 0 ? ["--", ...allowedPaths] : [];
  const chunks: string[] = [];
  if (baseCommit) {
    const committed = git(["diff", "--no-ext-diff", "--minimal", `${baseCommit}..HEAD`, ...pathArgs], workingRoot).stdout;
    if (committed.trim()) chunks.push(`# committed diff ${baseCommit}..HEAD\n${committed}`);
  }
  const cached = git(["diff", "--cached", "--no-ext-diff", "--minimal", ...pathArgs], workingRoot).stdout;
  if (cached.trim()) chunks.push(`# cached diff\n${cached}`);
  const dirty = git(["diff", "--no-ext-diff", "--minimal", ...pathArgs], workingRoot).stdout;
  if (dirty.trim()) chunks.push(`# working tree diff\n${dirty}`);
  return capTextByBytes(chunks.join("\n"), maxBytes);
}

export function capTextByBytes(text: string, maxBytes: number): { text: string; bytes: number; truncated: boolean } {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { text, bytes, truncated: false };
  let out = text;
  while (Buffer.byteLength(out, "utf8") > maxBytes && out.length > 0) {
    out = out.slice(0, Math.max(0, out.length - 512));
  }
  const suffix = "\n[... patch truncated ...]";
  return { text: `${out}${suffix}`, bytes, truncated: true };
}

export function statusPorcelainPaths(cwd: string): string[] {
  return git(["status", "--porcelain", "--untracked-files=all"], cwd).stdout
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => {
      const pathPart = line.slice(3);
      return pathPart.includes(" -> ") ? pathPart.split(" -> ").pop() || "" : pathPart;
    })
    .filter(Boolean);
}

export function gitLines(gitArgs: string[], cwd: string): string[] {
  return git(gitArgs, cwd).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function numstatLineCount(raw: string): number {
  let total = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [a, d] = line.split(/\s+/);
    const add = a === "-" ? 0 : Number.parseInt(a, 10);
    const del = d === "-" ? 0 : Number.parseInt(d, 10);
    if (Number.isFinite(add)) total += add;
    if (Number.isFinite(del)) total += del;
  }
  return total;
}

export function numstatByFile(raw: string): Map<string, { additions: number; deletions: number }> {
  const out = new Map<string, { additions: number; deletions: number }>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(/\t/);
    if (parts.length < 3) continue;
    const additions = parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10);
    const file = parts.slice(2).join("\t");
    out.set(file, {
      additions: Number.isFinite(additions) ? additions : 0,
      deletions: Number.isFinite(deletions) ? deletions : 0,
    });
  }
  return out;
}
