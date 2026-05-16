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

export function cmdWikiDiffSnapshot(): void {
  const gitRoot = utils.gitRootPath(PROJECT_ROOT);
  if (!gitRoot) {
    ok({ tool: "wiki.diff-snapshot", is_git_repo: false, changed_file_count: 0, changed_files: [] });
    return;
  }

  const pathArgs = [path.join(BOARD_ROOT, "wiki"), path.join(BOARD_ROOT, "wiki-raw")].filter((p) => fs.existsSync(p));
  if (pathArgs.length === 0) {
    ok({ tool: "wiki.diff-snapshot", is_git_repo: true, changed_file_count: 0, changed_files: [] });
    return;
  }

  const statusLines = git(["status", "--porcelain", "--untracked-files=all", "--", ...pathArgs], gitRoot).stdout
    .split(/\r?\n/)
    .filter(Boolean);
  const numstatRaw = [
    git(["diff", "--numstat", "--", ...pathArgs], gitRoot).stdout,
    git(["diff", "--cached", "--numstat", "--", ...pathArgs], gitRoot).stdout,
  ].join("\n");
  const numstat = parseNumstat(numstatRaw);
  const changed = statusLines.map((line) => readWikiStatusItem(line, gitRoot, numstat)).filter((item) => item.path);
  const totalWeight = changed.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const lineDelta = changed.reduce((sum, item) => sum + Number(item.additions || 0) + Number(item.deletions || 0), 0);
  const hasNewFiles = changed.some((item) => String(item.status || "").includes("??") || item.untracked === true);
  const hasDeletedFiles = changed.some((item) => String(item.status || "").includes("D"));
  const weightThreshold = positiveInt(process.env.AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD || "", 5);
  const lineThreshold = positiveInt(process.env.AUTOFLOW_WIKI_COMMIT_MIN_LINES || "", 30);
  const meaningful = totalWeight >= weightThreshold && (lineDelta >= lineThreshold || hasNewFiles || hasDeletedFiles);

  ok({
    tool: "wiki.diff-snapshot",
    is_git_repo: true,
    generated_at: utils.nowIso(),
    changed_file_count: changed.length,
    changed_files: changed,
    total_weight: totalWeight,
    line_delta: lineDelta,
    weight_threshold: weightThreshold,
    line_threshold: lineThreshold,
    meaningful_commit_candidate: meaningful,
  });
}
