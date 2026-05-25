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

function todoReferencesPrdKey(file: string, prdKey: string): boolean {
  const re = new RegExp(`^-\\s*PRD Key\\s*:\\s*${prdKey.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "im");
  return re.test(utils.readFileSafe(file));
}

function findTodosForPrdKey(prdKey: string): string[] {
  const matches: string[] = [];
  const buckets = ["todo", "inprogress", "verifier"];
  for (const bucket of buckets) {
    const dir = path.join(TICKETS_ROOT, bucket);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/.test(name)) continue;
      const full = path.join(dir, name);
      if (todoReferencesPrdKey(full, prdKey)) matches.push(boardRel(full));
    }
  }
  const doneProjectDir = path.join(TICKETS_ROOT, "done", prdKey);
  if (fs.existsSync(doneProjectDir)) {
    for (const name of fs.readdirSync(doneProjectDir)) {
      if (!/^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/.test(name)) continue;
      matches.push(boardRel(path.join(doneProjectDir, name)));
    }
  }
  return matches;
}

export function cmdPlannerItemArchive(): void {
  const runnerId = currentRunnerId("planner");
  const fromRaw = getArg("--from");
  const projectKey = getArg("--project-key");
  if (!fromRaw) fail(2, "item-archive requires --from");
  if (!projectKey || !/^[A-Za-z0-9._-]+$/.test(projectKey)) fail(2, "item-archive requires safe --project-key");

  const from = resolveBoardPath(fromRaw);
  if (!from || !fs.existsSync(from) || !fs.statSync(from).isFile()) fail(1, `archive source not found: ${fromRaw}`);
  const assignment = requireRoleAssignmentForItem("planner", from, runnerId);
  const targetName = getArg("--as") || path.basename(from);
  if (!/^[A-Za-z0-9._-]+\.md$/.test(targetName)) fail(2, "archive target filename must be a safe markdown filename");

  // Enforce: archiving a PRD requires at least one work item to reference it.
  // Use --force-archive-orphan when intentionally closing a no-implementation PRD
  // (research/audit/policy only). Without that override the planner refuses to
  // strand a done PRD with zero children.
  const sourceName = path.basename(from);
  const isPrdSource = /^(PRD)-\d+\.md$/i.test(sourceName);
  const allowOrphan = hasFlag("--force-archive-orphan");
  if (isPrdSource && !allowOrphan) {
    const matches = findTodosForPrdKey(projectKey);
    if (matches.length === 0) {
      fail(2, `PRD ${sourceName} has no work item referencing PRD Key=${projectKey}; refuse to archive a PRD without at least one work item. Pass --force-archive-orphan to override for an intentional no-implementation PRD.`, {
        project_key: projectKey,
        source: boardRel(from),
        rule: "prd_archive_requires_at_least_one_work_item",
      });
    }
  }

  const target = path.join(TICKETS_ROOT, "done", projectKey, targetName);
  validateNoUnsafeWrite(target, false);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(from, target);

  ok({
    tool: "planner.item-archive",
    status: "ok",
    runner: runnerId,
    assignment: compactAssignment(assignment),
    from: boardRel(from),
    path: boardRel(target),
    project_key: projectKey,
    orphan_archive: isPrdSource && allowOrphan ? "true" : "false",
  });
}
