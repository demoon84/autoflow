import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { listWorkerTicketItems, ticketItemOwnedByRunner } from "./tickets";
import { replaceSectionBlock } from "./sections";

export function pathConflictGuardEnabled(): boolean {
  return !["off", "0", "false", "no"].includes(String(process.env.AUTOFLOW_PATH_CONFLICT_CHECK || "on").toLowerCase());
}

export function collectTicketConflicts(candidateFile: string, inprogress: WorkerTicketItem[], runnerId: string): ConflictInfo[] {
  if (!candidateFile) return [];
  const candidatePaths = utils.ticketConcreteAllowedPaths(candidateFile);
  const conflicts: ConflictInfo[] = [];
  for (const other of inprogress) {
    if (ticketItemOwnedByRunner(other, runnerId)) continue;
    for (const a of candidatePaths) {
      for (const b of other.allowed_paths) {
        if (!pathsOverlap(a, b)) continue;
        conflicts.push({
          path: `${a} <-> ${b}`,
          ticket: other.path,
          runner: other.claimed_by || other.execution_ai || "",
        });
      }
    }
  }
  return conflicts;
}

export function pathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = normalizeRelPath(aRaw);
  const b = normalizeRelPath(bRaw);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function normalizeRelPath(raw: string): string {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

export function isReadyWorktree(result: JsonObject): boolean {
  return String(result.worktree_status || "") === "ready" &&
    Boolean(result.worktree_path) &&
    Boolean(result.working_root);
}

export function acquireDispatchLock(): { acquired: boolean; path: string; pid: number } {
  const lockDir = path.join(BOARD_ROOT, "runners", "state", "dispatch.lock");
  const pidFile = path.join(lockDir, "pid");
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const pid = positiveInt(process.env.AUTOFLOW_WORKER_PID || process.env.AUTOFLOW_RUNNER_PID || "", process.pid);
  const tryCreate = (): boolean => {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(pidFile, `${pid}\n`, "utf8");
      return true;
    } catch {
      return false;
    }
  };
  if (tryCreate()) return { acquired: true, path: lockDir, pid };

  let heldPid = 0;
  try { heldPid = Number.parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10); } catch {}
  if (utils.pidAlive(heldPid)) return { acquired: false, path: lockDir, pid };

  let ageMs = 0;
  try { ageMs = Date.now() - fs.statSync(lockDir).mtimeMs; } catch {}
  if (ageMs < 30000) return { acquired: false, path: lockDir, pid };

  try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch {}
  return { acquired: tryCreate(), path: lockDir, pid };
}

export function releaseDispatchLock(lock: { acquired: boolean; path: string; pid: number }): void {
  if (!lock.acquired) return;
  const pidFile = path.join(lock.path, "pid");
  let heldPid = 0;
  try { heldPid = Number.parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10); } catch {}
  if (heldPid === lock.pid) {
    try { fs.rmSync(lock.path, { recursive: true, force: true }); } catch {}
  }
}

export function readWorktreeStatus(ticket: string): JsonObject {
  const worktreePath = utils.ticketWorktreePathFromFile(ticket);
  const branch = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Branch"));
  const baseCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Base Commit"));
  const worktreeCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Worktree Commit"));
  const integrationStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status");
  const gitOk = worktreePath ? git(["rev-parse", "--is-inside-work-tree"], worktreePath).stdout.trim() === "true" : false;
  const head = gitOk ? git(["rev-parse", "--verify", "HEAD"], worktreePath).stdout.trim() : "";
  const actualBranch = gitOk ? git(["symbolic-ref", "--short", "HEAD"], worktreePath).stdout.trim() : "";
  const dirty = gitOk ? git(["status", "--porcelain", "--untracked-files=all"], worktreePath).stdout.trim() : "";
  const workingRoot = gitOk ? worktreePath : "";
  return {
    worktree_path: worktreePath,
    worktree_status: integrationStatus,
    branch,
    actual_branch: actualBranch,
    base_commit: baseCommit,
    worktree_commit: worktreeCommit,
    head,
    is_git_worktree: gitOk,
    dirty: Boolean(dirty),
    dirty_summary: oneLine(dirty, 1000),
    working_root: workingRoot,
  };
}

