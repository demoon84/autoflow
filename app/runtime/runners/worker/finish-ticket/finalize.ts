import {fs, path, boardRoot, projectRoot, spawnSync, timestamp, workerId} from "./context";
import {normalizeId, oneLine, safeSegment, unique} from "./io";
import {allowedPaths, appendNote, doneWhenItems, normalizedChangeType, replaceScalar, replaceSection, scalar, updateGoalRuntime} from "./ticket-sections";
import {changedFiles, diffLineCount, git, gitLines, gitOut, gitRootPath, headContainsCommit, isGitWorktree, pathsOverlap, rootContainsWorktreeChange, statusPaths} from "./git";
import {positiveInt, read} from "./io";

type SanityFailure = { failure: string; detail: string; recoveryClass: string };
type MergeTarget = {
  root: string;
  branch: string;
  prdKey: string;
  kind: "prd_branch" | "project_root";
};

function realPathSafe(value: string): string {
  try {
    return fs.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

function gitRelativePath(gitRoot: string, target: string): string {
  return path.relative(realPathSafe(gitRoot), realPathSafe(target));
}

function normalizeRelPath(raw: string): string {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

function boardPathPrefix(): string {
  return path.basename(boardRoot) || ".autoflow";
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
    if (rel === prefix) return boardRoot;
    if (rel.startsWith(`${prefix}/`)) return path.join(boardRoot, rel.slice(prefix.length + 1));
  }
  return "";
}

function ticketStartedAtMs(ticketFile: string): number {
  const explicit = Date.parse(scalar(ticketFile, "Goal Runtime", "Started At"));
  if (Number.isFinite(explicit)) return explicit;
  const claimedBy = scalar(ticketFile, "Ticket", "Claimed By");
  const match = claimedBy.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
  const claimed = match ? Date.parse(match[1]) : Number.NaN;
  return Number.isFinite(claimed) ? claimed : 0;
}

function collectFiles(root: string, maxFiles = 200): string[] {
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

function boardEvidenceFiles(ticketFile: string, allowed: string[]): string[] {
  const startedAt = ticketStartedAtMs(ticketFile);
  const ticketPath = path.resolve(ticketFile);
  const evidence = new Set<string>();
  for (const allowedPath of allowed) {
    const abs = boardPathToAbsolute(allowedPath);
    if (!abs) continue;
    for (const file of collectFiles(abs)) {
      const resolved = path.resolve(file);
      if (resolved === ticketPath) continue;
      let mtime = 0;
      try { mtime = fs.statSync(file).mtimeMs; } catch { continue; }
      if (startedAt > 0 && mtime + 1000 < startedAt) continue;
      evidence.add(file);
    }
  }
  return [...evidence].sort();
}

function isBoardOnlyTicket(allowed: string[]): boolean {
  return allowed.length > 0 && allowed.every(isBoardSidecarPath);
}

function ticketIdFromFile(ticketFile: string): string {
  const match = path.basename(ticketFile).match(/TODO-(\d+)/i);
  return match?.[1] || "";
}

function todoCommitSubject(ticketId: string, suffix: string): string {
  const normalized = normalizeId(ticketId) || ticketId;
  const safeSuffix = String(suffix || "").replace(/\s+/g, " ").trim() || "완료";
  return `TODO-${normalized} ${safeSuffix}`;
}

function prdCommitSubject(prdKey: string): string {
  return `${normalizePrdKey(prdKey) || prdKey} 완료`;
}

function ticketCompletionCommitExists(cwd: string, ticketFile: string): boolean {
  const ticketId = ticketIdFromFile(ticketFile);
  if (!ticketId) return false;
  const patterns = unique([`TODO-${ticketId}`, `ticket_${ticketId}`]);
  return patterns.some((pattern) => {
    const hash = gitOut(cwd, [
      "log",
      "--fixed-strings",
      "--grep",
      pattern,
      "--format=%H",
      "-1",
      "HEAD",
    ]);
    return Boolean(hash);
  });
}

function prdBranchForTicket(ticketFile: string): { prdKey: string; branch: string } {
  const prdKey = normalizePrdKey(scalar(ticketFile, "Ticket", "PRD Key"));
  if (!/^PRD-\d+$/i.test(prdKey)) return { prdKey: "", branch: "" };
  const candidates = [
    path.join(boardRoot, "tickets", "prd", `${prdKey}.md`),
    path.join(boardRoot, "tickets", "done", prdKey, `${prdKey}.md`),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const branch = scalar(candidate, "Project", "Branch").replace(/^`+|`+$/g, "").trim();
    if (branch) return { prdKey, branch };
  }
  return { prdKey, branch: "" };
}

function worktreePathForBranch(gitRoot: string, branch: string): string {
  let current = "";
  for (const line of gitLines(gitRoot, ["worktree", "list", "--porcelain"])) {
    if (line.startsWith("worktree ")) {
      current = line.slice("worktree ".length).trim();
      continue;
    }
    if (line === `branch refs/heads/${branch}`) return current;
  }
  return "";
}

function mergeTargetForTicket(ticketFile: string): MergeTarget {
  const gitRoot = gitRootPath(projectRoot);
  const prd = prdBranchForTicket(ticketFile);
  if (gitRoot && prd.branch) {
    const branchRoot = worktreePathForBranch(gitRoot, prd.branch);
    if (branchRoot && isGitWorktree(branchRoot)) {
      return { root: branchRoot, branch: prd.branch, prdKey: prd.prdKey, kind: "prd_branch" };
    }
  }
  return { root: projectRoot, branch: "", prdKey: prd.prdKey, kind: "project_root" };
}

export function sanityPreflight(ticketFile: string): SanityFailure | null {
  const text = read(ticketFile);
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const changeType = normalizedChangeType(ticketFile);
  const allowed = allowedPaths(ticketFile);
  const boardOnly = isBoardOnlyTicket(allowed);
  let minDiffLines = changeType === "infra" ? positiveInt(process.env.AUTOFLOW_INFRA_MIN_DIFF_LINES || "", 10) : 1;
  if (changeType === "docs" || changeType === "cleanup") minDiffLines = 0;
  if (boardOnly) minDiffLines = 0;

  if (!worktreePath || !isGitWorktree(worktreePath)) {
    return {
      failure: "missing_worktree",
      detail: "ticket pass requires a git worktree; run worker runner-tool worktree-ensure before finishing",
      recoveryClass: "missing_worktree",
    };
  }
  if (!baseCommit) {
    return {
      failure: "missing_worktree_base",
      detail: "ticket pass requires Worktree Base Commit before finishing",
      recoveryClass: "missing_worktree",
    };
  }

  if (minDiffLines > 0) {
    const lineCount = diffLineCount(worktreePath, baseCommit);
    if (lineCount < minDiffLines) {
      return {
        failure: changeType === "infra" ? "zero_diff_infra" : "zero_diff",
        detail: `${changeType} change requires at least ${minDiffLines} changed line(s); saw ${lineCount}`,
        recoveryClass: "verification_failed",
      };
    }
  }

  const checklist = doneWhenItems(text);
  if (checklist.length === 0) return { failure: "done_when_empty", detail: "## Done When section has no checklist items", recoveryClass: "ambiguous_scope" };
  const unchecked = checklist.filter((line) => /^\s*[-*]\s+\[ \]/.test(line)).length;
  if (unchecked > 0) return { failure: "done_when_unchecked", detail: `${unchecked} of ${checklist.length} Done When item(s) still unchecked`, recoveryClass: "verification_failed" };

  if (boardOnly && boardEvidenceFiles(ticketFile, allowed).length === 0) {
    return {
      failure: "board_only_no_evidence",
      detail: `board-only ticket has no changed sidecar evidence under Allowed Paths since worker start: ${allowed.join(", ")}`,
      recoveryClass: "ambiguous_scope",
    };
  }

  if (!boardOnly && !["docs", "cleanup"].includes(changeType)) {
    const names = changedFiles(worktreePath, baseCommit)
      .filter((name) => !name.startsWith(".autoflow/tickets/inprogress/"))
      .filter((name) => !name.startsWith(".autoflow/tickets/done/"));
    const matched = names.some((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    if (!matched) {
      return {
        failure: "allowed_paths_no_diff",
        detail: `no changed product file matches an Allowed Path (change_type=${changeType})`,
        recoveryClass: "ambiguous_scope",
      };
    }
  }

  return null;
}

export function prepareWorktreeForFinalization(ticketFile: string, ticketId: string): { status: "ready" | "needs_ai_merge"; reason: string; worktreePath: string; worktreeCommit: string } {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const allowed = allowedPaths(ticketFile);
  if (!worktreePath || !isGitWorktree(worktreePath) || allowed.length === 0) {
    return { status: "ready", reason: "no_worktree_or_allowed_paths", worktreePath, worktreeCommit: scalar(ticketFile, "Worktree", "Worktree Commit") };
  }

  const changed = baseCommit ? changedFiles(worktreePath, baseCommit) : statusPaths(worktreePath);
  const scopedChanged = changed.filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
  if (scopedChanged.length > 0) {
    git(worktreePath, ["add", "-A", "--", ...allowed]);
    if (git(worktreePath, ["diff", "--cached", "--quiet"]).status !== 0) {
      git(worktreePath, ["commit", "-m", todoCommitSubject(ticketId, "snapshot")]);
    }
  }

  const head = gitOut(worktreePath, ["rev-parse", "--verify", "HEAD"]);
  if (head) replaceScalar(ticketFile, "Worktree", "Worktree Commit", head);

  const target = mergeTargetForTicket(ticketFile);
  if (head && headContainsCommit(target.root, head)) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
    return { status: "ready", reason: `worktree_commit_in_${target.kind}_history`, worktreePath, worktreeCommit: head };
  }
  if (ticketCompletionCommitExists(target.root, ticketFile)) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
    return { status: "ready", reason: `ticket_completion_commit_in_${target.kind}_history`, worktreePath, worktreeCommit: head };
  }

  const needsMerge = scopedChanged.some((name) => !rootContainsWorktreeChange(target.root, worktreePath, baseCommit, name));
  if (needsMerge) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
    return { status: "needs_ai_merge", reason: "runner_merge_required", worktreePath, worktreeCommit: head };
  }

  replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
  return { status: "ready", reason: `merge_target_matches_worktree_${target.kind}`, worktreePath, worktreeCommit: head };
}

function verificationCommand(ticketFile: string): string {
  const rawCommand = scalar(ticketFile, "Verification", "Command").trim();
  if (!rawCommand || /^(TBD|TODO:?|N\/A|NA|NONE|none-shell)$/i.test(rawCommand)) return "";
  const command = rawCommand.replace(
    /^(?:PROJECT_ROOT|PROJECT ROOT|ROOT|WORKTREE|TICKET WORKTREE)\s*:\s*/i,
    ""
  ).trim();
  if (!command || /^(TBD|TODO:?|N\/A|NA|NONE|none-shell)$/i.test(command)) return "";
  if (command !== rawCommand) replaceScalar(ticketFile, "Verification", "Command", command);
  return command;
}

export function finalizationPreflight(ticketFile: string): { status: "ok" | "needs_ai_merge" | "blocked"; reason: string; detail: string; command?: string; exitCode?: number } {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const allowed = allowedPaths(ticketFile);
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const target = mergeTargetForTicket(ticketFile);
  if (worktreePath && isGitWorktree(worktreePath)) {
    const changed = baseCommit ? changedFiles(worktreePath, baseCommit) : statusPaths(worktreePath);
    const scopedChanged = changed.filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    const mismatched = scopedChanged.filter((relPath) => !rootContainsWorktreeChange(target.root, worktreePath, baseCommit, relPath));
    if (mismatched.length > 0 && !ticketCompletionCommitExists(target.root, ticketFile)) {
      return {
        status: "needs_ai_merge",
        reason: "merge_target_not_integrated",
        detail: `${target.branch || "PROJECT_ROOT"} differs from verified worktree for: ${mismatched.join(",")}`,
      };
    }
  }

  const command = verificationCommand(ticketFile);
  if (!command || process.env.AUTOFLOW_FINALIZE_RUN_VERIFICATION === "0") {
    return { status: "ok", reason: command ? "verification_rerun_skipped_by_env" : "verification_command_empty", detail: "" };
  }

  const timeout = positiveInt(process.env.AUTOFLOW_FINALIZE_VERIFY_TIMEOUT_MS || "", 120000);
  const result = spawnSync(command, {
    cwd: target.root,
    encoding: "utf8",
    shell: true,
    timeout,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  replaceScalar(ticketFile, "Verification", "Exit Code", String(exitCode));
  replaceScalar(ticketFile, "Verification", "Last Run", timestamp);
  replaceScalar(ticketFile, "Verification", "Result", exitCode === 0 ? "pass" : "fail");
  appendNote(ticketFile, `${target.branch || "PROJECT_ROOT"} verification rerun at ${timestamp}: exit_code=${exitCode} command=${command}`);
  if (exitCode !== 0 || result.error) {
    const output = result.error
      ? `verification command failed before completion: ${oneLine(String(result.error), 240)}`
      : `verification command exited ${exitCode}; stdout/stderr omitted from ticket note`;
    return {
      status: "blocked",
      reason: "merge_target_verification_failed",
      detail: output,
      command,
      exitCode,
    };
  }
  return { status: "ok", reason: "merge_target_verification_passed", detail: "", command, exitCode };
}

export function archiveDone(ticketFile: string, ticketId: string): string {
  const projectKey = scalar(ticketFile, "Ticket", "PRD Key") || `ticket_${ticketId}`;
  replaceScalar(ticketFile, "Ticket", "Stage", "done");
  replaceScalar(ticketFile, "Ticket", "Claimed By", "");
  replaceScalar(ticketFile, "Ticket", "Execution AI", "");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  updateGoalRuntime(ticketFile, "complete", timestamp);
  replaceSection(ticketFile, "Verification", `- Result: passed by ${workerId} at ${timestamp}
- Evidence: ticket inline verification and result sections`);
  appendNote(ticketFile, `Worker runner ${workerId} finalized ticket at ${timestamp}.`);

  const doneDir = path.join(boardRoot, "tickets", "done", safeSegment(projectKey));
  fs.mkdirSync(doneDir, { recursive: true });
  const doneFile = path.join(doneDir, path.basename(ticketFile));
  if (path.resolve(ticketFile) !== path.resolve(doneFile)) {
    if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
    fs.renameSync(ticketFile, doneFile);
  }
  return doneFile;
}

export function restoreDoneAfterCommitFailure(doneFile: string, ticketId: string, failureStatus: string, detail: string): string {
  const restoredFile = path.join(boardRoot, "tickets", "inprogress", path.basename(doneFile));
  fs.mkdirSync(path.dirname(restoredFile), { recursive: true });
  if (path.resolve(doneFile) !== path.resolve(restoredFile)) {
    if (fs.existsSync(restoredFile)) fs.unlinkSync(restoredFile);
    fs.renameSync(doneFile, restoredFile);
  }

  replaceScalar(restoredFile, "Ticket", "Stage", "blocked");
  replaceScalar(restoredFile, "Ticket", "Claimed By", workerId);
  replaceScalar(restoredFile, "Ticket", "Execution AI", workerId);
  replaceScalar(restoredFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(restoredFile, "Worktree", "Integration Status", `blocked_${failureStatus}`);
  updateGoalRuntime(restoredFile, "blocked", timestamp);
  appendNote(restoredFile, `Completion commit failed at ${timestamp}: ${failureStatus}; ${detail}`);
  replaceSection(restoredFile, "Next Action", `- Next: completion commit failed (${failureStatus}). Inspect PROJECT_ROOT git status, fix the commit blocker, then rerun \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`. The ticket was restored from done to inprogress because finalization is not complete.`);
  return restoredFile;
}

export function commitCompletion(doneFile: string, ticketId: string, summary: string): { status: string; hash: string; detail: string } {
  if (process.env.AUTOFLOW_WORKER_SKIP_COMMIT === "1") return { status: "skipped_by_env", hash: "", detail: "" };
  const gitRoot = gitRootPath(projectRoot);
  if (!gitRoot) return { status: "not_git_repo", hash: "", detail: "" };

  const prdKey = normalizePrdKey(scalar(doneFile, "Ticket", "PRD Key"));
  if (/^PRD-\d+$/i.test(prdKey)) {
    return commitPrdTrackCompletion(gitRoot, doneFile, ticketId, prdKey, summary);
  }

  const boardRelPath = gitRelativePath(gitRoot, boardRoot);
  const worktreeCommit = scalar(doneFile, "Worktree", "Worktree Commit");
  const productChangesAreCommitted = worktreeCommit ? headContainsCommit(gitRoot, worktreeCommit) : false;
  const allowed = allowedPaths(doneFile);
  const boardOnly = isBoardOnlyTicket(allowed);
  const candidates = [
    gitRelativePath(gitRoot, doneFile),
    path.join(boardRelPath, "tickets", "todo", `TODO-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "todo", `TODO-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `TODO-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `TODO-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `TODO-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `TODO-${ticketId}.md`),
    ...(productChangesAreCommitted || boardOnly ? [] : allowed),
  ].filter((value) => value && !value.startsWith(".."));
  const stageFailures: string[] = [];
  for (const candidate of unique(candidates)) {
    const candidatePath = path.join(gitRoot, candidate);
    const candidateTracked = git(gitRoot, ["ls-files", "--error-unmatch", "--", candidate]).status === 0;
    if (!fs.existsSync(candidatePath) && !candidateTracked) {
      continue;
    }
    const result = spawnSync("git", ["add", "-A", "--", candidate], {
      cwd: gitRoot,
      encoding: "utf8",
    });
    if (result.status !== 0 && allowed.some((ap) => pathsOverlap(candidate, ap))) {
      stageFailures.push(oneLine(`${candidate}: ${result.stderr || ""} ${result.stdout || ""}`));
    }
  }
  if (stageFailures.length > 0) {
    return { status: "stage_failed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: stageFailures.join("; ") };
  }

  if (git(gitRoot, ["diff", "--cached", "--quiet"]).status === 0) {
    const dirtyAllowed = statusPaths(gitRoot).filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    if (dirtyAllowed.length > 0) {
      return { status: "dirty_allowed_paths_uncommitted", hash: "", detail: dirtyAllowed.join(",") };
    }
    if (productChangesAreCommitted) {
      return { status: "already_committed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: "" };
    }
    if (worktreeCommit && allowed.length > 0 && !boardOnly) {
      return { status: "no_completion_changes_for_allowed_paths", hash: "", detail: allowed.join(",") };
    }
    return { status: "no_changes", hash: "", detail: "" };
  }
  const commitResult = spawnSync("git", ["commit", "-m", todoCommitSubject(ticketId, "완료")], {
    cwd: gitRoot,
    encoding: "utf8",
  });
  if (commitResult.status !== 0) {
    const detail = oneLine(`${commitResult.stderr || ""} ${commitResult.stdout || ""}`) || `git commit exited ${commitResult.status ?? 1}`;
    return { status: "commit_failed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail };
  }
  const hash = gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]);
  const dirtyAllowedAfterCommit = statusPaths(gitRoot).filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
  if (dirtyAllowedAfterCommit.length > 0) {
    return { status: "dirty_allowed_paths_after_commit", hash, detail: dirtyAllowedAfterCommit.join(",") };
  }
  return { status: "committed", hash, detail: "" };
}

function commitPrdTrackCompletion(gitRoot: string, doneFile: string, ticketId: string, prdKey: string, summary: string): { status: string; hash: string; detail: string } {
  const target = mergeTargetForTicket(doneFile);
  if (target.kind !== "prd_branch" || !target.branch || !isGitWorktree(target.root)) {
    return { status: "prd_branch_missing", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: `${prdKey} PRD branch worktree is not available` };
  }

  const sync = syncDoneTicketToPrdWorktree(gitRoot, target.root, doneFile, ticketId);
  if (sync.status !== "ok") {
    return { status: sync.status, hash: gitOut(target.root, ["rev-parse", "--verify", "HEAD"]), detail: sync.detail };
  }

  const commitBranch = commitIfStaged(target.root, todoCommitSubject(ticketId, "done"));
  if (commitBranch === "failed") {
    return { status: "prd_branch_commit_failed", hash: gitOut(target.root, ["rev-parse", "--verify", "HEAD"]), detail: `${prdKey} branch ticket commit failed` };
  }
  const branchHead = gitOut(target.root, ["rev-parse", "--verify", "HEAD"]);
  if (!prdTodoQueueDrained(prdKey)) {
    replaceScalar(doneFile, "Worktree", "Integration Status", "prd_branch_done_pending");
    return {
      status: commitBranch === "committed" ? "prd_branch_committed_pending" : "prd_branch_no_changes_pending",
      hash: branchHead,
      detail: `${prdKey} still has active TODO tickets`,
    };
  }

  return squashPrdBranchToMain(gitRoot, target.root, target.branch, prdKey, summary);
}

function syncDoneTicketToPrdWorktree(gitRoot: string, prdWorktree: string, doneFile: string, ticketId: string): { status: string; detail: string } {
  const relDone = gitRelativePath(gitRoot, doneFile);
  if (!relDone || relDone.startsWith("..") || path.isAbsolute(relDone)) {
    return { status: "prd_done_path_outside_git", detail: doneFile };
  }

  const dest = path.join(prdWorktree, relDone);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(doneFile, dest);
  const stale = ticketQueueRelCandidates(gitRoot, ticketId);
  for (const rel of stale) {
    git(prdWorktree, ["rm", "-f", "--ignore-unmatch", "--", rel]);
  }
  const add = spawnSync("git", ["add", "-A", "--", relDone], { cwd: prdWorktree, encoding: "utf8" });
  if (add.status !== 0) {
    return { status: "prd_branch_stage_failed", detail: oneLine(`${add.stderr || ""} ${add.stdout || ""}`) };
  }
  return { status: "ok", detail: "" };
}

function ticketQueueRelCandidates(gitRoot: string, ticketId: string): string[] {
  const boardRelPath = gitRelativePath(gitRoot, boardRoot);
  const names = [`TODO-${ticketId}.md`, `Todo-${ticketId}.md`, `tickets_${ticketId}.md`];
  const states = ["todo", "inprogress", "verifier", "ready-to-merge"];
  const out: string[] = [];
  for (const state of states) {
    for (const name of names) out.push(path.join(boardRelPath, "tickets", state, name));
  }
  return unique(out).filter((value) => value && !value.startsWith(".."));
}

function commitIfStaged(cwd: string, message: string): "committed" | "no_changes" | "failed" {
  if (git(cwd, ["diff", "--cached", "--quiet"]).status === 0) return "no_changes";
  const commit = spawnSync("git", ["commit", "-m", message], { cwd, encoding: "utf8" });
  return commit.status === 0 ? "committed" : "failed";
}

function prdTodoQueueDrained(prdKey: string): boolean {
  for (const state of ["todo", "inprogress", "verifier", "ready-to-merge"]) {
    const dir = path.join(boardRoot, "tickets", state);
    let entries: string[] = [];
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      if (!/^TODO-\d+\.md$/i.test(entry) && !/^Todo-\d+\.md$/.test(entry) && !/^tickets_\d+\.md$/i.test(entry)) continue;
      const candidate = path.join(dir, entry);
      if (normalizePrdKey(scalar(candidate, "Ticket", "PRD Key")) === prdKey) return false;
    }
  }
  return true;
}

function squashPrdBranchToMain(gitRoot: string, prdWorktree: string, branch: string, prdKey: string, _summary: string): { status: string; hash: string; detail: string } {
  const currentBranch = gitOut(gitRoot, ["symbolic-ref", "--short", "HEAD"]);
  if (currentBranch === branch) {
    return { status: "prd_squash_blocked", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: "PROJECT_ROOT is checked out on the PRD branch" };
  }

  // New installs often have untracked board files until the first PRD squash.
  // Stage the PRD-scoped board state before merge so --autostash can move it
  // out of the way and restore it into the final squash commit.
  stagePrdBoardState(gitRoot, prdKey);
  const merge = spawnSync("git", ["merge", "--squash", "--autostash", branch], { cwd: gitRoot, encoding: "utf8" });
  if (merge.status !== 0) {
    const detail = oneLine(`${merge.stderr || ""} ${merge.stdout || ""}`) || `git merge --squash exited ${merge.status ?? 1}`;
    return { status: "prd_squash_needs_ai_merge", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail };
  }

  const prdDoneFile = archivePrdDone(prdKey);
  if (!prdDoneFile) {
    return { status: "prd_archive_missing", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: `${prdKey} PRD file not found` };
  }

  stagePrdBoardState(gitRoot, prdKey);
  if (git(gitRoot, ["diff", "--cached", "--quiet"]).status === 0) {
    replaceScalar(prdDoneFile, "Project", "Status", "done");
    cleanupPrdBranch(gitRoot, prdWorktree, branch);
    return { status: "prd_squash_no_changes", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail: "" };
  }

  const commitMessage = prdCommitMessage(prdKey, prdDoneFile, _summary);
  const commit = spawnSync("git", ["commit", "-m", commitMessage], { cwd: gitRoot, encoding: "utf8" });
  if (commit.status !== 0) {
    const detail = oneLine(`${commit.stderr || ""} ${commit.stdout || ""}`) || `git commit exited ${commit.status ?? 1}`;
    return { status: "prd_squash_commit_failed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]), detail };
  }

  const hash = gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]);
  cleanupPrdBranch(gitRoot, prdWorktree, branch);
  clearCurrentPrdState(prdKey);
  return { status: "prd_squash_committed", hash, detail: "" };
}

function archivePrdDone(prdKey: string): string {
  const active = path.join(boardRoot, "tickets", "prd", `${prdKey}.md`);
  const doneDir = path.join(boardRoot, "tickets", "done", safeSegment(prdKey));
  const done = path.join(doneDir, `${prdKey}.md`);
  fs.mkdirSync(doneDir, { recursive: true });
  if (fs.existsSync(active)) {
    replaceScalar(active, "Project", "Status", "done");
    appendNote(active, `Worker runner ${workerId} finalized ${prdKey} at ${timestamp}.`);
    if (fs.existsSync(done)) fs.unlinkSync(done);
    fs.renameSync(active, done);
  } else if (fs.existsSync(done)) {
    replaceScalar(done, "Project", "Status", "done");
  }
  return fs.existsSync(done) ? done : "";
}

function stagePrdBoardState(gitRoot: string, prdKey: string): void {
  const boardRelPath = gitRelativePath(gitRoot, boardRoot);
  const doneDir = path.join(boardRelPath, "tickets", "done", safeSegment(prdKey));
  const prdActive = path.join(boardRelPath, "tickets", "prd", `${prdKey}.md`);
  const ids = doneTodoIds(prdKey);
  const candidates = [doneDir, prdActive, ...ids.flatMap((id) => ticketQueueRelCandidates(gitRoot, id))];
  for (const candidate of unique(candidates)) {
    if (!candidate || candidate.startsWith("..")) continue;
    const tracked = git(gitRoot, ["ls-files", "--error-unmatch", "--", candidate]).status === 0;
    if (!fs.existsSync(path.join(gitRoot, candidate)) && !tracked) continue;
    spawnSync("git", ["add", "-A", "--", candidate], { cwd: gitRoot, encoding: "utf8" });
  }
}

function doneTodoIds(prdKey: string): string[] {
  const dir = path.join(boardRoot, "tickets", "done", safeSegment(prdKey));
  let entries: string[] = [];
  try { entries = fs.readdirSync(dir); } catch { return []; }
  return unique(entries.map((entry) => ticketIdFromFile(entry)).filter(Boolean));
}

function prdCommitMessage(prdKey: string, _prdDoneFile: string, _summary: string): string {
  return prdCommitSubject(prdKey);
}

function cleanupPrdBranch(gitRoot: string, prdWorktree: string, branch: string): void {
  if (prdWorktree && path.resolve(prdWorktree) !== path.resolve(gitRoot) && fs.existsSync(prdWorktree)) {
    git(gitRoot, ["worktree", "remove", "--force", prdWorktree]);
  }
  if (branch) git(gitRoot, ["branch", "-D", branch]);
}

function clearCurrentPrdState(prdKey: string): void {
  const stateFile = path.join(boardRoot, "runners", "state", "current-prd.json");
  if (!fs.existsSync(stateFile)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as { prd_id?: string };
    if (normalizePrdKey(String(parsed.prd_id || "")) === prdKey) fs.rmSync(stateFile, { force: true });
  } catch {}
}

function normalizePrdKey(value: string): string {
  const trimmed = value.trim();
  const numeric = trimmed.match(/(?:PRD[-_]|prd_|project_)(\d+)/i);
  if (numeric) return `PRD-${numeric[1].padStart(3, "0")}`;
  return trimmed.toUpperCase().replace(/_/g, "-");
}
