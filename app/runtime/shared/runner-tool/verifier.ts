import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, ticketPrdKeyFromFile, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { cleanSectionLines, replaceSectionBlock } from "./sections";
import { diffCheck, diffPatch } from "./diff";
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
    ticket_id: `TODO-${idFromPath(ticket)}`,
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
      `ticket_id=TODO-${idFromPath(ticket)}\ndecision=pass\nreason=${oneLine(reason, 500)}\ncreated_at=${now}\nrunner=${runnerId}\n`,
      "utf8"
    );
  }
  utils.updateRunnerState(runnerId, {
    runner_status: "running",
    active_role: "verifier",
    active_ticket_id: `TODO-${idFromPath(ticket)}`,
    active_ticket_path: boardRel(ticket),
    active_stage: `verifier_${decision}`,
    last_result: `verifier_${decision}`,
  }, BOARD_ROOT);

  return {
    log_path: logPath ? boardRel(logPath) : "",
    marker_path: markerPath ? boardRel(markerPath) : "",
  };
}

export function findTicketById(states: string[], ticketId: string): string {
  const normalized = normalizeId(ticketId);
  if (!normalized) return "";
  for (const state of states) {
    for (const name of [`TODO-${normalized}.md`, `TODO-${normalized}.md`]) {
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

function prdBranchForTicket(ticket: string): string {
  const prdKey = ticketPrdKeyFromFile(ticket);
  if (!prdKey) return "";
  const candidates = [
    path.join(TICKETS_ROOT, "prd", `${prdKey}.md`),
    path.join(TICKETS_ROOT, "done", prdKey, `${prdKey}.md`),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const branch = stripTicks(utils.extractScalarFieldInSection(candidate, "Project", "Branch"));
    if (branch) return branch;
  }
  return "";
}

function mergeTargetDescription(ticket: string): string {
  const prdBranch = prdBranchForTicket(ticket);
  if (prdBranch) return `${prdBranch} PRD branch`;
  return "main";
}

export function markWorkerTicketVerified(ticket: string, ticketId: string, reason: string, logPath: string, markerPath: string): void {
  const now = utils.nowIso();
  const mergeTarget = mergeTargetDescription(ticket);
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
	    `- Next: legacy review가 이 worktree를 승인했다. 워커 러너는 검증된 결과를 Allowed Paths 안에서 ${mergeTarget}에 반영하고, 필요한 conflict를 해결하고, 해당 target에서 검증을 다시 실행한 뒤 \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`를 호출해야 한다.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
	    `- Current state: legacy semantic pass가 기록되었고 ${mergeTarget} 반영은 아직 대기 중이다.
	- Last completed action: ${now}에 verifier pass를 기록했다.
	- First thing to inspect on resume: Worktree, Verification, Allowed Paths, verifier semantic decision.`
  );
  utils.appendNote(ticket, `${now}에 verifier pass를 기록했다. worker finalization은 아직 완료되지 않았다.`);
  updateWorkerState(workerRunnerIdFromTicket(ticket), ticket, "verified_pending_merge", "verifier_passed_worker_finalization_pending");
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
	    `- Next: legacy review가 ${ticketId} revise를 요청했다. 워커 러너는 같은 worktree를 유지하고 Allowed Paths 안에서 검증 노트를 반영해 수정한 뒤, local verification을 다시 실행하고 \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`를 호출해야 한다.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
	    `- Current state: legacy revise 요청이 기록되었고 같은 worktree가 계속 active 상태다.
	- Last completed action: ${now}에 verifier revise decision을 기록했다.
	- First thing to inspect on resume: Verification Semantic Reason, Done When, diff, 현재 worktree.`
  );
  utils.appendNote(ticket, `${now}에 verifier revise가 요청되었다: ${oneLine(reason, 500)}`);
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
	    `- Next: legacy review가 ${ticketId} replan을 요청했다. 워커 러너는 \`autoflow tool runner-tool worker request-replan --ticket ${ticketId} --reason "<reason>"\`를 실행해야 한다. 이 명령은 워크트리를 정리하고, 이 inprogress work item을 pending work lane으로 복귀시키며 (Replan Count/Decision 누적), 워커가 새 워크트리에서 재시도할 수 있게 한다. follow-up 경로를 처리하기 전에는 관련 없는 work item을 claim하지 않는다.`
  );
  replaceSectionBlock(
    ticket,
    "Resume Context",
	`- Current state: legacy replan 요청이 기록되었으며 원래 작업은 merge하면 안 된다.
	- Last completed action: ${now}에 verifier replan decision을 기록했다.
	- First thing to inspect on resume: Verification Semantic Reason을 확인한 뒤 worker request-replan을 실행한다.`
  );
  utils.appendNote(ticket, `${now}에 verifier replan이 요청되었다: ${oneLine(reason, 500)}`);
  updateWorkerState(workerRunnerIdFromTicket(ticket), ticket, "replan_requested", "verifier_replan_requested");
}

export function writeVerifierLog(ticket: string, decision: VerifierDecision, reason: string, decidedAt: string): string {
  void ticket;
  void decision;
  void reason;
  void decidedAt;
  return "";
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
