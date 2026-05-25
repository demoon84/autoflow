import {fs, path, boardRoot, projectRoot, timestamp, workerId} from "./context";
import {idFromTicketPath, normalizeId, read, stripTicks, write} from "./io";
import {scalar} from "./ticket-sections";
import {git, gitOut} from "./git";

const ticketBranchIdPattern = "(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\\d+";
const managedTodoBranchRe = new RegExp(`^autoflow\\/(?:TODO|work)-${ticketBranchIdPattern}$`, "i");
const managedPrdBranchRe = new RegExp(`^autoflow\\/prd-${ticketBranchIdPattern}$`, "i");

function isManagedTodoBranch(branch: string): boolean {
  return managedTodoBranchRe.test(branch);
}

function isManagedPrdBranch(branch: string): boolean {
  return managedPrdBranchRe.test(branch);
}

function isManagedAutoflowBranch(branch: string): boolean {
  return isManagedTodoBranch(branch) || isManagedPrdBranch(branch);
}

function isPrdTrackTicket(ticketFile: string): boolean {
  const prdKey = scalar(ticketFile, "Ticket", "PRD Key");
  const branch = stripTicks(scalar(ticketFile, "Worktree", "Branch"));
  return Boolean(prdKey) && isManagedPrdBranch(branch);
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
  if (isManagedTodoBranch(recorded)) return recorded;
  const ticketId = idFromTicketPath(ticketFile);
  return ticketId ? `autoflow/TODO-${ticketId}` : "";
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
  if (isPrdTrackTicket(ticketFile)) return;
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  if (worktreePath && fs.existsSync(worktreePath) && isManagedAutoflowWorktree(worktreePath)) {
    git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
  }
  cleanupTicketBranch(ticketFile);
}

export function clearActiveState(lastResult = ""): void {
  const stateFile = path.join(boardRoot, "runners", "state", `${workerId}.state`);
  if (fs.existsSync(stateFile)) {
    const keys = new Set(["active_item", "active_ticket_id", "active_ticket_title", "active_stage", "active_spec_ref", "active_ticket_path"]);
    const updates = new Map<string, string>();
    if (lastResult) {
      updates.set("last_result", lastResult);
      updates.set("updated_at", timestamp);
    }
    const seen = new Set<string>();
    const lines = read(stateFile).split(/\r?\n/).filter(Boolean).map((line) => {
      const key = line.split("=")[0];
      if (updates.has(key)) {
        seen.add(key);
        return `${key}=${updates.get(key)}`;
      }
      return keys.has(key) ? `${key}=` : line;
    });
    for (const [key, value] of updates) {
      if (!seen.has(key)) lines.push(`${key}=${value}`);
    }
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
  for (const state of ["inprogress", "todo", "verifier"]) {
    for (const name of [`TODO-${id}.md`, `TODO-${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}
