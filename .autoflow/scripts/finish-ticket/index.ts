import {boardRoot, projectRoot, timestamp} from "./context";
import {printPairs} from "./io";
import {failureClass, replaceScalar, replaceSection, updateGoalRuntime, scalar, appendNote} from "./ticket-sections";
import {resolveTicketFile, cleanupWorktree, clearActiveState} from "./state";
import {routeToOrderRetry} from "./retry";
import {recordCodeMetricsWithRunnerTool} from "./metrics";
import {shouldHandoffToVerifier, handoffToVerifier, removeVerifierMarker, markNeedsAiMerge} from "./verifier";
import {sanityPreflight, prepareWorktreeForFinalization, archiveDone, commitCompletion} from "./finalize";
import {idFromTicketPath} from "./io";

export function main(): void {
  const [ticketRef, outcome, message = ""] = process.argv.slice(2);
  if (!ticketRef || !["pass", "replan"].includes(outcome || "")) {
    process.stderr.write("Usage: finish-ticket.ts <ticket-id-or-path> <pass|replan> [summary-or-replan-reason]\n");
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
    routeToOrderRetry(ticketFile, ticketId, failureClass(ticketFile) || "verifier_replan_requested", message);
    return;
  }

  if (message) replaceScalar(ticketFile, "Result", "Summary", message);

  const sanity = sanityPreflight(ticketFile);
  if (sanity) {
    appendNote(ticketFile, `TS sanity gate refused pass at ${timestamp}: ${sanity.failure}; ${sanity.detail}`);
    replaceScalar(ticketFile, "Ticket", "Stage", "blocked");
    replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
    replaceScalar(ticketFile, "Worktree", "Integration Status", `blocked_${sanity.failure}`);
    replaceScalar(ticketFile, "Recovery State", "Status", "blocked");
    replaceScalar(ticketFile, "Recovery State", "Detected By", "finish-ticket.ts pass sanity gate");
    replaceScalar(ticketFile, "Recovery State", "Failure Class", `shell_sanity_gate_${sanity.failure}`);
    replaceScalar(ticketFile, "Recovery State", "Evidence", sanity.detail);
    replaceScalar(ticketFile, "Recovery State", "Worker Resume Instruction", "Fix this same worktree, rerun local verification, check every Done When item, then call runner-tool.ts worker submit-to-verifier again.");
    replaceScalar(ticketFile, "Recovery State", "Last Recovery At", timestamp);
    updateGoalRuntime(ticketFile, "blocked", timestamp);
    replaceSection(ticketFile, "Next Action", `- Next: shell sanity gate refused pass (${sanity.failure}). Worker must keep this same worktree, fix the issue, rerun local verification, update Done When, then call \`scripts/runner-tool.ts worker submit-to-verifier --ticket ${ticketId} --summary "<summary>"\` again. Do not create a retry order for this mechanical false-pass block.`);
    printPairs({
      status: "blocked",
      outcome: "pass_refused",
      failure_class: `shell_sanity_gate_${sanity.failure}`,
      reason: sanity.detail,
      ticket: ticketFile,
      ticket_id: ticketId,
      next_action: "Worker must revise the same worktree and rerun worker submit-to-verifier; no order retry was created.",
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
      next_action: "AI must manually integrate the verified worktree changes into PROJECT_ROOT, resolve conflicts, rerun verification, and rerun worker finalize-approved. Runtime scripts will not perform the merge.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  removeVerifierMarker(ticketId);
  const doneFile = archiveDone(ticketFile, ticketId);
  const commit = commitCompletion(doneFile, ticketId, message || scalar(doneFile, "Result", "Summary") || "complete worker work");
  cleanupWorktree(doneFile);
  clearActiveState();

  printPairs({
    status: "done",
    outcome: "pass",
    ticket: doneFile,
    ticket_id: ticketId,
    worktree_path: prep.worktreePath,
    worktree_commit: prep.worktreeCommit,
    finalization: "done; log written; wiki deferred to Wiki AI",
    merge_actor: "worker",
    finalizer_merge_action: "none",
    "wiki.status": "ai_owned",
    "wiki.next_action": "Wiki AI inspects done/log sources and runs scripts/update-wiki.ts only when material baseline drift exists.",
    commit_status: commit.status === "committed" ? "committed_via_completion_finalizer" : commit.status,
    commit_hash: commit.hash,
    next_action: "Worker-owned merge finalization completed. Impl AI may pick the next todo ticket on the next tick.",
    board_root: boardRoot,
    project_root: projectRoot,
  });
}

main();
