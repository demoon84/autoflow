import {boardRoot, projectRoot, runnerId} from "./context";
import {asObject, printPairs} from "./io";
import {doneTarget, idFromTicketPath, nextActionFor, resolveBoardPath, ticketScalar, ticketWorktreeField, worktreeStatusAllowsResume} from "./ticket";

export function emitActiveTicket(rawItem: unknown, source: string): void {
  const item = asObject(rawItem);
  const ticketRel = String(item.path || "");
  const ticketAbs = resolveBoardPath(ticketRel);
  const ticketId = idFromTicketPath(ticketRel || ticketAbs);
  const stage = String(item.stage || ticketScalar(ticketAbs, "Stage") || "executing");
  const worktreePath = String(item.worktree_path || ticketWorktreeField(ticketAbs, "Path") || "");
  const worktreeStatus = String(item.worktree_status || ticketWorktreeField(ticketAbs, "Integration Status") || "");
  const worktreeReady = Boolean(worktreePath) && worktreeStatusAllowsResume(worktreeStatus);
  const workingRoot = worktreeReady ? worktreePath : "";

  printPairs({
    status: "resume",
    source,
    runner: runnerId,
    ticket: ticketRel,
    ticket_id: ticketId,
    stage,
    worktree_status: worktreeStatus,
    worktree_path: worktreePath,
    working_root: workingRoot,
    implementation_root: workingRoot,
    board_root: boardRoot,
    project_root: projectRoot,
    done_target: doneTarget(ticketAbs),
    next_action: worktreeReady
      ? nextActionFor(ticketId, stage)
      : `Call scripts/runner-tool.ts worker worktree-ensure --ticket ${ticketRel || `Todo-${ticketId}`} before implementation. Do not edit PROJECT_ROOT as fallback.`,
    routing_pass: `After worktree verification evidence passes, run scripts/runner-tool.ts worker submit-to-verifier --ticket ${ticketId} --summary "<short summary>" to hand off to verifier before any PROJECT_ROOT merge.`,
    routing_replan: `If verifier or recovery evidence says the ticket must be replaced, run scripts/runner-tool.ts worker create-retry-order --ticket ${ticketId} --reason "<concrete reason>".`,
  });
}

export function emitTodoCandidate(rawItem: unknown, source: string): void {
  const item = asObject(rawItem);
  const ticketRel = String(item.path || "");
  const ticketAbs = resolveBoardPath(ticketRel);
  const ticketId = idFromTicketPath(ticketRel || ticketAbs);
  printPairs({
    status: "todo_available",
    runner_status: "idle",
    runtime_status: "waiting_for_runner_decision",
    source,
    runner: runnerId,
    ticket: ticketRel,
    ticket_id: ticketId,
    stage: String(item.stage || ticketScalar(ticketAbs, "Stage") || "todo"),
    priority: String(item.priority || ticketScalar(ticketAbs, "Priority") || ""),
    claimable: String(item.claimable ?? "true"),
    worktree_status: String(item.worktree_status || ticketWorktreeField(ticketAbs, "Integration Status") || ""),
    worktree_path: String(item.worktree_path || ticketWorktreeField(ticketAbs, "Path") || ""),
    working_root: "",
    implementation_root: "",
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: `Runner must choose explicitly: scripts/runner-tool.ts worker claim --ticket ${ticketRel || `Todo-${ticketId}`} --runner ${runnerId}. Claim will create/validate the worktree before implementation.`,
  });
}

export function emitIdle(reason: string, detail: string): void {
  printPairs({
    status: "idle",
    runner_status: "idle",
    runtime_status: "idle",
    runner: runnerId,
    reason,
    detail,
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: "No claimable ticket found for this worker tick.",
  });
}
