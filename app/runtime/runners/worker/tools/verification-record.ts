import * as shared from "../../../shared/runner-tool";
import { recordWorkerCodeMetrics } from "./code-report";

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

export function cmdWorkerVerificationRecord(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const result = getArg("--result");
  if (!result) fail(2, "worker verification-record requires --result");
  const command = getArg("--command");
  const exitCode = getArg("--exit-code");
  const summary = getArg("--summary") || readOptionalTextFile(getArg("--summary-file"));
  const now = utils.nowIso();

  if (command) utils.replaceScalarFieldInSection(ticket, "Verification", "Command", command);
  if (exitCode) utils.replaceScalarFieldInSection(ticket, "Verification", "Exit Code", exitCode);
  utils.replaceScalarFieldInSection(ticket, "Verification", "Last Run", now);
  utils.replaceScalarFieldInSection(ticket, "Verification", "Result", result);
  if (summary) utils.replaceScalarFieldInSection(ticket, "Verification", "Summary", oneLine(summary, 500));
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  utils.appendNote(ticket, `Verification recorded at ${now}: result=${result}${exitCode ? ` exit_code=${exitCode}` : ""}`);
  let codeMetrics: JsonObject = { status: "not_recorded" };
  try {
    codeMetrics = recordWorkerCodeMetrics(ticket);
  } catch (error) {
    codeMetrics = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  ok({
    tool: "worker.verification-record",
    path: boardRel(ticket),
    result,
    command_recorded: Boolean(command),
    exit_code: exitCode || "",
    summary_recorded: Boolean(summary),
    code_metrics_counted: codeMetrics.counted === true,
    code_metrics_status: String(codeMetrics.status || "ok"),
    code_metrics_files_changed_count: codeMetrics.code_files_changed_count ?? 0,
    code_metrics_volume_count: codeMetrics.code_volume_count ?? 0,
    code_metrics_delta_volume_count: codeMetrics.delta_code_volume_count ?? 0,
  });
}
