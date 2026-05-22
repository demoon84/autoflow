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
  boardRel,
  stringValue,
  safeIsFile,
  ensureTrailingNewline,
  escapeRe,
  ok,
  fail
} = shared;

export function cmdWikiWritePage(): void {
  // DB-only mode: wiki pages are not written to disk. Content is chunked and
  // upserted directly into wiki_chunks. AI runners retrieve via wiki query.
  const rawPath = getArg("--path");
  if (!rawPath) fail(2, "wiki write-page requires --path");
  const normalizedPath = String(rawPath || "")
    .replace(/^`+|`+$/g, "")
    .replace(/\\/g, "/")
    .replace(/^[.][/]/, "")
    .replace(/^\.autoflow\//, "");
  if (!normalizedPath.startsWith("wiki/") || !normalizedPath.endsWith(".md")) {
    fail(2, "wiki write-page path must be board-relative under wiki/ and end in .md");
  }

  const contentFile = getArg("--content-file");
  let content = "";
  if (contentFile) {
    const file = resolveLocalFile(contentFile);
    if (!file || !safeIsFile(file)) fail(1, `content file not found: ${contentFile}`);
    content = fs.readFileSync(file, "utf8");
  } else if (!process.stdin.isTTY) {
    content = fs.readFileSync(0, "utf8");
  }
  if (!content.trim()) fail(2, "wiki write-page requires --content-file or stdin markdown");

  const cliArgs = ["wiki", "upsert", PROJECT_ROOT, boardDirName(), "--path", normalizedPath];
  if (contentFile) cliArgs.push("--content-file", contentFile);

  // Use the autoflow CLI wrapper so the underlying upsert (chunk + embed +
  // DB INSERT) runs in the standard CLI context. We forward stdin/content
  // through --content-file when available; otherwise we pipe via a temp file.
  if (!contentFile) {
    const tmp = path.join(BOARD_ROOT, "runners", "state", `wiki-upsert.${process.pid}.${Date.now()}.md`);
    try {
      fs.mkdirSync(path.dirname(tmp), {recursive: true});
      fs.writeFileSync(tmp, content, "utf8");
      cliArgs.push("--content-file", tmp);
      try {
        emitAutoflowResult("wiki.write-page", cliArgs);
      } finally {
        try { fs.rmSync(tmp, {force: true}); } catch {}
      }
      return;
    } catch (error: any) {
      fail(1, `failed to stage content: ${error?.message || error}`);
    }
  }

  emitAutoflowResult("wiki.write-page", cliArgs);
}
