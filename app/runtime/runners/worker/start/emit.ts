import {boardRoot, projectRoot, runnerId} from "./context";
import {asObject, printPairs} from "./io";
import {doneTarget, idFromTicketPath, nextActionFor, resolveBoardPath, ticketScalar, ticketSectionScalar, ticketWorktreeField, worktreeStatusAllowsResume} from "./ticket";

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
      ? nextActionFor(ticketId, stage, ticketAbs)
      : `Call autoflow tool runner-tool worker worktree-ensure --ticket ${ticketRel || ticketId} before implementation. Do not edit PROJECT_ROOT as fallback.`,
    routing_pass: `After worktree verification evidence passes, run autoflow tool runner-tool worker submit-to-verifier --ticket ${ticketId} --summary "<short summary>" to hand off to verifier before any PROJECT_ROOT merge.`,
    routing_replan: `If verifier says the work item must be redone from scratch, run autoflow tool runner-tool worker request-replan --ticket ${ticketId} --reason "<concrete reason>". The work item returns to the pending work lane for a fresh worker attempt.`,
  });
}

export function emitWorkCandidate(rawItem: unknown, source: string): void {
  const item = asObject(rawItem);
  const ticketRel = String(item.path || "");
  const ticketAbs = resolveBoardPath(ticketRel);
  const ticketId = idFromTicketPath(ticketRel || ticketAbs);
  printPairs({
    status: "work_available",
    runner_status: "idle",
    runtime_status: "waiting_for_runner_decision",
    source,
    runner: runnerId,
    ticket: ticketRel,
    ticket_id: ticketId,
    stage: String(item.stage || ticketScalar(ticketAbs, "Stage") || "todo"),
    claimable: String(item.claimable ?? "true"),
    worktree_status: String(item.worktree_status || ticketWorktreeField(ticketAbs, "Integration Status") || ""),
    worktree_path: String(item.worktree_path || ticketWorktreeField(ticketAbs, "Path") || ""),
    working_root: "",
    implementation_root: "",
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: `Use the current runner assignment if one exists: run autoflow tool assignment current --runner ${runnerId}, then autoflow tool runner-tool worker claim --ticket ${ticketRel || ticketId} --runner ${runnerId}. Claim will create/validate the worktree before implementation.`,
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
    next_action: "No assigned claimable work item found for this worker tick.",
  });
}
