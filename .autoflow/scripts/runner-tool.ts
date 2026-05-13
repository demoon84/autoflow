#!/usr/bin/env tsx
/*
 * runner-tool.ts — small LLM-called runner tools.
 *
 * Runners (planner/worker/verifier/wiki) make decisions. Runner tools only
 * perform narrow, auditable board mutations or snapshots.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import * as utils from "./board-utils";

const SCRIPT_DIR = path.dirname(process.argv[1] || __filename);
const DEFAULT_BOARD_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_PROJECT_ROOT = path.resolve(DEFAULT_BOARD_ROOT, "..");
const BOARD_ROOT = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || DEFAULT_BOARD_ROOT);
const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || DEFAULT_PROJECT_ROOT);
const TICKETS_ROOT = path.join(BOARD_ROOT, "tickets");

type JsonValue = unknown;
type JsonObject = Record<string, unknown>;

interface QueueItem {
  kind: string;
  path: string;
  id: string;
  priority: string;
  priority_rank: number;
  title: string;
  status: string;
  stage: string;
  retry: boolean;
  express: boolean;
  recovery_status?: string;
  failure_class?: string;
}

interface WorkerTicketItem extends QueueItem {
  allowed_paths: string[];
  claimed_by: string;
  execution_ai: string;
  worktree_path: string;
  worktree_status: string;
  conflicts?: ConflictInfo[];
}

interface ConflictInfo {
  path: string;
  ticket: string;
  owner: string;
}

interface GitRunResult {
  status: number;
  stdout: string;
  stderr: string;
}

const args = process.argv.slice(2);

main();

function main(): void {
  if (args.length === 0 || hasFlag("-h") || hasFlag("--help")) {
    usage();
    process.exit(0);
  }

  const runner = args.shift();
  const command = args.shift();
  if (!command) fail(2, `missing ${runner || "runner"} command`);

  switch (runner) {
    case "planner":
      dispatchPlanner(command);
      return;
    case "worker":
      dispatchWorker(command);
      return;
    case "verifier":
      dispatchVerifier(command);
      return;
    case "wiki":
      dispatchWiki(command);
      return;
    default:
      fail(2, `unknown runner tool group: ${runner || ""}`);
  }
}

function usage(): void {
  process.stdout.write(`Usage:
  runner-tool.ts planner queue-snapshot
  runner-tool.ts planner reserve-id --kind <prd|ticket|order> [--ttl-sec <seconds>]
  runner-tool.ts planner write-prd --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  runner-tool.ts planner write-ticket --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  runner-tool.ts planner item-archive --from <board-path> --project-key <key> [--as <filename>]
  runner-tool.ts planner recovery-update --ticket <board-path> --status <value> [--failure-class <value>] [--evidence <text>] [--decision <text>] [--instruction <text>] [--note <text>]
  runner-tool.ts planner guard [--strict]

  runner-tool.ts worker active-get [--runner <id>]
  runner-tool.ts worker todo-snapshot [--runner <id>]
  runner-tool.ts worker claim --ticket <Todo-NNN|path> [--runner <id>]
  runner-tool.ts worker worktree-status --ticket <Todo-NNN|path>
  runner-tool.ts worker worktree-ensure --ticket <Todo-NNN|path>
  runner-tool.ts worker stage-set --ticket <Todo-NNN|path> --stage <value> [--runner <id>]
  runner-tool.ts worker context-update --ticket <Todo-NNN|path> [--next-action <text>] [--resume-current <text>] [--resume-last <text>] [--resume-first <text>] [--note <text>]
  runner-tool.ts worker verification-record --ticket <Todo-NNN|path> --result <value> [--command <cmd>] [--exit-code <n>] [--summary <text>|--summary-file <file>]
  runner-tool.ts worker done-when-check --ticket <Todo-NNN|path>
  runner-tool.ts worker diff-check --ticket <Todo-NNN|path>
  runner-tool.ts worker finish-pass --ticket <Todo-NNN|path> --summary <text>
  runner-tool.ts worker finish-fail --ticket <Todo-NNN|path> --reason <text>

  runner-tool.ts verifier queue-snapshot [--runner <id>]
  runner-tool.ts verifier evidence --ticket <Todo-NNN|path> [--patch-bytes <n>]
  runner-tool.ts verifier decision-record --ticket <Todo-NNN|path> --decision <pass|fail> --reason <text> [--runner <id>]
  runner-tool.ts verifier finish-pass --ticket <Todo-NNN|path> --summary <text> [--runner <id>]
  runner-tool.ts verifier finish-fail --ticket <Todo-NNN|path> --reason <text> [--runner <id>]
  runner-tool.ts verifier wake

  runner-tool.ts wiki source-snapshot [--runner <id>] [--max-items <n>]
  runner-tool.ts wiki update-baseline [--dry-run]
  runner-tool.ts wiki telemetry-summary [--slug-set telemetry-default|--slug <slug>] [--window 7d|30d|all] [--runner <id>]
  runner-tool.ts wiki query --term <text> [--term <text>]... [--limit <n>] [--rag] [--synth] [--save-as <slug>] [--runner <id>]
  runner-tool.ts wiki lint [--semantic] [--runner <id>]
  runner-tool.ts wiki ingest --source <file> [--slug <slug>] [--no-summary] [--runner <id>]
  runner-tool.ts wiki retrofit-frontmatter [--dry-run] [--page wiki/<kind>/<slug>.md] [--allow-adapter] [--runner <id>]
  runner-tool.ts wiki write-page --path wiki/<path>.md --content-file <file> [--overwrite]
  runner-tool.ts wiki diff-snapshot
  runner-tool.ts wiki wake

Output is JSON. Runner tools do not infer scope, draft Done When, or choose work.
`);
}

function dispatchPlanner(command: string): void {
  switch (command) {
    case "queue-snapshot":
      cmdPlannerQueueSnapshot();
      return;
    case "reserve-id":
      cmdPlannerReserveId();
      return;
    case "write-prd":
      cmdPlannerWritePrd();
      return;
    case "write-ticket":
      cmdPlannerWriteTicket();
      return;
    case "item-archive":
      cmdPlannerItemArchive();
      return;
    case "recovery-update":
      cmdPlannerRecoveryUpdate();
      return;
    case "guard":
      cmdPlannerGuard();
      return;
    default:
      fail(2, `unknown planner command: ${command}`);
  }
}

function dispatchWorker(command: string): void {
  switch (command) {
    case "active-get":
      cmdWorkerActiveGet();
      return;
    case "todo-snapshot":
      cmdWorkerTodoSnapshot();
      return;
    case "claim":
      cmdWorkerClaim();
      return;
    case "worktree-status":
      cmdWorkerWorktreeStatus();
      return;
    case "worktree-ensure":
      cmdWorkerWorktreeEnsure();
      return;
    case "stage-set":
      cmdWorkerStageSet();
      return;
    case "context-update":
      cmdWorkerContextUpdate();
      return;
    case "verification-record":
      cmdWorkerVerificationRecord();
      return;
    case "done-when-check":
      cmdWorkerDoneWhenCheck();
      return;
    case "diff-check":
      cmdWorkerDiffCheck();
      return;
    case "finish-pass":
      cmdWorkerFinish("pass");
      return;
    case "finish-fail":
      cmdWorkerFinish("fail");
      return;
    default:
      fail(2, `unknown worker command: ${command}`);
  }
}

function dispatchVerifier(command: string): void {
  switch (command) {
    case "queue-snapshot":
      cmdVerifierQueueSnapshot();
      return;
    case "evidence":
      cmdVerifierEvidence();
      return;
    case "decision-record":
      cmdVerifierDecisionRecord();
      return;
    case "finish-pass":
      cmdVerifierFinish("pass");
      return;
    case "finish-fail":
      cmdVerifierFinish("fail");
      return;
    case "wake":
      cmdVerifierWake();
      return;
    default:
      fail(2, `unknown verifier command: ${command}`);
  }
}

function dispatchWiki(command: string): void {
  switch (command) {
    case "source-snapshot":
      cmdWikiSourceSnapshot();
      return;
    case "update-baseline":
      cmdWikiUpdateBaseline();
      return;
    case "telemetry-summary":
      cmdWikiTelemetrySummary();
      return;
    case "query":
      cmdWikiQuery();
      return;
    case "lint":
      cmdWikiLint();
      return;
    case "ingest":
      cmdWikiIngest();
      return;
    case "retrofit-frontmatter":
      cmdWikiRetrofitFrontmatter();
      return;
    case "write-page":
      cmdWikiWritePage();
      return;
    case "diff-snapshot":
      cmdWikiDiffSnapshot();
      return;
    case "wake":
      cmdWikiWake();
      return;
    default:
      fail(2, `unknown wiki command: ${command}`);
  }
}

function cmdPlannerQueueSnapshot(): void {
  const items: QueueItem[] = [];
  items.push(...listQueueItems("inbox", [/^order_.*\.md$/], "order"));
  items.push(...listQueueItems("backlog", [/^(prd|project)_\d+\.md$/], "prd"));
  items.push(...listQueueItems("todo", [/^(Todo-\d+|tickets_\d+)\.md$/], "todo"));
  items.push(...listQueueItems("inprogress", [/^(Todo-\d+|tickets_\d+)\.md$/], "inprogress"));

  items.sort((a, b) => {
    if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
    const ai = Number.parseInt(a.id || "999999", 10);
    const bi = Number.parseInt(b.id || "999999", 10);
    if (ai !== bi) return ai - bi;
    return a.path.localeCompare(b.path);
  });

  ok({
    tool: "planner.queue-snapshot",
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    generated_at: utils.nowIso(),
    item_count: items.length,
    items,
  });
}

function cmdPlannerReserveId(): void {
  const kind = getArg("--kind") || getArg("-k");
  if (!kind || !["prd", "ticket", "order"].includes(kind)) {
    fail(2, "reserve-id requires --kind prd|ticket|order");
  }
  const ttlSec = positiveInt(getArg("--ttl-sec") || "", 3600);
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  fs.mkdirSync(reservationsDir, { recursive: true });
  pruneReservations(reservationsDir, ttlSec);

  const used = collectUsedIds(kind);
  for (let i = 1; i < 1000000; i += 1) {
    const id = String(i).padStart(3, "0");
    if (used.has(id)) continue;
    const token = `${Date.now()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    const reservationPath = path.join(reservationsDir, `${kind}_${id}_${token}.json`);
    try {
      fs.writeFileSync(
        reservationPath,
        JSON.stringify({ kind, id, token, created_at: utils.nowIso(), owner: currentRunnerId() }, null, 2) + "\n",
        { encoding: "utf8", flag: "wx" }
      );
      ok({
        tool: "planner.reserve-id",
        kind,
        id,
        reservation: boardRel(reservationPath),
        reservation_abs: reservationPath,
      });
      return;
    } catch {
      used.add(id);
    }
  }
  fail(1, `no ${kind} id available`);
}

function cmdPlannerWritePrd(): void {
  const payload = readWritePayload();
  const id = normalizeId(getArg("--id") || stringValue(payload.id) || extractIdFromContent(payload.content, "prd"));
  if (!id) fail(2, "write-prd requires --id or content with prd_NNN");
  const target = path.join(TICKETS_ROOT, "backlog", `prd_${id}.md`);

  validateNoUnsafeWrite(target, hasFlag("--overwrite"));
  validatePrdContent(payload.content, id);
  writeAtomic(target, payload.content);
  releaseReservation(getArg("--reservation") || stringValue(payload.reservation));

  ok({ tool: "planner.write-prd", status: "ok", id: `prd_${id}`, path: boardRel(target) });
}

function cmdPlannerWriteTicket(): void {
  const payload = readWritePayload();
  const id = normalizeId(getArg("--id") || stringValue(payload.id) || extractIdFromContent(payload.content, "ticket"));
  if (!id) fail(2, "write-ticket requires --id or content with Todo-NNN");
  const target = path.join(TICKETS_ROOT, "todo", `Todo-${id}.md`);

  validateNoUnsafeWrite(target, hasFlag("--overwrite"));
  validateTicketContent(payload.content, id);
  writeAtomic(target, payload.content);
  releaseReservation(getArg("--reservation") || stringValue(payload.reservation));

  ok({ tool: "planner.write-ticket", status: "ok", id: `Todo-${id}`, path: boardRel(target) });
}

function cmdPlannerItemArchive(): void {
  const fromRaw = getArg("--from");
  const projectKey = getArg("--project-key");
  if (!fromRaw) fail(2, "item-archive requires --from");
  if (!projectKey || !/^[A-Za-z0-9._-]+$/.test(projectKey)) fail(2, "item-archive requires safe --project-key");

  const from = resolveBoardPath(fromRaw);
  if (!from || !fs.existsSync(from) || !fs.statSync(from).isFile()) fail(1, `archive source not found: ${fromRaw}`);
  const targetName = getArg("--as") || path.basename(from);
  if (!/^[A-Za-z0-9._-]+\.md$/.test(targetName)) fail(2, "archive target filename must be a safe markdown filename");
  const target = path.join(TICKETS_ROOT, "done", projectKey, targetName);
  validateNoUnsafeWrite(target, false);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(from, target);

  ok({ tool: "planner.item-archive", status: "ok", from: boardRel(from), path: boardRel(target), project_key: projectKey });
}

function cmdPlannerRecoveryUpdate(): void {
  const ticketRaw = getArg("--ticket");
  const status = getArg("--status");
  if (!ticketRaw) fail(2, "recovery-update requires --ticket");
  if (!status) fail(2, "recovery-update requires --status");
  const ticket = resolveBoardPath(ticketRaw);
  if (!ticket || !fs.existsSync(ticket) || !fs.statSync(ticket).isFile()) fail(1, `ticket not found: ${ticketRaw}`);

  setRecoveryField(ticket, "Status", status);
  setRecoveryField(ticket, "Detected By", getArg("--detected-by") || "planner");
  setRecoveryField(ticket, "Failure Class", getArg("--failure-class") || "");
  setRecoveryField(ticket, "Evidence", getArg("--evidence") || "");
  setRecoveryField(ticket, "Planner Decision", getArg("--decision") || "");
  setRecoveryField(ticket, "Owner Resume Instruction", getArg("--instruction") || "");
  setRecoveryField(ticket, "Last Recovery At", utils.nowIso());
  const note = getArg("--note");
  if (note) utils.appendNote(ticket, `Planner recovery update at ${utils.nowIso()}: ${note}`);

  ok({ tool: "planner.recovery-update", status: "ok", path: boardRel(ticket), recovery_status: status });
}

function cmdPlannerGuard(): void {
  const guardJs = path.join(SCRIPT_DIR, "board-guard.js");
  const guardTs = path.join(SCRIPT_DIR, "board-guard.ts");
  const strictArgs = hasFlag("--strict") ? ["--strict"] : [];
  const guardEnv = {
    ...process.env,
    PROJECT_ROOT,
    AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
    BOARD_ROOT,
    AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
  };
  const result = fs.existsSync(guardJs)
    ? spawnSync("node", [guardJs, ...strictArgs], { encoding: "utf8", env: guardEnv })
    : spawnSync("npx", ["tsx", guardTs, ...strictArgs], { encoding: "utf8", env: guardEnv });
  ok({
    tool: "planner.guard",
    status: result.status === 0 ? "ok" : "error",
    exit_code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  });
  process.exit(result.status === 0 ? 0 : 1);
}

function cmdWorkerActiveGet(): void {
  const runnerId = currentRunnerId("worker");
  const inprogress = listWorkerTicketItems("inprogress");
  const owned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  ok({
    tool: "worker.active-get",
    runner: runnerId,
    generated_at: utils.nowIso(),
    owned_count: owned.length,
    owned,
    inprogress_count: inprogress.length,
    inprogress,
  });
}

function cmdWorkerTodoSnapshot(): void {
  const runnerId = currentRunnerId("worker");
  const inprogress = listWorkerTicketItems("inprogress");
  const activeOwned = inprogress.filter((item) => ticketItemOwnedByRunner(item, runnerId));
  const todos = listWorkerTicketItems("todo").map((item) => {
    const conflicts = pathConflictGuardEnabled()
      ? collectTicketConflicts(resolveBoardPath(item.path), inprogress, runnerId)
      : [];
    return {
      ...item,
      conflicts,
      claimable: activeOwned.length === 0 && conflicts.length === 0,
      blocked_reason:
        activeOwned.length > 0 ? "runner_has_active_ticket" :
        conflicts.length > 0 ? "allowed_path_conflict" :
        "",
    };
  });
  todos.sort(workerTicketSort);
  ok({
    tool: "worker.todo-snapshot",
    runner: runnerId,
    generated_at: utils.nowIso(),
    active_owned_count: activeOwned.length,
    todo_count: todos.length,
    todos,
  });
}

function cmdWorkerClaim(): void {
  const ticketRaw = getArg("--ticket");
  if (!ticketRaw) fail(2, "worker claim requires --ticket");
  const runnerId = currentRunnerId("worker");
  const token = ownershipToken(runnerId);
  const lock = acquireDispatchLock();
  if (!lock.acquired) fail(1, "dispatch lock is held by another worker", { reason: "dispatch_lock_busy" });

  try {
    const source = resolveTicketPath(ticketRaw, ["todo"]);
    if (!source) fail(1, `claimable todo ticket not found: ${ticketRaw}`);
    const activeOwned = listWorkerTicketItems("inprogress").filter((item) => ticketItemOwnedByRunner(item, runnerId));
    if (activeOwned.length > 0) {
      fail(1, "runner already owns an active ticket; resume it before claiming another", {
        reason: "runner_has_active_ticket",
        active_ticket: activeOwned[0]?.path || "",
      });
    }

    const conflicts = pathConflictGuardEnabled()
      ? collectTicketConflicts(source, listWorkerTicketItems("inprogress"), runnerId)
      : [];
    if (conflicts.length > 0) {
      fail(1, "ticket conflicts with another inprogress ticket Allowed Paths", {
        reason: "allowed_path_conflict",
        conflicts,
      });
    }

    const target = path.join(TICKETS_ROOT, "inprogress", path.basename(source));
    if (fs.existsSync(target)) fail(1, `inprogress target already exists: ${boardRel(target)}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);

    const now = utils.nowIso();
    utils.replaceScalarFieldInSection(target, "Ticket", "Stage", "executing");
    utils.replaceScalarFieldInSection(target, "Ticket", "AI", runnerId);
    utils.replaceScalarFieldInSection(target, "Ticket", "Claimed By", token);
    utils.replaceScalarFieldInSection(target, "Ticket", "Execution AI", runnerId);
    utils.replaceScalarFieldInSection(target, "Ticket", "Last Updated", now);
    replaceSectionBlock(target, "Next Action", "- 다음에 바로 이어서 할 일: worker runner-tool worktree-ensure로 작업 루트를 준비한 뒤 Allowed Paths 안에서 구현을 진행한다.");
    replaceSectionBlock(
      target,
      "Resume Context",
      `- Current state: worker runner-tool claimed this ticket and moved it to inprogress.
- Last completed action: claim by ${runnerId} at ${now}.
- First thing to inspect on resume: Worktree, Goal, Allowed Paths, Done When, Notes.`
    );
    utils.appendNote(target, `Worker runner-tool claimed ticket at ${now}: runner=${runnerId}`);
    updateWorkerState(runnerId, target, "executing", "claimed");

    ok({
      tool: "worker.claim",
      status: "ok",
      runner: runnerId,
      ticket_id: `Todo-${idFromPath(target)}`,
      from: boardRel(source),
      path: boardRel(target),
      claimed_by: token,
      stage: "executing",
      next_action: "Call worker worktree-ensure, then implement inside the returned working_root.",
    });
  } finally {
    releaseDispatchLock(lock);
  }
}

function cmdWorkerWorktreeStatus(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  ok({
    tool: "worker.worktree-status",
    path: boardRel(ticket),
    ...readWorktreeStatus(ticket),
  });
}

function cmdWorkerWorktreeEnsure(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const result = ensureWorkerTicketWorktree(ticket);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", utils.nowIso());
  ok({ tool: "worker.worktree-ensure", path: boardRel(ticket), ...result });
}

function cmdWorkerStageSet(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const stage = getArg("--stage");
  if (!stage) fail(2, "worker stage-set requires --stage");
  const runnerId = currentRunnerId("worker");
  const now = utils.nowIso();
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", stage);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  const note = getArg("--note");
  if (note) utils.appendNote(ticket, `Stage set to ${stage} at ${now}: ${note}`);
  updateWorkerState(runnerId, ticket, stage, `stage_${stage}`);
  ok({ tool: "worker.stage-set", path: boardRel(ticket), runner: runnerId, stage });
}

function cmdWorkerContextUpdate(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const nextAction = getArg("--next-action");
  if (nextAction) replaceSectionBlock(ticket, "Next Action", bulletize(nextAction));

  const resumeCurrent = getArg("--resume-current");
  const resumeLast = getArg("--resume-last");
  const resumeFirst = getArg("--resume-first");
  if (resumeCurrent || resumeLast || resumeFirst) {
    replaceSectionBlock(
      ticket,
      "Resume Context",
      `- Current state: ${resumeCurrent || utils.extractScalarFieldInSection(ticket, "Resume Context", "Current state") || "not provided"}
- Last completed action: ${resumeLast || "not provided"}
- First thing to inspect on resume: ${resumeFirst || "not provided"}`
    );
  }

  const note = getArg("--note");
  if (note) utils.appendNote(ticket, note);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", utils.nowIso());
  ok({
    tool: "worker.context-update",
    path: boardRel(ticket),
    updated_next_action: Boolean(nextAction),
    updated_resume_context: Boolean(resumeCurrent || resumeLast || resumeFirst),
    appended_note: Boolean(note),
  });
}

function cmdWorkerVerificationRecord(): void {
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

  ok({
    tool: "worker.verification-record",
    path: boardRel(ticket),
    result,
    command_recorded: Boolean(command),
    exit_code: exitCode || "",
    summary_recorded: Boolean(summary),
  });
}

function cmdWorkerDoneWhenCheck(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const check = doneWhenCheck(ticket);
  ok({ tool: "worker.done-when-check", path: boardRel(ticket), ...check });
}

function cmdWorkerDiffCheck(): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  ok({ tool: "worker.diff-check", path: boardRel(ticket), ...diffCheck(ticket) });
}

function cmdWorkerFinish(outcome: "pass" | "fail"): void {
  const ticket = requireTicket(["inprogress", "todo", "verifier", "ready-to-merge"]);
  const message = outcome === "pass" ? getArg("--summary") : getArg("--reason");
  if (!message) fail(2, `worker finish-${outcome} requires --${outcome === "pass" ? "summary" : "reason"}`);
  const finishTs = path.join(SCRIPT_DIR, "finish-ticket-owner.ts");
  const finishEnv = {
    ...process.env,
    PROJECT_ROOT,
    AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
    BOARD_ROOT,
    AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
    AUTOFLOW_ROLE: "ticket-owner",
    AUTOFLOW_WORKER_ID: currentRunnerId("worker"),
  };
  const result = spawnTsScript(finishTs, [boardRel(ticket), outcome, message], finishEnv);
  ok({
    tool: `worker.finish-${outcome}`,
    path: boardRel(ticket),
    exit_code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  });
  process.exit(result.status === 0 ? 0 : 1);
}

function cmdVerifierQueueSnapshot(): void {
  const runnerId = currentRunnerId("verifier");
  const tickets = listWorkerTicketItems("verifier").map((item) => ({
    ...item,
    verify_pending: item.stage === "verify_pending" || item.stage === "",
  }));
  ok({
    tool: "verifier.queue-snapshot",
    runner: runnerId,
    generated_at: utils.nowIso(),
    ticket_count: tickets.length,
    tickets,
  });
}

function cmdVerifierEvidence(): void {
  const ticket = requireTicket(["verifier"]);
  const patchBytes = positiveInt(getArg("--patch-bytes") || "", 20000);
  ok({
    tool: "verifier.evidence",
    path: boardRel(ticket),
    ...readVerifierEvidence(ticket, patchBytes),
  });
}

function cmdVerifierDecisionRecord(): void {
  const ticket = requireTicket(["verifier"]);
  const decision = getArg("--decision");
  const reason = getArg("--reason");
  if (!["pass", "fail"].includes(decision)) fail(2, "verifier decision-record requires --decision pass|fail");
  if (!reason) fail(2, "verifier decision-record requires --reason");
  const record = recordVerifierDecision(ticket, decision as "pass" | "fail", reason, decision === "pass");
  ok({
    tool: "verifier.decision-record",
    path: boardRel(ticket),
    decision,
    reason,
    ...record,
  });
}

function cmdVerifierFinish(outcome: "pass" | "fail"): void {
  const ticket = requireTicket(["verifier"]);
  const message = outcome === "pass" ? getArg("--summary") : getArg("--reason");
  if (!message) fail(2, `verifier finish-${outcome} requires --${outcome === "pass" ? "summary" : "reason"}`);
  const decisionReason = outcome === "pass" ? message : `verifier_semantic_mismatch: ${message}`;
  const record = recordVerifierDecision(ticket, outcome, decisionReason, outcome === "pass");
  const ticketId = idFromPath(ticket);
  const finishTs = path.join(SCRIPT_DIR, "finish-ticket-owner.ts");
  const finishEnv = {
    ...process.env,
    PROJECT_ROOT,
    AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
    BOARD_ROOT,
    AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
    AUTOFLOW_ROLE: "ticket-owner",
    AUTOFLOW_WORKER_ID: currentRunnerId("verifier"),
    AUTOFLOW_SKIP_VERIFIER: outcome === "pass" ? "1" : process.env.AUTOFLOW_SKIP_VERIFIER || "0",
  };
  const result = spawnTsScript(finishTs, [`Todo-${ticketId}`, outcome, decisionReason], finishEnv);
  if (result.status === 0) {
    try { fs.unlinkSync(ticket); } catch {}
  }
  ok({
    tool: `verifier.finish-${outcome}`,
    ticket_id: `Todo-${ticketId}`,
    verifier_ticket: boardRel(ticket),
    decision: outcome,
    log_path: stringValue(record.log_path),
    marker_path: stringValue(record.marker_path),
    removed_verifier_ticket: result.status === 0 && !fs.existsSync(ticket),
    exit_code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  });
  process.exit(result.status === 0 ? 0 : 1);
}

function cmdVerifierWake(): void {
  const verifierDir = path.join(TICKETS_ROOT, "verifier");
  const stateDir = path.join(BOARD_ROOT, "runners", "state");
  const marker = path.join(stateDir, "verifier.verifier-realtime-wakeup.pending");
  fs.mkdirSync(verifierDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  const pending = listWorkerTicketItems("verifier");
  if (pending.length > 0) {
    fs.writeFileSync(marker, `triggered_at=${utils.nowIso()}\nticket_count=${pending.length}\n`, "utf8");
  }
  ok({
    tool: "verifier.wake",
    wakeup: pending.length > 0 ? "triggered" : "no_pending_tickets",
    marker: pending.length > 0 ? boardRel(marker) : "",
    ticket_count: pending.length,
  });
}

function cmdWikiSourceSnapshot(): void {
  const maxItems = positiveInt(getArg("--max-items") || "", 20);
  const groups = wikiSourceGroups();
  const allFiles = Object.values(groups).flat();
  const recent = allFiles
    .map((file) => {
      const stat = fs.statSync(file);
      return {
        path: boardRel(file),
        size: stat.size,
        mtime: new Date(stat.mtimeMs).toISOString().replace(/\.\d+Z$/, "Z"),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime) || a.path.localeCompare(b.path))
    .slice(0, maxItems);

  ok({
    tool: "wiki.source-snapshot",
    runner: currentRunnerId("wiki"),
    generated_at: utils.nowIso(),
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    source_counts: Object.fromEntries(Object.entries(groups).map(([name, files]) => [name, files.length])),
    total_source_files: allFiles.length,
    content_fingerprint: hashFiles(allFiles),
    recent,
  });
}

function cmdWikiUpdateBaseline(): void {
  const cliArgs = ["wiki", "update", PROJECT_ROOT, boardDirName()];
  if (hasFlag("--dry-run")) cliArgs.push("--dry-run");
  emitAutoflowResult("wiki.update-baseline", cliArgs);
}

function cmdWikiTelemetrySummary(): void {
  const cliArgs = ["wiki", "summarize-telemetry", PROJECT_ROOT, boardDirName()];
  const slug = getArg("--slug");
  const slugSet = getArg("--slug-set") || (slug ? "" : "telemetry-default");
  const windowValue = getArg("--window") || "7d";
  if (slug) cliArgs.push("--slug", slug);
  if (slugSet) cliArgs.push("--slug-set", slugSet);
  cliArgs.push("--window", windowValue);
  emitAutoflowResult("wiki.telemetry-summary", cliArgs);
}

function cmdWikiQuery(): void {
  const terms = getArgs("--term");
  if (terms.length === 0) fail(2, "wiki query requires at least one --term");
  const cliArgs = ["wiki", "query", PROJECT_ROOT, boardDirName()];
  for (const term of terms) cliArgs.push("--term", term);
  const limit = getArg("--limit");
  if (limit) cliArgs.push("--limit", limit);
  for (const flag of ["--no-tickets", "--no-snippets", "--no-handoffs", "--rag", "--synth"]) {
    if (hasFlag(flag)) cliArgs.push(flag);
  }
  const saveAs = getArg("--save-as");
  if (saveAs) cliArgs.push("--save-as", saveAs);
  cliArgs.push("--runner", currentRunnerId("wiki"));
  emitAutoflowResult("wiki.query", cliArgs);
}

function cmdWikiLint(): void {
  const cliArgs = ["wiki", "lint", PROJECT_ROOT, boardDirName()];
  if (hasFlag("--semantic")) cliArgs.push("--semantic");
  cliArgs.push("--runner", currentRunnerId("wiki"));
  emitAutoflowResult("wiki.lint", cliArgs);
}

function cmdWikiIngest(): void {
  const sourceRaw = getArg("--source");
  if (!sourceRaw) fail(2, "wiki ingest requires --source");
  const source = resolveLocalFile(sourceRaw);
  if (!source || !safeIsFile(source)) fail(1, `wiki ingest source not found: ${sourceRaw}`);
  const cliArgs = ["wiki", "ingest", PROJECT_ROOT, boardDirName(), source];
  const slug = getArg("--slug");
  if (slug) cliArgs.push("--slug", slug);
  if (hasFlag("--no-summary")) cliArgs.push("--no-summary");
  cliArgs.push("--runner", currentRunnerId("wiki"));
  emitAutoflowResult("wiki.ingest", cliArgs);
}

function cmdWikiRetrofitFrontmatter(): void {
  const cliArgs = ["wiki", "retrofit-frontmatter", PROJECT_ROOT, boardDirName()];
  if (hasFlag("--dry-run")) cliArgs.push("--dry-run");
  const page = getArg("--page");
  if (page) cliArgs.push("--page", page);
  if (hasFlag("--allow-adapter")) cliArgs.push("--allow-adapter");
  cliArgs.push("--runner", currentRunnerId("wiki"));
  emitAutoflowResult("wiki.retrofit-frontmatter", cliArgs);
}

function cmdWikiWritePage(): void {
  const rawPath = getArg("--path");
  if (!rawPath) fail(2, "wiki write-page requires --path");
  const target = resolveWikiWritablePath(rawPath);
  if (!target) fail(2, "wiki write-page path must be board-relative under wiki/ or wiki-raw/ and end in .md");
  const existed = fs.existsSync(target);
  if (existed && !hasFlag("--overwrite")) fail(1, `target already exists: ${boardRel(target)}`);

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

  writeAtomic(target, ensureTrailingNewline(content));
  ok({
    tool: "wiki.write-page",
    status: "ok",
    path: boardRel(target),
    bytes: Buffer.byteLength(ensureTrailingNewline(content), "utf8"),
    overwritten: existed,
  });
}

function cmdWikiDiffSnapshot(): void {
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

function cmdWikiWake(): void {
  const stateDir = path.join(BOARD_ROOT, "runners", "state");
  const runnerId = currentRunnerId("wiki");
  const marker = path.join(stateDir, `${runnerId}.wiki-realtime-wakeup.pending`);
  const sources = Object.values(wikiSourceGroups()).flat();
  fs.mkdirSync(stateDir, { recursive: true });
  if (sources.length > 0 || hasFlag("--force")) {
    fs.writeFileSync(marker, `triggered_at=${utils.nowIso()}\nsource_count=${sources.length}\n`, "utf8");
  }
  ok({
    tool: "wiki.wake",
    runner: runnerId,
    wakeup: sources.length > 0 || hasFlag("--force") ? "triggered" : "no_sources",
    marker: sources.length > 0 || hasFlag("--force") ? boardRel(marker) : "",
    source_count: sources.length,
  });
}

function listQueueItems(bucket: string, patterns: RegExp[], kind: string): QueueItem[] {
  const dir = path.join(TICKETS_ROOT, bucket);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => patterns.some((re) => re.test(name)))
    .map((name) => path.join(dir, name))
    .filter((file) => safeIsFile(file))
    .map((file) => readQueueItem(file, kind));
}

function readQueueItem(file: string, kind: string): QueueItem {
  const text = utils.readFileSafe(file);
  const priority = normalizePriority(readAnyPriority(file, text));
  const rel = boardRel(file);
  const recoveryStatus = utils.extractScalarFieldInSection(file, "Recovery State", "Status");
  const failureClass = utils.extractScalarFieldInSection(file, "Recovery State", "Failure Class");
  const orderExpress = utils.extractScalarFieldInSection(file, "Order", "Express").toLowerCase();
  return {
    kind,
    path: rel,
    id: idFromPath(file),
    priority,
    priority_rank: priorityRank(priority),
    title: readTitle(file, text),
    status: readStatus(file),
    stage: utils.extractScalarFieldInSection(file, "Ticket", "Stage"),
    retry: /^order_.*_retry_.*\.md$/.test(path.basename(file)),
    express: ["true", "yes", "1", "on"].includes(orderExpress),
    recovery_status: recoveryStatus || undefined,
    failure_class: failureClass || undefined,
  };
}

function readAnyPriority(file: string, text: string): string {
  const candidates = [
    utils.extractScalarFieldInSection(file, "Order", "Priority"),
    utils.extractScalarFieldInSection(file, "Ticket", "Priority"),
    utils.extractScalarFieldInSection(file, "Project", "Priority"),
  ].filter(Boolean);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatter) {
    const m = frontmatter[1].match(/^\s*priority\s*:\s*(.+)$/im);
    if (m) candidates.push(m[1]);
  }
  return candidates[0] || "normal";
}

function readTitle(file: string, text: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Order", "Title") ||
    utils.extractScalarFieldInSection(file, "Ticket", "Title") ||
    utils.extractScalarFieldInSection(file, "Project", "Title") ||
    utils.extractScalarFieldInSection(file, "Project", "Name") ||
    (text.match(/^#\s+(.+)$/m)?.[1] || "")
  ).trim();
}

function readStatus(file: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Order", "Status") ||
    utils.extractScalarFieldInSection(file, "Project", "Status") ||
    utils.extractScalarFieldInSection(file, "Ticket", "Stage") ||
    ""
  ).trim();
}

function listWorkerTicketItems(bucket: string): WorkerTicketItem[] {
  const dir = path.join(TICKETS_ROOT, bucket);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^(Todo-\d+|tickets_\d+)\.md$/.test(name))
    .map((name) => path.join(dir, name))
    .filter((file) => safeIsFile(file))
    .map((file) => readWorkerTicketItem(file, bucket))
    .sort(workerTicketSort);
}

function readWorkerTicketItem(file: string, kind: string): WorkerTicketItem {
  const base = readQueueItem(file, kind);
  return {
    ...base,
    allowed_paths: utils.ticketConcreteAllowedPaths(file),
    claimed_by: utils.extractScalarFieldInSection(file, "Ticket", "Claimed By"),
    execution_ai: utils.extractScalarFieldInSection(file, "Ticket", "Execution AI"),
    worktree_path: utils.ticketWorktreePathFromFile(file),
    worktree_status: utils.extractScalarFieldInSection(file, "Worktree", "Integration Status"),
  };
}

function workerTicketSort(a: WorkerTicketItem, b: WorkerTicketItem): number {
  if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
  const ai = Number.parseInt(a.id || "999999", 10);
  const bi = Number.parseInt(b.id || "999999", 10);
  if (ai !== bi) return ai - bi;
  return a.path.localeCompare(b.path);
}

function ticketItemOwnedByRunner(item: WorkerTicketItem, runnerId: string): boolean {
  return ownerTokenMatchesRunner(item.claimed_by, runnerId) ||
    ownerTokenMatchesRunner(item.execution_ai, runnerId);
}

function ownerTokenMatchesRunner(raw: string, runnerId: string): boolean {
  if (!raw || !runnerId) return false;
  const tokenOwner = raw.includes(":") ? raw.split(":")[0] : raw;
  return canonicalRunnerId(tokenOwner) === canonicalRunnerId(runnerId);
}

function canonicalRunnerId(raw: string): string {
  return String(raw || "").trim().replace(/-\d+$/, "").toLowerCase();
}

function ownershipToken(runnerId: string): string {
  const pid = positiveInt(process.env.AUTOFLOW_TICKET_OWNER_PID || process.env.AUTOFLOW_RUNNER_PID || "", process.pid);
  return `${runnerId}:${pid}:${utils.nowIso()}`;
}

function pathConflictGuardEnabled(): boolean {
  return !["off", "0", "false", "no"].includes(String(process.env.AUTOFLOW_PATH_CONFLICT_CHECK || "on").toLowerCase());
}

function collectTicketConflicts(candidateFile: string, inprogress: WorkerTicketItem[], runnerId: string): ConflictInfo[] {
  if (!candidateFile) return [];
  const candidatePaths = utils.ticketConcreteAllowedPaths(candidateFile);
  const conflicts: ConflictInfo[] = [];
  for (const other of inprogress) {
    if (ticketItemOwnedByRunner(other, runnerId)) continue;
    for (const a of candidatePaths) {
      for (const b of other.allowed_paths) {
        if (!pathsOverlap(a, b)) continue;
        conflicts.push({
          path: `${a} <-> ${b}`,
          ticket: other.path,
          owner: other.claimed_by || other.execution_ai || "",
        });
      }
    }
  }
  return conflicts;
}

function pathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = normalizeRelPath(aRaw);
  const b = normalizeRelPath(bRaw);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function normalizeRelPath(raw: string): string {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

function requireTicket(states: string[]): string {
  const ticketRaw = getArg("--ticket");
  if (!ticketRaw) fail(2, "worker command requires --ticket");
  const ticket = resolveTicketPath(ticketRaw, states);
  if (!ticket) fail(1, `ticket not found: ${ticketRaw}`, { states: states.join(",") });
  return ticket;
}

function resolveTicketPath(raw: string, states: string[]): string {
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

function acquireDispatchLock(): { acquired: boolean; path: string; pid: number } {
  const lockDir = path.join(BOARD_ROOT, "runners", "state", "dispatch.lock");
  const pidFile = path.join(lockDir, "pid");
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const pid = positiveInt(process.env.AUTOFLOW_TICKET_OWNER_PID || process.env.AUTOFLOW_RUNNER_PID || "", process.pid);
  const tryCreate = (): boolean => {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(pidFile, `${pid}\n`, "utf8");
      return true;
    } catch {
      return false;
    }
  };
  if (tryCreate()) return { acquired: true, path: lockDir, pid };

  let heldPid = 0;
  try { heldPid = Number.parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10); } catch {}
  if (utils.pidAlive(heldPid)) return { acquired: false, path: lockDir, pid };

  let ageMs = 0;
  try { ageMs = Date.now() - fs.statSync(lockDir).mtimeMs; } catch {}
  if (ageMs < 30000) return { acquired: false, path: lockDir, pid };

  try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch {}
  return { acquired: tryCreate(), path: lockDir, pid };
}

function releaseDispatchLock(lock: { acquired: boolean; path: string; pid: number }): void {
  if (!lock.acquired) return;
  const pidFile = path.join(lock.path, "pid");
  let heldPid = 0;
  try { heldPid = Number.parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10); } catch {}
  if (heldPid === lock.pid) {
    try { fs.rmSync(lock.path, { recursive: true, force: true }); } catch {}
  }
}

function readWorktreeStatus(ticket: string): JsonObject {
  const worktreePath = utils.ticketWorktreePathFromFile(ticket);
  const branch = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Branch"));
  const baseCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Base Commit"));
  const worktreeCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Worktree Commit"));
  const integrationStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status");
  const gitOk = worktreePath ? git(["rev-parse", "--is-inside-work-tree"], worktreePath).stdout.trim() === "true" : false;
  const head = gitOk ? git(["rev-parse", "--verify", "HEAD"], worktreePath).stdout.trim() : "";
  const actualBranch = gitOk ? git(["symbolic-ref", "--short", "HEAD"], worktreePath).stdout.trim() : "";
  const dirty = gitOk ? git(["status", "--porcelain", "--untracked-files=all"], worktreePath).stdout.trim() : "";
  const fallbackStatuses = new Set(["disabled", "not_git_repo", "no_head_commit", "project_root_fallback"]);
  const workingRoot = gitOk ? worktreePath : fallbackStatuses.has(integrationStatus) ? PROJECT_ROOT : "";
  return {
    worktree_path: worktreePath,
    worktree_status: integrationStatus,
    branch,
    actual_branch: actualBranch,
    base_commit: baseCommit,
    worktree_commit: worktreeCommit,
    head,
    is_git_worktree: gitOk,
    dirty: Boolean(dirty),
    dirty_summary: oneLine(dirty, 1000),
    working_root: workingRoot,
  };
}

function ensureWorkerTicketWorktree(ticket: string): JsonObject {
  if (worktreeModeDisabled()) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: disabled");
    return { worktree_status: "disabled", working_root: PROJECT_ROOT };
  }

  const gitRoot = utils.gitRootPath(PROJECT_ROOT);
  if (!gitRoot) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: not_git_repo");
    return { worktree_status: "not_git_repo", working_root: PROJECT_ROOT };
  }

  git(["worktree", "prune"], gitRoot);
  const baseCommit = git(["rev-parse", "--verify", "HEAD"], gitRoot).stdout.trim();
  if (!baseCommit) {
    replaceSectionBlock(ticket, "Worktree", "- Path:\n- Branch:\n- Base Commit:\n- Worktree Commit:\n- Integration Status: no_head_commit");
    return { worktree_status: "no_head_commit", working_root: PROJECT_ROOT };
  }

  const ticketId = idFromPath(ticket);
  const branch = `autoflow/tickets_${ticketId}`;
  const existingPath = utils.ticketWorktreePathFromFile(ticket);
  let worktreePath = existingPath && isGitWorktree(existingPath)
    ? existingPath
    : defaultTicketWorktreePath(ticketId, gitRoot);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

  if (!isGitWorktree(worktreePath)) {
    if (fs.existsSync(worktreePath) && fs.readdirSync(worktreePath).length > 0) {
      fail(1, `worktree path exists but is not a git worktree: ${worktreePath}`);
    }
    const addArgs = gitBranchExists(gitRoot, branch)
      ? ["worktree", "add", worktreePath, branch]
      : ["worktree", "add", "-b", branch, worktreePath, baseCommit];
    const add = git(addArgs, gitRoot);
    if (add.status !== 0) {
      fail(1, "git worktree add failed", { stdout: add.stdout, stderr: add.stderr, worktree_path: worktreePath });
    }
  }

  const actualBranch = git(["symbolic-ref", "--short", "HEAD"], worktreePath).stdout.trim() || branch;
  const existingBase = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Base Commit"));
  const existingCommit = stripTicks(utils.extractScalarFieldInSection(ticket, "Worktree", "Worktree Commit"));
  let integrationStatus = utils.extractScalarFieldInSection(ticket, "Worktree", "Integration Status") || "pending";
  if (["pending_claim", "worktree_missing", "blocked_recovery_missing_worktree", "blocked_worktree_setup_failed"].includes(integrationStatus)) {
    integrationStatus = "pending";
  }
  replaceSectionBlock(
    ticket,
    "Worktree",
    `- Path: \`${worktreePath}\`
- Branch: ${actualBranch}
- Base Commit: ${existingBase || baseCommit}
- Worktree Commit: ${existingCommit}
- Integration Status: ${integrationStatus}`
  );

  const hydration = hydrateWorktreeDependencies(ticket, worktreePath);
  return {
    worktree_status: "ready",
    worktree_path: worktreePath,
    worktree_branch: actualBranch,
    worktree_base: existingBase || baseCommit,
    working_root: worktreePath,
    dependency_status: hydration.status,
    dependency_links: hydration.links,
  };
}

function worktreeModeDisabled(): boolean {
  return ["0", "off", "false", "disabled"].includes(String(process.env.AUTOFLOW_WORKTREE_MODE || "auto").toLowerCase());
}

function defaultTicketWorktreePath(ticketId: string, gitRoot: string): string {
  const configured = process.env.AUTOFLOW_WORKTREE_ROOT;
  if (configured) return path.join(path.resolve(configured), `tickets_${ticketId}`);
  const repoName = path.basename(gitRoot);
  const home = process.env.HOME || "";
  let cacheRoot = "";
  if (process.env.XDG_CACHE_HOME) cacheRoot = path.join(process.env.XDG_CACHE_HOME, "autoflow", "worktrees");
  else if (home && process.platform === "darwin") cacheRoot = path.join(home, "Library", "Caches", "autoflow", "worktrees");
  else if (home) cacheRoot = path.join(home, ".cache", "autoflow", "worktrees");
  else cacheRoot = path.join(path.dirname(gitRoot), ".autoflow-worktrees");
  return path.join(cacheRoot, repoName, `tickets_${ticketId}`);
}

function isGitWorktree(dir: string): boolean {
  return Boolean(dir) && git(["rev-parse", "--is-inside-work-tree"], dir).stdout.trim() === "true";
}

function gitBranchExists(cwd: string, branch: string): boolean {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd).status === 0;
}

function hydrateWorktreeDependencies(ticket: string, worktreePath: string): { status: string; links: string[] } {
  if (!fs.existsSync(worktreePath) || path.resolve(worktreePath) === path.resolve(PROJECT_ROOT)) {
    return { status: "unchanged", links: [] };
  }
  const links: string[] = [];
  for (const depDir of findDependencyDirs(PROJECT_ROOT, 4)) {
    const rel = path.relative(PROJECT_ROOT, depDir);
    if (!rel || rel.startsWith("..")) continue;
    const target = path.join(worktreePath, rel);
    if (fs.existsSync(target)) continue;
    if (!fs.existsSync(path.dirname(target))) continue;
    try {
      excludeWorktreePath(worktreePath, rel);
      fs.symlinkSync(depDir, target, "dir");
      links.push(rel);
    } catch {}
  }
  if (links.length > 0) {
    utils.appendNote(ticket, `Runtime hydrated worktree dependencies at ${utils.nowIso()}: ${links.join(", ")}`);
  }
  return { status: links.length > 0 ? "linked" : "unchanged", links };
}

function findDependencyDirs(root: string, maxDepth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === "node_modules") {
        out.push(full);
        continue;
      }
      if (entry.name === ".git" || entry.name === ".autoflow") continue;
      walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return out.sort();
}

function excludeWorktreePath(worktreePath: string, relPath: string): void {
  const exclude = git(["rev-parse", "--git-path", "info/exclude"], worktreePath).stdout.trim();
  if (!exclude) return;
  try {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    const existing = utils.readFileSafe(exclude);
    if (!existing.split(/\r?\n/).includes(relPath)) fs.appendFileSync(exclude, `${relPath}\n`, "utf8");
  } catch {}
}

function doneWhenCheck(ticket: string): JsonObject {
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

function diffCheck(ticket: string): JsonObject {
  const status = readWorktreeStatus(ticket);
  const workingRoot = stringValue(status.working_root) || PROJECT_ROOT;
  if (!isGitWorktree(workingRoot)) {
    return { passed: false, reason: "working_root_not_git", working_root: workingRoot };
  }
  const base = stringValue(status.base_commit) || git(["rev-parse", "--verify", "HEAD"], workingRoot).stdout.trim();
  const changedFiles = unique([
    ...gitLines(["diff", "--name-only", `${base}..HEAD`], workingRoot),
    ...gitLines(["diff", "--name-only"], workingRoot),
    ...gitLines(["diff", "--cached", "--name-only"], workingRoot),
    ...statusPorcelainPaths(workingRoot),
  ]);
  const allowed = utils.ticketConcreteAllowedPaths(ticket);
  const outOfScope = changedFiles.filter((file) => !allowed.some((allowedPath) => pathsOverlap(file, allowedPath)));
  const lineCount =
    numstatLineCount(git(["diff", "--numstat", `${base}..HEAD`], workingRoot).stdout) +
    numstatLineCount(git(["diff", "--numstat"], workingRoot).stdout) +
    numstatLineCount(git(["diff", "--cached", "--numstat"], workingRoot).stdout);
  return {
    passed: changedFiles.length > 0 && outOfScope.length === 0,
    working_root: workingRoot,
    base_commit: base,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    changed_line_count: lineCount,
    allowed_paths: allowed,
    in_scope: outOfScope.length === 0,
    out_of_scope_files: outOfScope,
  };
}

function readVerifierEvidence(ticket: string, patchBytes: number): JsonObject {
  const text = utils.readFileSafe(ticket);
  const worktree = readWorktreeStatus(ticket);
  const diff = diffCheck(ticket);
  const workingRoot = stringValue(diff.working_root) || stringValue(worktree.working_root) || PROJECT_ROOT;
  const baseCommit = stringValue(diff.base_commit) || stringValue(worktree.base_commit);
  const allowed = utils.ticketConcreteAllowedPaths(ticket);
  const patch = diffPatch(workingRoot, baseCommit, allowed, patchBytes);
  return {
    ticket_id: `Todo-${idFromPath(ticket)}`,
    title: readTitle(ticket, text),
    stage: utils.extractScalarFieldInSection(ticket, "Ticket", "Stage"),
    goal_lines: cleanSectionLines(text, "Goal"),
    done_when_items: cleanSectionLines(text, "Done When").filter((line) => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line)),
    acceptance_probe: cleanSectionLines(text, "Acceptance Probe"),
    allowed_paths: allowed,
    verification: {
      command: utils.extractScalarFieldInSection(ticket, "Verification", "Command"),
      exit_code: utils.extractScalarFieldInSection(ticket, "Verification", "Exit Code"),
      last_run: utils.extractScalarFieldInSection(ticket, "Verification", "Last Run"),
      result: utils.extractScalarFieldInSection(ticket, "Verification", "Result"),
      summary: utils.extractScalarFieldInSection(ticket, "Verification", "Summary"),
    },
    worktree,
    diff,
    diff_patch: patch.text,
    diff_patch_bytes: patch.bytes,
    diff_patch_truncated: patch.truncated,
  };
}

function recordVerifierDecision(ticket: string, decision: "pass" | "fail", reason: string, createMarker: boolean): JsonObject {
  const now = utils.nowIso();
  const runnerId = currentRunnerId("verifier");
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Decision", decision);
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Reason", oneLine(reason, 500));
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Checked At", now);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", decision === "pass" ? "verifier_passed" : "verifier_failed");
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  utils.appendNote(ticket, `Verifier ${decision} decision recorded at ${now}: ${oneLine(reason, 500)}`);

  const logPath = writeVerifierLog(ticket, decision, reason, now);
  let markerPath = "";
  if (createMarker) {
    markerPath = verifierOkMarkerPath(idFromPath(ticket));
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(
      markerPath,
      `ticket_id=Todo-${idFromPath(ticket)}\ndecision=pass\nreason=${oneLine(reason, 500)}\ncreated_at=${now}\nrunner=${runnerId}\n`,
      "utf8"
    );
  }
  utils.updateRunnerState(runnerId, {
    runner_status: "running",
    active_role: "verifier",
    active_ticket_id: `Todo-${idFromPath(ticket)}`,
    active_ticket_path: boardRel(ticket),
    active_stage: `verifier_${decision}`,
    last_result: `verifier_${decision}`,
  }, BOARD_ROOT);

  return {
    log_path: boardRel(logPath),
    marker_path: markerPath ? boardRel(markerPath) : "",
  };
}

function writeVerifierLog(ticket: string, decision: "pass" | "fail", reason: string, decidedAt: string): string {
  const ticketId = idFromPath(ticket);
  const diff = diffCheck(ticket);
  const startedAt = getArg("--started-at") ||
    utils.extractScalarFieldInSection(ticket, "Ticket", "Last Updated") ||
    fileMtimeIso(ticket);
  const latency = isoLatencySeconds(startedAt, decidedAt);
  const logDir = path.join(BOARD_ROOT, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `verifier_${ticketId}_${compactIso(decidedAt)}_${decision}.md`);
  const body = [
    `ticket_id=Todo-${ticketId}`,
    `verifier_decision=${decision}`,
    `started_at=${startedAt}`,
    `decided_at=${decidedAt}`,
    `latency_seconds=${latency}`,
    `diff_files=${diff.changed_file_count ?? 0}`,
    `diff_lines=${diff.changed_line_count ?? 0}`,
    `reason=${oneLine(reason, 1000)}`,
    `ticket=${boardRel(ticket)}`,
    "",
  ].join("\n");
  fs.writeFileSync(logPath, body, "utf8");
  return logPath;
}

function verifierOkMarkerPath(ticketId: string): string {
  return path.join(BOARD_ROOT, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

function diffPatch(workingRoot: string, baseCommit: string, allowedPaths: string[], maxBytes: number): { text: string; bytes: number; truncated: boolean } {
  if (!workingRoot || !isGitWorktree(workingRoot)) return { text: "", bytes: 0, truncated: false };
  const pathArgs = allowedPaths.length > 0 ? ["--", ...allowedPaths] : [];
  const chunks: string[] = [];
  if (baseCommit) {
    const committed = git(["diff", "--no-ext-diff", "--minimal", `${baseCommit}..HEAD`, ...pathArgs], workingRoot).stdout;
    if (committed.trim()) chunks.push(`# committed diff ${baseCommit}..HEAD\n${committed}`);
  }
  const cached = git(["diff", "--cached", "--no-ext-diff", "--minimal", ...pathArgs], workingRoot).stdout;
  if (cached.trim()) chunks.push(`# cached diff\n${cached}`);
  const dirty = git(["diff", "--no-ext-diff", "--minimal", ...pathArgs], workingRoot).stdout;
  if (dirty.trim()) chunks.push(`# working tree diff\n${dirty}`);
  return capTextByBytes(chunks.join("\n"), maxBytes);
}

function capTextByBytes(text: string, maxBytes: number): { text: string; bytes: number; truncated: boolean } {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { text, bytes, truncated: false };
  let out = text;
  while (Buffer.byteLength(out, "utf8") > maxBytes && out.length > 0) {
    out = out.slice(0, Math.max(0, out.length - 512));
  }
  const suffix = "\n[... patch truncated ...]";
  return { text: `${out}${suffix}`, bytes, truncated: true };
}

function cleanSectionLines(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .map((line) => line.trim())
    .filter((line) => line && line !== "...");
}

function fileMtimeIso(file: string): string {
  try { return new Date(fs.statSync(file).mtimeMs).toISOString().replace(/\.\d+Z$/, "Z"); } catch { return utils.nowIso(); }
}

function compactIso(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function isoLatencySeconds(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function statusPorcelainPaths(cwd: string): string[] {
  return git(["status", "--porcelain", "--untracked-files=all"], cwd).stdout
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => {
      const pathPart = line.slice(3);
      return pathPart.includes(" -> ") ? pathPart.split(" -> ").pop() || "" : pathPart;
    })
    .filter(Boolean);
}

function gitLines(gitArgs: string[], cwd: string): string[] {
  return git(gitArgs, cwd).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function numstatLineCount(raw: string): number {
  let total = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [a, d] = line.split(/\s+/);
    const add = a === "-" ? 0 : Number.parseInt(a, 10);
    const del = d === "-" ? 0 : Number.parseInt(d, 10);
    if (Number.isFinite(add)) total += add;
    if (Number.isFinite(del)) total += del;
  }
  return total;
}

function updateWorkerState(runnerId: string, ticket: string, stage: string, result: string): void {
  utils.updateRunnerState(runnerId, {
    runner_status: stage === "idle" ? "idle" : "running",
    active_role: "ticket-owner",
    active_ticket_id: idFromPath(ticket) ? `Todo-${idFromPath(ticket)}` : "",
    active_ticket_path: boardRel(ticket),
    active_stage: stage,
    last_result: result,
  }, BOARD_ROOT);
}

function replaceSectionBlock(file: string, section: string, body: string): boolean {
  const content = utils.readFileSafe(file);
  if (!content) return false;
  const heading = section.replace(/^##\s+/, "");
  const nextBody = ensureTrailingNewline(body.trim());
  const re = new RegExp(`(^## ${escapeRe(heading)}\\b[^\\n]*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  let next: string;
  if (re.test(content)) {
    next = content.replace(re, (_match, headingLine: string) => `${headingLine}\n${nextBody}\n`);
  } else {
    next = `${content}${content.endsWith("\n") ? "" : "\n"}\n## ${heading}\n\n${nextBody}`;
  }
  return utils.writeFileSafe(file, next);
}

function bulletize(text: string): string {
  const trimmed = text.trim();
  return /^[-*]\s+/.test(trimmed) ? trimmed : `- ${trimmed}`;
}

function readOptionalTextFile(file: string): string {
  if (!file) return "";
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function stripTicks(value: string): string {
  return String(value || "").replace(/^`+|`+$/g, "").trim();
}

function oneLine(value: string, maxLen: number): string {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map(normalizeRelPath))].sort();
}

function git(gitArgs: string[], cwd: string): GitRunResult {
  const result = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function spawnTsScript(scriptPath: string, scriptArgs: string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  const localTsx = path.join(PROJECT_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const command = fs.existsSync(localTsx) ? localTsx : (process.platform === "win32" ? "npx.cmd" : "npx");
  const args = fs.existsSync(localTsx) ? [scriptPath, ...scriptArgs] : ["tsx", scriptPath, ...scriptArgs];
  return spawnSync(command, args, { encoding: "utf8", env });
}

function wikiSourceGroups(): Record<string, string[]> {
  return {
    done: collectFiles(path.join(TICKETS_ROOT, "done"), /\.md$/, 8),
    reject: collectFiles(path.join(TICKETS_ROOT, "reject"), /\.md$/, 3),
    logs: collectFiles(path.join(BOARD_ROOT, "logs"), /\.md$/, 4),
    conversations: collectFiles(path.join(BOARD_ROOT, "conversations"), /\.md$/, 4),
    wiki: collectFiles(path.join(BOARD_ROOT, "wiki"), /\.md$/, 8),
    wiki_raw: collectFiles(path.join(BOARD_ROOT, "wiki-raw"), /\.md$/, 8),
  };
}

function hashFiles(files: string[]): string {
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    try {
      hash.update(boardRel(file));
      hash.update("\0");
      hash.update(fs.readFileSync(file));
      hash.update("\0");
    } catch {}
  }
  return hash.digest("hex");
}

function boardDirName(): string {
  const configured = process.env.AUTOFLOW_BOARD_DIR_NAME || process.env.BOARD_DIR_NAME;
  if (configured) return configured;
  const rel = path.relative(PROJECT_ROOT, BOARD_ROOT);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
  return path.basename(BOARD_ROOT) || ".autoflow";
}

function autoflowCliPath(): string {
  const configured = process.env.AUTOFLOW_CLI;
  if (configured) return configured;
  const local = path.join(PROJECT_ROOT, "bin", "autoflow");
  return fs.existsSync(local) ? local : "autoflow";
}

function emitAutoflowResult(tool: string, cliArgs: string[]): void {
  const cli = autoflowCliPath();
  const result = spawnSync(cli, cliArgs, {
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECT_ROOT,
      AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
      BOARD_ROOT,
      AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
      AUTOFLOW_BOARD_DIR_NAME: boardDirName(),
    },
  });
  const exitCode = typeof result.status === "number" ? result.status : 127;
  ok({
    tool,
    cli,
    cli_args: cliArgs,
    exit_code: exitCode,
    stdout: result.stdout || "",
    stderr: result.stderr || (result.error ? String(result.error) : ""),
    parsed: parseKeyValueOutput(result.stdout || ""),
  });
  process.exit(exitCode === 0 ? 0 : 1);
}

function parseKeyValueOutput(output: string): JsonObject {
  const parsed: JsonObject = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+)=(.*)$/);
    if (!match) continue;
    parsed[match[1]] = match[2];
  }
  return parsed;
}

function resolveLocalFile(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^`+|`+$/g, "");
  const resolved = path.resolve(path.isAbsolute(cleaned) ? cleaned : path.join(process.cwd(), cleaned));
  return resolved;
}

function resolveWikiWritablePath(raw: string): string {
  const cleaned = raw
    .replace(/^`+|`+$/g, "")
    .replace(/\\/g, "/")
    .replace(/^[.][/]/, "")
    .replace(/^\.autoflow\//, "");
  if (!cleaned || path.isAbsolute(cleaned)) return "";
  const normalized = path.posix.normalize(cleaned);
  if (normalized === ".." || normalized.startsWith("../")) return "";
  if (!/^(wiki|wiki-raw)\//.test(normalized)) return "";
  if (!normalized.endsWith(".md")) return "";
  const resolved = path.resolve(BOARD_ROOT, normalized);
  if (!resolved.startsWith(path.resolve(BOARD_ROOT) + path.sep)) return "";
  return resolved;
}

function parseNumstat(raw: string): Map<string, { additions: number; deletions: number }> {
  const out = new Map<string, { additions: number; deletions: number }>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(/\t/);
    if (parts.length < 3) continue;
    const additions = parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10);
    const file = parts.slice(2).join("\t");
    out.set(file, {
      additions: Number.isFinite(additions) ? additions : 0,
      deletions: Number.isFinite(deletions) ? deletions : 0,
    });
  }
  return out;
}

function readWikiStatusItem(line: string, gitRoot: string, numstat: Map<string, { additions: number; deletions: number }>): JsonObject {
  const rawStatus = line.slice(0, 2);
  const status = rawStatus.trim() || rawStatus;
  let rawPath = line.slice(3).trim();
  if (rawPath.includes(" -> ")) rawPath = rawPath.split(" -> ").pop() || rawPath;
  rawPath = rawPath.replace(/^"|"$/g, "");
  const abs = path.resolve(gitRoot, rawPath);
  const rel = boardRel(abs);
  const stats = numstat.get(rawPath) || numstat.get(path.relative(gitRoot, abs)) || { additions: 0, deletions: 0 };
  const untracked = rawStatus === "??";
  const additions = untracked ? safeLineCount(abs) : stats.additions;
  const deletions = stats.deletions;
  return {
    path: rel,
    status,
    category: wikiCategory(rel),
    additions,
    deletions,
    untracked,
    weight: wikiFileWeight(rel),
  };
}

function safeLineCount(file: string): number {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split(/\r?\n/).filter((line) => line.length > 0).length;
  } catch {
    return 0;
  }
}

function wikiCategory(rel: string): string {
  const clean = rel.replace(/^\.autoflow\//, "");
  const parts = clean.split("/");
  if (parts[0] === "wiki-raw") return "raw";
  if (parts[0] !== "wiki") return "other";
  return parts[1] || "root";
}

function wikiFileWeight(rel: string): number {
  const clean = rel.replace(/^\.autoflow\//, "");
  const base = path.basename(clean);
  if (clean === "wiki/index.md" || clean === "wiki/log.md") return 0;
  if (/\.(manifest|history|fingerprint)$/.test(base)) return 0;
  if (clean.startsWith("wiki-raw/")) return 1;
  if (/^wiki\/(answers|architecture|decisions|features|learnings|operations|sources)\//.test(clean)) return 5;
  return clean.startsWith("wiki/") ? 3 : 0;
}

function readWritePayload(): { id?: JsonValue; reservation?: JsonValue; content: string } {
  const inputJson = getArg("--input-json");
  if (inputJson) {
    const parsed = JSON.parse(fs.readFileSync(inputJson, "utf8")) as { id?: JsonValue; reservation?: JsonValue; content?: unknown; contentFile?: unknown };
    const content = typeof parsed.content === "string"
      ? parsed.content
      : typeof parsed.contentFile === "string"
        ? fs.readFileSync(parsed.contentFile, "utf8")
        : "";
    if (!content.trim()) fail(2, "input JSON must contain content or contentFile");
    return { id: parsed.id, reservation: parsed.reservation, content: ensureTrailingNewline(content) };
  }

  const contentFile = getArg("--content-file");
  if (contentFile) {
    return { content: ensureTrailingNewline(fs.readFileSync(contentFile, "utf8")) };
  }

  if (!process.stdin.isTTY) {
    const content = fs.readFileSync(0, "utf8");
    if (content.trim()) return { content: ensureTrailingNewline(content) };
  }

  fail(2, "write command requires --content-file, --input-json, or stdin markdown");
}

function validatePrdContent(content: string, id: string): void {
  requireSection(content, "Project");
  requireSection(content, "Allowed Paths");
  const contentId = extractIdFromContent(content, "prd");
  if (contentId && contentId !== id) fail(2, `content PRD id ${contentId} does not match target id ${id}`);
  if (extractBulletSectionFromText(content, "Allowed Paths").length === 0) {
    fail(2, "PRD content must include non-empty ## Allowed Paths bullets");
  }
}

function validateTicketContent(content: string, id: string): void {
  for (const section of ["Ticket", "Goal", "Allowed Paths", "Done When", "Verification"]) {
    requireSection(content, section);
  }
  const contentId = extractIdFromContent(content, "ticket");
  if (contentId && contentId !== id) fail(2, `content ticket id ${contentId} does not match target id ${id}`);
  if (!new RegExp(`^-\\s*ID:\\s*Todo-${id}\\s*$`, "m").test(content)) {
    fail(2, `ticket content must contain "- ID: Todo-${id}"`);
  }
  if (extractBulletSectionFromText(content, "Allowed Paths").length === 0) {
    fail(2, "ticket content must include non-empty ## Allowed Paths bullets");
  }
  if (extractChecklistFromText(content, "Done When").length === 0) {
    fail(2, "ticket content must include non-empty ## Done When checklist items");
  }
}

function requireSection(content: string, section: string): void {
  if (!new RegExp(`^## ${escapeRe(section)}\\b`, "m").test(content)) {
    fail(2, `content is missing ## ${section}`);
  }
}

function setRecoveryField(ticket: string, field: string, value: string): void {
  utils.replaceScalarFieldInSection(ticket, "Recovery State", field, value);
}

function collectUsedIds(kind: string): Set<string> {
  const used = new Set<string>();
  const patterns: RegExp[] =
    kind === "ticket" ? [/^(Todo-|tickets_)(\d+)\.md$/] :
    kind === "prd" ? [/^(prd|project)_(\d+)\.md$/] :
    [/^order_(\d+)(?:_retry_.*)?\.md$/];
  const roots = [
    path.join(TICKETS_ROOT, "inbox"),
    path.join(TICKETS_ROOT, "backlog"),
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

function pruneReservations(dir: string, ttlSec: number): void {
  const cutoff = Date.now() - ttlSec * 1000;
  for (const file of collectFiles(dir, /\.json$/, 1)) {
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch {}
  }
}

function releaseReservation(raw: string): void {
  if (!raw) return;
  const reservation = resolveBoardPath(raw) || (path.isAbsolute(raw) ? raw : "");
  if (!reservation) return;
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  if (!path.resolve(reservation).startsWith(path.resolve(reservationsDir) + path.sep)) return;
  try { fs.unlinkSync(reservation); } catch {}
}

function collectFiles(root: string, pattern: RegExp, depth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, level: number): void => {
    if (level > depth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, level + 1);
      else if (pattern.test(entry.name)) out.push(full);
    }
  };
  walk(root, 1);
  return out.sort();
}

function resolveBoardPath(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^`+|`+$/g, "").replace(/^[.][/]/, "");
  const candidates = path.isAbsolute(cleaned)
    ? [cleaned]
    : [
        path.join(BOARD_ROOT, cleaned),
        path.join(BOARD_ROOT, cleaned.replace(/^\.autoflow\//, "")),
      ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (resolved === path.resolve(BOARD_ROOT) || resolved.startsWith(path.resolve(BOARD_ROOT) + path.sep)) return resolved;
  }
  return "";
}

function validateNoUnsafeWrite(target: string, overwrite: boolean): void {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(TICKETS_ROOT) + path.sep)) {
    fail(2, `target must stay under tickets/: ${target}`);
  }
  if (fs.existsSync(resolved) && !overwrite) fail(1, `target already exists: ${boardRel(resolved)}`);
}

function writeAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, target);
}

function extractIdFromContent(content: string, kind: "prd" | "ticket"): string {
  const pattern = kind === "ticket" ? /\bTodo-(\d+)\b/ : /\bprd_(\d+)\b/i;
  const m = content.match(pattern);
  return m ? normalizeId(m[1]) : "";
}

function extractBulletSectionFromText(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim() || "")
    .filter((line) => line && line !== "...");
}

function extractChecklistFromText(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .filter((line) => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
}

function extractSectionLines(content: string, section: string): string[] {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) break;
    if (inSection) out.push(line);
  }
  return out;
}

function normalizePriority(raw: string): string {
  const clean = String(raw || "normal").toLowerCase().replace(/[`"'\[\]:]/g, "").trim();
  if (["critical", "high", "normal", "low"].includes(clean)) return clean;
  if (["crit", "p0"].includes(clean)) return "critical";
  if (["p1"].includes(clean)) return "high";
  if (["medium", "default", "p2"].includes(clean)) return "normal";
  if (["p3"].includes(clean)) return "low";
  return "normal";
}

function priorityRank(priority: string): number {
  return { critical: 0, high: 1, normal: 2, low: 3 }[normalizePriority(priority)] ?? 2;
}

function idFromPath(file: string): string {
  const base = path.basename(file);
  const m = base.match(/(\d+)/);
  return m ? String(Number.parseInt(m[1], 10)).padStart(3, "0") : "";
}

function normalizeId(raw: string): string {
  const m = String(raw || "").match(/(\d+)/);
  return m ? String(Number.parseInt(m[1], 10)).padStart(3, "0") : "";
}

function getArg(name: string): string {
  const idx = args.indexOf(name);
  if (idx < 0) return "";
  const value = args[idx + 1];
  return value && !value.startsWith("--") ? value : "";
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== name) continue;
    const value = args[i + 1];
    if (value && !value.startsWith("--")) values.push(value);
  }
  return values;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function currentRunnerId(fallback = "planner"): string {
  return getArg("--runner") || process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || fallback;
}

function boardRel(file: string): string {
  return utils.boardRelativePath(file, BOARD_ROOT);
}

function stringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function safeIsFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ok(fields: JsonObject): void {
  process.stdout.write(JSON.stringify({ status: "ok", ...fields }, null, 2) + "\n");
}

function fail(exitCode: number, message: string, extra: JsonObject = {}): never {
  process.stdout.write(JSON.stringify({ status: "error", error: message, ...extra }, null, 2) + "\n");
  process.exit(exitCode);
}
