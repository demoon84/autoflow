import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, normalizePrdKey, parseTicketId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { listQueueItems, readQueueItem } from "./queue";
import { extractChecklistFromText, extractSectionLines } from "./sections";

export function listWorkerTicketItems(bucket: string): WorkerTicketItem[] {
  const dir = path.join(TICKETS_ROOT, bucket);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/.test(name))
    .map((name) => path.join(dir, name))
    .filter((file) => safeIsFile(file))
    .map((file) => readWorkerTicketItem(file, bucket))
    .sort(workerTicketSort);
}

export function readWorkerTicketItem(file: string, kind: string): WorkerTicketItem {
  const base = readQueueItem(file, kind);
  const prdKey = normalizePrdKey(
    utils.extractScalarFieldInSection(file, "Ticket", "PRD Key") ||
    utils.extractScalarFieldInSection(file, "References", "PRD")
  );
  return {
    ...base,
    prd_key: prdKey,
    allowed_paths: utils.ticketConcreteAllowedPaths(file),
    claimed_by: utils.extractScalarFieldInSection(file, "Ticket", "Claimed By"),
    execution_ai: utils.extractScalarFieldInSection(file, "Ticket", "Execution AI"),
    worktree_path: utils.ticketWorktreePathFromFile(file),
    worktree_status: utils.extractScalarFieldInSection(file, "Worktree", "Integration Status"),
    semantic_decision: utils.extractScalarFieldInSection(file, "Verification", "Semantic Decision"),
    semantic_reason: utils.extractScalarFieldInSection(file, "Verification", "Semantic Reason"),
    semantic_checked_at: utils.extractScalarFieldInSection(file, "Verification", "Semantic Checked At"),
    semantic_log: utils.extractScalarFieldInSection(file, "Verification", "Semantic Log"),
    submitted_to_verifier_at: utils.extractScalarFieldInSection(file, "Verification", "Submitted At"),
  };
}

export function workerTicketSort(a: WorkerTicketItem, b: WorkerTicketItem): number {
  const ai = Number.parseInt(a.id || "999999", 10);
  const bi = Number.parseInt(b.id || "999999", 10);
  if (ai !== bi) return ai - bi;
  return a.path.localeCompare(b.path);
}

export function ticketItemOwnedByRunner(item: WorkerTicketItem, runnerId: string): boolean {
  return runnerTokenMatches(item.claimed_by, runnerId) ||
    runnerTokenMatches(item.execution_ai, runnerId);
}

export function runnerTokenMatches(raw: string, runnerId: string): boolean {
  if (!raw || !runnerId) return false;
  const tokenRunner = raw.includes(":") ? raw.split(":")[0] : raw;
  return canonicalRunnerId(tokenRunner) === canonicalRunnerId(runnerId);
}

export function canonicalRunnerId(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

export function claimToken(runnerId: string): string {
  const pid = positiveInt(process.env.AUTOFLOW_WORKER_PID || process.env.AUTOFLOW_RUNNER_PID || "", process.pid);
  return `${runnerId}:${pid}:${utils.nowIso()}`;
}

export function requireTicket(states: string[]): string {
  const ticketRaw = getArg("--ticket");
  if (!ticketRaw) fail(2, "worker command requires --ticket");
  const ticket = resolveTicketPath(ticketRaw, states);
  if (!ticket) fail(1, `ticket not found: ${ticketRaw}`, { states: states.join(",") });
  return ticket;
}

export function resolveTicketPath(raw: string, states: string[]): string {
  const direct = resolveBoardPath(raw);
  if (direct && fs.existsSync(direct) && safeIsFile(direct)) {
    const resolved = path.resolve(direct);
    for (const state of states) {
      const stateRoot = path.resolve(path.join(TICKETS_ROOT, state));
      if (resolved.startsWith(stateRoot + path.sep)) return resolved;
    }
  }
  const id = normalizeId(raw);
  if (!id) return "";
  for (const state of states) {
    for (const name of [`TODO-${id}.md`, `TODO-${id}.md`]) {
      const candidate = path.join(TICKETS_ROOT, state, name);
      if (safeIsFile(candidate)) return candidate;
    }
  }
  return "";
}

export function doneWhenCheck(ticket: string): JsonObject {
  const lines = extractSectionLines(utils.readFileSafe(ticket), "Done When");
  const items = lines.filter((line) => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
  const unchecked = items.filter((line) => !/^\s*[-*]\s+\[[xX]\]\s+/.test(line));
  return {
    passed: items.length > 0 && unchecked.length === 0,
    item_count: items.length,
    unchecked_count: unchecked.length,
    unchecked_items: unchecked.map((line) => line.trim()),
  };
}

export function updateWorkerState(runnerId: string, ticket: string, stage: string, result: string): void {
  utils.updateRunnerState(runnerId, {
    runner_status: stage === "idle" ? "idle" : "running",
    active_role: "worker",
    active_ticket_id: idFromPath(ticket) ? `TODO-${idFromPath(ticket)}` : "",
    active_ticket_path: boardRel(ticket),
    active_stage: stage,
    last_result: result,
  }, BOARD_ROOT);
}

export function collectUsedIds(kind: string, namespace = ""): Set<string> {
  const used = new Set<string>();
  const patterns: RegExp[] =
    kind === "ticket" ? [/^TODO-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\.md$/] :
    kind === "prd" ? [/^PRD-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\.md$/] :
    [];
  const roots = [
    path.join(TICKETS_ROOT, "prd"),
    path.join(TICKETS_ROOT, "todo"),
    path.join(TICKETS_ROOT, "inprogress"),
    path.join(TICKETS_ROOT, "verifier"),
    path.join(TICKETS_ROOT, "done"),
  ];
  for (const root of roots) {
    for (const file of collectFiles(root, /\.md$/, 6)) {
      const base = path.basename(file);
      for (const pattern of patterns) {
        const m = base.match(pattern);
        const parsed = parseTicketId(m?.[1] || "");
        if ((!namespace || parsed.namespace === namespace) && parsed.numeric > 0) {
          used.add(String(parsed.numeric).padStart(3, "0"));
        }
      }
    }
  }
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  const reservationPattern = namespace
    ? new RegExp(`^${kind}_${escapeRe(namespace)}_\\d+_.*\\.json$`)
    : new RegExp(`^${kind}_(?:(?:[A-Za-z0-9][A-Za-z0-9_.-]*)_)?\\d+_.*\\.json$`);
  for (const file of collectFiles(reservationsDir, reservationPattern, 1)) {
    const m = path.basename(file).match(new RegExp(`^${kind}_(?:(?:[A-Za-z0-9][A-Za-z0-9_.-]*)_)?(\\d+)_`));
    if (m) used.add(m[1].padStart(3, "0"));
  }
  return used;
}
