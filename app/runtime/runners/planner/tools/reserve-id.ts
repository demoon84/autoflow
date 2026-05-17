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

export function cmdPlannerReserveId(): void {
  const kind = getArg("--kind") || getArg("-k");
  if (!kind || !["prd", "ticket", "order"].includes(kind)) {
    fail(2, "reserve-id requires --kind prd|ticket|order");
  }
  const ttlSec = positiveInt(getArg("--ttl-sec") || "", 3600);
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  fs.mkdirSync(reservationsDir, { recursive: true });
  pruneReservations(reservationsDir, ttlSec);

  const used = collectUsedIds(kind);
  let maxUsed = 0;
  for (const value of used) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > maxUsed) maxUsed = parsed;
  }
  for (let i = maxUsed + 1; i < 1000000; i += 1) {
    const id = String(i).padStart(3, "0");
    if (used.has(id)) continue;
    const token = `${Date.now()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    const reservationPath = path.join(reservationsDir, `${kind}_${id}_${token}.json`);
    try {
      fs.writeFileSync(
        reservationPath,
        JSON.stringify({ kind, id, token, created_at: utils.nowIso(), runner: currentRunnerId() }, null, 2) + "\n",
        { encoding: "utf8", flag: "wx" }
      );
      ok({
        tool: "planner.reserve-id",
        kind,
        id,
        reservation: boardRel(reservationPath),
        reservation_abs: reservationPath,
      });
      return;
    } catch {
      used.add(id);
    }
  }
  fail(1, `no ${kind} id available`);
}
