import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type AssignmentRecord = shared.AssignmentRecord;
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
  normalizePrdKey,
  readRoleAssignment,
  assignmentMatchesItem,
  startAssignmentIfLeased,
  completeRoleAssignment,
  compactAssignment,
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

function prdKeyFromAssignment(record: AssignmentRecord | null): string {
  if (!record) return "";
  return normalizePrdKey(record.assigned_item_ref || path.basename(record.assigned_item_ref || ""));
}

function workItemPrdKey(file: string): string {
  return normalizePrdKey(
    utils.extractScalarFieldInSection(file, "Work Item", "PRD Key") ||
    utils.extractScalarFieldInSection(file, "Ticket", "PRD Key") ||
    utils.extractScalarFieldInSection(file, "Project", "PRD Key")
  );
}

function findWorkItemsForPrdKey(prdKey: string): string[] {
  if (!prdKey) return [];
  const pattern = /^(?:TODO|WORK)-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i;
  const roots = [
    ["todo", 2],
    ["inprogress", 2],
    ["verifier", 2],
    ["done", 5],
  ] as const;
  const files = roots.flatMap(([dir, depth]) => collectFiles(path.join(TICKETS_ROOT, dir), pattern, depth));
  return unique(files)
    .filter((file) => workItemPrdKey(file) === prdKey)
    .sort();
}

function compactGeneratedWorkItems(files: string[]): JsonObject[] {
  return files.map((file) => {
    const text = readOptionalTextFile(file);
    return {
      path: boardRel(file),
      id: idFromPath(file),
      title: readTitle(file, text) || path.basename(file),
    };
  });
}

function plannerCompletionCandidate(record: AssignmentRecord | null): { shouldComplete: boolean; prdKey: string; workItems: string[] } {
  const prdKey = prdKeyFromAssignment(record);
  if (!record || !prdKey) return { shouldComplete: false, prdKey, workItems: [] };
  const activePrd = path.join(TICKETS_ROOT, "prd", `${prdKey}.md`);
  if (safeIsFile(activePrd)) return { shouldComplete: false, prdKey, workItems: [] };
  const workItems = findWorkItemsForPrdKey(prdKey);
  return { shouldComplete: workItems.length > 0, prdKey, workItems };
}

export function cmdPlannerQueueSnapshot(): void {
  const runnerId = currentRunnerId("planner");
  const assignmentCheck = readRoleAssignment("planner", runnerId);
  let assignment = assignmentCheck.assignment;
  const assignmentWasLeased = assignmentCheck.ok && assignment?.status === "leased";
  if (assignmentCheck.ok && assignment) {
    assignment = startAssignmentIfLeased(assignment);
  }
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const items: PlannerQueueItem[] = [];
  items.push(...listQueueItems("prd", [/^PRD[-_].+\.md$/i], "prd").filter(plannerQueueItemIsActionable));
  items.push(...listQueueItems("todo", [/^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/], "todo"));
  items.push(...listQueueItems("inprogress", [/^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/], "inprogress"));

  items.sort((a, b) => {
    const ar = planSelectionRank(a);
    const br = planSelectionRank(b);
    if (ar !== br) return ar - br;

    const ai = Number.parseInt(a.id || "999999", 10);
    const bi = Number.parseInt(b.id || "999999", 10);
    if (ai !== bi) return ai - bi;
    return a.path.localeCompare(b.path);
  });

  const visibleItems = items.slice(0, maxItems);
  const assignmentIsScoped = Boolean(assignment);
  const assignedItems = assignmentCheck.ok && assignmentIsScoped
    ? items.filter((item) => assignmentMatchesItem(assignment, item.path))
    : assignmentCheck.ok
      ? items
    : [];
  const actionable = assignedItems.find(plannerQueueItemIsActionable);
  const scopedSources = actionable ? [compactPlannerSource(actionable)] : [];
  let assignmentStatus = assignmentCheck.ok ? (assignmentIsScoped ? "active" : "fixed_runner") : assignmentCheck.reason;
  let followupReason = actionable ? plannerFollowupReason(actionable) : assignmentCheck.reason || "no_actionable_plan_input";
  let generatedWorkItems: JsonObject[] = [];
  let assignmentLifecycle = assignmentWasLeased ? "started" : "unchanged";

  if (assignmentCheck.ok && assignment && !actionable) {
    const completion = plannerCompletionCandidate(assignment);
    if (completion.shouldComplete) {
      generatedWorkItems = compactGeneratedWorkItems(completion.workItems);
      const result = `planner completed ${completion.prdKey}; generated_work_items=${completion.workItems.length}: ${generatedWorkItems
        .map((item) => String(item.path || ""))
        .slice(0, 8)
        .join(", ")}`;
      assignment = completeRoleAssignment(assignment, result, "completed");
      assignmentStatus = "completed";
      followupReason = "planner_assignment_completed";
      assignmentLifecycle = "completed";
    }
  }

  ok({
    tool: "planner.queue-snapshot",
    runner: runnerId,
    assignment_required: assignmentIsScoped,
    assignment_status: assignmentStatus,
    assignment_lifecycle: assignmentLifecycle,
    assignment: compactAssignment(assignment),
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    generated_at: utils.nowIso(),
    item_count_total: items.length,
    item_count: visibleItems.length,
    items_truncated: items.length > visibleItems.length,
    items: visibleItems,
    ai_followup_recommended: Boolean(actionable),
    ai_followup_reason: followupReason,
    generated_work_items: generatedWorkItems,
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
