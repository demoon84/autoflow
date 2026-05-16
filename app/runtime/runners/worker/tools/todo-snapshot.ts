import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type WakeEmitResult = shared.WakeEmitResult;
type WorkerTodoItem = WorkerTicketItem & {
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

function compactWorkerSource(item: WorkerTodoItem): JsonObject {
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
    allowed_paths: item.allowed_paths || [],
    claimable: item.claimable,
    blocked_reason: item.blocked_reason,
  };
}

function includeActionableFirst(items: WorkerTodoItem[], actionable: WorkerTodoItem | undefined, maxItems: number): WorkerTodoItem[] {
  if (!actionable) return items.slice(0, maxItems);
  const head = items.slice(0, maxItems);
  if (head.some((item) => item.path === actionable.path)) return head;
  return [actionable, ...head.filter((item) => item.path !== actionable.path).slice(0, Math.max(0, maxItems - 1))];
}

export function cmdWorkerTodoSnapshot(): void {
  const runnerId = currentRunnerId("worker");
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const inprogress = listWorkerTicketItems("inprogress");
  const activeOwned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const todos: WorkerTodoItem[] = listWorkerTicketItems("todo").map((item) => {
    const conflicts = pathConflictGuardEnabled()
      ? collectTicketConflicts(resolveBoardPath(item.path), inprogress, runnerId)
      : [];
    return {
      ...item,
      conflicts,
      claimable: activeOwned.length === 0 && conflicts.length === 0,
      blocked_reason:
        activeOwned.length > 0 ? "runner_has_active_ticket" :
        conflicts.length > 0 ? "allowed_path_conflict" :
        "",
    };
  });
  todos.sort(workerTicketSort);
  const actionable =
    todos.find((item) => item.claimable) ||
    todos.find((item) => item.blocked_reason !== "");
  const visibleTodos = includeActionableFirst(todos, actionable, maxItems);
  const scopedSources = actionable ? [compactWorkerSource(actionable)] : [];
  ok({
    tool: "worker.todo-snapshot",
    runner: runnerId,
    generated_at: utils.nowIso(),
    active_owned_count: activeOwned.length,
    todo_count_total: todos.length,
    todo_count: visibleTodos.length,
    todos_truncated: todos.length > visibleTodos.length,
    todos: visibleTodos,
    ai_followup_recommended: Boolean(actionable),
    ai_followup_reason: actionable
      ? (actionable.claimable ? "worker_todo_claimable" : actionable.blocked_reason || "worker_todo_blocked")
      : "no_actionable_ticket",
    ai_followup_scope: {
      inspect_only_recent_sources: scopedSources,
      max_files_to_open: scopedSources.length,
      max_tickets_to_edit: actionable ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
