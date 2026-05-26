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
  requireRoleAssignmentForItem,
  completeRoleAssignment,
  compactAssignment,
  findTicketById,
  workerRunnerIdFromTicket,
  markWorkerTicketVerified,
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
  emitRunnerContextReset,
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
  getArg,
  getArgs,
  hasFlag,
  positiveInt,
  numberValue,
  safeSegment,
  currentRunnerId,
  boardRel,
  stringValue,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail
} = shared;

type WorkerCompletionCommand = "finalize-approved" | "request-replan";

function verifierMarkerForTicket(ticketId: string): string {
  return path.join(BOARD_ROOT, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

function verifierRequired(): boolean {
  if ((process.env.AUTOFLOW_VERIFIER_ENABLED || "0") !== "1") return false;
  if ((process.env.AUTOFLOW_SKIP_VERIFIER || "0") === "1") return false;
  return true;
}

export function cmdWorkerComplete(command: WorkerCompletionCommand): void {
  const backendOutcome = command === "request-replan" ? "replan" : "pass";
  const ticket = requireTicket(["inprogress"]);
  const assignment = requireRoleAssignmentForItem("worker", ticket, currentRunnerId("worker"));
  const message = backendOutcome === "pass" ? getArg("--summary") : getArg("--reason");
  if (!message) fail(2, `worker ${command} requires --${backendOutcome === "pass" ? "summary" : "reason"}`);
  const ticketId = idFromPath(ticket);
  const verifierMarker = verifierMarkerForTicket(ticketId);
  const hasVerifierApproval = fs.existsSync(verifierMarker);
  const verifierActive = verifierRequired();

  if (command === "finalize-approved" && verifierActive && !hasVerifierApproval) {
    fail(2, "legacy approval marker is missing; finalize-approved cannot continue while legacy approval is required", {
      ticket_id: `TODO-${ticketId}`,
      expected_marker: boardRel(verifierMarker),
    });
  }

  const finishTs = path.join(SCRIPT_DIR, "worker", "finish-ticket", "index.ts");
  const finishEnv = {
    ...process.env,
    PROJECT_ROOT,
    AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
    BOARD_ROOT,
    AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
    AUTOFLOW_ROLE: "worker",
    AUTOFLOW_WORKER_ID: currentRunnerId("worker"),
  };
  const result = spawnTsScript(finishTs, [boardRel(ticket), backendOutcome, message], finishEnv);
  const stdout = spawnOutputText(result.stdout);
  const stderr = spawnOutputText(result.stderr);
  const parsed = parseKeyValueOutput(stdout);
  const backendStatus = stringValue(parsed.status);
  const outputPath = stringValue(parsed.ticket) || stringValue(parsed.verifier_ticket) || boardRel(ticket);
  const finalBoundaryStatuses = new Set(["done", "replanned"]);
  const completedAssignment = result.status === 0 && finalBoundaryStatuses.has(backendStatus)
    ? completeRoleAssignment(
        assignment,
        `worker ${command} finished with ${backendStatus}`,
        backendStatus === "replanned" ? "released" : "completed"
      )
    : assignment;
  const contextResetMode = "compact";
  const contextReset = result.status === 0 && finalBoundaryStatuses.has(backendStatus)
    ? emitRunnerContextReset(currentRunnerId("worker"), `worker.${command}`, contextResetMode, {
        tool: `worker.${command}`,
        ticket_id: `TODO-${ticketId}`,
        backend_status: backendStatus,
      next_scan: "after context compact, run worker.active-get; if no owned ticket, run worker.work-snapshot before idling",
      })
    : { ok: false, path: "" };
  ok({
    status: backendStatus || (result.status === 0 ? "ok" : "error"),
    tool: `worker.${command}`,
    path: outputPath,
    backend: `runners/worker/finish-ticket/index.ts ${backendOutcome}`,
    exit_code: result.status ?? 1,
    backend_status: backendStatus,
    backend_commit_status: stringValue(parsed.commit_status),
    backend_next_action: stringValue(parsed.next_action),
    assignment: compactAssignment(completedAssignment),
    assignment_lifecycle: completedAssignment.status !== assignment.status ? completedAssignment.status : "unchanged",
    context_reset: contextReset.ok ? "queued" : "not_queued",
    context_reset_path: contextReset.path,
    parsed,
    stdout,
    stderr,
  });
  process.exit(result.status === 0 ? 0 : 1);
}
