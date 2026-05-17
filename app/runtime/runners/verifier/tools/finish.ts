import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type WakeEmitResult = shared.WakeEmitResult;

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
  emitRunnerWake,
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
  setRecoveryField,
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
  getArg,
  getArgs,
  hasFlag,
  positiveInt,
  numberValue,
  safeSegment,
  boardRel,
  stringValue,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail
} = shared;

type VerifierDecision = shared.VerifierDecision;
type VerifierCompletionCommand = "approve-merge" | "request-revision" | "request-replan";

function commandForOutcome(outcome: VerifierDecision): VerifierCompletionCommand {
  if (outcome === "pass") return "approve-merge";
  if (outcome === "revise") return "request-revision";
  return "request-replan";
}

export function cmdVerifierComplete(outcome: VerifierDecision): void {
  const ticket = requireTicket(["verifier"]);
  const message = outcome === "pass" ? getArg("--summary") : getArg("--reason");
  const command = commandForOutcome(outcome);
  if (!message) fail(2, `verifier ${command} requires --${outcome === "pass" ? "summary" : "reason"}`);
  const decisionReason = message;
  const ticketId = idFromPath(ticket);
  const original = findTicketById(["inprogress"], ticketId);
  if (!original) {
    fail(1, `original inprogress ticket not found for verifier ${outcome}`, {
      ticket_id: `Todo-${ticketId}`,
      verifier_ticket: boardRel(ticket),
    });
  }

  if (outcome === "pass") {
    const record = recordVerifierDecision(ticket, outcome, decisionReason, true);
    const workerRunner = workerRunnerIdFromTicket(original);
    markWorkerTicketVerified(original, ticketId, decisionReason, stringValue(record.log_path), stringValue(record.marker_path));
    try { fs.unlinkSync(ticket); } catch {}
    const wake = emitRunnerWake(workerRunner, `tickets/inprogress/Todo-${ticketId}.md`, "verifier.pass.worker-wake");
    ok({
      tool: `verifier.${command}`,
      ticket_id: `Todo-${ticketId}`,
      verifier_ticket: boardRel(ticket),
      worker_ticket: boardRel(original),
      worker_runner: workerRunner,
      decision: outcome,
      log_path: stringValue(record.log_path),
      marker_path: stringValue(record.marker_path),
      removed_verifier_ticket: !fs.existsSync(ticket),
      worker_wake: wake.ok ? "emitted" : "failed",
      worker_wake_exit_code: wake.status,
      context_reset: "not_queued",
      context_reset_path: "",
      next_action: "Worker must merge the verifier-approved worktree into PROJECT_ROOT, rerun verification from PROJECT_ROOT, then call worker finalize-approved.",
    });
    return;
  }

  const record = recordVerifierDecision(ticket, outcome, decisionReason, false);
  const workerRunner = workerRunnerIdFromTicket(original);
  if (outcome === "revise") {
    markWorkerTicketRevisionRequested(original, ticketId, decisionReason, stringValue(record.log_path));
  } else {
    markWorkerTicketReplanRequested(original, ticketId, decisionReason, stringValue(record.log_path));
  }
  try { fs.unlinkSync(ticket); } catch {}
  const wake = emitRunnerWake(workerRunner, `tickets/inprogress/Todo-${ticketId}.md`, `verifier.${outcome}.worker-wake`);
  ok({
    tool: `verifier.${command}`,
    ticket_id: `Todo-${ticketId}`,
    verifier_ticket: boardRel(ticket),
    worker_ticket: boardRel(original),
    worker_runner: workerRunner,
    decision: outcome,
    log_path: stringValue(record.log_path),
    marker_path: stringValue(record.marker_path),
    removed_verifier_ticket: !fs.existsSync(ticket),
    worker_wake: wake.ok ? "emitted" : "failed",
    worker_wake_exit_code: wake.status,
    context_reset: "not_queued",
    context_reset_path: "",
    next_action: outcome === "revise"
      ? "Worker must keep the same worktree, apply corrections, rerun local verification, and run worker submit-to-verifier again."
      : "Worker must run worker create-retry-order so the retry order is created, the worktree is deleted, and the planner runner can create the follow-up TODO.",
  });
}
