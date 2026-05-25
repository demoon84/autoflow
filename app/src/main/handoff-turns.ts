import nodeCrypto from "node:crypto";
import fsSync from "node:fs";
import path from "node:path";
import {
  boardRelPath,
  computeQueueFingerprint,
  listQueueFilesSync,
  markdownScalarInSectionSync,
  normalizeRunnerRole,
  plannerQueueFileIsActionableSync,
  readMarkdownTitleSync,
  runnerActiveTicketIdSync,
  runnerStateFieldSync,
  safeIsFileSync,
  ticketClaimedByRunnerIdSync,
  wikiHasPendingRunnerWorkSync,
  workerTodoFileIsClaimableSync,
  workItemQueueFilePattern
} from "./board-queue";
import { stripTerminalControlSequences } from "./codex";
import { runnerPromptFileSegment } from "./context-reset";
import {
  canonicalWorkerRunnerId,
  ensureWikiAssignmentForPendingWorkSync,
  inferRunnerRoleFromId,
  readRunnerConfigBlocks,
  runnerConfigBoolean
} from "./runner-config-read";
import {
  defaultBoardDirName,
  ptyRunnerKey,
  ptyRunnerMatchesRequestedScope,
  ptyRunnerMeta
} from "./pty-scope";
import { writePtyRunnerStateFile } from "./runner-state-write";
import { autoflowShellCommand } from "./shell-path";

type HandoffEntry = { attempt: number; timer: ReturnType<typeof setTimeout> | null };
type LastInjectedEntry = { at: number; fingerprint: string; reason?: string };
type DecisionLastInjected = { at: number; fingerprint: string; reason?: string };

const plannerHandoffTurnTimers = new Map<string, HandoffEntry>();
const plannerHandoffLastInjected = new Map<string, LastInjectedEntry>();
const verifierHandoffTurnTimers = new Map<string, HandoffEntry>();
const verifierHandoffLastInjected = new Map<string, LastInjectedEntry>();
const wikiHandoffTurnTimers = new Map<string, HandoffEntry>();
const wikiHandoffLastInjected = new Map<string, LastInjectedEntry>();
const workerTodoHandoffTurnTimers = new Map<string, HandoffEntry>();
const workerTodoHandoffLastInjected = new Map<string, LastInjectedEntry>();
const workerVerifierDecisionTurnTimers = new Map<string, HandoffEntry>();
const workerVerifierDecisionLastInjected = new Map<string, DecisionLastInjected>();

type PtyManagerLike = {
  get?: (runnerKey: string) => { status?: string; lastDataAt?: number; pid?: number } | null | undefined;
  writePrompt?: (runnerKey: string, prompt: string, opts: { paste: string }) => boolean;
  writeInput?: (runnerKey: string, sequence: string) => boolean | undefined;
  snapshot?: (runnerKey: string) => string | undefined;
};

function getPtyManager(): PtyManagerLike | undefined {
  return (globalThis as any).__autoflowPtyManager;
}

