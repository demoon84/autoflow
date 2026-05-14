import {fs, path, boardRoot, projectRoot, workerId} from "./context";
import {normalizeId, read, write} from "./io";
import {scalar} from "./ticket-sections";
import {git, gitOut} from "./git";

function isManagedAutoflowWorktree(worktreePath: string): boolean {
  const resolved = path.resolve(worktreePath);
  if (resolved === path.resolve(projectRoot)) return false;
  if (resolved.includes(`${path.sep}.autoflow${path.sep}worktrees${path.sep}`)) return true;
  if (!resolved.includes(`${path.sep}autoflow${path.sep}worktrees${path.sep}`)) return false;
  const branch = gitOut(resolved, ["symbolic-ref", "--short", "HEAD"]);
  return /^autoflow\/tickets_\d+$/.test(branch);
}

export function cleanupWorktree(ticketFile: string): void {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  if (!worktreePath || !fs.existsSync(worktreePath)) return;
  if (!isManagedAutoflowWorktree(worktreePath)) return;
  git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
}

export function clearActiveState(): void {
  const stateFile = path.join(boardRoot, "runners", "state", `${workerId}.state`);
  if (fs.existsSync(stateFile)) {
    const keys = new Set(["active_item", "active_ticket_id", "active_ticket_title", "active_stage", "active_spec_ref", "active_recovery_reason", "active_recovery_status", "active_recovery_failure_class", "active_recovery_worktree_path", "active_recovery_worktree_status", "active_recovery_board_state"]);
    const lines = read(stateFile).split(/\r?\n/).filter(Boolean).map((line) => {
      const key = line.split("=")[0];
      return keys.has(key) ? `${key}=` : line;
    });
    write(stateFile, `${lines.join("\n")}\n`);
  }
}

export function resolveTicketFile(ref: string): string {
  const normalized = ref.replace(/^[.][/]/, "");
  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;
  if (normalized.includes("/")) {
    const candidate = path.join(boardRoot, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  const id = normalizeId(ref);
  if (!id) return "";
  for (const state of ["inprogress", "ready-to-merge", "todo", "verifier"]) {
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}
