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
  worktreeStatusIsSetupBlocker,
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
  if (workerWorktreeSetupStillBlocked(active)) return "worker_ticket_blocked_waiting_for_prd_worktree";
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
    return "verifier_passed_worker_finalization_pending";
  }
  if (active.kind === "verifier") return "worker_ticket_waiting_for_verifier";
  if (stage === "verify_pending") return "worker_ticket_waiting_for_verifier";
  return "worker_owned_ticket_pending";
}

function workerNextAction(active?: WorkerTicketItem): string {
  if (!active) return "run_worker_work_snapshot_before_idle";
  const reason = workerFollowupReason(active);
  if (reason === "worker_ticket_waiting_for_verifier") {
    return "wait_for_verifier_decision";
  }
  if (reason === "verifier_passed_worker_finalization_pending") {
    return "wait_for_worker_finalization";
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
  if (reason === "worker_ticket_blocked_waiting_for_prd_worktree") {
    return "idle_until_prd_worktree_or_branch_is_repaired";
  }
  return "resume_owned_inprogress_ticket";
}

function workerNextActionInstruction(active?: WorkerTicketItem): string {
  const reason = workerFollowupReason(active);
  if (reason === "worker_ticket_waiting_for_verifier") {
    return "Verifier still owns this ticket. Summarize compact result and idle; do not open source files or run work-snapshot.";
  }
  if (reason === "verifier_passed_worker_finalization_pending") {
    return "Worker owns finalization now. Run worker finalize-approved after reviewing the scoped ticket/worktree.";
  }
  if (reason === "verifier_revision_requested") {
    return "Do not idle. Inspect only the scoped ticket/worktree, apply the verifier requested corrections inside Allowed Paths, rerun local verification, record evidence, then call worker submit-to-verifier again.";
  }
  if (reason === "verifier_replan_requested") {
    return "Do not idle. Inspect only the scoped ticket and run worker request-replan for this ticket before accepting another assignment.";
  }
  if (reason === "worker_ticket_blocked") {
    return "Do one runner-owned blocked-handling pass before any idle decision.";
  }
  if (reason === "worker_ticket_blocked_waiting_for_prd_worktree") {
    return "The ticket is still blocked by PRD worktree/branch setup after a worker worktree-ensure attempt. Summarize the blocker and idle; do not retry the same tool until the PRD branch/worktree changes.";
  }
  if (active) {
    return "Inspect only the scoped ticket/worktree and continue the owned ticket. Do not run work-snapshot for another assignment while this active ticket exists.";
  }
  return "No owned active ticket exists. Run worker work-snapshot before idling.";
}

function readText(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function workerWorktreeSetupStillBlocked(active?: WorkerTicketItem): boolean {
  if (!active || String(active.stage || "").toLowerCase() !== "blocked") return false;
  if (!worktreeStatusIsSetupBlocker(active.worktree_status || "")) return false;
  const activePath = resolveBoardPath(active.path);
  return /reason=worktree_setup_still_blocked/.test(readText(activePath));
}

function writeText(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function markdownScalar(file: string, section: string, field: string): string {
  const lines = readText(file).split(/\r?\n/);
  let inSection = false;
  const sectionRe = new RegExp(`^##\\s+${escapeRe(section)}\\s*$`);
  const fieldRe = new RegExp(`^-\\s*${escapeRe(field)}\\s*:\\s*(.*?)\\s*$`, "i");
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^##\s+/.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return stripTicks(match[1] || "").trim();
  }
  return "";
}

function normalizePrdKey(value: string): string {
  const trimmed = String(value || "").trim();
  const scoped = trimmed.match(/PRD-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)/i);
  if (scoped) return `PRD-${normalizeId(scoped[1])}`;
  const match = trimmed.match(/(?:PRD[-_]|prd_|project_)(\d+)/i);
  if (match) return `PRD-${match[1].padStart(3, "0")}`;
  return "";
}

function runnerStatePath(runnerId: string): string {
  return path.join(BOARD_ROOT, "runners", "state", `${runnerId}.state`);
}

function readStateMap(file: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readText(file).split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    map.set(line.slice(0, index), line.slice(index + 1));
  }
  return map;
}

function writeStateMap(file: string, map: Map<string, string>): void {
  const lines = [...map.entries()].map(([key, value]) => `${key}=${value}`);
  writeText(file, `${lines.join("\n")}\n`);
}