export function ensureWorkerTicketWorktree(ticket: string): JsonObject {
  if (worktreeModeDisabled()) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: disabled");
    return { worktree_status: "disabled", working_root: "" };
  }

  const gitRoot = utils.gitRootPath(PROJECT_ROOT);
  if (!gitRoot) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: not_git_repo");
    return { worktree_status: "not_git_repo", working_root: "" };
  }

  git(["worktree", "prune"], gitRoot);
  const baseCommit = git(["rev-parse", "--verify", "HEAD"], gitRoot).stdout.trim();
  if (!baseCommit) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: no_head_commit");
    return { worktree_status: "no_head_commit", working_root: "" };
  }

  const ticketId = idFromPath(ticket);
  const branch = `autoflow/tickets_${ticketId}`;
  const existingPath = utils.ticketWorktreePathFromFile(ticket);
  let worktreePath = existingPath && isGitWorktree(existingPath)
    ? existingPath
    : defaultTicketWorktreePath(ticketId, gitRoot);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

  if (!isGitWorktree(worktreePath)) {
    if (fs.existsSync(worktreePath) && fs.readdirSync(worktreePath).length > 0) {
      fail(1, `worktree path exists but is not a git worktree: ${worktreePath}`);
    }
    const addArgs = gitBranchExists(gitRoot, branch)
      ? ["worktree", "add", worktreePath, branch]
      : ["worktree", "add", "-b", branch, worktreePath, baseCommit];
    const add = git(addArgs, gitRoot);
    if (add.status !== 0) {
      fail(1, "git worktree add failed", { stdout: add.stdout, stderr: add.stderr, worktree_path: worktreePath });
    }
  }

  const actualBranch = git(["symbolic-ref", "--short", "HEAD"], worktreePath).stdout.trim() || branch;
  const existingBase = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Base Commit"));
  const existingCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Worktree Commit"));
  let integrationStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status") || "pending";
  if ([
    "pending",
    "pending_claim",
    "worktree_missing",
    "blocked_recovery_missing_worktree",
    "blocked_worktree_setup_failed",
    "not_git_repo",
    "no_head_commit",
    "disabled",
    "project_root_fallback",
  ].includes(integrationStatus)) {
    integrationStatus = "ready";
  }
  replaceSectionBlock(
    ticket,
    "Worktree",
    `- Path: \`${worktreePath}\`
- Branch: ${actualBranch}
- Base Commit: ${existingBase || baseCommit}
- Worktree Commit: ${existingCommit}
- Integration Status: ${integrationStatus}`
  );

  const hydration = hydrateWorktreeDependencies(ticket, worktreePath);
  return {
    worktree_status: "ready",
    worktree_path: worktreePath,
    worktree_branch: actualBranch,
    worktree_base: existingBase || baseCommit,
    working_root: worktreePath,
    dependency_status: hydration.status,
    dependency_links: hydration.links,
  };
}

export function worktreeModeDisabled(): boolean {
  return ["0", "off", "false", "disabled"].includes(String(process.env.AUTOFLOW_WORKTREE_MODE || "auto").toLowerCase());
}

export function defaultTicketWorktreePath(ticketId: string, gitRoot: string): string {
  const configured = process.env.AUTOFLOW_WORKTREE_ROOT;
  if (configured) return path.join(path.resolve(configured), `tickets_${ticketId}`);
  const repoName = path.basename(gitRoot);
  const home = process.env.HOME || "";
  let cacheRoot = "";
  if (process.env.XDG_CACHE_HOME) cacheRoot = path.join(process.env.XDG_CACHE_HOME, "autoflow", "worktrees");
  else if (home && process.platform === "darwin") cacheRoot = path.join(home, "Library", "Caches", "autoflow", "worktrees");
  else if (home) cacheRoot = path.join(home, ".cache", "autoflow", "worktrees");
  else cacheRoot = path.join(path.dirname(gitRoot), ".autoflow-worktrees");
  return path.join(cacheRoot, repoName, `tickets_${ticketId}`);
}

export function isGitWorktree(dir: string): boolean {
  return Boolean(dir) && git(["rev-parse", "--is-inside-work-tree"], dir).stdout.trim() === "true";
}

export function gitBranchExists(cwd: string, branch: string): boolean {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd).status === 0;
}

export function hydrateWorktreeDependencies(ticket: string, worktreePath: string): { status: string; links: string[] } {
  if (!fs.existsSync(worktreePath) || path.resolve(worktreePath) === path.resolve(PROJECT_ROOT)) {
    return { status: "unchanged", links: [] };
  }
  const links: string[] = [];
  for (const depDir of findDependencyDirs(PROJECT_ROOT, 4)) {
    const rel = path.relative(PROJECT_ROOT, depDir);
    if (!rel || rel.startsWith("..")) continue;
    const target = path.join(worktreePath, rel);
    if (fs.existsSync(target)) continue;
    if (!fs.existsSync(path.dirname(target))) continue;
    try {
      excludeWorktreePath(worktreePath, rel);
      fs.symlinkSync(depDir, target, "dir");
      links.push(rel);
    } catch {}
  }
  if (links.length > 0) {
    utils.appendNote(ticket, `Runtime hydrated worktree dependencies at ${utils.nowIso()}: ${links.join(", ")}`);
  }
  return { status: links.length > 0 ? "linked" : "unchanged", links };
}

export function findDependencyDirs(root: string, maxDepth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === "node_modules") {
        out.push(full);
        continue;
      }
      if (entry.name === ".git" || entry.name === ".autoflow") continue;
      walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return out.sort();
}

export function excludeWorktreePath(worktreePath: string, relPath: string): void {
  const exclude = git(["rev-parse", "--git-path", "info/exclude"], worktreePath).stdout.trim();
  if (!exclude) return;
  try {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    const existing = utils.readFileSafe(exclude);
    if (!existing.split(/\r?\n/).includes(relPath)) fs.appendFileSync(exclude, `${relPath}\n`, "utf8");
  } catch {}
}