export function clearVerifierHandoffTurnTimers(idlePtyRunnerStopTimers?: Map<string, NodeJS.Timeout>): void {
  for (const entry of plannerHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  plannerHandoffTurnTimers.clear();
  plannerHandoffLastInjected.clear();
  for (const entry of verifierHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  verifierHandoffTurnTimers.clear();
  verifierHandoffLastInjected.clear();
  for (const entry of wikiHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  wikiHandoffTurnTimers.clear();
  wikiHandoffLastInjected.clear();
  for (const entry of workerTodoHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  workerTodoHandoffTurnTimers.clear();
  workerTodoHandoffLastInjected.clear();
  for (const entry of workerVerifierDecisionTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  workerVerifierDecisionTurnTimers.clear();
  workerVerifierDecisionLastInjected.clear();
  if (idlePtyRunnerStopTimers) {
    for (const timer of idlePtyRunnerStopTimers.values()) {
      if (timer) clearTimeout(timer);
    }
    idlePtyRunnerStopTimers.clear();
  }
}

export function writeRunnerHandoffPromptFile(
  { boardRoot, runnerId, kind, prompt }: { boardRoot: string; runnerId: string; kind: string; prompt: string }
): string {
  const stateDir = path.join(boardRoot, "runners", "state");
  fsSync.mkdirSync(stateDir, { recursive: true });
  const promptPath = path.join(
    stateDir,
    `${runnerPromptFileSegment(runnerId)}-${runnerPromptFileSegment(kind)}-handoff-prompt.md`
  );
  const tmpPath = `${promptPath}.${process.pid}.${Date.now()}.tmp`;
  fsSync.writeFileSync(tmpPath, String(prompt || "").replace(/[\r\n]+$/, "") + "\n", "utf8");
  fsSync.renameSync(tmpPath, promptPath);
  return promptPath;
}

export function buildInjectedHandoffPrompt(
  { agent, boardRoot, runnerId, kind, prompt }: { agent: string; boardRoot: string; runnerId: string; kind: string; prompt: string }
): { prompt: string; paste: string; promptPath: string } {
  const normalizedAgent = String(agent || "").toLowerCase();
  if (normalizedAgent === "codex") {
    const promptPath = writeRunnerHandoffPromptFile({ boardRoot, runnerId, kind, prompt });
    return {
      prompt: `Autoflow handoff: read ${JSON.stringify(promptPath)} and follow it exactly now. Execute the single runner turn it describes, then summarize briefly. When no actionable work remains, Desktop will stop this runner process.`,
      paste: "plain",
      promptPath
    };
  }
  return {
    prompt,
    paste: normalizedAgent === "claude" ? "bracketed" : "plain",
    promptPath: ""
  };
}

export function verifierQueueChangeReasons(reasons: unknown[]): boolean {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/verifier" || /^tickets\/verifier\/TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(value);
  });
}

export function runnerPromptNeedsContinue(snapshot: string, agent: unknown): boolean {
  if (String(agent || "").toLowerCase() !== "codex") return false;
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(//g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-20)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  return /press\s+enter\s+to\s+continue|esc\s+to\s+go\s+back/i.test(compactTail);
}

export function verifierPromptLooksReady(snapshot: string, agent: unknown): boolean {
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(//g, "");
  const lines = clean
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tailLines = lines.slice(-16);
  const tail = tailLines.join("\n");
  const compactTail = tail.replace(/\s+/g, " ").trim();
  if (/\b(Working|Running command|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return false;
  if (/Hooks need review/i.test(tail)) return false;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) {
    return false;
  }
  if (runnerPromptNeedsContinue(snapshot, agent)) return false;
  const promptPattern = /^[›>]\s*(?:$|gpt-|claude|sonnet|opus|haiku|.*[~/][^ ]*)/i;
  const promptLine = tailLines.slice(-8).find((line) => promptPattern.test(line));
  if (promptLine) return true;
  if (/(?:^|\s)[›>]\s*(?:gpt-|claude|sonnet|opus|haiku|[~/])/i.test(compactTail)) return true;
  if (String(agent || "").toLowerCase() !== "codex") {
    if (/bypass\s+permissions\s+on/i.test(compactTail)) return true;
    return tailLines.slice(-3).some((line) => /^[›>]\s*$/.test(line));
  }
  return /(?:^|\s)›\s*$/.test(compactTail);
}

export function runnerSnapshotLooksBusy(snapshot: string): boolean {
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(//g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-24)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!compactTail) return false;
  if (/\b(Working|Running command|Waiting for background terminal|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return true;
  if (/Hooks need review/i.test(compactTail)) return true;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) return true;
  return false;
}

export function runnerPromptAcceptsInjectedTurn(snapshot: string, agent: unknown, idleMs: number): boolean {
  if (verifierPromptLooksReady(snapshot, agent)) return true;
  const fallbackIdleMs = Math.max(
    1000,
    Number.parseInt(process.env.AUTOFLOW_HANDOFF_READY_FALLBACK_IDLE_MS || "8000", 10) || 8000
  );
  if (!Number.isFinite(idleMs) || idleMs < fallbackIdleMs) return false;
  if (runnerSnapshotLooksBusy(snapshot)) return false;
  if (runnerPromptNeedsContinue(snapshot, agent)) return false;
  return true;
}

export function handoffRetryDedupMs(envName: string, fallbackMs: number, dedupMs: number): number {
  const parsed = Number.parseInt(process.env[envName] || "", 10);
  const configured = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
  return Math.max(1000, Math.min(dedupMs, configured));
}

export function handoffDedupBlocks(
  last: { at?: number; fingerprint?: string } | undefined,
  fingerprint: string,
  now: number,
  dedupMs: number,
  retryMs: number,
  force: boolean
): boolean {
  if (force || !last || last.fingerprint !== fingerprint) return false;
  return now - (last.at || 0) < Math.max(1000, Math.min(dedupMs, retryMs));
}

export function handoffIdleStateFields(lastResult: string, promptPath = ""): Record<string, string> {
  return {
    last_result: lastResult,
    active_item: "",
    active_stage: "idle",
    active_ticket_id: "",
    active_ticket_path: "",
    active_ticket_title: "",
    active_spec_ref: "",
    last_handoff_prompt_path: promptPath || ""
  };
}

export function pokeRunnerContinuePromptIfNeeded(
  mgr: PtyManagerLike | undefined,
  runnerKey: string,
  snapshot: string,
  agent: unknown
): boolean {
  if (!runnerPromptNeedsContinue(snapshot, agent)) return false;
  if (!mgr || typeof mgr.writeInput !== "function") return false;
  return Boolean(mgr.writeInput(runnerKey, "\r"));
}

export function workerVerifierDecisionChangeReasons(reasons: unknown[]): boolean {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/inprogress" || /^tickets\/inprogress\/TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(value);
  });
}

export function verifierDecisionStageForWorkerTurn(ticketPath: string): string {
  const stage = (
    markdownScalarInSectionSync(ticketPath, "Ticket", "Stage") ||
    markdownScalarInSectionSync(ticketPath, "Worktree", "Integration Status") ||
    markdownScalarInSectionSync(ticketPath, "Goal Runtime", "Status")
  ).toLowerCase();
  if (/verified[_ -]?pending[_ -]?merge/.test(stage)) return "verified_pending_merge";
  if (/revision[_ -]?requested/.test(stage)) return "revision_requested";
  if (/replan[_ -]?requested/.test(stage)) return "replan_requested";
  return "";
}

export function workerRunnerIdFromTicketSync(ticketPath: string): string {
  for (const value of [
    markdownScalarInSectionSync(ticketPath, "Ticket", "Execution AI"),
    markdownScalarInSectionSync(ticketPath, "Ticket", "Claimed By"),
    markdownScalarInSectionSync(ticketPath, "Ticket", "AI")
  ]) {
    const token = canonicalWorkerRunnerId(String(value || "").split(":")[0]);
    if (token && !/^verifier(?:-\d+)?$/i.test(token)) return token;
  }
  return "worker";
}

export function workerDecisionFingerprint(boardRoot: string, ticketPath: string, stage: string): string {
  let mtimeMs = 0;
  try { mtimeMs = fsSync.statSync(ticketPath).mtimeMs || 0; } catch {}
  return `${boardRelPath(boardRoot, ticketPath)}:${stage}:${Math.round(mtimeMs)}`;
}

function buildWorkerVerifierDecisionTurnPrompt(
  { projectRoot, boardRoot, runnerId, ticketPath, stage }: { projectRoot: string; boardRoot: string; runnerId: string; ticketPath: string; stage: string }
): string {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  const stageGuidance = stage === "verified_pending_merge"
    ? `Verifier pass is recorded. Worker must integrate the approved worktree into the ticket merge target inside Allowed Paths, rerun required verification from that target, then call worker finalize-approved.`
    : stage === "revision_requested"
      ? `Verifier requested revision. Keep the same worktree, apply the verifier notes inside Allowed Paths, rerun local verification, then submit to verifier again.`
      : `Verifier requested replan. Run worker request-replan for this ticket before claiming anything else.`;
  return [
    `Autoflow worker verifier-decision handoff detected by Desktop.`,
    `This is a one-shot worker turn for a verifier decision that returned a ticket to tickets/inprogress/; it is not a recurring loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Ticket:       ${relTicket}${title ? ` — ${title}` : ""}`,
    `Stage:        ${stage}`,
    ``,
    stageGuidance,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `Inspect only active-get.ai_followup_scope.inspect_only_recent_sources for this ticket, then perform the next worker action recorded in the ticket.`,
    `Do not run work-snapshot or claim another ticket while this returned verifier decision is active.`
  ].join("\n");
}

export function scheduleWorkerVerifierDecisionTurn(
  { projectRoot, boardDirName, boardRoot, runnerId, ticketPath, stage, reason, force = false }:
  { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string; ticketPath: string; stage: string; reason: string; force?: boolean }
): void {
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const fingerprint = workerDecisionFingerprint(boardRoot, ticketPath, stage);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_DEDUP_MS || "300000", 10) || 300000);
  const last = workerVerifierDecisionLastInjected.get(runnerKey);
  if (!force && last?.fingerprint === fingerprint && now - last.at < dedupMs) return;

  const existing = workerVerifierDecisionTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: HandoffEntry = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    workerVerifierDecisionTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get!(runnerKey);
      if (!live || live.status !== "running" || !safeIsFileSync(ticketPath)) { clearEntry(); return; }
      const currentStage = verifierDecisionStageForWorkerTurn(ticketPath);
      if (!currentStage) { clearEntry(); return; }
      const currentOwner = workerRunnerIdFromTicketSync(ticketPath);
      if (canonicalWorkerRunnerId(currentOwner) !== canonicalWorkerRunnerId(runnerId)) { clearEntry(); return; }
      const idleMs = Number.isFinite(live.lastDataAt) && (live.lastDataAt || 0) > 0
        ? Date.now() - (live.lastDataAt || 0)
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWorkerVerifierDecisionTurnPrompt({ projectRoot, boardRoot, runnerId, ticketPath, stage: currentStage });
      const injectedPrompt = buildInjectedHandoffPrompt({ agent: String(meta.agent || ""), boardRoot, runnerId, kind: "worker-verifier-decision", prompt });
      const injected = mgr.writePrompt!(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        workerVerifierDecisionLastInjected.set(runnerKey, {
          at: Date.now(),
          fingerprint: workerDecisionFingerprint(boardRoot, ticketPath, currentStage),
          reason
        });
        void writePtyRunnerStateFile(runnerKey, {
          last_result: currentStage === "verified_pending_merge"
            ? "verifier_passed_worker_finalization_pending"
            : currentStage === "revision_requested"
              ? "verifier_revise_requested"
              : "verifier_replan_requested",
          active_stage: currentStage,
          active_ticket_id: path.basename(ticketPath, ".md"),
          active_ticket_path: boardRelPath(boardRoot, ticketPath),
          active_ticket_title: readMarkdownTitleSync(ticketPath),
          last_handoff_prompt_path: injectedPrompt.promptPath || ""
        });
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  workerVerifierDecisionTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

export function scheduleWorkerVerifierDecisionTurnsForScope(
  { projectRoot, boardDirName, boardRoot, reasons }: { projectRoot: string; boardDirName: string; boardRoot: string; reasons: unknown[] }
): void {
  if (!workerVerifierDecisionChangeReasons(reasons)) return;
  const candidates = listQueueFilesSync(boardRoot, "tickets/inprogress", workItemQueueFilePattern, 1000)
    .map((ticketPath) => ({
      ticketPath,
      stage: verifierDecisionStageForWorkerTurn(ticketPath),
      runnerId: workerRunnerIdFromTicketSync(ticketPath)
    }))
    .filter((item) => item.stage && item.runnerId);
  if (candidates.length === 0) return;
  const enabledWorkers = new Set(
    readRunnerConfigBlocks(projectRoot, boardDirName)
      .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "worker")
      .filter((runner) => runnerConfigBoolean(runner.enabled, true))
      .map((runner) => canonicalWorkerRunnerId(runner.id))
  );
  for (const item of candidates) {
    if (!enabledWorkers.has(canonicalWorkerRunnerId(item.runnerId))) continue;
    scheduleWorkerVerifierDecisionTurn({
      projectRoot, boardDirName, boardRoot,
      runnerId: item.runnerId, ticketPath: item.ticketPath, stage: item.stage,
      reason: (reasons || []).join(",")
    });
  }
}

function buildVerifierHandoffTurnPrompt(
  { projectRoot, boardRoot, runnerId, ticketPath }: { projectRoot: string; boardRoot: string; boardDirName: string; runnerId: string; ticketPath: string }
): string {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  return [
    `Autoflow verifier handoff detected by Desktop.`,
    `This is a one-shot verifier turn for a ticket that just entered tickets/verifier/; it is not a recurring loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending verifier ticket: ${relTicket}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "verifier", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
    `If a verifier ticket exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, run verifier evidence for that one ticket, make exactly one pass/revise/replan decision, run the matching verifier tool, rerun queue-snapshot once, then summarize.`,
    `Do not open full AGENTS, rule docs, or unrelated project files unless the compact verifier tool fails or the scoped verifier ticket directly requires them.`
  ].join("\n");
}

export function scheduleVerifierHandoffTurn(
  { projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }:
  { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string; reason: string; force?: boolean }
): void {
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const pendingTickets = listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern, 1000);
  if (pendingTickets.length === 0) return;

  const fingerprint = computeQueueFingerprint("verifier", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_VERIFIER_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = verifierHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = verifierHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: HandoffEntry = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    verifierHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get!(runnerKey);
      if (!live || live.status !== "running") { clearEntry(); return; }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern, 1000);
      if (currentPending.length === 0) { clearEntry(); return; }
      const idleMs = Number.isFinite(live.lastDataAt) && (live.lastDataAt || 0) > 0
        ? Date.now() - (live.lastDataAt || 0)
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildVerifierHandoffTurnPrompt({ projectRoot, boardRoot, boardDirName, runnerId, ticketPath: currentPending[0] });
      const injectedPrompt = buildInjectedHandoffPrompt({ agent: String(meta.agent || ""), boardRoot, runnerId, kind: "verifier", prompt });
      const injected = mgr.writePrompt!(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("verifier", boardRoot);
        verifierHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(runnerKey, handoffIdleStateFields("verifier_handoff_turn_requested", injectedPrompt.promptPath));
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  verifierHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

export function scheduleVerifierHandoffTurnsForScope(
  { projectRoot, boardDirName, boardRoot, reasons }: { projectRoot: string; boardDirName: string; boardRoot: string; reasons: unknown[] }
): void {
  if (!verifierQueueChangeReasons(reasons)) return;
  if (listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern, 1).length === 0) return;
  const verifierRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "verifier")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of verifierRunners) {
    scheduleVerifierHandoffTurn({
      projectRoot, boardDirName, boardRoot,
      runnerId: runner.id, reason: (reasons || []).join(",")
    });
  }
}

export function plannerQueueChangeReasons(reasons: unknown[]): boolean {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/prd" || /^tickets\/prd\/PRD[-_].+\.md$/i.test(value);
  });
}

function buildPlannerHandoffTurnPrompt(
  { projectRoot, boardRoot, runnerId, prdPath }: { projectRoot: string; boardRoot: string; runnerId: string; prdPath: string }
): string {
  const relPrd = boardRelPath(boardRoot, prdPath);
  const title = readMarkdownTitleSync(prdPath);
  return [
    `Autoflow planner PRD handoff detected by Desktop.`,
    `This is a one-shot planner turn for an actionable PRD in tickets/prd/; it is not a recurring loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending PRD:  ${relPrd}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "planner", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
    `If a PRD exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, create the worker-facing work item set for that one PRD, rerun queue-snapshot once, then summarize.`,
    `Do not open unrelated PRDs, tickets, AGENTS, or rule docs unless the compact planner tool fails or the scoped PRD directly requires them.`
  ].join("\n");
}

export function schedulePlannerHandoffTurn(
  { projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }:
  { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string; reason: string; force?: boolean }
): void {
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const pendingPrds = listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000)
    .filter(plannerQueueFileIsActionableSync);
  if (pendingPrds.length === 0) return;

  const fingerprint = computeQueueFingerprint("planner", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_PLANNER_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = plannerHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = plannerHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: HandoffEntry = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    plannerHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get!(runnerKey);
      if (!live || live.status !== "running") { clearEntry(); return; }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000)
        .filter(plannerQueueFileIsActionableSync);
      if (currentPending.length === 0) { clearEntry(); return; }
      const idleMs = Number.isFinite(live.lastDataAt) && (live.lastDataAt || 0) > 0
        ? Date.now() - (live.lastDataAt || 0)
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildPlannerHandoffTurnPrompt({ projectRoot, boardRoot, runnerId, prdPath: currentPending[0] });
      const injectedPrompt = buildInjectedHandoffPrompt({ agent: String(meta.agent || ""), boardRoot, runnerId, kind: "planner", prompt });
      const injected = mgr.writePrompt!(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("planner", boardRoot);
        plannerHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(runnerKey, handoffIdleStateFields("planner_handoff_turn_requested", injectedPrompt.promptPath));
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  plannerHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

export function schedulePlannerHandoffTurnsForScope(
  { projectRoot, boardDirName, boardRoot, reasons }: { projectRoot: string; boardDirName: string; boardRoot: string; reasons: unknown[] }
): void {
  if (!plannerQueueChangeReasons(reasons)) return;
  if (listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000).filter(plannerQueueFileIsActionableSync).length === 0) return;
  const plannerRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "planner")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of plannerRunners) {
    schedulePlannerHandoffTurn({
      projectRoot, boardDirName, boardRoot,
      runnerId: runner.id, reason: (reasons || []).join(",")
    });
  }
}

export function workerTodoQueueChangeReasons(reasons: unknown[]): boolean {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/todo" || /^tickets\/todo\/TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(value);
  });
}

export function workerTodoQueueFingerprint(boardRoot: string): string {
  const parts: string[] = [];
  for (const filePath of listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern, 1000)) {
    if (!workerTodoFileIsClaimableSync(filePath)) continue;
    try {
      const stat = fsSync.statSync(filePath);
      parts.push(`${boardRelPath(boardRoot, filePath)}:${stat.size}:${stat.mtimeMs}`);
    } catch {}
  }
  return nodeCrypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

export function workerRunnerHasOwnedActiveTicketSync(boardRoot: string, runnerId: string): boolean {
  const normalizedRunnerId = canonicalWorkerRunnerId(runnerId);
  if (!normalizedRunnerId) return false;
  const stateRel = runnerStateFieldSync(boardRoot, normalizedRunnerId, "active_ticket_path")
    .split(path.sep)
    .join("/");
  if (/^tickets\/(?:inprogress|verifier)\/TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(stateRel)) {
    const statePath = path.join(boardRoot, stateRel);
    if (safeIsFileSync(statePath)) {
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(statePath));
      if (!claimedBy || claimedBy === normalizedRunnerId) return true;
    }
  }
  const stateTicketId = runnerActiveTicketIdSync(boardRoot, normalizedRunnerId);
  if (stateTicketId) {
    for (const relDir of ["tickets/inprogress", "tickets/verifier"]) {
      const candidatePath = path.join(boardRoot, relDir, `${stateTicketId}.md`);
      if (!safeIsFileSync(candidatePath)) continue;
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(candidatePath));
      if (!claimedBy || claimedBy === normalizedRunnerId) return true;
    }
  }
  for (const relDir of ["tickets/inprogress", "tickets/verifier"]) {
    for (const ticketPath of listQueueFilesSync(boardRoot, relDir, workItemQueueFilePattern, 1000)) {
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(ticketPath));
      if (claimedBy && claimedBy === normalizedRunnerId) return true;
    }
  }
  return false;
}

