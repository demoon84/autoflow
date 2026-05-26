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
  worktreeStatusIsSetupBlocker,
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

export function cmdWorkerWorktreeEnsure(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier"]);
  const previousStage = utils.extractScalarFieldInSection(ticket, "Ticket", "Stage");
  const previousWorktreeStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status");
  const result = ensureWorkerTicketWorktree(ticket);
  if (
    isReadyWorktree(result) &&
    String(previousStage || "").toLowerCase() === "blocked" &&
    worktreeStatusIsSetupBlocker(previousWorktreeStatus)
  ) {
    utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", "executing");
    utils.replaceScalarFieldInSection(ticket, "Goal Runtime", "Status", "active");
    replaceSectionBlock(ticket, "Next Action", "- 다음 즉시 작업: 준비된 worktree의 Allowed Paths 안에서 구현을 계속한다.");
  } else if (!isReadyWorktree(result) && worktreeStatusIsSetupBlocker(String(result.worktree_status || previousWorktreeStatus || ""))) {
    utils.appendNote(
      ticket,
      `Worker worktree-ensure still blocked at ${utils.nowIso()}: reason=worktree_setup_still_blocked status=${String(result.worktree_status || "")}`
    );
  }
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", utils.nowIso());
  ok({ tool: "worker.worktree-ensure", path: boardRel(ticket), ...result });
}
