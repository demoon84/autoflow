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
  ensureTicketWorktree,
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
  requireRoleAssignmentForItem,
  compactAssignment,
  boardRel,
  stringValue,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail
} = shared;

export function cmdPlannerWritePrd(): void {
  const runnerId = currentRunnerId("planner");
  const payload = readWritePayload();
  const id = normalizeId(getArg("--id") || stringValue(payload.id) || extractIdFromContent(payload.content, "prd"));
  if (!id) fail(2, "write-prd requires --id or content with PRD-NNN");
  const target = path.join(TICKETS_ROOT, "prd", `PRD-${id}.md`);
  const assignment = requireRoleAssignmentForItem("planner", target, runnerId);

  validateNoUnsafeWrite(target, hasFlag("--overwrite"));
  validatePrdContent(payload.content, id);

  // 1) Create branch + worktree first. The PRD worktree is the durable work
  //    root for every TODO derived from this PRD.
  let wt = ensureTicketWorktree({ id, kind: "prd", content: payload.content });
  if (!wt.branch || !wt.baseCommit || !wt.worktreePath) {
    // PRD worktree 가 없으면 TODO 가 PRD branch 안에서 작업할 수 없다.
    // 발행 자체를 실패시켜 "PRD body 는 만들어졌는데 branch/worktree 없음"
    // 같은 모순 상태를 막는다.
    fail(1, "PRD worktree could not be created; refusing to publish PRD without a usable worktree", {
      prd_id: `PRD-${id}`,
      reason: wt.reason || wt.status || "ensure_ticket_worktree_failed",
      branch: wt.branch || "",
      worktree_path: wt.worktreePath || "",
    });
  }

  // 2) Persist in main board for queue scan / locatePrdFile.
  writeAtomic(target, payload.content);
  releaseReservation(getArg("--reservation") || stringValue(payload.reservation));

  // 3) Reflect branch / base commit fields back into the main markdown so
  //    downstream tools can use the PRD worktree as the only PRD-backed TODO
  //    working root.
  if (wt.branch && wt.baseCommit) {
    utils.replaceScalarFieldInSection(target, "Project", "Branch", wt.branch);
    utils.replaceScalarFieldInSection(target, "Project", "Base Commit", wt.baseCommit);
    wt = ensureTicketWorktree({
      id,
      kind: "prd",
      content: fs.readFileSync(target, "utf8"),
      commitMessage: `[PRD-${id}] record PRD branch metadata`,
    });
  }

  writeCurrentPrdState(id, wt, target);

  ok({
    tool: "planner.write-prd",
    status: "ok",
    runner: runnerId,
    assignment: compactAssignment(assignment),
    id: `PRD-${id}`,
    path: boardRel(target),
    branch: wt.branch,
    base_commit: wt.baseCommit,
    branch_status: wt.status,
    worktree_path: wt.worktreePath,
    worktree_commit: wt.commit || "",
  });
}

function writeCurrentPrdState(id: string, wt: { branch: string; baseCommit: string; worktreePath: string; commit?: string }, prdFile: string): void {
  const stateDir = path.join(BOARD_ROOT, "runners", "state");
  fs.mkdirSync(stateDir, { recursive: true });
  const statePath = path.join(stateDir, "current-prd.json");
  const payload = {
    prd_id: `PRD-${id}`,
    path: boardRel(prdFile),
    branch: wt.branch,
    worktree_path: wt.worktreePath,
    base_commit: wt.baseCommit,
    worktree_commit: wt.commit || "",
    status: "active",
    updated_at: utils.nowIso(),
  };
  writeAtomic(statePath, JSON.stringify(payload, null, 2) + "\n");
}