function buildWorkerTodoHandoffTurnPrompt(
  { projectRoot, boardRoot, runnerId, ticketPath }: { projectRoot: string; boardRoot: string; runnerId: string; ticketPath: string }
): string {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  return [
    `Autoflow worker work-item handoff detected by Desktop.`,
    `This is a one-shot worker turn for a pending work item; it is not a recurring loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending work item: ${relTicket}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If active-get reports an owned active ticket, handle that ticket first and do not claim another ticket.`,
    `If no owned active ticket exists, run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "work-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once before deciding there is no work.`,
    `If work-snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
    `If a candidate exists, inspect only work-snapshot.ai_followup_scope.inspect_only_recent_sources, choose exactly one work item, run worker claim, then run worker worktree-ensure before any product edits.`
  ].join("\n");
}

export function scheduleWorkerTodoHandoffTurn(
  { projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }:
  { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string; reason: string; force?: boolean }
): void {
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;
  if (workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) return;

  const pendingTodos = listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern, 1000)
    .filter(workerTodoFileIsClaimableSync);
  if (pendingTodos.length === 0) return;

  const fingerprint = workerTodoQueueFingerprint(boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WORKER_WORK_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_WORKER_WORK_HANDOFF_RETRY_MS", 15000, dedupMs);
  const last = workerTodoHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = workerTodoHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_WORK_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_WORK_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WORKER_WORK_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: HandoffEntry = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    workerTodoHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get!(runnerKey);
      if (!live || live.status !== "running") { clearEntry(); return; }
      if (workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) { clearEntry(); return; }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern, 1000)
        .filter(workerTodoFileIsClaimableSync);
      if (currentPending.length === 0) { clearEntry(); return; }
      const idleMs = Number.isFinite(live.lastDataAt) && (live.lastDataAt || 0) > 0
        ? Date.now() - (live.lastDataAt || 0)
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWorkerTodoHandoffTurnPrompt({ projectRoot, boardRoot, runnerId, ticketPath: currentPending[0] });
      const injectedPrompt = buildInjectedHandoffPrompt({ agent: String(meta.agent || ""), boardRoot, runnerId, kind: "worker-todo", prompt });
      const injected = mgr.writePrompt!(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = workerTodoQueueFingerprint(boardRoot);
        workerTodoHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(runnerKey, handoffIdleStateFields("worker_work_handoff_turn_requested", injectedPrompt.promptPath));
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  workerTodoHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

export function scheduleWorkerTodoHandoffTurnsForScope(
  { projectRoot, boardDirName, boardRoot, reasons }: { projectRoot: string; boardDirName: string; boardRoot: string; reasons: unknown[] }
): void {
  if (!workerTodoQueueChangeReasons(reasons)) return;
  const pendingTodos = listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern, 1000)
    .filter(workerTodoFileIsClaimableSync);
  if (pendingTodos.length === 0) return;
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function") return;
  const workerRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "worker")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  let scheduled = 0;
  for (const runner of workerRunners) {
    const runnerId = canonicalWorkerRunnerId(runner.id);
    if (!runnerId || workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) continue;
    const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
    const live = mgr.get(runnerKey);
    if (!live || live.status !== "running") continue;
    scheduleWorkerTodoHandoffTurn({
      projectRoot, boardDirName, boardRoot,
      runnerId, reason: (reasons || []).join(",")
    });
    scheduled += 1;
    if (scheduled >= pendingTodos.length) break;
  }
}

export function wikiQueueChangeReasons(reasons: unknown[]): boolean {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "wiki" || value.startsWith("wiki/") || value === "tickets/done" || value.startsWith("tickets/done/");
  });
}

function buildWikiHandoffTurnPrompt(
  { projectRoot, boardRoot, runnerId }: { projectRoot: string; boardRoot: string; runnerId: string }
): string {
  return [
    `Autoflow wiki handoff detected by Desktop.`,
    `This is a one-shot wiki turn for board wiki/done changes; it is not a recurring loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete.`,
    `If tick.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
    `If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources, write or update at most one focused wiki page through wiki write-page (DB upsert; do not create .autoflow/wiki markdown), then rerun wiki tick once with --skip-telemetry.`,
    `If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the page you updated and the remaining count, then let the Stop hook continue the next focused wiki turn. When no follow-up remains, summarize and leave this runner idle.`,
    `Do not open unrelated tickets, full AGENTS, or broad project files unless the compact wiki tool fails or the scoped source directly requires them.`
  ].join("\n");
}

