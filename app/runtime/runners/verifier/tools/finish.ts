import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;

const {
  crypto,
  fs,
  path,
  spawnSync,
  utils,
  SCRIPT_DIR,
  DEFAULT_BOARD_ROOT,
  DEFAULT_PROJECT_ROOT,
  BOARD_ROOT,
  PROJECT_ROOT,
  TICKETS_ROOT,
  args,
  isReadyWorktree,
  listQueueItems,
  readQueueItem,
  readAnyPriority,
  readTitle,
  readStatus,
  listWorkerTicketItems,
  readWorkerTicketItem,
  workerTicketSort,
  ticketItemOwnedByRunner,
  runnerTokenMatches,
  canonicalRunnerId,
  claimToken,
  pathConflictGuardEnabled,
  collectTicketConflicts,
  pathsOverlap,
  normalizeRelPath,
  requireTicket,
  resolveTicketPath,
  acquireDispatchLock,
  releaseDispatchLock,
  readWorktreeStatus,
  ensureWorkerTicketWorktree,
  worktreeModeDisabled,
  defaultTicketWorktreePath,
  isGitWorktree,
  gitBranchExists,
  hydrateWorktreeDependencies,
  findDependencyDirs,
  excludeWorktreePath,
  doneWhenCheck,
  diffCheck,
  diffStats,
  readVerifierEvidence,
  recordVerifierDecision,
  findTicketById,
  workerRunnerIdFromTicket,
  markWorkerTicketVerified,
  markWorkerTicketRevisionRequested,
  markWorkerTicketReplanRequested,
  writeVerifierLog,
  verifierOkMarkerPath,
  diffPatch,
  capTextByBytes,
  cleanSectionLines,
  fileMtimeIso,
  compactIso,
  isoLatencySeconds,
  statusPorcelainPaths,
  gitLines,
  numstatLineCount,
  numstatByFile,
  updateWorkerState,
  replaceSectionBlock,
  bulletize,
  readOptionalTextFile,
  stripTicks,
  oneLine,
  unique,
  git,
  spawnTsScript,
  spawnOutputText,
  wikiSourceGroups,
  hashFiles,
  boardDirName,
  autoflowCliPath,
  emitAutoflowResult,
  parseKeyValueOutput,
  resolveLocalFile,
  resolveWikiWritablePath,
  parseNumstat,
  readWikiStatusItem,
  safeLineCount,
  wikiCategory,
  wikiFileWeight,
  readWritePayload,
  validatePrdContent,
  validateTicketContent,
  requireSection,
  collectUsedIds,
  pruneReservations,
  releaseReservation,
  collectFiles,
  resolveBoardPath,
  validateNoUnsafeWrite,
  writeAtomic,
  extractIdFromContent,
  extractBulletSectionFromText,
  extractChecklistFromText,
  extractSectionLines,
  normalizePriority,
  priorityRank,
  idFromPath,
  normalizeId,
  currentRunnerId,
  getArg,
  getArgs,
  hasFlag,
  positiveInt,
  numberValue,
  safeSegment,
  boardRel,
  stringValue,
  requireRoleAssignmentForItem,
  compactAssignment,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail,
  emitRunnerContextReset
} = shared;

type VerifierDecision = shared.VerifierDecision;
type VerifierCompletionCommand = "pass" | "request-revision" | "request-replan";

function commandForOutcome(outcome: VerifierDecision): VerifierCompletionCommand {
  if (outcome === "pass") return "pass";
  if (outcome === "revise") return "request-revision";
  return "request-replan";
}

function inprogressTicketPath(ticketId: string): string {
  return path.join(TICKETS_ROOT, "inprogress", `TODO-${ticketId}.md`);
}

function restoreVerifierTicketToInprogress(ticket: string, ticketId: string): string {
  const target = inprogressTicketPath(ticketId);
  if (path.resolve(ticket) === path.resolve(target)) return target;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (safeIsFile(target)) {
    try { fs.unlinkSync(ticket); } catch {}
    return target;
  }
  fs.renameSync(ticket, target);
  return target;
}

