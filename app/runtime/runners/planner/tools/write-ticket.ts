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
  emitRunnerContextReset,
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

function scalarFromTicketContent(content: string, fieldName: string): string {
  const escaped = escapeRe(fieldName);
  const match = String(content || "").match(new RegExp(`^- ${escaped}\\s*:\\s*(.*)$`, "m"));
  return match ? stripTicks(match[1]).trim() : "";
}

function sourceOrderRefsFromTicketContent(content: string): string[] {
  const source = scalarFromTicketContent(content, "Source");
  return unique(
    [
      ...source.split(/[, ]+/),
      ...(String(content || "").match(/tickets\/order\/order_[A-Za-z0-9._-]+\.md/g) || []),
    ]
      .map((part) => stripTicks(part).trim())
      .filter((part) => /^tickets\/order\/[A-Za-z0-9._-]+\.md$/.test(part))
  );
}

function sectionTextFromTicketContent(content: string, heading: string): string {
  const escaped = escapeRe(heading);
  const match = String(content || "").match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|\\s*$)`, "m"));
  return match ? match[1].trim() : "";
}

function firstPlainSectionLine(content: string, heading: string): string {
  return sectionTextFromTicketContent(content, heading)
    .split(/\r?\n/)
    .map((line) => stripTicks(line).trim())
    .filter((line) => line && !line.startsWith("-"))[0] || "";
}

function projectKeyFromTicketContent(content: string, ticketId: string): string {
  return safeSegment(
    scalarFromTicketContent(content, "Project key") ||
    scalarFromTicketContent(content, "Project Key") ||
    firstPlainSectionLine(content, "Project") ||
    scalarFromTicketContent(content, "PRD Key") ||
    `ticket_${ticketId}`
  );
}

function sourcePrdRefsFromTicketContent(content: string): string[] {
  return unique(
    (String(content || "").match(/tickets\/prd\/prd_[A-Za-z0-9._-]+\.md/g) || [])
      .map((part) => stripTicks(part).trim())
      .filter(Boolean)
  );
}

function uniqueArchiveTarget(doneDir: string, filename: string): string {
  const parsed = path.parse(filename);
  let target = path.join(doneDir, filename);
  if (!fs.existsSync(target)) return target;

  const stamp = utils.nowIso().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  for (let index = 1; index < 100; index += 1) {
    target = path.join(doneDir, `${parsed.name}_archived_${stamp}_${index}${parsed.ext}`);
    if (!fs.existsSync(target)) return target;
  }
  fail(1, `unable to choose archive target for ${filename}`);
  throw new Error(`unable to choose archive target for ${filename}`);
}

function archiveConsumedOrderSources(content: string, ticketId: string): JsonObject[] {
  const refs = sourceOrderRefsFromTicketContent(content);
  if (refs.length === 0) return [];

  const projectKey = projectKeyFromTicketContent(content, ticketId);
  const doneDir = path.join(TICKETS_ROOT, "done", projectKey);
  fs.mkdirSync(doneDir, { recursive: true });

  const archived: JsonObject[] = [];
  for (const ref of refs) {
    const source = resolveBoardPath(ref);
    const orderRoot = path.resolve(path.join(TICKETS_ROOT, "order"));
    if (!source || !path.resolve(source).startsWith(orderRoot + path.sep)) {
      archived.push({ source: ref, status: "skipped_unsafe_source" });
      continue;
    }
    if (!safeIsFile(source)) {
      archived.push({ source: ref, status: "missing" });
      continue;
    }

    const target = uniqueArchiveTarget(doneDir, path.basename(source));
    fs.renameSync(source, target);
    archived.push({ source: ref, status: "archived", path: boardRel(target), project_key: projectKey });
  }
  return archived;
}

function archiveConsumedPrdSources(content: string, ticketId: string): JsonObject[] {
  const refs = sourcePrdRefsFromTicketContent(content);
  if (refs.length === 0) return [];

  const projectKey = projectKeyFromTicketContent(content, ticketId);
  const doneDir = path.join(TICKETS_ROOT, "done", projectKey);
  fs.mkdirSync(doneDir, { recursive: true });

  const archived: JsonObject[] = [];
  for (const ref of refs) {
    const source = resolveBoardPath(ref);
    const prdRoot = path.resolve(path.join(TICKETS_ROOT, "prd"));
    if (!source || !path.resolve(source).startsWith(prdRoot + path.sep)) {
      archived.push({ source: ref, status: "skipped_unsafe_source" });
      continue;
    }
    if (!safeIsFile(source)) {
      archived.push({ source: ref, status: "missing" });
      continue;
    }

    const target = uniqueArchiveTarget(doneDir, path.basename(source));
    fs.renameSync(source, target);
    archived.push({ source: ref, status: "archived", path: boardRel(target), project_key: projectKey });
  }
  return archived;
}

export function cmdPlannerWriteTicket(): void {
  const payload = readWritePayload();
  const id = normalizeId(getArg("--id") || stringValue(payload.id) || extractIdFromContent(payload.content, "ticket"));
  if (!id) fail(2, "write-ticket requires --id or content with Todo-NNN");
  const target = path.join(TICKETS_ROOT, "todo", `Todo-${id}.md`);

  validateNoUnsafeWrite(target, hasFlag("--overwrite"));
  validateTicketContent(payload.content, id);
  writeAtomic(target, payload.content);
  releaseReservation(getArg("--reservation") || stringValue(payload.reservation));
  const archivedSources = archiveConsumedOrderSources(payload.content, id);
  const archivedPrds = archiveConsumedPrdSources(payload.content, id);
  const contextReset = emitRunnerContextReset(currentRunnerId("planner"), "planner.write-ticket", "compact", {
    tool: "planner.write-ticket",
    ticket_id: `Todo-${id}`,
    path: boardRel(target),
  });

  ok({
    tool: "planner.write-ticket",
    status: "ok",
    id: `Todo-${id}`,
    path: boardRel(target),
    archived_sources: archivedSources,
    archived_prds: archivedPrds,
    context_reset: contextReset.ok ? "queued" : "failed",
    context_reset_path: contextReset.path,
  });
}
