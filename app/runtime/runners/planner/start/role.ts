import {fs, path, BOARD_ROOT, workerId, utils} from "./context";

export function ensureExpectedRole(expected: string): void {
  const role = process.env.AUTOFLOW_ROLE || process.env.ROLE || "";
  if (!role) return;
  if (expected === "plan" && ["plan", "planner"].includes(role)) return;
  if (role === expected) return;
  process.stderr.write(`start-plan.ts: expected role ${expected}, got ${role}\n`);
  process.exit(1);
}

export function workerRole(): string {
  return process.env.AUTOFLOW_TICKET_WORKER_ROLE || process.env.AUTOFLOW_WORKER_ROLE || "worker";
}

export function setThreadContextRecord(role: string, worker: string, ticket: string, worktree: string, branch: string): void {
  const stateDir = path.join(BOARD_ROOT, "automations", "state");
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, `${role}.context`),
      `role=${role}\nworker=${worker}\nticket=${ticket}\nworktree=${worktree}\nbranch=${branch}\nupdated_at=${utils.nowIso()}\n`,
      "utf8"
    );
  } catch {}
}

export function displayWorkerId(raw: string): string {
  if (/^(planner|plan)-/.test(raw)) return "planner";
  if (raw === "planner" || raw === "plan") return "planner";
  return raw || "planner";
}