export function cmdVerifierComplete(outcome: VerifierDecision): void {
  const ticket = requireTicket(["verifier"]);
  const message = outcome === "pass" ? getArg("--summary") : getArg("--reason");
  const command = commandForOutcome(outcome);
  if (!message) fail(2, `verifier ${command} requires --${outcome === "pass" ? "summary" : "reason"}`);
  const decisionReason = message;
  const ticketId = idFromPath(ticket);
  const runnerId = currentRunnerId("verifier");
  const assignment = requireRoleAssignmentForItem("verifier", ticket, runnerId);
  const original = findTicketById(["inprogress"], ticketId);

  if (outcome === "pass") {
    const record = recordVerifierDecision(ticket, outcome, decisionReason, true);
    const workerTicket = original || restoreVerifierTicketToInprogress(ticket, ticketId);
    const workerRunner = workerRunnerIdFromTicket(workerTicket);
    markWorkerTicketVerified(workerTicket, ticketId, decisionReason, stringValue(record.log_path), stringValue(record.marker_path));
    if (original) {
      try { fs.unlinkSync(ticket); } catch {}
    }
    const passContextReset = emitRunnerContextReset(runnerId, `verifier.${command}`, "compact", {
      tool: `verifier.${command}`,
      ticket_id: `TODO-${ticketId}`,
      decision: outcome,
    });
    ok({
      tool: `verifier.${command}`,
      runner: runnerId,
      assignment: compactAssignment(assignment),
      ticket_id: `TODO-${ticketId}`,
      verifier_ticket: boardRel(ticket),
      worker_ticket: boardRel(workerTicket),
      worker_runner: workerRunner,
      decision: outcome,
      log_path: stringValue(record.log_path),
      marker_path: stringValue(record.marker_path),
      removed_verifier_ticket: !fs.existsSync(ticket),
      context_reset: passContextReset.ok ? "queued" : "not_queued",
      context_reset_path: stringValue(passContextReset.path),
      next_action: "Worker must run worker finalize-approved to commit the verifier-approved result into the PRD worktree, rerun required verification from that target, and merge the PRD worktree if this was the final TODO.",
    });
    return;
  }

  const record = recordVerifierDecision(ticket, outcome, decisionReason, false);
  const workerTicket = original || restoreVerifierTicketToInprogress(ticket, ticketId);
  const workerRunner = workerRunnerIdFromTicket(workerTicket);
  if (outcome === "revise") {
    markWorkerTicketRevisionRequested(workerTicket, ticketId, decisionReason, stringValue(record.log_path));
  } else {
    markWorkerTicketReplanRequested(workerTicket, ticketId, decisionReason, stringValue(record.log_path));
  }
  if (original) {
    try { fs.unlinkSync(ticket); } catch {}
  }
  const decisionContextReset = emitRunnerContextReset(runnerId, `verifier.${command}`, "compact", {
    tool: `verifier.${command}`,
    ticket_id: `TODO-${ticketId}`,
    decision: outcome,
  });
  ok({
    tool: `verifier.${command}`,
    runner: runnerId,
    assignment: compactAssignment(assignment),
    ticket_id: `TODO-${ticketId}`,
    verifier_ticket: boardRel(ticket),
    worker_ticket: boardRel(workerTicket),
    worker_runner: workerRunner,
    decision: outcome,
    log_path: stringValue(record.log_path),
    marker_path: stringValue(record.marker_path),
    removed_verifier_ticket: !fs.existsSync(ticket),
    context_reset: decisionContextReset.ok ? "queued" : "not_queued",
    context_reset_path: stringValue(decisionContextReset.path),
    next_action: outcome === "revise"
      ? "Worker must keep the same worktree, apply corrections, rerun local verification, and run worker submit-to-verifier again."
      : "Worker must run worker request-replan so the worktree is cleaned up and this work item returns to the pending work lane for a fresh worker attempt.",
  });
}