export function scheduleWikiHandoffTurn(
  { projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }:
  { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string; reason: string; force?: boolean }
): void {
  const mgr = getPtyManager();
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;
  if (!wikiHasPendingRunnerWorkSync(boardRoot)) return;
  if (!ensureWikiAssignmentForPendingWorkSync({ projectRoot, boardDirName, boardRoot, runnerId })) return;

  const fingerprint = computeQueueFingerprint("wiki-maintainer", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_WIKI_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = wikiHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = wikiHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: HandoffEntry = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    wikiHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get!(runnerKey);
      if (!live || live.status !== "running") { clearEntry(); return; }
      if (!wikiHasPendingRunnerWorkSync(boardRoot)) { clearEntry(); return; }
      const idleMs = Number.isFinite(live.lastDataAt) && (live.lastDataAt || 0) > 0
        ? Date.now() - (live.lastDataAt || 0)
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) { clearEntry(); return; }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWikiHandoffTurnPrompt({ projectRoot, boardRoot, runnerId });
      const injectedPrompt = buildInjectedHandoffPrompt({ agent: String(meta.agent || ""), boardRoot, runnerId, kind: "wiki", prompt });
      const injected = mgr.writePrompt!(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("wiki-maintainer", boardRoot);
        wikiHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(runnerKey, handoffIdleStateFields("wiki_handoff_turn_requested", injectedPrompt.promptPath));
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  wikiHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

export function scheduleWikiHandoffTurnsForScope(
  { projectRoot, boardDirName, boardRoot, reasons }: { projectRoot: string; boardDirName: string; boardRoot: string; reasons: unknown[] }
): void {
  if (!wikiQueueChangeReasons(reasons)) return;
  if (!wikiHasPendingRunnerWorkSync(boardRoot)) return;
  const wikiRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "wiki-maintainer")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of wikiRunners) {
    scheduleWikiHandoffTurn({
      projectRoot, boardDirName, boardRoot,
      runnerId: runner.id, reason: (reasons || []).join(",")
    });
  }
}

