import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { listQueueItems, readQueueItem } from "./queue";
import { extractChecklistFromText, extractSectionLines } from "./sections";

export function listWorkerTicketItems(bucket: string): WorkerTicketItem[] {
  const dir = path.join(TICKETS_ROOT, bucket);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^(Todo-\d+|tickets_\d+)\.md$/.test(name))
    .map((name) => path.join(dir, name))
    .filter((file) => safeIsFile(file))
    .map((file) => readWorkerTicketItem(file, bucket))
    .sort(workerTicketSort);
}

export function readWorkerTicketItem(file: string, kind: string): WorkerTicketItem {
  const base = readQueueItem(file, kind);
  return {
    ...base,
    allowed_paths: utils.ticketConcreteAllowedPaths(file),
    claimed_by: utils.extractScalarFieldInSection(file, "Ticket", "Claimed By"),
    execution_ai: utils.extractScalarFieldInSection(file, "Ticket", "Execution AI"),
    worktree_path: utils.ticketWorktreePathFromFile(file),
    worktree_status: utils.extractScalarFieldInSection(file, "Worktree", "Integration Status"),
    semantic_decision: utils.extractScalarFieldInSection(file, "Verification", "Semantic Decision"),
    semantic_reason: utils.extractScalarFieldInSection(file, "Verification", "Semantic Reason"),
    semantic_checked_at: utils.extractScalarFieldInSection(file, "Verification", "Semantic Checked At"),
    semantic_log: utils.extractScalarFieldInSection(file, "Verification", "Semantic Log"),
  };
}

export function workerTicketSort(a: WorkerTicketItem, b: WorkerTicketItem): number {
  if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
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
  return String(raw || "").trim().replace(/-\d+$/, "").toLowerCase();
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
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
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
    active_ticket_id: idFromPath(ticket) ? `Todo-${idFromPath(ticket)}` : "",
    active_ticket_path: boardRel(ticket),
    active_stage: stage,
    last_result: result,
  }, BOARD_ROOT);
}

export function setRecoveryField(ticket: string, field: string, value: string): void {
  utils.replaceScalarFieldInSection(ticket, "Recovery State", field, value);
}

export function collectUsedIds(kind: string): Set<string> {
  const used = new Set<string>();
  const patterns: RegExp[] =
    kind === "ticket" ? [/^(Todo-|tickets_)(\d+)\.md$/] :
    kind === "prd" ? [/^(prd|project)_(\d+)\.md$/] :
    [/^order_(\d+)(?:_retry_.*)?\.md$/];
  const roots = [
    path.join(TICKETS_ROOT, "order"),
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
        const id = m?.[2] || m?.[1] || "";
        if (/^\d+$/.test(id)) used.add(String(Number.parseInt(id, 10)).padStart(3, "0"));
      }
    }
  }
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  for (const file of collectFiles(reservationsDir, new RegExp(`^${kind}_\\d+_.*\\.json$`), 1)) {
    const m = path.basename(file).match(new RegExp(`^${kind}_(\\d+)_`));
    if (m) used.add(m[1]);
  }
  return used;
}