function doneTicketExists(ticketId: string): boolean {
  if (!ticketId) return false;
  const doneRoot = path.join(TICKETS_ROOT, "done");
  const stack = [doneRoot];
  while (stack.length > 0) {
    const current = stack.pop() || "";
    let entries: any[] = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (new RegExp(`^TODO-${escapeRe(ticketId)}\\.md$`, "i").test(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

function clearStaleWorkerActiveState(runnerId: string): string {
  const file = runnerStatePath(runnerId);
  if (!fs.existsSync(file)) return "";
  const state = readStateMap(file);
  const activePath = state.get("active_ticket_path") || "";
  const activeId = normalizeId(state.get("active_ticket_id") || activePath);
  const activeStage = state.get("active_stage") || "";
  if (!activePath && !activeId && !activeStage) return "";

  const resolvedActive = activePath ? resolveBoardPath(activePath) : "";
  const activeStillExists = Boolean(
    resolvedActive &&
    fs.existsSync(resolvedActive) &&
    (
      resolvedActive.includes(`${path.sep}tickets${path.sep}inprogress${path.sep}`) ||
      resolvedActive.includes(`${path.sep}tickets${path.sep}verifier${path.sep}`)
    )
  );
  if (activeStillExists) return "";

  state.set("active_item", "");
  state.set("active_ticket_id", "");
  state.set("active_ticket_title", "");
  state.set("active_stage", "idle");
  state.set("active_spec_ref", "");
  state.set("active_ticket_path", "");
  state.set("last_result", doneTicketExists(activeId) ? "worker_active_ticket_already_done" : "worker_active_ticket_missing");
  state.set("updated_at", utils.nowIso());
  writeStateMap(file, state);
  return doneTicketExists(activeId) ? `cleared_done_ticket:${activeId}` : `cleared_missing_ticket:${activeId || activePath || "unknown"}`;
}

function gitResult(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function gitOk(cwd: string, args: string[]): boolean {
  return gitResult(cwd, args).status === 0;
}

function gitText(cwd: string, args: string[]): string {
  const result = gitResult(cwd, args);
  return result.status === 0 ? result.stdout.trim() : "";
}

function projectGitRoot(): string {
  return gitText(PROJECT_ROOT, ["rev-parse", "--show-toplevel"]) || "";
}

function gitRelative(gitRoot: string, target: string): string {
  const rel = path.relative(gitRoot, target).split(path.sep).join("/");
  return rel && !rel.startsWith("../") && rel !== ".." ? rel : "";
}

function headContainsPath(gitRoot: string, file: string): boolean {
  const rel = gitRelative(gitRoot, file);
  return Boolean(rel) && gitOk(gitRoot, ["cat-file", "-e", `HEAD:${rel}`]);
}

function branchExists(gitRoot: string, branch: string): boolean {
  return Boolean(branch) && gitOk(gitRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
}

function worktreePathForBranch(gitRoot: string, branch: string): string {
  let current = "";
  for (const line of gitText(gitRoot, ["worktree", "list", "--porcelain"]).split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      current = line.slice("worktree ".length).trim();
      continue;
    }
    if (line === `branch refs/heads/${branch}`) return current;
  }
  return "";
}

function safeAutoflowWorktree(gitRoot: string, candidate: string): boolean {
  const resolved = path.resolve(candidate || "");
  if (!resolved || resolved === path.resolve(gitRoot) || resolved === path.resolve(PROJECT_ROOT)) return false;
  return (
    resolved.includes(`${path.sep}autoflow${path.sep}worktrees${path.sep}`) ||
    resolved.includes(`${path.sep}.autoflow${path.sep}worktrees${path.sep}`) ||
    resolved.includes(`${path.sep}Library${path.sep}Caches${path.sep}autoflow${path.sep}worktrees${path.sep}`)
  );
}

function prdHasActiveQueue(prdKey: string): boolean {
  for (const state of ["prd", "todo", "inprogress", "verifier"]) {
    const dir = path.join(TICKETS_ROOT, state);
    let entries: string[] = [];
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      if (!/^(PRD|TODO)-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(entry)) continue;
      const file = path.join(dir, entry);
      if (normalizePrdKey(path.basename(entry, ".md")) === prdKey) return true;
      if (normalizePrdKey(markdownScalar(file, "Ticket", "PRD Key")) === prdKey) return true;
    }
  }
  return false;
}

function cleanupCompletedPrdArtifacts(): string[] {
  const repairs: string[] = [];
  const gitRoot = projectGitRoot();
  if (!gitRoot) return repairs;
  const doneRoot = path.join(TICKETS_ROOT, "done");
  let dirs: string[] = [];
  try { dirs = fs.readdirSync(doneRoot); } catch { return repairs; }
  for (const dirName of dirs) {
    const prdKey = normalizePrdKey(dirName);
    if (!prdKey || prdHasActiveQueue(prdKey)) continue;
    const prdDoneFile = path.join(doneRoot, dirName, `${prdKey}.md`);
    if (!fs.existsSync(prdDoneFile) || !headContainsPath(gitRoot, prdDoneFile)) continue;
    const branch = markdownScalar(prdDoneFile, "Project", "Branch") || `autoflow/${prdKey.toLowerCase()}`;
    if (!/^autoflow\/prd-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+$/i.test(branch)) continue;
    const worktreePath = worktreePathForBranch(gitRoot, branch);
    if (worktreePath && safeAutoflowWorktree(gitRoot, worktreePath)) {
      const removed = gitOk(gitRoot, ["worktree", "remove", "--force", "--force", worktreePath]);
      if (!removed && safeAutoflowWorktree(gitRoot, worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        gitOk(gitRoot, ["worktree", "prune"]);
      }
      repairs.push(`removed_worktree:${prdKey}`);
    }
    if (branchExists(gitRoot, branch)) {
      gitOk(gitRoot, ["branch", "-D", branch]);
      if (!branchExists(gitRoot, branch)) repairs.push(`deleted_branch:${branch}`);
    }
  }
  return repairs;
}

function normalizeVerificationCommand(raw: string): string {
  const command = stripTicks(String(raw || ""))
    .replace(/^(?:PROJECT_ROOT|PROJECT ROOT|ROOT|WORKTREE|TICKET WORKTREE)\s*:\s*/i, "")
    .replace(/\.\s*$/, "")
    .trim();
  if (!command || /^(TBD|TODO:?|N\/A|NA|NONE|none-shell)$/i.test(command)) return "";
  return command;
}

function commandScore(command: string): number {
  const lowered = command.toLowerCase();
  let score = 0;
  if (lowered.includes("scripts/install-clipshot.sh")) score += 100;
  if (lowered.includes("scripts/verify-clipshot-install.sh")) score += 50;
  if (lowered.includes("codesign --verify")) score += 10;
  if (lowered.includes("swift build")) score += 5;
  return score;
}

function extractVerificationCommands(text: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /verification rerun[^\r\n]*?\bcommand=([^\r\n]+)/gi,
    /Verification passed:\s*([^\r\n]+?)(?:\.\s+Evidence|\s*$)/gi,
    /`([^`\r\n]*(?:install-clipshot|verify-clipshot-install)[^`\r\n]*)`/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const command = normalizeVerificationCommand(match[1] || "");
      if (command) candidates.push(command);
    }
  }
  return candidates;
}

function finalizedPrdVerificationCommand(prdKey: string): string {
  const doneDir = path.join(TICKETS_ROOT, "done", safeSegment(prdKey));
  const prdFile = path.join(doneDir, `${prdKey}.md`);
  const candidates: string[] = [];
  const prdCommand = normalizeVerificationCommand(markdownScalar(prdFile, "Verification", "Command"));
  if (prdCommand) candidates.push(prdCommand);

  let entries: string[] = [];
  try { entries = fs.readdirSync(doneDir).filter((entry: string) => /\.md$/i.test(entry)).sort(); } catch { entries = []; }
  for (const entry of entries) {
    candidates.push(...extractVerificationCommands(readText(path.join(doneDir, entry))));
  }

  const uniqueCandidates = unique(candidates).filter(Boolean);
  uniqueCandidates.sort((a, b) => commandScore(b) - commandScore(a));
  return uniqueCandidates[0] || "";
}

function markdownListSection(file: string, section: string): string[] {
  const lines = readText(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^##\\s+${escapeRe(section)}\\s*$`);
  const values: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^##\s+/.test(line) && inSection) break;
    if (!inSection) continue;
    const match = line.match(/^\s*[-*]\s+(.*)$/);
    if (!match) continue;
    const value = normalizeRelPath(stripTicks(match[1] || ""));
    if (value && !value.startsWith("..") && !path.isAbsolute(value)) values.push(value);
  }
  return unique(values);
}

function appendPrdRepairNote(prdKey: string, note: string): void {
  const file = path.join(TICKETS_ROOT, "done", safeSegment(prdKey), `${prdKey}.md`);
  if (!fs.existsSync(file)) return;
  const text = ensureTrailingNewline(readText(file));
  const next = `${text}- ${note}\n`;
  writeText(file, next);
}

function cleanupVerificationArtifacts(gitRoot: string, allowed: string[]): string[] {
  const repairs: string[] = [];
  if (allowed.some((rel) => rel === ".build" || rel.startsWith(".build/"))) return repairs;
  if (!fs.existsSync(path.join(gitRoot, ".build"))) return repairs;
  gitOk(gitRoot, ["restore", "--worktree", "--", ".build"]);
  gitOk(gitRoot, ["clean", "-ffdx", "--", ".build"]);
  repairs.push("cleaned_build_artifacts");
  return repairs;
}

function commitFinalizedPrdRepair(prdKey: string, note: string): string[] {
  const repairs: string[] = [];
  const gitRoot = projectGitRoot();
  if (!gitRoot) return repairs;
  const prdFile = path.join(TICKETS_ROOT, "done", safeSegment(prdKey), `${prdKey}.md`);
  const prdRel = gitRelative(gitRoot, prdFile);
  const allowed = fs.existsSync(prdFile) ? markdownListSection(prdFile, "Allowed Paths") : [];
  repairs.push(...cleanupVerificationArtifacts(gitRoot, allowed));
  for (const rel of unique(allowed).filter(Boolean)) {
    const abs = path.join(gitRoot, rel);
    const tracked = gitOk(gitRoot, ["ls-files", "--error-unmatch", "--", rel]);
    if (!fs.existsSync(abs) && !tracked) continue;
    gitOk(gitRoot, ["add", "-A", "--", rel]);
  }
  if (gitOk(gitRoot, ["diff", "--cached", "--quiet"])) {
    repairs.push("repair_commit_no_changes");
  } else {
    appendPrdRepairNote(prdKey, note);
    if (prdRel) gitOk(gitRoot, ["add", "-A", "--", prdRel]);
    const commit = gitResult(gitRoot, ["commit", "-m", `${prdKey} 복구`]);
    if (commit.status === 0) {
      repairs.push(`repair_committed:${gitText(gitRoot, ["rev-parse", "--short", "HEAD"])}`);
    } else {
      repairs.push(`repair_commit_failed:${commit.status}`);
    }
  }
  repairs.push(...cleanupVerificationArtifacts(gitRoot, allowed));
  return repairs;
}

function repairFinalizedPrdPostVerification(prdKey: string): string[] {
  const repairs: string[] = [];
  const normalized = normalizePrdKey(prdKey);
  if (!normalized) return repairs;
  const command = finalizedPrdVerificationCommand(normalized);
  if (!command) {
    repairs.push(`post_verify_skipped_no_command:${normalized}`);
    return repairs;
  }
  const timeout = positiveInt(process.env.AUTOFLOW_FINALIZE_VERIFY_TIMEOUT_MS || "", 120000);
  const result = spawnSync(command, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    shell: true,
    timeout,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  if (exitCode === 0 && !result.error) {
    const note = `Worker runner repair reran finalized PRD verification at ${utils.nowIso()}: exit_code=0 command=${command}`;
    repairs.push(`post_verify_passed:${normalized}`);
    repairs.push(...commitFinalizedPrdRepair(normalized, note));
  } else {
    repairs.push(`post_verify_failed:${normalized}:${exitCode}`);
    const prdFile = path.join(TICKETS_ROOT, "done", safeSegment(normalized), `${normalized}.md`);
    const allowed = fs.existsSync(prdFile) ? markdownListSection(prdFile, "Allowed Paths") : [];
    const gitRoot = projectGitRoot();
    if (gitRoot) repairs.push(...cleanupVerificationArtifacts(gitRoot, allowed));
  }
  return repairs;
}

export function cmdWorkerActiveGet(): void {
  const runnerId = currentRunnerId("worker");
  const maxItems = positiveInt(getArg("--max-items") || "", 12);
  const repairActions = cleanupCompletedPrdArtifacts();
  const repairFinalizedPrd = normalizePrdKey(getArg("--repair-finalized-prd") || "");
  if (repairFinalizedPrd) {
    repairActions.push(...repairFinalizedPrdPostVerification(repairFinalizedPrd));
  }
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
  } else {
    const stateRepair = clearStaleWorkerActiveState(runnerId);
    if (stateRepair) repairActions.push(stateRepair);
  }
  const scopedSources = active ? [compactWorkerSource(active)] : [];
  const noOwnedNextAction = "run worker.work-snapshot before idling";
  const followupReason = workerFollowupReason(active);
  const nextAction = workerNextAction(active);
  const blockedSetupTerminal = followupReason === "worker_ticket_blocked_waiting_for_prd_worktree";
  const terminal = blockedSetupTerminal ||
    followupReason === "worker_ticket_waiting_for_verifier" ||
    followupReason === "verifier_passed_worker_finalization_pending";
  const mustContinue = Boolean(active && !terminal);
  ok({
    tool: "worker.active-get",
    runner: runnerId,
    generated_at: utils.nowIso(),
    repair_actions: repairActions,
    repair_action_count: repairActions.length,
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
    next_tool: active ? "" : "worker.work-snapshot",
    idle_allowed: !active || terminal,
    active_get_terminal: terminal,
    no_owned_ticket_instruction: active ? "" : noOwnedNextAction,
    ai_followup_recommended: Boolean(active && !blockedSetupTerminal),
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
