import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { isGitWorktree, normalizeRelPath, pathsOverlap, readWorktreeStatus } from "./worktree";
import { safeLineCount } from "./wiki";

const nonCodeMetricBasenames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "composer.lock",
  "poetry.lock",
  "Cargo.lock",
]);

const nonCodeMetricExtensions = new Set([
  ".3gp",
  ".7z",
  ".aac",
  ".aiff",
  ".apk",
  ".avi",
  ".avif",
  ".bin",
  ".bmp",
  ".bz2",
  ".class",
  ".dmg",
  ".eot",
  ".exe",
  ".flac",
  ".gif",
  ".gz",
  ".heic",
  ".icns",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".m4v",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".otf",
  ".pdf",
  ".png",
  ".rar",
  ".so",
  ".tar",
  ".tgz",
  ".tif",
  ".tiff",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

export function isCodeMetricPath(file: string): boolean {
  const normalized = normalizeRelPath(file);
  const basename = path.basename(normalized);
  if (nonCodeMetricBasenames.has(basename)) return false;
  const ext = path.extname(basename).toLowerCase();
  if (nonCodeMetricExtensions.has(ext)) return false;
  return true;
}

export function diffCheck(ticket: string): JsonObject {
  const stats = diffStats(ticket);
  const hasChangedEvidence = Boolean(stats.board_only)
    ? numberValue(stats.board_changed_file_count) > 0
    : numberValue(stats.changed_file_count) > 0;
  return {
    passed: hasChangedEvidence && Boolean(stats.in_scope),
    ...stats,
  };
}

function boardPathPrefix(): string {
  return path.basename(BOARD_ROOT) || ".autoflow";
}

function isBoardSidecarPath(raw: string): boolean {
  const rel = normalizeRelPath(raw);
  const prefix = boardPathPrefix();
  return rel === prefix || rel.startsWith(`${prefix}/`) || rel === ".autoflow" || rel.startsWith(".autoflow/");
}

function boardPathToAbsolute(raw: string): string {
  const rel = normalizeRelPath(raw);
  const prefixes = unique([boardPathPrefix(), ".autoflow"]);
  for (const prefix of prefixes) {
    if (rel === prefix) return BOARD_ROOT;
    if (rel.startsWith(`${prefix}/`)) return path.join(BOARD_ROOT, rel.slice(prefix.length + 1));
  }
  return "";
}

function ticketStartedAtMs(ticket: string): number {
  const explicit = Date.parse(utils.extractScalarFieldInSection(ticket, "Goal Runtime", "Started At"));
  if (Number.isFinite(explicit)) return explicit;
  const claimedBy = utils.extractScalarFieldInSection(ticket, "Ticket", "Claimed By");
  const match = claimedBy.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
  const claimed = match ? Date.parse(match[1]) : Number.NaN;
  return Number.isFinite(claimed) ? claimed : 0;
}

function collectBoardFiles(root: string, maxFiles = 200): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (out.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  try {
    if (fs.statSync(root).isFile()) return [root];
  } catch {
    return [];
  }
  walk(root);
  return out;
}

function boardRelPath(file: string): string {
  return normalizeRelPath(path.join(boardPathPrefix(), path.relative(BOARD_ROOT, file)));
}

function boardEvidenceFiles(ticket: string, allowed: string[]): string[] {
  const startedAt = ticketStartedAtMs(ticket);
  const ticketPath = path.resolve(ticket);
  const evidence = new Set<string>();
  for (const allowedPath of allowed) {
    const abs = boardPathToAbsolute(allowedPath);
    if (!abs) continue;
    for (const file of collectBoardFiles(abs)) {
      const resolved = path.resolve(file);
      if (resolved === ticketPath) continue;
      let mtime = 0;
      try { mtime = fs.statSync(file).mtimeMs; } catch { continue; }
      if (startedAt > 0 && mtime + 1000 < startedAt) continue;
      evidence.add(boardRelPath(file));
    }
  }
  return unique([...evidence]);
}

export function diffStats(ticket: string): JsonObject {
  const status = readWorktreeStatus(ticket);
  const recordedBase = stringValue(status.base_commit);
  const recordedWorktreeCommit = stringValue(status.worktree_commit);
  const hasRecordedWorktreeCommit = Boolean(recordedBase && recordedWorktreeCommit) &&
    git(["rev-parse", "--verify", `${recordedWorktreeCommit}^{commit}`], PROJECT_ROOT).status === 0;
  const useRecordedWorktreeCommit = !stringValue(status.working_root) && hasRecordedWorktreeCommit;
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
  const base = recordedBase || git(["rev-parse", "--verify", "HEAD"], workingRoot).stdout.trim();
  const committedRange = useRecordedWorktreeCommit ? `${base}..${recordedWorktreeCommit}` : `${base}..HEAD`;
  const changedFiles = unique([
    ...gitLines(["diff", "--name-only", committedRange], workingRoot),
    ...(useRecordedWorktreeCommit ? [] : gitLines(["diff", "--name-only"], workingRoot)),
    ...(useRecordedWorktreeCommit ? [] : gitLines(["diff", "--cached", "--name-only"], workingRoot)),
    ...(useRecordedWorktreeCommit ? [] : statusPorcelainPaths(workingRoot)),
  ]);
  const allowed = utils.ticketConcreteAllowedPaths(ticket);
  const boardOnly = allowed.length > 0 && allowed.every(isBoardSidecarPath);
  const boardChangedFiles = boardOnly ? boardEvidenceFiles(ticket, allowed) : [];
  const allChangedFiles = unique([...changedFiles, ...boardChangedFiles]);
  const outOfScope = changedFiles.filter((file) => !allowed.some((allowedPath) => pathsOverlap(file, allowedPath)));
  const statsByFile = numstatByFile([
    git(["diff", "--numstat", committedRange], workingRoot).stdout,
    useRecordedWorktreeCommit ? "" : git(["diff", "--numstat"], workingRoot).stdout,
    useRecordedWorktreeCommit ? "" : git(["diff", "--cached", "--numstat"], workingRoot).stdout,
  ].join("\n"));
  const productFiles = changedFiles
    .filter((file) => !isBoardSidecarPath(file))
    .filter((file) => allowed.length === 0 || allowed.some((allowedPath) => pathsOverlap(file, allowedPath)));
  const codeFiles = productFiles.filter(isCodeMetricPath);
  let insertions = 0;
  let deletions = 0;
  for (const file of codeFiles) {
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
  const boardLineCount = boardChangedFiles.reduce((total, file) => {
    const abs = boardPathToAbsolute(file);
    return total + (abs ? safeLineCount(abs) : 0);
  }, 0);
  const lineCount = insertions + deletions + (boardOnly ? boardLineCount : 0);
  return {
    working_root: workingRoot,
    base_commit: base,
    worktree_commit: useRecordedWorktreeCommit ? recordedWorktreeCommit : "",
    diff_source: useRecordedWorktreeCommit ? "recorded_worktree_commit" : "working_root",
    changed_file_count: allChangedFiles.length,
    changed_files: allChangedFiles,
    changed_line_count: lineCount,
    code_files_changed_count: codeFiles.length,
    code_changed_files: codeFiles,
    code_insertions_count: insertions,
    code_deletions_count: deletions,
    code_volume_count: insertions + deletions,
    code_net_delta_count: insertions - deletions,
    product_changed_files: productFiles,
    board_only: boardOnly,
    board_changed_file_count: boardChangedFiles.length,
    board_changed_files: boardChangedFiles,
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
    const previous = out.get(file) || { additions: 0, deletions: 0 };
    out.set(file, {
      additions: previous.additions + (Number.isFinite(additions) ? additions : 0),
      deletions: previous.deletions + (Number.isFinite(deletions) ? deletions : 0),
    });
  }
  return out;
}
