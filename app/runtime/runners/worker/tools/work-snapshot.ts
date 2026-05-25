import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type WorkerWorkItem = WorkerTicketItem & {
  conflicts: shared.ConflictInfo[];
  claimable: boolean;
  blocked_reason: string;
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
  readRoleAssignment,
  assignmentMatchesItem,
  compactAssignment,
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
  conversationHandoffLinksForPrdKey,
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

function compactWorkerSource(item: WorkerWorkItem): JsonObject {
  const handoffLinks = conversationHandoffLinksForPrdKey(item.prd_key || "", 4);
  return {
    path: item.path,
    id: item.id,
    prd_key: item.prd_key || "",
    title: item.title,
    stage: item.stage || "",
    claimed_by: item.claimed_by || "",
    execution_ai: item.execution_ai || "",
    worktree_path: item.worktree_path || "",
    worktree_status: item.worktree_status || "",
    allowed_paths: item.allowed_paths || [],
    conflict_warnings: item.conflicts || [],
    claimable: item.claimable,
    blocked_reason: item.blocked_reason,
    handoff_links: handoffLinks,
    handoff_link_count: handoffLinks.length,
  };
}

function includeActionableFirst(items: WorkerWorkItem[], actionable: WorkerWorkItem | undefined, maxItems: number): WorkerWorkItem[] {
  if (!actionable) return items.slice(0, maxItems);
  const head = items.slice(0, maxItems);
  if (head.some((item) => item.path === actionable.path)) return head;
  return [actionable, ...head.filter((item) => item.path !== actionable.path).slice(0, Math.max(0, maxItems - 1))];
}

function readGoalRuntimeScalar(item: WorkerWorkItem, field: string): string {
  const ticket = resolveBoardPath(item.path);
  return ticket ? utils.extractScalarFieldInSection(ticket, "Goal Runtime", field) : "";
}

function looksPlannerRewriteBlocked(item: WorkerWorkItem): boolean {
  if (!item.claimable) return false;
  const replanDecision = readGoalRuntimeScalar(item, "Replan Decision").toLowerCase();
  const replanCount = numberValue(readGoalRuntimeScalar(item, "Replan Count"));
  if (replanCount <= 0 || !["replan", "needs_user"].includes(replanDecision)) return false;

  const ticket = resolveBoardPath(item.path);
  const text = ticket ? utils.readFileSafe(ticket) : "";
  if (!text) return false;
  return /spec-level structural blocker|structural blocker|구조적 차단|Planner (?:option|가|권장)|worker(?:가)? .*해소 불가|Worker cannot resolve/i.test(text);
}

function followupClaimableWorkItems(items: WorkerWorkItem[]): WorkerWorkItem[] {
  const preferred = items.filter((item) => item.claimable && !looksPlannerRewriteBlocked(item));
  return preferred.length > 0 ? preferred : items.filter((item) => item.claimable);
}

export function cmdWorkerWorkSnapshot(): void {
  const runnerId = currentRunnerId("worker");
  const assignmentCheck = readRoleAssignment("worker", runnerId);
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const inprogress = listWorkerTicketItems("inprogress");
  const verifier = listWorkerTicketItems("verifier");
  const activeOwned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const verifierOwned = verifier.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const activeOwnedCount = activeOwned.length + verifierOwned.length;
  const assignmentIsScoped = Boolean(assignmentCheck.assignment);
  const workItems: WorkerWorkItem[] = listWorkerTicketItems("todo").map((item) => {
    const conflicts = pathConflictGuardEnabled()
      ? collectTicketConflicts(resolveBoardPath(item.path), inprogress, runnerId)
      : [];
    const missingAllowedPaths = item.allowed_paths.length === 0;
    const assignedToThisRunner = assignmentCheck.ok && (!assignmentIsScoped || assignmentMatchesItem(assignmentCheck.assignment, item.path));
    return {
      ...item,
      conflicts,
      claimable: activeOwnedCount === 0 && !missingAllowedPaths && assignedToThisRunner,
      blocked_reason:
        activeOwnedCount > 0 ? "runner_has_active_ticket" :
        !assignmentCheck.ok ? assignmentCheck.reason :
        assignmentIsScoped && !assignedToThisRunner ? "assignment_item_mismatch" :
        missingAllowedPaths ? "allowed_paths_missing" :
        "",
    };
  });
  workItems.sort(workerTicketSort);
  const claimableWorkItems = followupClaimableWorkItems(workItems);
  const assignedWorkItems = assignmentCheck.ok && assignmentIsScoped
    ? workItems.filter((item) => assignmentMatchesItem(assignmentCheck.assignment, item.path))
    : assignmentCheck.ok
      ? workItems
    : [];
  const actionable = assignmentCheck.ok
    ? ((claimableWorkItems.length > 0
        ? claimableWorkItems[0]
        : undefined) ||
      assignedWorkItems[0] ||
      workItems.find((item) => item.blocked_reason !== "assignment_item_mismatch"))
    : undefined;
  const visibleWorkItems = includeActionableFirst(workItems, actionable, maxItems);
  const scopedSources = actionable ? [compactWorkerSource(actionable)] : [];
  ok({
    tool: "worker.work-snapshot",
    runner: runnerId,
    assignment_required: Boolean(assignmentCheck.assignment),
    assignment_status: assignmentCheck.ok
      ? (assignmentCheck.assignment ? "active" : "fixed_runner")
      : assignmentCheck.reason,
    assignment: compactAssignment(assignmentCheck.assignment),
    generated_at: utils.nowIso(),
    active_owned_count: activeOwnedCount,
    inprogress_owned_count: activeOwned.length,
    verifier_owned_count: verifierOwned.length,
    work_item_count_total: workItems.length,
    work_item_count: visibleWorkItems.length,
    work_items_truncated: workItems.length > visibleWorkItems.length,
    work_items: visibleWorkItems,
    ai_followup_recommended: Boolean(actionable),
    ai_followup_reason: actionable
      ? (actionable.claimable ? "worker_work_claimable" : actionable.blocked_reason || "worker_work_blocked")
      : assignmentCheck.reason || "no_actionable_ticket",
    ai_followup_scope: {
      inspect_only_recent_sources: scopedSources,
      max_files_to_open: scopedSourceFileCount(scopedSources),
      max_tickets_to_edit: actionable ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
