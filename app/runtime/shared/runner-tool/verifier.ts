import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { cleanSectionLines, replaceSectionBlock } from "./sections";
import { diffCheck, diffPatch, diffStats } from "./diff";
import { readTitle } from "./queue";
import { updateWorkerState } from "./tickets";
import { readWorktreeStatus } from "./worktree";

export type VerifierDecision = "pass" | "revise" | "replan";

export function readVerifierEvidence(ticket: string, patchBytes: number): JsonObject {
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

function verifierStage(decision: VerifierDecision): string {
  if (decision === "pass") return "verifier_passed";
  if (decision === "revise") return "verifier_revise_requested";
  return "verifier_replan_requested";
}

export function recordVerifierDecision(ticket: string, decision: VerifierDecision, reason: string, createMarker: boolean): JsonObject {
  const now = utils.nowIso();
  const runnerId = currentRunnerId("verifier");
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Decision", decision);
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Reason", oneLine(reason, 500));
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Checked At", now);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", verifierStage(decision));
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

export function findTicketById(states: string[], ticketId: string): string {
  const normalized = normalizeId(ticketId);
  if (!normalized) return "";
  for (const state of states) {
    for (const name of [`Todo-${normalized}.md`, `tickets_${normalized}.md`]) {
      const candidate = path.join(TICKETS_ROOT, state, name);
      if (safeIsFile(candidate)) return candidate;
    }
  }
  return "";
}

export function workerRunnerIdFromTicket(ticket: string): string {
  for (const value of [
    utils.extractScalarFieldInSection(ticket, "Ticket", "Execution AI"),
    utils.extractScalarFieldInSection(ticket, "Ticket", "Claimed By"),
    utils.extractScalarFieldInSection(ticket, "Ticket", "AI"),
  ]) {
    const token = String(value || "").split(":")[0].trim();
    if (token && !/^verifier(?:-\d+)?$/i.test(token)) return token;
  }
  return "worker";
}

export function markWorkerTicketVerified(ticket: string, ticketId: string, reason: string, logPath: string, markerPath: string): void {
  const now = utils.nowIso();
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Decision", "pass");
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Reason", oneLine(reason, 500));
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Checked At", now);
  if (logPath) utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Log", logPath);
  if (markerPath) utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Marker", markerPath);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", "verified_pending_merge");
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  utils.replaceScalarFieldInSection(ticket, "Worktree", "Integration Status", "verified_pending_merge");
  replaceSectionBlock(
    ticket,
    "Next Action",
    `- Next: verifier approved this worktree. Worker must merge the verified worktree into PROJECT_ROOT/main inside Allowed Paths, resolve conflicts if needed, rerun verification from PROJECT_ROOT, then call \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
    `- Current state: verifier semantic pass recorded; PROJECT_ROOT merge is still pending.
- Last completed action: verifier pass at ${now}.
- First thing to inspect on resume: Worktree, Verification, Allowed Paths, and the verifier semantic decision.`
  );
  utils.appendNote(ticket, `Verifier pass recorded at ${now}: worker merge is now allowed but not yet complete.`);
  updateWorkerState(workerRunnerIdFromTicket(ticket), ticket, "verified_pending_merge", "verifier_passed_merge_pending");
}

export function markWorkerTicketRevisionRequested(ticket: string, ticketId: string, reason: string, logPath: string): void {
  const now = utils.nowIso();
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Decision", "revise");
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Reason", oneLine(reason, 500));
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Checked At", now);
  if (logPath) utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Log", logPath);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", "revision_requested");
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  utils.replaceScalarFieldInSection(ticket, "Worktree", "Integration Status", "revision_requested");
  replaceSectionBlock(
    ticket,
    "Next Action",
    `- Next: verifier requested revise for ${ticketId}. Worker must keep the same worktree, fix the verifier notes inside Allowed Paths, rerun local verification, then call \`autoflow tool runner-tool worker submit-to-verifier --ticket ${ticketId} --summary "<summary>"\` to submit the revised work back to verifier.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
    `- Current state: verifier requested revise; same worktree remains active.
- Last completed action: verifier revise decision at ${now}.
- First thing to inspect on resume: Verification Semantic Reason, Done When, diff, and the current worktree.`
  );
  utils.appendNote(ticket, `Verifier revise requested at ${now}: ${oneLine(reason, 500)}`);
  updateWorkerState(workerRunnerIdFromTicket(ticket), ticket, "revision_requested", "verifier_revise_requested");
}

export function markWorkerTicketReplanRequested(ticket: string, ticketId: string, reason: string, logPath: string): void {
  const now = utils.nowIso();
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Decision", "replan");
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Reason", oneLine(reason, 500));
  utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Checked At", now);
  if (logPath) utils.replaceScalarFieldInSection(ticket, "Verification", "Semantic Log", logPath);
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Stage", "replan_requested");
  utils.replaceScalarFieldInSection(ticket, "Ticket", "Last Updated", now);
  utils.replaceScalarFieldInSection(ticket, "Worktree", "Integration Status", "replan_requested");
  replaceSectionBlock(
    ticket,
    "Next Action",
    `- Next: verifier requested replan for ${ticketId}. Worker must run \`autoflow tool runner-tool worker create-retry-order --ticket ${ticketId} --reason "<reason>"\`; that creates a retry order, deletes the ticket worktree, removes this inprogress ticket, and lets the planner runner create the follow-up TODO. Do not claim unrelated todo work until the follow-up path is handled.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
`- Current state: verifier requested replan; original work should not be merged.
- Last completed action: verifier replan decision at ${now}.
- First thing to inspect on resume: Verification Semantic Reason and then run worker create-retry-order.`
  );
  utils.appendNote(ticket, `Verifier replan requested at ${now}: ${oneLine(reason, 500)}`);
  updateWorkerState(workerRunnerIdFromTicket(ticket), ticket, "replan_requested", "verifier_replan_requested");
}

export function writeVerifierLog(ticket: string, decision: VerifierDecision, reason: string, decidedAt: string): string {
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

export function verifierOkMarkerPath(ticketId: string): string {
  return path.join(BOARD_ROOT, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

export function fileMtimeIso(file: string): string {
  try { return new Date(fs.statSync(file).mtimeMs).toISOString().replace(/\.\d+Z$/, "Z"); } catch { return utils.nowIso(); }
}

export function compactIso(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

export function isoLatencySeconds(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}
