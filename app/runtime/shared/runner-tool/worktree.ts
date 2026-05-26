import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, parseTicketId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { listWorkerTicketItems, ticketItemOwnedByRunner } from "./tickets";
import { replaceSectionBlock } from "./sections";

export function pathConflictGuardEnabled(): boolean {
  return pathConflictMode() !== "off";
}

export function pathConflictMode(): "files" | "strict" | "off" {
  const explicitMode = String(process.env.AUTOFLOW_PATH_CONFLICT_MODE || "").trim().toLowerCase();
  const raw = explicitMode || String(process.env.AUTOFLOW_PATH_CONFLICT_CHECK || "").trim().toLowerCase();
  if (["off", "0", "false", "no", "disabled", "none"].includes(raw)) return "off";
  if (["strict", "legacy", "directory", "directories", "dir"].includes(raw)) return "strict";
  return "files";
}

export function collectTicketConflicts(candidateFile: string, inprogress: WorkerTicketItem[], runnerId: string): ConflictInfo[] {
  if (!candidateFile) return [];
  const candidatePaths = utils.ticketConcreteAllowedPaths(candidateFile);
  const conflicts: ConflictInfo[] = [];
  for (const other of inprogress) {
    if (ticketItemOwnedByRunner(other, runnerId)) continue;
    for (const a of candidatePaths) {
      for (const b of other.allowed_paths) {
        if (!allowedPathsConflict(a, b)) continue;
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

function boardPathPrefix(): string {
  return path.basename(BOARD_ROOT) || ".autoflow";
}

function isBoardSidecarPath(raw: string): boolean {
  const rel = normalizeRelPath(raw);
  const prefix = boardPathPrefix();
  return rel === prefix || rel.startsWith(`${prefix}/`) || rel === ".autoflow" || rel.startsWith(".autoflow/");
}

function pathLooksDirectoryScope(raw: string): boolean {
  const text = String(raw || "").replace(/`/g, "").trim();
  const rel = normalizeRelPath(text);
  if (!rel) return false;
  if (/[\/\\]$/.test(text)) return true;
  try {
    return fs.statSync(path.join(PROJECT_ROOT, rel)).isDirectory();
  } catch {
    return false;
  }
}

function conflictComparablePath(raw: string): string {
  const rel = normalizeRelPath(raw);
  if (!rel || isBoardSidecarPath(rel)) return "";
  if (pathConflictMode() === "files" && pathLooksDirectoryScope(raw)) return "";
  return rel;
}

export function allowedPathsConflict(aRaw: string, bRaw: string): boolean {
  const mode = pathConflictMode();
  if (mode === "off") return false;
  if (mode === "strict") return pathsOverlap(aRaw, bRaw);
  const a = conflictComparablePath(aRaw);
  const b = conflictComparablePath(bRaw);
  return Boolean(a && b && a === b);
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

export function worktreeStatusIsSetupBlocker(status: string): boolean {
  return [
    "pending",
    "pending_claim",
    "worktree_missing",
    "blocked_recovery_missing_worktree",
    "blocked_worktree_setup_failed",
    "blocked_prd_branch_missing",
    "blocked_prd_worktree_unavailable",
    "blocked_no_prd_branch",
    "not_git_repo",
    "no_head_commit",
    "disabled",
    "project_root_fallback",
  ].includes(String(status || "").toLowerCase());
}

export function acquireDispatchLock(options: { waitMs?: number; pollMs?: number } = {}): { acquired: boolean; path: string; pid: number } {
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

  const tryReclaimStale = (): boolean => {
    let heldPid = 0;
    try { heldPid = Number.parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10); } catch {}
    if (utils.pidAlive(heldPid)) return false;
    let ageMs = 0;
    try { ageMs = Date.now() - fs.statSync(lockDir).mtimeMs; } catch {}
    if (ageMs < 30000) return false;
    try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch {}
    return tryCreate();
  };

  const waitMs = Math.max(0, numberValue(options.waitMs));
  const pollMs = Math.max(20, numberValue(options.pollMs) || 50);
  const deadline = Date.now() + waitMs;
  const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    if (tryCreate()) return { acquired: true, path: lockDir, pid };
    if (tryReclaimStale()) return { acquired: true, path: lockDir, pid };
    if (Date.now() >= deadline) return { acquired: false, path: lockDir, pid };
    const sleepMs = Math.min(pollMs, Math.max(1, deadline - Date.now()));
    Atomics.wait(sleepBuffer, 0, 0, sleepMs);
  }
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
  const mainHead = git(["rev-parse", "--verify", "HEAD"], gitRoot).stdout.trim();
  if (!mainHead) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: no_head_commit");
    return { worktree_status: "no_head_commit", working_root: "" };
  }
  const ticketId = idFromPath(ticket);
  const prdKey = stripTicks(utils.extractScalarFieldInSection(ticket, "Ticket", "PRD Key"));
  const prdTrack = resolvePrdTrackBase(ticket, gitRoot, mainHead);
  if (prdKey && prdTrack.source !== "prd_branch") {
    const blockedStatus = prdTrack.source === "main_branch_missing"
      ? "blocked_prd_branch_missing"
      : "blocked_prd_worktree_unavailable";
    replaceSectionBlock(
      ticket,
      "Worktree",
      `- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: ${blockedStatus}`
    );
    return {
      worktree_status: blockedStatus,
      reason: prdTrack.source,
      prd_key: prdKey,
      working_root: "",
    };
  }

  // TODO 는 반드시 PRD worktree 안에서 처리된다. 별도 TODO branch/worktree 는 만들지 않는다.
  // Planner 가 PRD 발행 시점에 PRD worktree 를 만들어둔다는 계약을 따른다.
  const prdTrackActive = prdTrack.source === "prd_branch" && Boolean(prdTrack.branch);
  if (!prdTrackActive) {
    replaceSectionBlock(
      ticket,
      "Worktree",
      `- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: blocked_no_prd_branch`
    );
    fail(1, "TODO worktree requires an existing PRD branch", {
      ticket: boardRel(ticket),
      prd_key: prdKey || "",
      detail: "Planner 가 PRD worktree 를 먼저 만들어야 worker 가 작업할 수 있다.",
    });
  }
  const branch = prdTrack.branch;
  const baseCommit = prdTrack.base;
  const prdWorktreePath = checkedOutWorktreePathForBranch(gitRoot, branch) || ticketWorktreePath("prd", prdIdFromKey(prdKey), gitRoot);
  const worktreePath = prdWorktreePath;
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
  if (actualBranch !== branch) {
    fail(1, "worktree branch does not match ticket policy", {
      ticket: boardRel(ticket),
      expected_branch: branch,
      actual_branch: actualBranch,
      worktree_path: worktreePath,
    });
  }
  const existingBase = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Base Commit"));
  const existingCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Worktree Commit"));
  let integrationStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status") || "pending";
  if (worktreeStatusIsSetupBlocker(integrationStatus)) {
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
  return ticketWorktreePath("todo", ticketId, gitRoot);
}

function worktreeCacheRoot(gitRoot: string): string {
  const configured = process.env.AUTOFLOW_WORKTREE_ROOT;
  if (configured) return path.resolve(configured);
  const home = process.env.HOME || "";
  if (process.env.XDG_CACHE_HOME) return path.join(process.env.XDG_CACHE_HOME, "autoflow", "worktrees");
  if (home && process.platform === "darwin") return path.join(home, "Library", "Caches", "autoflow", "worktrees");
  if (home) return path.join(home, ".cache", "autoflow", "worktrees");
  return path.join(path.dirname(gitRoot), ".autoflow-worktrees");
}

export function ticketWorktreePath(kind: "prd" | "todo", id: string, gitRoot: string): string {
  const cacheRoot = worktreeCacheRoot(gitRoot);
  const configured = process.env.AUTOFLOW_WORKTREE_ROOT;
  const folder = kind === "prd" ? `prd-${id}` : `TODO-${id}`;
  if (configured) return path.join(cacheRoot, folder);
  const repoName = path.basename(gitRoot);
  return path.join(cacheRoot, repoName, folder);
}

export type TicketWorktreeResult = {
  status: "created" | "updated" | "unchanged" | "skipped";
  reason?: string;
  branch: string;
  baseCommit: string;
  worktreePath: string;
  ticketRelPath: string;
  ticketAbsPath: string;
  commit?: string;
};

/**
 * Provision (or reuse) a branch + worktree for a ticket. Ticket markdown stays
 * in the local board; PRD-backed work items reuse the parent PRD worktree so
 * product changes can finish as a single squash merge.
 */
export function ensureTicketWorktree(opts: {
  id: string;
  kind: "prd" | "todo";
  content: string;
  prdKey?: string;          // work item only — points at the parent PRD worktree
  commitMessage?: string;   // override default `[KIND-id] init/update`
}): TicketWorktreeResult {
  const gitRoot = utils.gitRootPath(PROJECT_ROOT);
  if (!gitRoot) {
    return {
      status: "skipped",
      reason: "not_git_repo",
      branch: "",
      baseCommit: "",
      worktreePath: "",
      ticketRelPath: "",
      ticketAbsPath: "",
    };
  }

  const prdTodoId = opts.kind === "todo" && opts.prdKey ? prdIdFromKey(opts.prdKey) : "";
  const branch = opts.kind === "prd"
    ? `autoflow/prd-${opts.id}`
    : prdTodoId ? `autoflow/prd-${prdTodoId}` : `autoflow/TODO-${opts.id}`;
  const worktreePath = opts.kind === "todo" && prdTodoId
    ? ticketWorktreePath("prd", prdTodoId, gitRoot)
    : ticketWorktreePath(opts.kind, opts.id, gitRoot);

  // Resolve base: PRD-backed work items always use the PRD branch HEAD.
  let baseCommit = git(["rev-parse", "--verify", "HEAD"], gitRoot).stdout.trim();
  if (opts.kind === "todo" && prdTodoId) {
    if (!gitBranchExists(gitRoot, branch)) {
      return {
        status: "skipped",
        reason: "prd_branch_missing",
        branch,
        baseCommit: "",
        worktreePath: "",
        ticketRelPath: "",
        ticketAbsPath: "",
      };
    }
    const sha = git(["rev-parse", "--verify", branch], gitRoot).stdout.trim();
    if (sha) baseCommit = sha;
  }
  if (!baseCommit) {
    return {
      status: "skipped",
      reason: "no_base_commit",
      branch,
      baseCommit: "",
      worktreePath: "",
      ticketRelPath: "",
      ticketAbsPath: "",
    };
  }

  let createdBranch = false;
  let createdWorktree = false;

  // Create branch if missing. PRD-backed work items reuse the PRD branch.
  if (opts.kind === "prd" && !gitBranchExists(gitRoot, branch)) {
    const create = git(["branch", branch, baseCommit], gitRoot);
    if (create.status !== 0) {
      fail(1, "failed to create ticket branch", {
        branch,
        base_commit: baseCommit,
        stderr: create.stderr,
      });
    }
    createdBranch = true;
  }
  if (opts.kind === "todo" && !prdTodoId && !gitBranchExists(gitRoot, branch)) {
    const create = git(["branch", branch, baseCommit], gitRoot);
    if (create.status !== 0) {
      fail(1, "failed to create ticket branch", {
        branch,
        base_commit: baseCommit,
        stderr: create.stderr,
      });
    }
    createdBranch = true;
  }

  // Ensure worktree.
  git(["worktree", "prune"], gitRoot);
  if (!isGitWorktree(worktreePath)) {
    if (fs.existsSync(worktreePath) && fs.readdirSync(worktreePath).length > 0) {
      fail(1, `worktree path exists but is not a git worktree: ${worktreePath}`);
    }
    fs.mkdirSync(path.dirname(worktreePath), {recursive: true});
    const add = git(["worktree", "add", worktreePath, branch], gitRoot);
    if (add.status !== 0) {
      fail(1, "git worktree add failed", {
        worktree_path: worktreePath,
        stderr: add.stderr,
        stdout: add.stdout,
      });
    }
    createdWorktree = true;
  }

  const headSha = git(["rev-parse", "--verify", "HEAD"], worktreePath).stdout.trim();
  return {
    status: createdBranch || createdWorktree ? "created" : "unchanged",
    branch,
    baseCommit,
    worktreePath,
    ticketRelPath: "",
    ticketAbsPath: "",
    commit: headSha,
  };
}

export function isGitWorktree(dir: string): boolean {
  return Boolean(dir) && git(["rev-parse", "--is-inside-work-tree"], dir).stdout.trim() === "true";
}

export function gitBranchExists(cwd: string, branch: string): boolean {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd).status === 0;
}

function unsetWorktreeValue(raw: string): boolean {
  const value = stripTicks(raw).trim();
  return !value || /^(TBD|TODO:?|N\/A|NA|NONE|null|undefined)$/i.test(value);
}

function defaultPrdBranchName(prdId: string): string {
  return `autoflow/prd-${prdId}`;
}

function autoCreatablePrdBranch(branch: string, prdId: string): boolean {
  const normalized = String(branch || "").trim();
  return normalized === defaultPrdBranchName(prdId) ||
    new RegExp(`^autoflow/prd-${escapeRe(prdId)}$`, "i").test(normalized);
}

function commitShaOrFallback(gitRoot: string, commitish: string, fallbackHead: string): string {
  const raw = stripTicks(commitish);
  if (!unsetWorktreeValue(raw)) {
    const sha = git(["rev-parse", "--verify", `${raw}^{commit}`], gitRoot).stdout.trim();
    if (sha) return sha;
  }
  return fallbackHead;
}

function checkedOutWorktreePathForBranch(gitRoot: string, branch: string): string {
  let current = "";
  for (const line of git(["worktree", "list", "--porcelain"], gitRoot).stdout.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      current = line.slice("worktree ".length).trim();
      continue;
    }
    if (line === `branch refs/heads/${branch}`) return current;
  }
  return "";
}

export function resolvePrdTrackBase(
  ticket: string,
  gitRoot: string,
  fallbackHead: string
): { base: string; branch: string; source: "prd_branch" | "main" | "main_branch_missing" } {
  const prdKey = stripTicks(utils.extractScalarFieldInSection(ticket, "Ticket", "PRD Key"));
  if (!prdKey) return { base: fallbackHead, branch: "", source: "main" };
  const prdId = prdIdFromKey(prdKey);
  if (!prdId) return { base: fallbackHead, branch: "", source: "main" };
  const prdFile = locatePrdFile(prdId);
  if (!prdFile) return { base: fallbackHead, branch: "", source: "main" };
  const rawBranch = stripTicks(utils.extractScalarFieldInSection(prdFile, "Project", "Branch"));
  const branchWasUnset = unsetWorktreeValue(rawBranch);
  const branch = branchWasUnset ? defaultPrdBranchName(prdId) : rawBranch;
  if (!gitBranchExists(gitRoot, branch)) {
    if (!branchWasUnset && !autoCreatablePrdBranch(branch, prdId)) {
      return { base: fallbackHead, branch, source: "main_branch_missing" };
    }
    const base = commitShaOrFallback(gitRoot, utils.extractScalarFieldInSection(prdFile, "Project", "Base Commit"), fallbackHead);
    const created = git(["branch", branch, base], gitRoot);
    if (created.status !== 0) {
      return { base: fallbackHead, branch, source: "main_branch_missing" };
    }
    utils.replaceScalarFieldInSection(prdFile, "Project", "Branch", branch);
    utils.replaceScalarFieldInSection(prdFile, "Project", "Base Commit", base);
  } else if (branchWasUnset) {
    utils.replaceScalarFieldInSection(prdFile, "Project", "Branch", branch);
    const base = commitShaOrFallback(gitRoot, utils.extractScalarFieldInSection(prdFile, "Project", "Base Commit"), fallbackHead);
    utils.replaceScalarFieldInSection(prdFile, "Project", "Base Commit", base);
  }
  const sha = git(["rev-parse", "--verify", branch], gitRoot).stdout.trim();
  if (!sha) return { base: fallbackHead, branch: "", source: "main" };
  return { base: sha, branch, source: "prd_branch" };
}

function prdIdFromKey(raw: string): string {
  return parseTicketId(raw).id;
}

function locatePrdFile(prdId: string): string {
  const active = path.join(TICKETS_ROOT, "prd", `PRD-${prdId}.md`);
  if (fs.existsSync(active)) return active;
  const archived = path.join(TICKETS_ROOT, "done", `PRD-${prdId}`, `PRD-${prdId}.md`);
  if (fs.existsSync(archived)) return archived;
  return "";
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
