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

function compactWorkerSource(item: WorkerTicketItem): JsonObject {
  const handoffLinks = conversationHandoffLinksForPrdKey(item.prd_key || "", 4);
  return {
    path: item.path,
    id: item.id,
    prd_key: item.prd_key || "",
    priority: item.priority,
    title: item.title,
    status: item.status || "",
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
    handoff_links: handoffLinks,
    handoff_link_count: handoffLinks.length,
  };
}

function workerFollowupReason(active?: WorkerTicketItem): string {
  if (!active) return "no_owned_inprogress_ticket";
  const stage = (active.stage || "").toLowerCase();
  const decision = (active.semantic_decision || "").toLowerCase();
  if (stage === "blocked") return "worker_ticket_blocked";
  if (decision === "revise" || stage.includes("revision_requested") || stage.includes("verifier_revise")) {
    return "verifier_revision_requested";
  }
  if (decision === "replan" || stage.includes("replan_requested") || stage.includes("verifier_replan")) {
    return "verifier_replan_requested";
  }
  if (
    decision === "pass" ||
    stage === "verifier_pass" ||
    stage.includes("verifier_passed") ||
    stage.includes("verified_pending_merge")
  ) {
    return "verifier_passed_merge_pending";
  }
  if (active.kind === "verifier") return "worker_ticket_waiting_for_verifier";
  if (stage === "verify_pending") return "worker_ticket_waiting_for_verifier";
  return "worker_owned_ticket_pending";
}

function workerNextAction(active?: WorkerTicketItem): string {
  if (!active) return "run_worker_todo_snapshot_before_idle";
  const reason = workerFollowupReason(active);
  if (reason === "worker_ticket_waiting_for_verifier") {
    return "wait_for_verifier_decision";
  }
  if (reason === "verifier_passed_merge_pending") {
    return "merge_verified_worktree_rerun_target_verification_then_finalize_approved";
  }
  if (reason === "verifier_revision_requested") {
    return "revise_same_worktree_rerun_local_verification_then_submit_to_verifier";
  }
  if (reason === "verifier_replan_requested") {
    return "run_worker_request_replan_for_this_ticket";
  }
  if (reason === "worker_ticket_blocked") {
    return "perform_one_runner_owned_blocked_handling_pass_before_idle";
  }
  return "resume_owned_inprogress_ticket";
}

function workerNextActionInstruction(active?: WorkerTicketItem): string {
  const reason = workerFollowupReason(active);
  if (reason === "worker_ticket_waiting_for_verifier") {
    return "Verifier still owns this ticket. Summarize compact result and idle; do not open source files or run todo-snapshot.";
  }
  if (reason === "verifier_passed_merge_pending") {
    return "Do not idle. Inspect only the scoped ticket/worktree, merge the verifier-approved worktree into the ticket merge target (PRD branch when PRD Key+Branch exists, otherwise main), rerun required verification from that merge target, then call `autoflow tool runner-tool worker finalize-approved --ticket <id> --summary \"<summary>\"`.";
  }
  if (reason === "verifier_revision_requested") {
    return "Do not idle. Inspect only the scoped ticket/worktree, apply the verifier requested corrections inside Allowed Paths, rerun local verification, record evidence, then call worker submit-to-verifier again.";
  }
  if (reason === "verifier_replan_requested") {
    return "Do not idle. Inspect only the scoped ticket and run worker request-replan for this ticket before claiming or inspecting any other ticket.";
  }
  if (reason === "worker_ticket_blocked") {
    return "Do one runner-owned blocked-handling pass before any idle decision.";
  }
  if (active) {
    return "Inspect only the scoped ticket/worktree and continue the owned ticket. Do not run todo-snapshot or claim another ticket while this active ticket exists.";
  }
  return "No owned active ticket exists. Run worker todo-snapshot before idling or claiming new work.";
}

export function cmdWorkerActiveGet(): void {
  const runnerId = currentRunnerId("worker");
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const inprogress = listWorkerTicketItems("inprogress");
  const verifier = listWorkerTicketItems("verifier");
  const owned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const verifierOwned = verifier.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const allOwned = [...owned, ...verifierOwned];
  const visibleVerifierOwned = verifierOwned.slice(0, maxItems);
  const visibleInprogress = inprogress.slice(0, maxItems);
  const active = allOwned[0];
  if (active) {
    const activePath = resolveBoardPath(active.path);
    if (activePath) {
      updateWorkerState(runnerId, activePath, active.stage || "active", "active_get");
    }
  }
  const scopedSources = active ? [compactWorkerSource(active)] : [];
  const noOwnedNextAction = "run worker.todo-snapshot before idling or claiming new work";
  const followupReason = workerFollowupReason(active);
  const nextAction = workerNextAction(active);
  const terminal = followupReason === "worker_ticket_waiting_for_verifier";
  const mustContinue = Boolean(active && !terminal);
  ok({
    tool: "worker.active-get",
    runner: runnerId,
    generated_at: utils.nowIso(),
    owned_count_total: allOwned.length,
    owned_count: Math.min(allOwned.length, maxItems),
    owned_truncated: allOwned.length > maxItems,
    owned: allOwned.slice(0, maxItems),
    inprogress_owned_count_total: owned.length,
    verifier_owned_count_total: verifierOwned.length,
    verifier_owned_count: visibleVerifierOwned.length,
    verifier_owned_truncated: verifierOwned.length > visibleVerifierOwned.length,
    verifier_owned: visibleVerifierOwned,
    inprogress_count_total: inprogress.length,
    inprogress_count: visibleInprogress.length,
    inprogress_truncated: inprogress.length > visibleInprogress.length,
    inprogress: visibleInprogress,
    next_action: nextAction,
    next_action_instruction: workerNextActionInstruction(active),
    next_tool: active ? "" : "worker.todo-snapshot",
    idle_allowed: !active || terminal,
    active_get_terminal: terminal,
    no_owned_ticket_instruction: active ? "" : noOwnedNextAction,
    ai_followup_recommended: Boolean(active),
    ai_followup_reason: followupReason,
    ai_followup_scope: {
      inspect_only_recent_sources: scopedSources,
      max_files_to_open: scopedSourceFileCount(scopedSources),
      max_tickets_to_edit: mustContinue ? 1 : 0,
      must_continue: mustContinue,
      idle_allowed: !active || terminal,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_snapshot_after_manual_board_edits: true,
    },
  });
}
