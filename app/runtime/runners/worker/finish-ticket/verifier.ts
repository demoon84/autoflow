import {fs, path, boardRoot, timestamp, workerId} from "./context";
import {appendNote, removeScalars, replaceScalar, replaceSection, scalar, updateGoalRuntime} from "./ticket-sections";
import {boardRel, printPairs, read, write} from "./io";

const verifierDecisionFields = [
  "Semantic Decision",
  "Semantic Reason",
  "Semantic Checked At",
  "Semantic Log",
  "Semantic Marker",
];

function prdBranchForTicket(ticketFile: string): string {
  const prdKey = scalar(ticketFile, "Ticket", "PRD Key");
  if (!/^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+$/i.test(prdKey)) return "";
  const candidates = [
    path.join(boardRoot, "tickets", "prd", `${prdKey}.md`),
    path.join(boardRoot, "tickets", "done", prdKey, `${prdKey}.md`),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const branch = scalar(candidate, "Project", "Branch");
    if (branch) return branch;
  }
  return "";
}

function mergeTargetDescription(ticketFile: string): string {
  const prdBranch = prdBranchForTicket(ticketFile);
  if (prdBranch) return `${prdBranch} PRD branch`;
  return "main";
}

export function handoffToVerifier(ticketFile: string, ticketId: string): void {
  const verifierDir = path.join(boardRoot, "tickets", "verifier");
  fs.mkdirSync(verifierDir, { recursive: true });
  const verifierTicket = path.join(verifierDir, `TODO-${ticketId}.md`);
  if (path.resolve(ticketFile) !== path.resolve(verifierTicket) && fs.existsSync(verifierTicket)) {
    printPairs({
      status: "blocked",
      reason: "verifier_ticket_already_exists",
      ticket: ticketFile,
      ticket_id: ticketId,
      verifier_ticket: verifierTicket,
      next_action: "Verifier ticket already exists. Worker must wait for the verifier decision instead of overwriting the verifier lane.",
    });
    process.exit(1);
  }
  removeScalars(ticketFile, "Verification", verifierDecisionFields);
  replaceScalar(ticketFile, "Ticket", "Stage", "verify_pending");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(ticketFile, "Worktree", "Integration Status", "verify_pending");
  updateGoalRuntime(ticketFile, "verify_pending", timestamp);
  replaceSection(ticketFile, "Next Action", `- Next: verifier must review tickets/verifier/TODO-${ticketId}.md before any PROJECT_ROOT merge. Verifier pass/revise/replan moves this ticket back to tickets/inprogress/ with the next worker action recorded.`);
  appendNote(ticketFile, `Worker pass handed off to verifier at ${timestamp}; PROJECT_ROOT merge is blocked until verifier pass.`);
  if (path.resolve(ticketFile) !== path.resolve(verifierTicket)) {
    fs.renameSync(ticketFile, verifierTicket);
  }
  replaceScalar(verifierTicket, "Ticket", "Stage", "verify_pending");
  replaceScalar(verifierTicket, "Verification", "Submitted At", timestamp);
  updateWorkerVerifierWaitState(verifierTicket, ticketId);
  printPairs({
    status: "verify_pending",
    ticket: verifierTicket,
    ticket_id: ticketId,
    moved_from: ticketFile,
    verifier_ticket: verifierTicket,
    next_action: `Verifier runner should inspect tickets/verifier/TODO-${ticketId}.md on its next startup scan. On pass/revise/replan it moves the ticket back to tickets/inprogress/ with the corresponding worker stage; worker then finalizes, revises, or runs request-replan.`,
  });
}

export function shouldHandoffToVerifier(ticketId: string): boolean {
  if ((process.env.AUTOFLOW_VERIFIER_ENABLED || "0") !== "1") return false;
  if ((process.env.AUTOFLOW_SKIP_VERIFIER || "0") === "1") return false;
  return !fs.existsSync(verifierMarker(ticketId));
}

export function removeVerifierMarker(ticketId: string): void {
  try { fs.unlinkSync(verifierMarker(ticketId)); } catch {}
}

export function verifierMarker(ticketId: string): string {
  return path.join(boardRoot, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

function updateWorkerVerifierWaitState(ticketFile: string, ticketId: string): void {
  const stateFile = path.join(boardRoot, "runners", "state", `${workerId}.state`);
  if (!fs.existsSync(stateFile)) return;
  const updates = new Map([
    ["active_ticket_id", `TODO-${ticketId}`],
    ["active_stage", "verify_pending"],
    ["active_ticket_path", boardRel(ticketFile)],
    ["last_result", "worker_ticket_waiting_for_verifier"],
    ["updated_at", timestamp],
  ]);
  const seen = new Set<string>();
  const lines = read(stateFile).split(/\r?\n/).filter(Boolean).map((line) => {
    const key = line.split("=")[0];
    if (!updates.has(key)) return line;
    seen.add(key);
    return `${key}=${updates.get(key)}`;
  });
  for (const [key, value] of updates) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  write(stateFile, `${lines.join("\n")}\n`);
}

function updateWorkerMergeState(ticketFile: string, ticketId: string): void {
  const stateFile = path.join(boardRoot, "runners", "state", `${workerId}.state`);
  if (!fs.existsSync(stateFile)) return;
  const updates = new Map([
    ["active_ticket_id", `TODO-${ticketId}`],
    ["active_stage", "merging"],
    ["active_ticket_path", boardRel(ticketFile)],
    ["last_result", "needs_ai_merge"],
    ["updated_at", timestamp],
  ]);
  const seen = new Set<string>();
  const lines = read(stateFile).split(/\r?\n/).filter(Boolean).map((line) => {
    const key = line.split("=")[0];
    if (!updates.has(key)) return line;
    seen.add(key);
    return `${key}=${updates.get(key)}`;
  });
  for (const [key, value] of updates) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  write(stateFile, `${lines.join("\n")}\n`);
}

export function markNeedsAiMerge(ticketFile: string, ticketId: string, reason: string): void {
  replaceScalar(ticketFile, "Ticket", "Stage", "merging");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
  updateGoalRuntime(ticketFile, "merging", timestamp);
  const mergeTarget = mergeTargetDescription(ticketFile);
    replaceSection(ticketFile, "Next Action", `- Next: verifier has approved this worktree. Worker must now integrate verified worktree changes into ${mergeTarget} inside Allowed Paths, resolve conflicts if needed, rerun required verification from that merge target, then run \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`. Do not accept another TODO before finalization is complete.`);
  appendNote(ticketFile, `Finish paused at ${timestamp}: ${reason}. AI must integrate worktree changes into ${mergeTarget} before finalization.`);
  updateWorkerMergeState(ticketFile, ticketId);
}

export function writeVerifierLog(ticketFile: string, ticketId: string): string {
  void ticketFile;
  void ticketId;
  return "";
}
