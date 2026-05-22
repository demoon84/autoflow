import * as shared from "../../../shared/runner-tool";

type JsonObject = shared.JsonObject;
type QueueItem = shared.QueueItem;
type WorkerTicketItem = shared.WorkerTicketItem;
type VerifierTicketItem = WorkerTicketItem & { verify_pending: boolean };

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

function verifierFifoSort(a: VerifierTicketItem, b: VerifierTicketItem): number {
  if (a.verify_pending !== b.verify_pending) return a.verify_pending ? -1 : 1;
  const at = a.submitted_to_verifier_at || "";
  const bt = b.submitted_to_verifier_at || "";
  if (at && bt && at !== bt) return at < bt ? -1 : 1;
  if (at && !bt) return -1;
  if (!at && bt) return 1;
  const ai = Number.parseInt(a.id || "999999", 10);
  const bi = Number.parseInt(b.id || "999999", 10);
  if (ai !== bi) return ai - bi;
  return a.path.localeCompare(b.path);
}

function compactVerifierSource(item: VerifierTicketItem): JsonObject {
  const handoffLinks = conversationHandoffLinksForPrdKey(item.prd_key || "", 4);
  return {
    path: item.path,
    id: item.id,
    prd_key: item.prd_key || "",
    priority: item.priority,
    title: item.title,
    stage: item.stage || "",
    claimed_by: item.claimed_by || "",
    execution_ai: item.execution_ai || "",
    worktree_path: item.worktree_path || "",
    worktree_status: item.worktree_status || "",
    allowed_paths: item.allowed_paths || [],
    verify_pending: item.verify_pending,
    submitted_to_verifier_at: item.submitted_to_verifier_at || "",
    handoff_links: handoffLinks,
    handoff_link_count: handoffLinks.length,
  };
}

export function cmdVerifierQueueSnapshot(): void {
  const runnerId = currentRunnerId("verifier");
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const tickets: VerifierTicketItem[] = listWorkerTicketItems("verifier").map((item) => ({
    ...item,
    verify_pending: item.stage === "verify_pending" || item.stage === "",
  }));
  tickets.sort(verifierFifoSort);
  const actionable = tickets.find((item) => item.verify_pending) || tickets[0];
  const visibleTickets = actionable && !tickets.slice(0, maxItems).some((item) => item.path === actionable.path)
    ? [actionable, ...tickets.filter((item) => item.path !== actionable.path).slice(0, Math.max(0, maxItems - 1))]
    : tickets.slice(0, maxItems);
  const scopedSources = actionable ? [compactVerifierSource(actionable)] : [];
  ok({
    tool: "verifier.queue-snapshot",
    runner: runnerId,
    generated_at: utils.nowIso(),
    ticket_count_total: tickets.length,
    ticket_count: visibleTickets.length,
    tickets_truncated: tickets.length > visibleTickets.length,
    tickets: visibleTickets,
    ai_followup_recommended: Boolean(actionable),
    ai_followup_reason: actionable ? "verifier_ticket_pending" : "no_pending_verifier_ticket",
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
