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
  for (const state of ["inprogress", "todo", "verifier"]) {
    for (const name of [`TODO-${id}.md`, `TODO-${id}.md`]) {
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
  return normalizeId(path.basename(file));
}

export function normalizeId(raw: string): string {
  const value = String(raw || "").trim().replace(/\.md$/i, "").replace(/^(?:PRD|TODO)-/i, "");
  const scoped = value.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
  if (scoped) return `${scoped[1].toLowerCase()}-${scoped[2].padStart(3, "0")}`;
  const match = value.match(/(\d+)/);
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

export function ticketSectionScalar(file: string, section: string, field: string): string {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const sectionRe = new RegExp(`^##\\s+${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) break;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return stripTicks(match[1].trim());
  }
  return "";
}

function normalizePrdKey(value: string): string {
  const trimmed = String(value || "").trim();
  const scoped = trimmed.match(/\bPRD-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\b/i);
  if (scoped) return `PRD-${normalizeId(scoped[1])}`;
  const numeric = trimmed.match(/\b(?:PRD[-_]|prd_|project_)(\d+)\b/i);
  if (numeric) return `PRD-${numeric[1].padStart(3, "0")}`;
  return "";
}

function ticketPrdKey(ticketAbs: string): string {
  if (!ticketAbs) return "";
  return normalizePrdKey(
    ticketScalar(ticketAbs, "PRD Key") ||
    ticketScalar(ticketAbs, "PRD") ||
    ticketSectionScalar(ticketAbs, "References", "PRD") ||
    ticketSectionScalar(ticketAbs, "Source", "PRD")
  );
}

function prdBranchForTicket(ticketAbs: string): string {
  if (!ticketAbs) return "";
  const prdKey = ticketPrdKey(ticketAbs);
  if (!/^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+$/i.test(prdKey)) return "";
  const candidates = [
    path.join(boardRoot, "tickets", "prd", `${prdKey}.md`),
    path.join(boardRoot, "tickets", "done", prdKey, `${prdKey}.md`),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const branch = ticketSectionScalar(candidate, "Project", "Branch");
    if (branch) return branch;
  }
  return "";
}

function mergeTargetDescription(ticketAbs: string): string {
  const prdBranch = prdBranchForTicket(ticketAbs);
  if (prdBranch) return `${prdBranch} PRD branch`;
  return "main";
}

export function doneTarget(ticketAbs: string): string {
  const projectKey = ticketPrdKey(ticketAbs) || "unknown";
  return path.join(boardRoot, "tickets", "done", projectKey, path.basename(ticketAbs));
}

export function nextActionFor(ticketId: string, stage: string, ticketAbs = ""): string {
  if (stage === "blocked") {
    return `Ticket ${ticketId} is blocked. Worker must inspect Notes/Next Action for the blocker, fix it inside Allowed Paths in the same worktree, update Next Action, set the stage back to executing, then continue. If progress is impossible without planner or user input, leave one concrete next-step note and idle once.`;
  }
  if (stage === "verify_pending" || stage === "verifying") {
    return `Ticket ${ticketId} is in a legacy review state. Worker must inspect the ticket evidence and continue with local verification or request replan without merging unverified work.`;
  }
  if (stage === "verified_pending_merge") {
    return `Ticket ${ticketId} is ready for Worker finalization: run autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>" to commit the verified result into ${mergeTargetDescription(ticketAbs)}, rerun required verification, and merge the PRD worktree if this was the final TODO.`;
  }
  if (stage === "revision_requested") {
    return `Revision was requested for ticket ${ticketId}. Keep the same worktree, apply the notes inside Allowed Paths, rerun local verification, then run autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>".`;
  }
  if (stage === "replan_requested") {
    return `Replan was requested for ticket ${ticketId}. Run autoflow tool runner-tool worker request-replan --ticket ${ticketId} --reason "<reason>" so the worktree is cleaned up and this work item returns to the pending work lane for a fresh worker attempt.`;
  }
  if (stage === "merging" || stage === "needs_ai_merge") {
    return `Worker must continue finalization for ticket ${ticketId}: integrate verified worktree changes into ${mergeTargetDescription(ticketAbs)}, rerun verification from that merge target, then run autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>".`;
  }
  return `Use this same worker turn to update the mini-plan and implement within Allowed Paths. Then run the verification command yourself, record evidence with autoflow tool runner-tool worker verification-record, and call autoflow tool runner-tool worker finalize-approved --ticket ${ticketId} --summary "<summary>". If the ticket itself must be redone from scratch, use worker request-replan after blocker evidence records the reason. Never git push.`;
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
