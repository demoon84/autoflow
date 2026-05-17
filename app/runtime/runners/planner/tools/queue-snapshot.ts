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

function compactPlannerSource(item: QueueItem): JsonObject {
  const absolutePath = resolveBoardPath(item.path);
  const blockedReason = utils.extractScalarFieldInSection(absolutePath, "Order", "Blocked Reason") ||
    utils.extractScalarFieldInSection(absolutePath, "Project", "Blocked Reason") ||
    "";
  const isOrdinaryOrder = item.kind === "order" && !item.retry;
  return {
    path: item.path,
    kind: item.kind,
    id: item.id,
    priority: item.priority,
    title: item.title,
    status: item.status || "",
    blocked_reason: blockedReason,
    intake_mode: isOrdinaryOrder ? "prd_first" : "",
    recommended_next_step: isOrdinaryOrder ? "generate_prd_from_order" : "",
    stage: item.stage || "",
    retry: Boolean(item.retry),
    express: Boolean(item.express),
    recovery_status: item.recovery_status || "",
    failure_class: item.failure_class || "",
  };
}

function plannerQueueItemIsActionable(item: QueueItem): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  return !["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status);
}

function plannerFollowupReason(item: QueueItem): string {
  const status = String(item.status || "").trim().toLowerCase();
  if (item.kind === "order" && !item.retry) {
    return status === "blocked" || status === "needs-info" || status === "needs_user" || status === "needs-user"
      ? "planner_order_prd_intake"
      : "planner_order_pending";
  }
  return status === "blocked"
    ? `planner_${item.kind}_blocked_review`
    : `planner_${item.kind}_pending`;
}

export function cmdPlannerQueueSnapshot(): void {
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const items: QueueItem[] = [];
  items.push(...listQueueItems("order", [/^order_.*\.md$/], "order").filter(plannerQueueItemIsActionable));
  items.push(...listQueueItems("prd", [/^(prd|project)_\d+\.md$/], "prd").filter(plannerQueueItemIsActionable));
  items.push(...listQueueItems("todo", [/^(Todo-\d+|tickets_\d+)\.md$/], "todo"));
  items.push(...listQueueItems("inprogress", [/^(Todo-\d+|tickets_\d+)\.md$/], "inprogress"));

  items.sort((a, b) => {
    if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
    const ai = Number.parseInt(a.id || "999999", 10);
    const bi = Number.parseInt(b.id || "999999", 10);
    if (ai !== bi) return ai - bi;
    return a.path.localeCompare(b.path);
  });

  const visibleItems = items.slice(0, maxItems);
  const actionable = visibleItems[0];
  const scopedSources = actionable ? [compactPlannerSource(actionable)] : [];

  ok({
    tool: "planner.queue-snapshot",
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    generated_at: utils.nowIso(),
    item_count_total: items.length,
    item_count: visibleItems.length,
    items_truncated: items.length > visibleItems.length,
    items: visibleItems,
    ai_followup_recommended: Boolean(actionable),
    ai_followup_reason: actionable ? plannerFollowupReason(actionable) : "no_actionable_plan_input",
    ai_followup_scope: {
      inspect_only_recent_sources: scopedSources,
      max_files_to_open: scopedSources.length,
      max_board_items_to_edit: actionable ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
