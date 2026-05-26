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
  emitRunnerContextReset,
  ensureTicketWorktree,
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
  normalizePrdKey,
  getArg,
  getArgs,
  hasFlag,
  positiveInt,
  numberValue,
  safeSegment,
  currentRunnerId,
  requireRoleAssignmentForItem,
  startAssignmentIfLeased,
  compactAssignment,
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
    prdKeyFromTicketContent(content) ||
    `ticket_${ticketId}`
  );
}

function sourcePrdRefsFromTicketContent(content: string): string[] {
  return unique(
    (String(content || "").match(/tickets\/prd\/PRD-[A-Za-z0-9._-]+\.md/g) || [])
      .map((part) => stripTicks(part).trim())
      .filter(Boolean)
  );
}

function prdKeyFromTicketContent(content: string): string {
  return normalizePrdKey(
    scalarFromTicketContent(content, "PRD Key") ||
    scalarFromTicketContent(content, "PRD") ||
    scalarFromTicketContent(content, "Source PRD") ||
    sourcePrdRefsFromTicketContent(content)[0] ||
    ""
  );
}

function prdBodyExists(prdKey: string): boolean {
  if (!prdKey) return false;
  const active = path.join(TICKETS_ROOT, "prd", `${prdKey}.md`);
  const done = path.join(TICKETS_ROOT, "done", prdKey, `${prdKey}.md`);
  return safeIsFile(active) || safeIsFile(done);
}

function enforcePrdReferenceExists(content: string): void {
  // Reject work items that self-declare a `PRD Key: PRD-NNN` whose PRD body
  // does not exist on the board. Without this gate, a work item can claim
  // provenance from a PRD that was lost, leaving the UI to render an orphan
  // "PRD 없음" group.
  const normalizedPrdKey = prdKeyFromTicketContent(content);
  if (!normalizedPrdKey) return;
  if (prdBodyExists(normalizedPrdKey)) return;
  if (hasFlag("--allow-missing-prd")) return;
  fail(2, `ticket references PRD Key=${normalizedPrdKey} but no PRD body exists at tickets/prd/${normalizedPrdKey}.md or tickets/done/${normalizedPrdKey}/${normalizedPrdKey}.md; refuse to create an orphan work item. Pass --allow-missing-prd to override for reconstructed-stub or migration scenarios.`, {
    prd_key: normalizedPrdKey,
    rule: "todo_requires_existing_prd",
  });
}

function prdBranchFromKey(prdKey: string): string {
  prdKey = normalizePrdKey(prdKey);
  if (!prdKey) return "";
  const candidates = [
    path.join(TICKETS_ROOT, "prd", `${prdKey}.md`),
    path.join(TICKETS_ROOT, "done", prdKey, `${prdKey}.md`),
  ];
  for (const candidate of candidates) {
    if (!safeIsFile(candidate)) continue;
    const branch = stripTicks(utils.extractScalarFieldInSection(candidate, "Project", "Branch"));
    if (branch) return branch;
  }
  return "";
}

function enforcePrdWorktreeAvailable(content: string): void {
  const prdKey = prdKeyFromTicketContent(content);
  if (!prdKey) return;
  const branch = prdBranchFromKey(prdKey);
  if (!branch) {
    fail(2, `ticket references ${prdKey}, but that PRD has no Branch field; PRD-derived work item cannot create an independent worktree`, {
      prd_key: prdKey,
      rule: "prd_todo_requires_prd_worktree",
    });
  }
  const gitRoot = utils.gitRootPath(PROJECT_ROOT);
  if (!gitRoot || !gitBranchExists(gitRoot, branch)) {
    fail(2, `ticket references ${prdKey}, but PRD branch ${branch} is missing; PRD-derived work item cannot create an independent worktree`, {
      prd_key: prdKey,
      branch,
      rule: "prd_todo_requires_prd_worktree",
    });
  }
}

function plannerAssignmentCandidateForWorkItem(content: string, fallbackTarget: string): string {
  const prdKey = prdKeyFromTicketContent(content);
  if (prdKey) return path.join(TICKETS_ROOT, "prd", `${prdKey}.md`);
  const refs = sourcePrdRefsFromTicketContent(content);
  if (refs.length > 0) return refs[0];
  return fallbackTarget;
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
  const runnerId = currentRunnerId("planner");
  const payload = readWritePayload();
  const id = normalizeId(getArg("--id") || stringValue(payload.id) || extractIdFromContent(payload.content, "ticket"));
  if (!id) fail(2, "write-ticket requires --id or content with a work item id");
  const target = path.join(TICKETS_ROOT, "todo", `TODO-${id}.md`);
  const assignment = requireRoleAssignmentForItem("planner", plannerAssignmentCandidateForWorkItem(payload.content, target), runnerId);
  const activeAssignment = startAssignmentIfLeased(assignment);

  validateNoUnsafeWrite(target, hasFlag("--overwrite"));
  validateTicketContent(payload.content, id);
  enforcePrdReferenceExists(payload.content);
  enforcePrdWorktreeAvailable(payload.content);

  // 1) Persist to main board.
  writeAtomic(target, payload.content);
  releaseReservation(getArg("--reservation") || stringValue(payload.reservation));
  const archivedPrds = archiveConsumedPrdSources(payload.content, id);

  // 2) Provision the correct worktree. Ticket markdown stays in the local
  //    board; PRD-derived work items reuse the PRD worktree.
  const prdKey = prdKeyFromTicketContent(payload.content);
  const wt = ensureTicketWorktree({ id, kind: "todo", content: payload.content, prdKey });
  if (prdKey && wt.status === "skipped") {
    fail(1, "PRD-derived work item could not use the PRD worktree", {
      prd_key: prdKey,
      reason: wt.reason || "unknown",
      branch: wt.branch,
    });
  }
  if (wt.worktreePath) {
    utils.replaceScalarFieldInSection(target, "Worktree", "Path", `\`${wt.worktreePath}\``);
    utils.replaceScalarFieldInSection(target, "Worktree", "Branch", wt.branch);
    utils.replaceScalarFieldInSection(target, "Worktree", "Base Commit", wt.baseCommit);
    utils.replaceScalarFieldInSection(target, "Worktree", "Worktree Commit", "");
    utils.replaceScalarFieldInSection(target, "Worktree", "Integration Status", "ready");
  }

  const contextReset = emitRunnerContextReset(runnerId, "planner.write-ticket", "compact", {
    tool: "planner.write-ticket",
    ticket_id: `TODO-${id}`,
    path: boardRel(target),
  });

  ok({
    tool: "planner.write-ticket",
    status: "ok",
    runner: runnerId,
    assignment: compactAssignment(activeAssignment),
    id: `TODO-${id}`,
    path: boardRel(target),
    archived_prds: archivedPrds,
    branch: wt.branch,
    base_commit: wt.baseCommit,
    worktree_path: wt.worktreePath,
    worktree_status: wt.status,
    worktree_commit: wt.commit || "",
    context_reset: contextReset.ok ? "queued" : "failed",
    context_reset_path: contextReset.path,
  });
}