// 한 runner 의 모든 handoff turn 타이머와 dedup 기록을 정리한다.
// PTY runner 가 stopped 이벤트를 발생시킬 때 main.ts 가 호출한다.
export function clearAllHandoffTimersForRunner(runnerKey: string): void {
  const verifierTurnTimer = verifierHandoffTurnTimers.get(runnerKey);
  if (verifierTurnTimer?.timer) clearTimeout(verifierTurnTimer.timer);
  verifierHandoffTurnTimers.delete(runnerKey);
  verifierHandoffLastInjected.delete(runnerKey);

  const plannerTurnTimer = plannerHandoffTurnTimers.get(runnerKey);
  if (plannerTurnTimer?.timer) clearTimeout(plannerTurnTimer.timer);
  plannerHandoffTurnTimers.delete(runnerKey);
  plannerHandoffLastInjected.delete(runnerKey);

  const wikiTurnTimer = wikiHandoffTurnTimers.get(runnerKey);
  if (wikiTurnTimer?.timer) clearTimeout(wikiTurnTimer.timer);
  wikiHandoffTurnTimers.delete(runnerKey);
  wikiHandoffLastInjected.delete(runnerKey);

  const workerTodoTurnTimer = workerTodoHandoffTurnTimers.get(runnerKey);
  if (workerTodoTurnTimer?.timer) clearTimeout(workerTodoTurnTimer.timer);
  workerTodoHandoffTurnTimers.delete(runnerKey);
  workerTodoHandoffLastInjected.delete(runnerKey);

  const workerVerifierDecisionTimer = workerVerifierDecisionTurnTimers.get(runnerKey);
  if (workerVerifierDecisionTimer?.timer) clearTimeout(workerVerifierDecisionTimer.timer);
  workerVerifierDecisionTurnTimers.delete(runnerKey);
  workerVerifierDecisionLastInjected.delete(runnerKey);
}
