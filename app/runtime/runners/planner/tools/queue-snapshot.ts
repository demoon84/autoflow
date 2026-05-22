import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type PlannerQueueItem = QueueItem & {
  branch?: string;
};

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
  conversationHandoffLinksForBoardPath,
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
  scopedSourceFileCount,
  ok,
  fail
} = shared;

function compactPlannerSource(item: PlannerQueueItem): JsonObject {
  const absolutePath = resolveBoardPath(item.path);
  const blockedReason = utils.extractScalarFieldInSection(absolutePath, "Project", "Blocked Reason") || "";
  const handoffLinks = conversationHandoffLinksForBoardPath(item.path, 4);
  return {
    path: item.path,
    kind: item.kind,
    id: item.id,
    priority: item.priority,
    title: item.title,
    status: item.status || "",
    blocked_reason: blockedReason,
    stage: item.stage || "",
    branch: item.branch || "",
    handoff_links: handoffLinks,
    handoff_link_count: handoffLinks.length,
  };
}

function plannerQueueItemIsActionable(item: PlannerQueueItem): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  return !["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status);
}

function planSelectionRank(item: PlannerQueueItem): number {
  if (item.kind === "prd") return 1;
  if (item.kind === "todo") return 2;
  if (item.kind === "inprogress") return 3;
  return 9;
}

function plannerFollowupReason(item: PlannerQueueItem): string {
  const status = String(item.status || "").trim().toLowerCase();
  return status === "blocked"
    ? `planner_${item.kind}_blocked_review`
    : `planner_${item.kind}_pending`;
}

export function cmdPlannerQueueSnapshot(): void {
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const items: PlannerQueueItem[] = [];
  items.push(...listQueueItems("prd", [/^PRD[-_].+\.md$/i], "prd").filter(plannerQueueItemIsActionable));
  items.push(...listQueueItems("todo", [/^TODO-\d+\.md$/], "todo"));
  items.push(...listQueueItems("inprogress", [/^TODO-\d+\.md$/], "inprogress"));

  items.sort((a, b) => {
    // Critical (rank 0) preempts everything else regardless of kind: that is
    // reserved for board-integrity / host-resource / security emergencies.
    if (a.priority_rank === 0 && b.priority_rank !== 0) return -1;
    if (b.priority_rank === 0 && a.priority_rank !== 0) return 1;

    const ar = planSelectionRank(a);
    const br = planSelectionRank(b);
    if (ar !== br) return ar - br;

    // Within the same kind, the original priority + FIFO order applies.
    if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
    const ai = Number.parseInt(a.id || "999999", 10);
    const bi = Number.parseInt(b.id || "999999", 10);
    if (ai !== bi) return ai - bi;
    return a.path.localeCompare(b.path);
  });

  const visibleItems = items.slice(0, maxItems);
  const actionable = items.find(plannerQueueItemIsActionable);
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
      max_files_to_open: scopedSourceFileCount(scopedSources),
      max_board_items_to_edit: actionable ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
