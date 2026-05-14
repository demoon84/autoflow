import {fs, path, boardRoot, projectRoot, timestamp, workerId} from "./context";
import {boardRel, oneLine, safeSegment, unique} from "./io";
import {allowedPaths, appendNote, doneWhenItems, normalizedChangeType, replaceScalar, replaceSection, scalar, updateGoalRuntime} from "./ticket-sections";
import {changedFiles, diffLineCount, git, gitOut, gitRootPath, isGitWorktree, pathsOverlap, projectRootPathMatchesWorktree, statusPaths} from "./git";
import {writeVerifierLog} from "./verifier";
import {positiveInt, read} from "./io";

export function sanityPreflight(ticketFile: string): { failure: string; detail: string } | null {
  const text = read(ticketFile);
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const changeType = normalizedChangeType(ticketFile);
  let minDiffLines = changeType === "infra" ? positiveInt(process.env.AUTOFLOW_INFRA_MIN_DIFF_LINES || "", 10) : 1;
  if (changeType === "docs" || changeType === "cleanup") minDiffLines = 0;

  if (!worktreePath || !isGitWorktree(worktreePath)) {
    return {
      failure: "missing_worktree",
      detail: "ticket pass requires a git worktree; run worker runner-tool worktree-ensure before finishing",
    };
  }
  if (!baseCommit) {
    return {
      failure: "missing_worktree_base",
      detail: "ticket pass requires Worktree Base Commit before finishing",
    };
  }

  if (minDiffLines > 0) {
    const lineCount = diffLineCount(worktreePath, baseCommit);
    if (lineCount < minDiffLines) {
      return {
        failure: changeType === "infra" ? "zero_diff_infra" : "zero_diff",
        detail: `${changeType} change requires at least ${minDiffLines} changed line(s); saw ${lineCount}`,
      };
    }
  }

  const checklist = doneWhenItems(text);
  if (checklist.length === 0) return { failure: "done_when_empty", detail: "## Done When section has no checklist items" };
  const unchecked = checklist.filter((line) => /^\s*[-*]\s+\[ \]/.test(line)).length;
  if (unchecked > 0) return { failure: "done_when_unchecked", detail: `${unchecked} of ${checklist.length} Done When item(s) still unchecked` };

  if (!["docs", "cleanup"].includes(changeType)) {
    const names = changedFiles(worktreePath, baseCommit)
      .filter((name) => !name.startsWith(".autoflow/tickets/inprogress/"))
      .filter((name) => !name.startsWith(".autoflow/tickets/done/"));
    const allowed = allowedPaths(ticketFile);
    const matched = names.some((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    if (!matched) {
      return {
        failure: "allowed_paths_no_diff",
        detail: `no changed product file matches an Allowed Path (change_type=${changeType})`,
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
      git(worktreePath, ["commit", "-m", `autoflow ticket ${ticketId} code snapshot`]);
    }
  }

  const head = gitOut(worktreePath, ["rev-parse", "--verify", "HEAD"]);
  if (head) replaceScalar(ticketFile, "Worktree", "Worktree Commit", head);

  const needsMerge = scopedChanged.some((name) => {
    const relPath = allowed.find((ap) => pathsOverlap(name, ap)) || name;
    return !projectRootPathMatchesWorktree(worktreePath, relPath);
  });
  if (needsMerge) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
    return { status: "needs_ai_merge", reason: "ai_merge_required", worktreePath, worktreeCommit: head };
  }

  replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
  return { status: "ready", reason: "", worktreePath, worktreeCommit: head };
}

export function archiveDone(ticketFile: string, ticketId: string): string {
  const projectKey = scalar(ticketFile, "Ticket", "PRD Key") || `ticket_${ticketId}`;
  replaceScalar(ticketFile, "Ticket", "Stage", "done");
  replaceScalar(ticketFile, "Ticket", "Claimed By", "");
  replaceScalar(ticketFile, "Ticket", "Execution AI", "");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  updateGoalRuntime(ticketFile, "complete", timestamp);
  replaceSection(ticketFile, "Verification", `- Result: passed by ${workerId} at ${timestamp}
- Log file: ${writeVerifierLog(ticketFile, ticketId)}`);
  appendNote(ticketFile, `Impl AI ${workerId} finalized ticket at ${timestamp}.`);

  const doneDir = path.join(boardRoot, "tickets", "done", safeSegment(projectKey));
  fs.mkdirSync(doneDir, { recursive: true });
  const doneFile = path.join(doneDir, path.basename(ticketFile));
  if (path.resolve(ticketFile) !== path.resolve(doneFile)) {
    if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
    fs.renameSync(ticketFile, doneFile);
  }
  return doneFile;
}

export function commitCompletion(doneFile: string, ticketId: string, summary: string): { status: string; hash: string } {
  if (process.env.AUTOFLOW_WORKER_SKIP_COMMIT === "1") return { status: "skipped_by_env", hash: "" };
  const gitRoot = gitRootPath(projectRoot);
  if (!gitRoot) return { status: "not_git_repo", hash: "" };

  const boardRelPath = path.relative(gitRoot, boardRoot);
  const candidates = [
    path.relative(gitRoot, doneFile),
    path.join(boardRelPath, "tickets", "todo", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "todo", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "logs"),
    ...allowedPaths(doneFile),
  ].filter((value) => value && !value.startsWith(".."));
  if (candidates.length > 0) git(gitRoot, ["add", "-A", "--", ...unique(candidates)]);

  if (git(gitRoot, ["diff", "--cached", "--quiet"]).status === 0) return { status: "no_changes", hash: "" };
  const prdKey = scalar(doneFile, "Ticket", "PRD Key");
  const prefix = prdKey ? `[${prdKey.toUpperCase()}][ticket_${ticketId}]` : `[ticket_${ticketId}]`;
  git(gitRoot, ["commit", "-m", `${prefix} ${oneLine(summary) || "complete worker work"}`]);
  return { status: "committed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]) };
}
