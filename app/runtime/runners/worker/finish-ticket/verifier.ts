import {fs, path, boardRoot, projectRoot, scriptDir, timestamp, workerId} from "./context";
import {appendNote, removeScalars, replaceScalar, replaceSection, updateGoalRuntime} from "./ticket-sections";
import {boardRel, oneLine, printPairs, read, write} from "./io";
import {spawnOutputText, spawnTsScript} from "./git";

const verifierDecisionFields = [
  "Semantic Decision",
  "Semantic Reason",
  "Semantic Checked At",
  "Semantic Log",
  "Semantic Marker",
];

export function handoffToVerifier(ticketFile: string, ticketId: string): void {
  const verifierDir = path.join(boardRoot, "tickets", "verifier");
  fs.mkdirSync(verifierDir, { recursive: true });
  const verifierTicket = path.join(verifierDir, `Todo-${ticketId}.md`);
  removeScalars(ticketFile, "Verification", verifierDecisionFields);
  replaceScalar(ticketFile, "Ticket", "Stage", "verify_pending");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(ticketFile, "Worktree", "Integration Status", "verify_pending");
  updateGoalRuntime(ticketFile, "verify_pending", timestamp);
  replaceSection(ticketFile, "Next Action", `- Next: verifier must review tickets/verifier/Todo-${ticketId}.md before any PROJECT_ROOT merge. Worker waits for verifier pass/revise/replan wake: pass allows merge/finalization, revise keeps this worktree for correction, replan creates a retry order and deletes this worktree.`);
  appendNote(ticketFile, `Worker pass handed off to verifier at ${timestamp}; PROJECT_ROOT merge is blocked until verifier pass.`);
  fs.copyFileSync(ticketFile, verifierTicket);
  replaceScalar(verifierTicket, "Ticket", "Stage", "verify_pending");
  const stateDir = path.join(boardRoot, "runners", "state");
  fs.mkdirSync(stateDir, { recursive: true });
  write(path.join(stateDir, "verifier.verifier-realtime-wakeup.pending"), `triggered_at=${timestamp}\nticket_id=${ticketId}\n`);
  const wake = wakeVerifierWithRunnerTool();
  printPairs({
    status: "verify_pending",
    ticket: ticketFile,
    ticket_id: ticketId,
    verifier_ticket: verifierTicket,
    verifier_wake_tool_status: wake.status,
    verifier_wake_tool_stdout: oneLine(wake.stdout),
    verifier_wake_tool_stderr: oneLine(wake.stderr),
    next_action: `Verifier runner will inspect tickets/verifier/Todo-${ticketId}.md. On pass it records a verifier marker and wakes the worker for merge/finalization; on revise it wakes worker to fix the same worktree; on replan it wakes worker to create the retry order and delete the worktree.`,
  });
}

export function wakeVerifierWithRunnerTool(): { status: string; stdout: string; stderr: string } {
  const tool = path.join(scriptDir, "..", "..", "tool.ts");
  if (!fs.existsSync(tool)) {
    return { status: "missing_runner_tool", stdout: "", stderr: "" };
  }
  const result = spawnTsScript(tool, ["verifier", "wake", "--runner", "verifier"], {
    ...process.env,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_ROLE: "verifier",
    AUTOFLOW_RUNNER_ID: "verifier",
    RUNNER_ID: "verifier",
  });
  const status = typeof result.status === "number" ? result.status : 1;
  return {
    status: status === 0 ? "ok" : `exit_${status}`,
    stdout: spawnOutputText(result.stdout),
    stderr: spawnOutputText(result.stderr),
  };
}

export function shouldHandoffToVerifier(ticketId: string): boolean {
  if ((process.env.AUTOFLOW_VERIFIER_ENABLED || "1") === "0") return false;
  if ((process.env.AUTOFLOW_SKIP_VERIFIER || "0") === "1") return false;
  return !fs.existsSync(verifierMarker(ticketId));
}

export function removeVerifierMarker(ticketId: string): void {
  try { fs.unlinkSync(verifierMarker(ticketId)); } catch {}
}

export function verifierMarker(ticketId: string): string {
  return path.join(boardRoot, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

function updateWorkerMergeState(ticketFile: string, ticketId: string): void {
  const stateFile = path.join(boardRoot, "runners", "state", `${workerId}.state`);
  if (!fs.existsSync(stateFile)) return;
  const updates = new Map([
    ["active_ticket_id", `Todo-${ticketId}`],
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
  replaceSection(ticketFile, "Next Action", `- Next: verifier has approved this worktree. Worker must now integrate verified worktree changes into PROJECT_ROOT/main inside Allowed Paths, resolve conflicts if needed, rerun required verification from PROJECT_ROOT, then run \`autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>"\`. Do not claim another ticket or call merge-ready-ticket directly.`);
  appendNote(ticketFile, `Finish paused at ${timestamp}: ${reason}. AI must integrate worktree changes into PROJECT_ROOT before finalization.`);
  updateWorkerMergeState(ticketFile, ticketId);
}

export function writeVerifierLog(ticketFile: string, ticketId: string): string {
  const logsDir = path.join(boardRoot, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const logFile = path.join(logsDir, `verifier_${ticketId}_${timestamp.replace(/[-:]/g, "")}.md`);
  write(logFile, `# Ticket ${ticketId} verification

- Ticket: ${boardRel(ticketFile)}
- Result: pass
- Finalized At: ${timestamp}
- Worker: ${workerId}
`);
  return logFile;
}
