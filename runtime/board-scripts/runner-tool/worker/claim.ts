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

export function cmdWorkerClaim(): void {
  const ticketRaw = getArg("--ticket");
  if (!ticketRaw) fail(2, "worker claim requires --ticket");
  const runnerId = currentRunnerId("worker");
  const token = claimToken(runnerId);
  const lock = acquireDispatchLock();
  if (!lock.acquired) fail(1, "dispatch lock is held by another worker", { reason: "dispatch_lock_busy" });

  try {
    const source = resolveTicketPath(ticketRaw, ["todo"]);
    if (!source) fail(1, `claimable todo ticket not found: ${ticketRaw}`);
    const activeOwned = listWorkerTicketItems("inprogress").filter((item) => ticketItemOwnedByRunner(item, runnerId));
    if (activeOwned.length > 0) {
      fail(1, "runner already owns an active ticket; resume it before claiming another", {
        reason: "runner_has_active_ticket",
        active_ticket: activeOwned[0]?.path || "",
      });
    }

    const conflicts = pathConflictGuardEnabled()
      ? collectTicketConflicts(source, listWorkerTicketItems("inprogress"), runnerId)
      : [];
    if (conflicts.length > 0) {
      fail(1, "ticket conflicts with another inprogress ticket Allowed Paths", {
        reason: "allowed_path_conflict",
        conflicts,
      });
    }

    const target = path.join(TICKETS_ROOT, "inprogress", path.basename(source));
    if (fs.existsSync(target)) fail(1, `inprogress target already exists: ${boardRel(target)}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);

    const now = utils.nowIso();
    utils.replaceScalarFieldInSection(target, "Ticket", "Stage", "executing");
    utils.replaceScalarFieldInSection(target, "Ticket", "AI", runnerId);
    utils.replaceScalarFieldInSection(target, "Ticket", "Claimed By", token);
    utils.replaceScalarFieldInSection(target, "Ticket", "Execution AI", runnerId);
    utils.replaceScalarFieldInSection(target, "Ticket", "Last Updated", now);
    if (!utils.extractScalarFieldInSection(target, "Goal Runtime", "Started At")) {
      utils.replaceScalarFieldInSection(target, "Goal Runtime", "Started At", now);
    }
    if (!utils.extractScalarFieldInSection(target, "Goal Runtime", "Started Epoch")) {
      utils.replaceScalarFieldInSection(target, "Goal Runtime", "Started Epoch", String(Math.floor(Date.parse(now) / 1000)));
    }
    const previousTickCount = numberValue(utils.extractScalarFieldInSection(target, "Goal Runtime", "Tick Count"));
    utils.replaceScalarFieldInSection(target, "Goal Runtime", "Status", "active");
    utils.replaceScalarFieldInSection(target, "Goal Runtime", "Updated At", now);
    utils.replaceScalarFieldInSection(target, "Goal Runtime", "Tick Count", String(previousTickCount + 1));
    replaceSectionBlock(target, "Next Action", "- 다음에 바로 이어서 할 일: worker runner-tool worktree-ensure로 작업 루트를 준비한 뒤 Allowed Paths 안에서 구현을 진행한다.");
    replaceSectionBlock(
      target,
      "Resume Context",
      `- Current state: worker runner-tool claimed this ticket and moved it to inprogress.
- Last completed action: claim by ${runnerId} at ${now}.
- First thing to inspect on resume: Worktree, Goal, Allowed Paths, Done When, Notes.`
    );
    utils.appendNote(target, `Worker runner-tool claimed ticket at ${now}: runner=${runnerId}`);
    const worktree = ensureWorkerTicketWorktree(target);
    if (!isReadyWorktree(worktree)) {
      const reason = String(worktree.worktree_status || "worktree_not_ready");
      utils.replaceScalarFieldInSection(target, "Ticket", "Stage", "blocked");
      utils.replaceScalarFieldInSection(target, "Ticket", "Last Updated", utils.nowIso());
      replaceSectionBlock(
        target,
        "Recovery State",
        `- Status: blocked
- Detected By: runner-tool worker claim
- Failure Class: worktree_not_ready
- Evidence: worktree_status=${reason}; worker must not implement in PROJECT_ROOT fallback
- Planner Decision:
- Worker Resume Instruction: Fix git/worktree setup, then rerun worker runner-tool worktree-ensure for this ticket before implementation.
- Last Recovery At: ${utils.nowIso()}`
      );
      replaceSectionBlock(
        target,
        "Next Action",
        "- 다음에 바로 이어서 할 일: git/worktree 준비 상태를 복구한 뒤 `worker worktree-ensure`를 다시 실행한다. worktree가 ready가 되기 전에는 구현을 시작하지 않는다."
      );
      utils.appendNote(target, `Worker claim blocked before implementation at ${utils.nowIso()}: worktree_status=${reason}`);
      updateWorkerState(runnerId, target, "blocked", `worktree_not_ready:${reason}`);
      fail(1, "worker claim blocked before implementation because worktree is not ready", {
        reason: "worktree_not_ready",
        runner: runnerId,
        ticket_id: `Todo-${idFromPath(target)}`,
        path: boardRel(target),
        ...worktree,
      });
    }

    updateWorkerState(runnerId, target, "executing", "claimed_worktree_ready");

    ok({
      tool: "worker.claim",
      status: "ok",
      runner: runnerId,
      ticket_id: `Todo-${idFromPath(target)}`,
      from: boardRel(source),
      path: boardRel(target),
      claimed_by: token,
      stage: "executing",
      ...worktree,
      next_action: "Implement only inside the returned working_root.",
    });
  } finally {
    releaseDispatchLock(lock);
  }
}
