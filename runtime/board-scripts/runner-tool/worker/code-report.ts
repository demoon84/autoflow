import * as shared from "../shared";

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
  currentRunnerId,
  boardRel,
  stringValue,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail
} = shared;

export function cmdWorkerCodeReport(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const runnerId = currentRunnerId("worker");
  const ticketId = `Todo-${idFromPath(ticket)}`;
  const stats = diffStats(ticket);
  const markerDir = path.join(BOARD_ROOT, "runners", "state", "code-metrics", safeSegment(runnerId));
  const markerPath = path.join(markerDir, `${safeSegment(ticketId)}.json`);
  fs.mkdirSync(markerDir, { recursive: true });

  if (fs.existsSync(markerPath)) {
    ok({
      tool: "worker.code-report",
      path: boardRel(ticket),
      runner: runnerId,
      ticket_id: ticketId,
      counted: false,
      marker_path: boardRel(markerPath),
      ...stats,
    });
    return;
  }

  const state = utils.readRunnerState(runnerId, BOARD_ROOT);
  const current = (key: string): number => {
    const parsed = Number.parseInt(state.get(key) || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const files = numberValue(stats.code_files_changed_count);
  const insertions = numberValue(stats.code_insertions_count);
  const deletions = numberValue(stats.code_deletions_count);
  const volume = numberValue(stats.code_volume_count);
  const net = numberValue(stats.code_net_delta_count);
  const reportedAt = utils.nowIso();

  utils.updateRunnerState(runnerId, {
    cumulative_code_files_changed: current("cumulative_code_files_changed") + files,
    cumulative_code_insertions: current("cumulative_code_insertions") + insertions,
    cumulative_code_deletions: current("cumulative_code_deletions") + deletions,
    cumulative_code_volume: current("cumulative_code_volume") + volume,
    cumulative_code_net_delta: current("cumulative_code_net_delta") + net,
    last_code_ticket_id: ticketId,
    last_code_files_changed: files,
    last_code_insertions: insertions,
    last_code_deletions: deletions,
    last_code_volume: volume,
    last_code_net_delta: net,
    last_code_reported_at: reportedAt,
    code_source: "worker_diff_report",
  }, BOARD_ROOT);

  fs.writeFileSync(markerPath, JSON.stringify({
    ticket_id: ticketId,
    runner: runnerId,
    reported_at: reportedAt,
    ...stats,
  }, null, 2) + "\n", "utf8");

  ok({
    tool: "worker.code-report",
    path: boardRel(ticket),
    runner: runnerId,
    ticket_id: ticketId,
    counted: true,
    marker_path: boardRel(markerPath),
    ...stats,
  });
}
