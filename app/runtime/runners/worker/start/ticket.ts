import {fs, path, boardRoot, type ToolJson} from "./context";
import {read, stripTicks, escapeRe} from "./io";

export function findTicket(raw: string): { state: string; path: string } | null {
  const direct = resolveBoardPath(raw);
  if (direct && fs.existsSync(direct)) {
    const state = path.basename(path.dirname(direct));
    return { state, path: direct };
  }
  const id = normalizeId(raw);
  if (!id) return null;
  for (const state of ["inprogress", "todo", "verifier", "ready-to-merge"]) {
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return { state, path: candidate };
    }
  }
  return null;
}

export function ticketItemFromPath(file: string): ToolJson {
  return {
    path: boardRel(file),
    id: idFromTicketPath(file),
    stage: ticketScalar(file, "Stage"),
    worktree_path: ticketWorktreeField(file, "Path"),
    worktree_status: ticketWorktreeField(file, "Integration Status"),
  };
}

export function resolveBoardPath(raw: string): string {
  if (!raw) return "";
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(boardRoot, raw.replace(/^[.][/]/, ""));
}

export function boardRel(file: string): string {
  const rel = path.relative(boardRoot, file);
  return rel.startsWith("..") ? file : rel;
}

export function idFromTicketPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

export function normalizeId(raw: string): string {
  const match = String(raw || "").match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

export function ticketScalar(file: string, field: string): string {
  const text = read(file);
  const match = text.match(new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`, "m"));
  return match ? stripTicks(match[1].trim()) : "";
}

export function ticketWorktreeField(file: string, field: string): string {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  let inWorktree = false;
  const re = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (/^## Worktree\b/.test(line)) {
      inWorktree = true;
      continue;
    }
    if (/^## /.test(line) && inWorktree) break;
    if (!inWorktree) continue;
    const match = line.match(re);
    if (match) return stripTicks(match[1].trim());
  }
  return "";
}

export function doneTarget(ticketAbs: string): string {
  const projectKey = ticketScalar(ticketAbs, "PRD Key") || "unknown";
  return path.join(boardRoot, "tickets", "done", projectKey, path.basename(ticketAbs));
}

export function nextActionFor(ticketId: string, stage: string): string {
  if (stage === "verify_pending" || stage === "verifying") {
    return `Wait for verifier semantic review for ticket ${ticketId}. Worker must not merge into PROJECT_ROOT until verifier records pass.`;
  }
  if (stage === "verified_pending_merge") {
    return `Verifier passed ticket ${ticketId}. Merge the verified worktree changes into PROJECT_ROOT/main, rerun verification from PROJECT_ROOT, then run autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>".`;
  }
  if (stage === "revision_requested") {
    return `Verifier requested revise for ticket ${ticketId}. Keep the same worktree, fix the verifier notes inside Allowed Paths, rerun local verification, then run autoflow tool runner-tool worker submit-to-verifier --ticket ${ticketId} --summary "<summary>" to submit again.`;
  }
  if (stage === "replan_requested") {
    return `Verifier requested replan for ticket ${ticketId}. Run autoflow tool runner-tool worker create-retry-order --ticket ${ticketId} --reason "<reason>" so the retry order is created and the ticket worktree is deleted.`;
  }
  if (stage === "merging" || stage === "ready_to_merge" || stage === "needs_ai_merge") {
    return `Continue worker merge for ticket ${ticketId}: integrate verifier-approved worktree changes into PROJECT_ROOT/main, rerun verification, then run autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>".`;
  }
  return `Use this same worker turn to update the mini-plan and implement within Allowed Paths. Then run the verification command yourself, record evidence with autoflow tool runner-tool worker verification-record, and call autoflow tool runner-tool worker submit-to-verifier --ticket ${ticketId} --summary "<summary>" for verifier handoff. If the ticket itself must be replaced, use worker create-retry-order after verifier/recovery evidence records the reason. Never git push.`;
}

export function worktreeStatusAllowsResume(status: string): boolean {
  const normalized = status.toLowerCase();
  return ![
    "",
    "pending",
    "pending_claim",
    "worktree_missing",
    "blocked_recovery_missing_worktree",
    "blocked_worktree_setup_failed",
    "not_git_repo",
    "no_head_commit",
    "disabled",
    "project_root_fallback",
  ].includes(normalized);
}
