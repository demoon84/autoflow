import {crypto, fs, path, boardRoot, projectRoot, timestamp} from "./context";
import {appendNote, appendReplanReason, replaceScalar, scalar, updateGoalRuntime} from "./ticket-sections";
import {cleanupWorktree, clearActiveState} from "./state";
import {positiveInt, printPairs} from "./io";

export function routeToTodoReplan(ticketFile: string, ticketId: string, failure: string, replanMessage: string): void {
  const prdKey = scalar(ticketFile, "Ticket", "PRD Key");
  const title = scalar(ticketFile, "Ticket", "Title");
  if (replanMessage) appendReplanReason(ticketFile, replanMessage);

  const fpInput = `${prdKey}|${title}|${failure}|${replanMessage}`;
  const fingerprint = crypto.createHash("sha256").update(fpInput).digest("hex").slice(0, 12);
  const priorRetryCount = positiveInt(scalar(ticketFile, "Goal Runtime", "Replan Count") || "", 0);
  const priorFingerprint = scalar(ticketFile, "Goal Runtime", "Replan Fingerprint");
  const sameFingerprint = priorFingerprint === fingerprint;
  const retryCount = sameFingerprint ? priorRetryCount + 1 : 1;
  const retryMax = positiveInt(process.env.AUTOFLOW_TODO_REPLAN_MAX_FINGERPRINT || process.env.AUTOFLOW_ORDER_RETRY_MAX_FINGERPRINT || "", 3);
  const decision = retryCount >= retryMax ? "needs_user" : "replan";

  cleanupWorktree(ticketFile);

  const todoDir = path.join(boardRoot, "tickets", "todo");
  fs.mkdirSync(todoDir, { recursive: true });
  const todoFile = path.join(todoDir, path.basename(ticketFile));
  if (path.resolve(ticketFile) !== path.resolve(todoFile)) {
    if (fs.existsSync(todoFile)) fs.rmSync(todoFile, { force: true });
    fs.renameSync(ticketFile, todoFile);
  }

  replaceScalar(todoFile, "Ticket", "Stage", decision === "needs_user" ? "needs_user" : "todo");
  replaceScalar(todoFile, "Ticket", "Claimed By", "");
  replaceScalar(todoFile, "Ticket", "Execution AI", "");
  replaceScalar(todoFile, "Ticket", "Verifier Runner", "");
  replaceScalar(todoFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(todoFile, "Worktree", "Path", "");
  replaceScalar(todoFile, "Worktree", "Branch", "");
  replaceScalar(todoFile, "Worktree", "Base Commit", "");
  replaceScalar(todoFile, "Worktree", "Worktree Commit", "");
  replaceScalar(todoFile, "Worktree", "Integration Status", decision === "needs_user" ? "needs_user" : "pending_claim");
  replaceScalar(todoFile, "Goal Runtime", "Replan Count", String(retryCount));
  replaceScalar(todoFile, "Goal Runtime", "Replan Max", String(retryMax));
  replaceScalar(todoFile, "Goal Runtime", "Replan Decision", decision);
  replaceScalar(todoFile, "Goal Runtime", "Replan Fingerprint", fingerprint);
  replaceScalar(todoFile, "Goal Runtime", "Failure Class", failure);
  updateGoalRuntime(todoFile, decision === "needs_user" ? "needs_user" : "todo", timestamp);
  appendNote(todoFile, `Verifier replan at ${timestamp}: replan_count=${retryCount}/${retryMax} fingerprint=${fingerprint} failure_class=${failure} decision=${decision}. ${replanMessage || "(see ticket replan reason)"}`);

  clearActiveState();
  printPairs({
    status: "replanned",
    outcome: "replan",
    failure_class: failure,
    ticket: todoFile,
    ticket_id: ticketId,
    "wiki.status": "ai_owned",
    commit_status: "not_committed_replan_ticket",
    replan_count: String(retryCount),
    replan_decision: decision,
    replan_fingerprint: fingerprint,
    worktree_cleanup: "attempted",
    board_root: boardRoot,
    project_root: projectRoot,
  });
}
