import {boardRoot, projectRoot, timestamp} from "./context";
import {printPairs} from "./io";
import {replaceScalar, replaceSection, updateGoalRuntime, scalar, appendNote} from "./ticket-sections";
import {resolveTicketFile, cleanupWorktree, clearActiveState} from "./state";
import {routeToTodoReplan} from "./retry";
import {recordCodeMetricsWithRunnerTool} from "./metrics";
import {shouldHandoffToVerifier, handoffToVerifier, removeVerifierMarker, markNeedsAiMerge} from "./verifier";
import {sanityPreflight, prepareWorktreeForFinalization, finalizationPreflight, archiveDone, commitCompletion, restoreDoneAfterCommitFailure} from "./finalize";
import {idFromTicketPath} from "./io";

export function main(): void {
  const [ticketRef, outcome, message = ""] = process.argv.slice(2);
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write("Usage: autoflow tool finish-ticket <ticket-id-or-path> <pass|replan> [summary-or-replan-reason]\n");
    process.exit(0);
  }
  if (!ticketRef || !["pass", "replan"].includes(outcome || "")) {
    process.stderr.write("Usage: autoflow tool finish-ticket <ticket-id-or-path> <pass|replan> [summary-or-replan-reason]\n");
    process.exit(1);
  }

  const ticketFile = resolveTicketFile(ticketRef);
  if (!ticketFile) {
    printPairs({
      status: "idle",
      reason: "worker_finish_ticket_missing",
      ticket_ref: ticketRef,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }

  const ticketId = idFromTicketPath(ticketFile);
  if (outcome === "replan") {
    routeToTodoReplan(ticketFile, ticketId, "verifier_replan_requested", message);
    return;
  }

  if (message) replaceScalar(ticketFile, "Result", "Summary", message);

  const sanity = sanityPreflight(ticketFile);
  if (sanity) {
    appendNote(ticketFile, `TS sanity gate refused pass at ${timestamp}: ${sanity.failure}; ${sanity.detail}`);
    replaceScalar(ticketFile, "Ticket", "Stage", "blocked");
    replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
    replaceScalar(ticketFile, "Worktree", "Integration Status", `blocked_${sanity.failure}`);
    updateGoalRuntime(ticketFile, "blocked", timestamp);
    replaceSection(ticketFile, "Next Action", `- Next: shell sanity gate refused pass (${sanity.failure}). Worker must keep this same worktree, fix the issue, rerun local verification, update Done When, then call \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\` again. Do not request replan requeue for this mechanical false-pass block.`);
    printPairs({
      status: "blocked",
      outcome: "pass_refused",
      sanity_failure: sanity.failure,
      reason: sanity.detail,
      ticket: ticketFile,
      ticket_id: ticketId,
      next_action: "Worker must revise the same worktree and rerun worker finalize-approved; no replan requeue was created.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
    return;
  }

  recordCodeMetricsWithRunnerTool(ticketFile, ticketId);

  if (shouldHandoffToVerifier(ticketId)) {
    handoffToVerifier(ticketFile, ticketId);
    return;
  }

  const prep = prepareWorktreeForFinalization(ticketFile, ticketId);
  if (prep.status === "needs_ai_merge") {
    markNeedsAiMerge(ticketFile, ticketId, prep.reason);
    printPairs({
      status: "needs_ai_merge",
      outcome: "pass",
      reason: prep.reason,
      ticket: ticketFile,
      ticket_id: ticketId,
      worktree_path: prep.worktreePath,
      worktree_commit: prep.worktreeCommit,
      commit_status: "ai_merge_required",
      next_action: "Worker must manually integrate the verified worktree changes into PROJECT_ROOT, resolve conflicts, rerun verification, and rerun worker finalize-approved. Runtime scripts will not choose the merge strategy.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  const finalization = finalizationPreflight(ticketFile);
  if (finalization.status === "needs_ai_merge") {
    markNeedsAiMerge(ticketFile, ticketId, finalization.reason);
    printPairs({
      status: "needs_ai_merge",
      outcome: "pass",
      reason: finalization.reason,
      detail: finalization.detail,
      ticket: ticketFile,
      ticket_id: ticketId,
      worktree_path: prep.worktreePath,
      worktree_commit: prep.worktreeCommit,
      commit_status: "ai_merge_required",
      next_action: "Worker must manually integrate the verified worktree changes into PROJECT_ROOT, rerun verification, and rerun worker finalize-approved.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  if (finalization.status === "blocked") {
    appendNote(ticketFile, `Finalize blocked at ${timestamp}: ${finalization.reason}; ${finalization.detail}`);
    replaceScalar(ticketFile, "Ticket", "Stage", "blocked");
    replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
    replaceScalar(ticketFile, "Worktree", "Integration Status", `blocked_${finalization.reason}`);
    updateGoalRuntime(ticketFile, "blocked", timestamp);
    replaceSection(ticketFile, "Next Action", `- Next: finalization preflight failed (${finalization.reason}). Worker must fix PROJECT_ROOT merge/verification, rerun verification, then call \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\` again.`);
    printPairs({
      status: "blocked",
      outcome: "pass_refused",
      reason: finalization.detail,
      ticket: ticketFile,
      ticket_id: ticketId,
      verification_command: finalization.command || "",
      verification_exit_code: String(finalization.exitCode ?? ""),
      next_action: "Worker must fix PROJECT_ROOT merge/verification and rerun worker finalize-approved.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
    return;
  }

  const doneFile = archiveDone(ticketFile, ticketId);
  const commit = commitCompletion(doneFile, ticketId, message || scalar(doneFile, "Result", "Summary") || "complete work item");
  const commitOk = [
    "committed",
    "already_committed",
    "skipped_by_env",
    "not_git_repo",
    "no_changes",
    "prd_branch_committed_pending",
    "prd_branch_no_changes_pending",
    "prd_squash_committed",
    "prd_squash_no_changes",
  ].includes(commit.status);
  if (!commitOk) {
    const restoredTicket = restoreDoneAfterCommitFailure(doneFile, ticketId, commit.status, commit.detail);
    printPairs({
      status: "blocked",
      outcome: "completion_commit_failed",
      reason: commit.detail,
      ticket: restoredTicket,
      ticket_id: ticketId,
      worktree_path: prep.worktreePath,
      worktree_commit: prep.worktreeCommit,
      commit_status: commit.status,
      commit_hash: commit.hash,
      next_action: "Completion commit did not meet the finalization contract; ticket was restored to inprogress/blocked. Inspect PROJECT_ROOT git status and rerun finalize after fixing it.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
    return;
  }
  removeVerifierMarker(ticketId);
  cleanupWorktree(doneFile);
  clearActiveState("done");

  const finalizerRole = "worker";
  printPairs({
    status: "done",
    outcome: "pass",
    ticket: doneFile,
    ticket_id: ticketId,
    worktree_path: prep.worktreePath,
    worktree_commit: prep.worktreeCommit,
    finalization: "done; log written; wiki deferred to wiki runner",
    merge_actor: finalizerRole,
    finalizer_merge_action: "none",
    "wiki.status": "ai_owned",
    "wiki.next_action": "Wiki runner inspects done/log sources and writes focused markdown wiki pages via autoflow wiki write-page when synthesis is warranted.",
    commit_status: commit.status === "committed" ? "committed_via_completion_finalizer" : commit.status,
    commit_hash: commit.hash,
    next_action: "Merge finalization completed. Orchestrator may checkpoint this PRD turn and assign the next role lease.",
    board_root: boardRoot,
    project_root: projectRoot,
  });
}

main();
