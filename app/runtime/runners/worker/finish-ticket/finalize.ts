import {fs, path, boardRoot, projectRoot, spawnSync, timestamp, workerId} from "./context";
import {boardRel, oneLine, safeSegment, unique} from "./io";
import {allowedPaths, appendNote, doneWhenItems, normalizedChangeType, replaceScalar, replaceSection, scalar, updateGoalRuntime} from "./ticket-sections";
import {changedFiles, diffLineCount, git, gitOut, gitRootPath, headContainsCommit, isGitWorktree, pathsOverlap, projectRootContainsWorktreeChange, statusPaths} from "./git";
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

  if (head && headContainsCommit(projectRoot, head)) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
    return { status: "ready", reason: "worktree_commit_in_project_history", worktreePath, worktreeCommit: head };
  }

  const needsMerge = scopedChanged.some((name) => !projectRootContainsWorktreeChange(worktreePath, baseCommit, name));
  if (needsMerge) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
    return { status: "needs_ai_merge", reason: "ai_merge_required", worktreePath, worktreeCommit: head };
  }

  replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
  return { status: "ready", reason: "", worktreePath, worktreeCommit: head };
}

function verificationCommand(ticketFile: string): string {
  const command = scalar(ticketFile, "Verification", "Command").trim();
  if (!command || /^(TBD|TODO:?|N\/A|NA|NONE|none-shell)$/i.test(command)) return "";
  return command;
}

export function finalizationPreflight(ticketFile: string): { status: "ok" | "needs_ai_merge" | "blocked"; reason: string; detail: string; command?: string; exitCode?: number } {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const allowed = allowedPaths(ticketFile);
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  if (worktreePath && isGitWorktree(worktreePath)) {
    const changed = baseCommit ? changedFiles(worktreePath, baseCommit) : statusPaths(worktreePath);
    const scopedChanged = changed.filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    const mismatched = scopedChanged.filter((relPath) => !projectRootContainsWorktreeChange(worktreePath, baseCommit, relPath));
    if (mismatched.length > 0) {
      return {
        status: "needs_ai_merge",
        reason: "project_root_not_integrated",
        detail: `PROJECT_ROOT differs from verified worktree for: ${mismatched.join(",")}`,
      };
    }
  }

  const command = verificationCommand(ticketFile);
  if (!command || process.env.AUTOFLOW_FINALIZE_RUN_VERIFICATION === "0") {
    return { status: "ok", reason: command ? "verification_rerun_skipped_by_env" : "verification_command_empty", detail: "" };
  }

  const timeout = positiveInt(process.env.AUTOFLOW_FINALIZE_VERIFY_TIMEOUT_MS || "", 120000);
  const result = spawnSync(command, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: true,
    timeout,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  replaceScalar(ticketFile, "Verification", "Exit Code", String(exitCode));
  replaceScalar(ticketFile, "Verification", "Last Run", timestamp);
  replaceScalar(ticketFile, "Verification", "Result", exitCode === 0 ? "pass" : "fail");
  appendNote(ticketFile, `Project-root verification rerun at ${timestamp}: exit_code=${exitCode} command=${command}`);
  if (exitCode !== 0 || result.error) {
    const output = oneLine(`${result.error ? String(result.error) : ""} ${result.stderr || ""} ${result.stdout || ""}`);
    return {
      status: "blocked",
      reason: "project_root_verification_failed",
      detail: output || `verification command exited ${exitCode}`,
      command,
      exitCode,
    };
  }
  return { status: "ok", reason: "project_root_verification_passed", detail: "", command, exitCode };
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
  replaceScalar(restoredFile, "Recovery State", "Status", "blocked");
  replaceScalar(restoredFile, "Recovery State", "Detected By", "finish-ticket.ts completion commit");
  replaceScalar(restoredFile, "Recovery State", "Failure Class", failureStatus);
  replaceScalar(restoredFile, "Recovery State", "Evidence", detail);
  replaceScalar(restoredFile, "Recovery State", "Worker Resume Instruction", "Inspect PROJECT_ROOT git status and rerun worker finalize-approved after fixing the completion commit failure.");
  replaceScalar(restoredFile, "Recovery State", "Last Recovery At", timestamp);
  updateGoalRuntime(restoredFile, "blocked", timestamp);
  appendNote(restoredFile, `Completion commit failed at ${timestamp}: ${failureStatus}; ${detail}`);
  replaceSection(restoredFile, "Next Action", `- Next: completion commit failed (${failureStatus}). Inspect PROJECT_ROOT git status, fix the commit blocker, then rerun \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`. The ticket was restored from done to inprogress because finalization is not complete.`);
  return restoredFile;
}

export function commitCompletion(doneFile: string, ticketId: string, summary: string): { status: string; hash: string; detail: string } {
  if (process.env.AUTOFLOW_WORKER_SKIP_COMMIT === "1") return { status: "skipped_by_env", hash: "", detail: "" };
  const gitRoot = gitRootPath(projectRoot);
  if (!gitRoot) return { status: "not_git_repo", hash: "", detail: "" };

  const boardRelPath = path.relative(gitRoot, boardRoot);
  const worktreeCommit = scalar(doneFile, "Worktree", "Worktree Commit");
  const productChangesAreCommitted = worktreeCommit ? headContainsCommit(gitRoot, worktreeCommit) : false;
  const allowed = allowedPaths(doneFile);
  const candidates = [
    path.relative(gitRoot, doneFile),
    path.join(boardRelPath, "tickets", "todo", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "todo", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "logs"),
    ...(productChangesAreCommitted ? [] : allowed),
  ].filter((value) => value && !value.startsWith(".."));
  const stageFailures: string[] = [];
  for (const candidate of unique(candidates)) {
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
    if (worktreeCommit && allowed.length > 0) {
      return { status: "no_completion_changes_for_allowed_paths", hash: "", detail: allowed.join(",") };
    }
    return { status: "no_changes", hash: "", detail: "" };
  }
  const prdKey = scalar(doneFile, "Ticket", "PRD Key");
  const prefix = prdKey ? `[${prdKey.toUpperCase()}][ticket_${ticketId}]` : `[ticket_${ticketId}]`;
  const commitResult = spawnSync("git", ["commit", "-m", `${prefix} ${oneLine(summary) || "complete worker work"}`], {
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
