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
  isCodeMetricPath,
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

export function cmdWorkerCodeReport(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge", "done"]);
  ok(recordWorkerCodeMetrics(ticket));
}

type CodeMetricNumbers = {
  files: number;
  insertions: number;
  deletions: number;
  volume: number;
  net: number;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function markerCodeFiles(marker: JsonObject): string[] {
  const explicit = stringArray(marker.code_changed_files);
  if (explicit.length > 0) return unique(explicit);
  return unique(stringArray(marker.product_changed_files).filter(isCodeMetricPath));
}

function statsNumbers(stats: JsonObject): CodeMetricNumbers {
  return {
    files: numberValue(stats.code_files_changed_count),
    insertions: numberValue(stats.code_insertions_count),
    deletions: numberValue(stats.code_deletions_count),
    volume: numberValue(stats.code_volume_count),
    net: numberValue(stats.code_net_delta_count),
  };
}

function readMarker(markerPath: string): JsonObject {
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8")) as JsonObject;
  } catch {
    return {};
  }
}

function nonNegative(value: number): number {
  return Math.max(0, value);
}

function markerTotals(markerDir: string): CodeMetricNumbers {
  const totals: CodeMetricNumbers = { files: 0, insertions: 0, deletions: 0, volume: 0, net: 0 };
  const uniqueFiles = new Set<string>();
  let fallbackFileCount = 0;
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(markerDir);
  } catch {
    return totals;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const marker = readMarker(path.join(markerDir, entry));
    const markerNumbers = statsNumbers(marker);
    const files = markerCodeFiles(marker);
    if (files.length > 0) {
      for (const file of files) uniqueFiles.add(file);
    } else {
      fallbackFileCount += markerNumbers.files;
    }
    totals.insertions += markerNumbers.insertions;
    totals.deletions += markerNumbers.deletions;
    totals.volume += markerNumbers.volume;
    totals.net += markerNumbers.net;
  }
  totals.files = uniqueFiles.size + fallbackFileCount;
  return totals;
}

function markerNumbers(markerPath: string): CodeMetricNumbers {
  const marker = readMarker(markerPath);
  const numbers = statsNumbers(marker);
  const files = markerCodeFiles(marker);
  return {
    ...numbers,
    files: files.length > 0 ? files.length : numbers.files,
  };
}

function syncWorkerCodeMetricState(runnerId: string, markerDir: string, ticketId: string, currentStats: CodeMetricNumbers, reportedAt: string): void {
  const totals = markerTotals(markerDir);
  utils.updateRunnerState(runnerId, {
    cumulative_code_files_changed: nonNegative(totals.files),
    cumulative_code_insertions: nonNegative(totals.insertions),
    cumulative_code_deletions: nonNegative(totals.deletions),
    cumulative_code_volume: nonNegative(totals.volume),
    cumulative_code_net_delta: totals.net,
    last_code_ticket_id: ticketId,
    last_code_files_changed: currentStats.files,
    last_code_insertions: currentStats.insertions,
    last_code_deletions: currentStats.deletions,
    last_code_volume: currentStats.volume,
    last_code_net_delta: currentStats.net,
    last_code_reported_at: reportedAt,
    code_source: "worker_diff_report",
  }, BOARD_ROOT);
}

export function recordWorkerCodeMetrics(ticket: string): JsonObject {
  const runnerId = currentRunnerId("worker");
  const ticketId = `Todo-${idFromPath(ticket)}`;
  const stats = diffStats(ticket);
  const markerDir = path.join(BOARD_ROOT, "runners", "state", "code-metrics", safeSegment(runnerId));
  const markerPath = path.join(markerDir, `${safeSegment(ticketId)}.json`);
  fs.mkdirSync(markerDir, { recursive: true });

  const markerExists = fs.existsSync(markerPath);
  const previous = markerExists ? markerNumbers(markerPath) : { files: 0, insertions: 0, deletions: 0, volume: 0, net: 0 };
  const currentStats = statsNumbers(stats);
  const delta = {
    files: currentStats.files - previous.files,
    insertions: currentStats.insertions - previous.insertions,
    deletions: currentStats.deletions - previous.deletions,
    volume: currentStats.volume - previous.volume,
    net: currentStats.net - previous.net,
  };
  const hasDelta = Object.values(delta).some((value) => value !== 0);
  const reportedAt = utils.nowIso();

  if (!hasDelta) {
    if (!markerExists) {
      fs.writeFileSync(markerPath, JSON.stringify({
        ticket_id: ticketId,
        runner: runnerId,
        reported_at: reportedAt,
        ...stats,
      }, null, 2) + "\n", "utf8");
    }
    syncWorkerCodeMetricState(runnerId, markerDir, ticketId, currentStats, reportedAt);
    return {
      tool: "worker.code-report",
      path: boardRel(ticket),
      runner: runnerId,
      ticket_id: ticketId,
      counted: false,
      marker_path: boardRel(markerPath),
      delta_code_files_changed_count: 0,
      delta_code_insertions_count: 0,
      delta_code_deletions_count: 0,
      delta_code_volume_count: 0,
      delta_code_net_delta_count: 0,
      ...stats,
    };
  }

  fs.writeFileSync(markerPath, JSON.stringify({
    ticket_id: ticketId,
    runner: runnerId,
    reported_at: reportedAt,
    ...stats,
  }, null, 2) + "\n", "utf8");
  syncWorkerCodeMetricState(runnerId, markerDir, ticketId, currentStats, reportedAt);

  return {
    tool: "worker.code-report",
    path: boardRel(ticket),
    runner: runnerId,
    ticket_id: ticketId,
    counted: true,
    marker_path: boardRel(markerPath),
    previous_code_files_changed_count: previous.files,
    previous_code_insertions_count: previous.insertions,
    previous_code_deletions_count: previous.deletions,
    previous_code_volume_count: previous.volume,
    previous_code_net_delta_count: previous.net,
    delta_code_files_changed_count: delta.files,
    delta_code_insertions_count: delta.insertions,
    delta_code_deletions_count: delta.deletions,
    delta_code_volume_count: delta.volume,
    delta_code_net_delta_count: delta.net,
    ...stats,
  };
}
