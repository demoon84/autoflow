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

function compactWorkerSource(item: WorkerTicketItem): JsonObject {
  return {
    path: item.path,
    id: item.id,
    priority: item.priority,
    title: item.title,
    stage: item.stage || "",
    claimed_by: item.claimed_by || "",
    execution_ai: item.execution_ai || "",
    worktree_path: item.worktree_path || "",
    worktree_status: item.worktree_status || "",
    semantic_decision: item.semantic_decision || "",
    semantic_reason: item.semantic_reason || "",
    semantic_checked_at: item.semantic_checked_at || "",
    semantic_log: item.semantic_log || "",
    allowed_paths: item.allowed_paths || [],
  };
}

function workerFollowupReason(active?: WorkerTicketItem): string {
  if (!active) return "no_owned_inprogress_ticket";
  const stage = (active.stage || "").toLowerCase();
  const decision = (active.semantic_decision || "").toLowerCase();
  if (decision === "revise" || stage.includes("revision_requested")) return "verifier_revision_requested";
  if (decision === "replan" || stage.includes("replan_requested")) return "verifier_replan_requested";
  if (decision === "pass" || stage.includes("verified_pending_merge")) return "verifier_passed_merge_pending";
  if (stage === "verify_pending") return "worker_ticket_waiting_for_verifier";
  return "worker_owned_ticket_pending";
}

export function cmdWorkerActiveGet(): void {
  const runnerId = currentRunnerId("worker");
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const inprogress = listWorkerTicketItems("inprogress");
  const owned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const visibleOwned = owned.slice(0, maxItems);
  const visibleInprogress = inprogress.slice(0, maxItems);
  const active = visibleOwned[0];
  const scopedSources = active ? [compactWorkerSource(active)] : [];
  ok({
    tool: "worker.active-get",
    runner: runnerId,
    generated_at: utils.nowIso(),
    owned_count_total: owned.length,
    owned_count: visibleOwned.length,
    owned_truncated: owned.length > visibleOwned.length,
    owned: visibleOwned,
    inprogress_count_total: inprogress.length,
    inprogress_count: visibleInprogress.length,
    inprogress_truncated: inprogress.length > visibleInprogress.length,
    inprogress: visibleInprogress,
    ai_followup_recommended: Boolean(active),
    ai_followup_reason: workerFollowupReason(active),
    ai_followup_scope: {
      inspect_only_recent_sources: scopedSources,
      max_files_to_open: scopedSources.length,
      max_tickets_to_edit: active ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
