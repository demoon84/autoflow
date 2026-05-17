import {fs, path, boardRoot, projectRoot, workerId} from "./context";
import {idFromTicketPath, normalizeId, read, stripTicks, write} from "./io";
import {scalar} from "./ticket-sections";
import {git, gitOut} from "./git";

function isManagedAutoflowBranch(branch: string): boolean {
  return /^autoflow\/tickets_\d+$/.test(branch);
}

function isManagedAutoflowWorktree(worktreePath: string): boolean {
  const resolved = path.resolve(worktreePath);
  if (resolved === path.resolve(projectRoot)) return false;
  const branch = gitOut(resolved, ["symbolic-ref", "--short", "HEAD"]);
  if (isManagedAutoflowBranch(branch)) return true;
  if (resolved.includes(`${path.sep}.autoflow${path.sep}worktrees${path.sep}`)) return true;
  return resolved.includes(`${path.sep}autoflow${path.sep}worktrees${path.sep}`);
}

function ticketBranch(ticketFile: string): string {
  const recorded = stripTicks(scalar(ticketFile, "Worktree", "Branch"));
  if (isManagedAutoflowBranch(recorded)) return recorded;
  const ticketId = idFromTicketPath(ticketFile);
  return ticketId ? `autoflow/tickets_${ticketId}` : "";
}

function branchExists(branch: string): boolean {
  return Boolean(branch) && git(projectRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
}

function checkedOutWorktreePath(branch: string): string {
  const blocks = gitOut(projectRoot, ["worktree", "list", "--porcelain"]).split(/\n\n+/).filter(Boolean);
  for (const block of blocks) {
    const branchMatch = block.match(/^branch refs\/heads\/(.+)$/m);
    if (!branchMatch || branchMatch[1] !== branch) continue;
    const worktreeMatch = block.match(/^worktree (.+)$/m);
    return worktreeMatch ? worktreeMatch[1] : "";
  }
  return "";
}

function cleanupTicketBranch(ticketFile: string): void {
  const branch = ticketBranch(ticketFile);
  if (!branchExists(branch)) return;
  git(projectRoot, ["worktree", "prune"]);
  if (checkedOutWorktreePath(branch)) return;
  git(projectRoot, ["branch", "-D", branch]);
}

export function cleanupWorktree(ticketFile: string): void {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  if (worktreePath && fs.existsSync(worktreePath) && isManagedAutoflowWorktree(worktreePath)) {
    git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
  }
  cleanupTicketBranch(ticketFile);
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
