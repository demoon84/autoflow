import { spawnSync } from "node:child_process";
import nodeCrypto from "node:crypto";
import fsSync from "node:fs";
import path from "node:path";
import { readJsonFileSync } from "./core-registry";

export function normalizeRunnerRole(role: unknown): string {
  const value = String(role || "").toLowerCase();
  if (value === "plan") return "planner";
  if (value === "ticket") return "worker";
  if (value === "wiki") return "wiki-maintainer";
  if (value === "verify") return "verifier";
  if (value === "coord") return "coordinator";
  return value || "planner";
}

export function boardRelPath(boardRoot: string, filePath: string): string {
  const rel = path.relative(boardRoot, filePath).split(path.sep).join("/");
  return rel && !rel.startsWith("..") ? rel : filePath;
}

export function readMarkdownTitleSync(filePath: string): string {
  try {
    const text = fsSync.readFileSync(filePath, "utf8");
    const titleScalar = text.match(/^- Title:\s*(.+)$/m);
    if (titleScalar) return titleScalar[1].trim();
    const first = text.split(/\r?\n/, 1)[0] || "";
    return first.replace(/^#\s+/, "").trim();
  } catch {
    return "";
  }
}

export function safeIsFileSync(filePath: string): boolean {
  try {
    return fsSync.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function migrateLegacyTicketQueueSync(boardRoot: string, fromName: string, toName: string): void {
  try {
    const ticketsRoot = path.join(boardRoot, "tickets");
    const fromDir = path.join(ticketsRoot, fromName);
    const toDir = path.join(ticketsRoot, toName);
    if (!fsSync.existsSync(fromDir)) return;
    fsSync.mkdirSync(toDir, { recursive: true });
    for (const name of fsSync.readdirSync(fromDir)) {
      const from = path.join(fromDir, name);
      const to = path.join(toDir, name);
      let stat;
      try {
        stat = fsSync.statSync(from);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (fsSync.existsSync(to)) {
        if (name === ".gitkeep") fsSync.rmSync(from, { force: true });
        continue;
      }
      fsSync.renameSync(from, to);
    }
    try {
      fsSync.rmdirSync(fromDir);
    } catch {}
  } catch {}
}

export function migrateLegacyTicketQueuesSync(boardRoot: string): void {
  migrateLegacyTicketQueueSync(boardRoot, "inbox", "order");
  migrateLegacyTicketQueueSync(boardRoot, "backlog", "prd");
}

export function listQueueFilesSync(boardRoot: string, relDir: string, pattern: RegExp, limit = 100): string[] {
  const full = path.join(boardRoot, relDir);
  if (!fsSync.existsSync(full)) return [];
  try {
    return fsSync.readdirSync(full)
      .filter((name) => pattern.test(name))
      .map((name) => path.join(full, name))
      .filter((filePath) => {
        try {
          return fsSync.statSync(filePath).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function markdownScalarInSectionSync(filePath: string, section: string, field: string): string {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inSection = heading[1].trim().toLowerCase() === String(section || "").toLowerCase();
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^-\s*([^:]+):\s*(.*?)\s*$/);
    if (match && match[1].trim().toLowerCase() === String(field || "").toLowerCase()) {
      return match[2].trim();
    }
  }
  return "";
}

export function plannerQueueFileIsActionableSync(filePath: string): boolean {
  const status = markdownScalarInSectionSync(filePath, "Project", "Status").toLowerCase();
  if (["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status)) {
    return false;
  }
  if (!status) {
    const title = markdownScalarInSectionSync(filePath, "Project", "Title");
    if (!title) return false;
  }
  return true;
}

export function workerInprogressFileIsActionableSync(filePath: string): boolean {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return false;
  }
  const stage = (
    markdownScalarInSectionSync(filePath, "Ticket", "Stage") ||
    markdownScalarInSectionSync(filePath, "Worktree", "Integration Status") ||
    markdownScalarInSectionSync(filePath, "Goal Runtime", "Status")
  ).toLowerCase();
  if (/verified[_ -]?pending[_ -]?merge/.test(stage) || /^-\s*Semantic Decision:\s*pass\s*$/mi.test(text)) {
    return true;
  }
  if (
    /verify[_ -]?pending/.test(stage) ||
    /verifier[_ -]?pending/.test(stage) ||
    /submitted[_ -]?to[_ -]?verifier/.test(stage) ||
    /awaiting[_ -]?verifier/.test(stage)
  ) {
    return false;
  }
  return true;
}

export const workItemQueueFilePattern = /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i;

export function walkMarkdownFilesSync(dir: string): string[] {
  const out: string[] = [];
  const visit = (current: string) => {
    let entries: fsSync.Dirent[] = [];
    try {
      entries = fsSync.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(filePath);
      }
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

export function computeWikiSourceHashSync(boardRoot: string): { hash: string; count: number } {
  const files = [
    ...walkMarkdownFilesSync(path.join(boardRoot, "wiki")),
    ...walkMarkdownFilesSync(path.join(boardRoot, "tickets", "done")),
  ].sort((a, b) => a.localeCompare(b));
  const hash = nodeCrypto.createHash("sha256");
  for (const filePath of files) {
    try {
      const text = fsSync.readFileSync(filePath, "utf8");
      if (!text.trim()) continue;
      const relPath = path.relative(boardRoot, filePath);
      const contentSha = nodeCrypto.createHash("sha256").update(text).digest("hex");
      hash.update(relPath).update("\0").update(contentSha).update("\0");
    } catch {}
  }
  return { hash: hash.digest("hex"), count: files.length };
}

export function wikiPendingReviewPathsSync(boardRoot: string): string[] {
  const statePath = path.join(boardRoot, "runners", "state", "wiki-focused-review.json");
  const state = readJsonFileSync<{
    reviewed_done_paths?: unknown[];
    pending_done_paths?: unknown[];
  }>(statePath) || {};
  const reviewed = new Set(
    Array.isArray(state.reviewed_done_paths)
      ? state.reviewed_done_paths.map((item) => String(item || "")).filter(Boolean)
      : []
  );
  const pending = new Set(
    Array.isArray(state.pending_done_paths)
      ? state.pending_done_paths.map((item) => String(item || "")).filter(Boolean)
      : []
  );

  for (const filePath of walkMarkdownFilesSync(path.join(boardRoot, "tickets", "done"))) {
    const relPath = boardRelPath(boardRoot, filePath);
    if (relPath && !reviewed.has(relPath)) {
      pending.add(relPath);
    }
  }

  return [...pending].sort((left, right) => left.localeCompare(right));
}

export function wikiHasPendingRunnerWorkSync(boardRoot: string): boolean {
  return wikiPendingReviewPathsSync(boardRoot).length > 0;
}

export function ticketClaimedByRunnerIdSync(filePath: string): string {
  try {
    const text = fsSync.readFileSync(filePath, "utf8");
    const match = text.match(/^- Claimed By:\s*(.+)$/m);
    if (!match) return "";
    const raw = match[1].trim();
    const tokenRunner = raw.includes(":") ? raw.split(":")[0] : raw;
    return tokenRunner.trim().toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeTodoIdSync(value: unknown): string {
  const match = String(value || "").match(/(?:TODO[-_])?(\d+)/i);
  if (!match) return "";
  return `TODO-${String(Number.parseInt(match[1], 10)).padStart(3, "0")}`;
}

export function runnerActiveTicketIdSync(boardRoot: string, runnerId: string): string {
  try {
    const raw = fsSync.readFileSync(path.join(boardRoot, "runners", "state", `${runnerId}.state`), "utf8");
    const match = raw.match(/(?:^|\n)active_ticket_id=([^\n]*)/);
    return normalizeTodoIdSync(match ? match[1].trim() : "");
  } catch {
    return "";
  }
}

export function runnerStateFieldSync(boardRoot: string, runnerId: string, field: string): string {
  try {
    const raw = fsSync.readFileSync(path.join(boardRoot, "runners", "state", `${runnerId}.state`), "utf8");
    const match = raw.match(new RegExp(`(?:^|\\n)${String(field).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^\\n]*)`));
    return match ? String(match[1] || "").trim() : "";
  } catch {
    return "";
  }
}

export function blockedActiveTicketFromPathSync(
  boardRoot: string,
  normalizedRunnerId: string,
  ticketPath: string,
  stateStage = ""
): { ticketId: string; path: string; fingerprint: string } | null {
  if (!ticketPath || !fsSync.existsSync(ticketPath)) return null;
  const claimedBy = ticketClaimedByRunnerIdSync(ticketPath);
  if (claimedBy && claimedBy !== normalizedRunnerId) return null;

  const ticketId = normalizeTodoIdSync(path.basename(ticketPath));
  if (!ticketId) return null;
  const ticketStage = markdownScalarInSectionSync(ticketPath, "Ticket", "Stage").toLowerCase();
  const blocked = stateStage === "blocked" || ticketStage === "blocked";
  if (!blocked) return null;

  let mtimeMs = "";
  try {
    mtimeMs = String(fsSync.statSync(ticketPath).mtimeMs || "");
  } catch {}
  const fingerprint = nodeCrypto.createHash("sha256")
    .update([ticketId, stateStage, ticketStage, mtimeMs].join("\0"))
    .digest("hex")
    .slice(0, 12);

  return {
    ticketId,
    path: `tickets/inprogress/${ticketId}.md`,
    fingerprint
  };
}

export function runnerBlockedActiveTicketSync(
  boardRoot: string,
  runnerId: string,
  role = ""
): { ticketId: string; path: string; fingerprint: string } | null {
  if (role && normalizeRunnerRole(role) !== "worker") return null;
  const normalizedRunnerId = String(runnerId || "").trim().toLowerCase();
  if (!normalizedRunnerId) return null;
  const ticketId = runnerActiveTicketIdSync(boardRoot, normalizedRunnerId);
  const stateStage = runnerStateFieldSync(boardRoot, normalizedRunnerId, "active_stage").toLowerCase();
  if (ticketId) {
    const ticketPath = path.join(boardRoot, "tickets", "inprogress", `${ticketId}.md`);
    const blockedActive = blockedActiveTicketFromPathSync(boardRoot, normalizedRunnerId, ticketPath, stateStage);
    if (blockedActive) return blockedActive;
  }

  const claimedInprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", workItemQueueFilePattern, 1000)
    .filter((filePath) => ticketClaimedByRunnerIdSync(filePath) === normalizedRunnerId);
  for (const filePath of claimedInprogress) {
    const blockedActive = blockedActiveTicketFromPathSync(boardRoot, normalizedRunnerId, filePath, stateStage);
    if (blockedActive) return blockedActive;
  }
  return null;
}

export function stripMarkdownTicksSync(value: unknown): string {
  return String(value || "").replace(/^`+|`+$/g, "").trim();
}

export function allowedPathIsConcreteRepoPathSync(raw: unknown): boolean {
  const clean = String(raw || "").replace(/`/g, "").trim();
  if (!clean) return false;
  if (/^(TBD|TODO:?|N\/A|NA|NONE)$/i.test(clean)) return false;
  if (/^TODO:?/i.test(clean)) return false;
  if (clean.startsWith("/")) return false;
  if (clean.startsWith("../") || clean.includes("/../")) return false;
  if (/[*?\[\]]/.test(clean)) return false;
  return true;
}

export function normalizeRelPathSync(raw: unknown): string {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

export function ticketAllowedPathsSync(filePath: string): string[] {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const out: string[] = [];
  let inSection = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(raw)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(raw) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const match = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const value = String(match[1] || "").replace(/`/g, "").trim();
    if (!allowedPathIsConcreteRepoPathSync(value)) continue;
    out.push(normalizeRelPathSync(value));
  }
  return [...new Set(out)].sort();
}

export function workerTodoFileIsClaimableSync(filePath: string): boolean {
  const candidatePaths = ticketAllowedPathsSync(filePath);
  return candidatePaths.length > 0;
}

export function gitBranchExistsSync(projectRoot: string, branch: string): boolean {
  const branchName = stripMarkdownTicksSync(branch);
  if (!projectRoot || !branchName) return false;
  try {
    const result = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function gitTrackedDirtySummarySync(projectRoot: string): string {
  if (!projectRoot) return "";
  try {
    const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return String(result.stdout || "").trim();
  } catch {
    return "";
  }
}

export function gitOutputSync(projectRoot: string, args: string[]): string {
  if (!projectRoot) return "";
  try {
    const result = spawnSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return result.status === 0 ? String(result.stdout || "").trim() : "";
  } catch {
    return "";
  }
}

export function gitStatusOkSync(projectRoot: string, args: string[]): boolean {
  if (!projectRoot) return false;
  try {
    return spawnSync("git", args, { cwd: projectRoot, encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
}

export function queueHasPendingWork(role: string, boardRoot: string, runnerId = ""): boolean {
  try {
    migrateLegacyTicketQueuesSync(boardRoot);
    if (role === "planner") {
      return listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i).some(plannerQueueFileIsActionableSync);
    }
    if (role === "worker") {
      const inprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", workItemQueueFilePattern);
      const verifier = listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern);
      const todo = listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern);
      const normalizedRunnerId = String(runnerId || "").trim().toLowerCase();
      if (normalizedRunnerId) {
        const ownedInProgress = inprogress.filter((file) =>
          ticketClaimedByRunnerIdSync(file) === normalizedRunnerId
        );
        const ownedVerifier = verifier.filter((file) =>
          ticketClaimedByRunnerIdSync(file) === normalizedRunnerId
        );
        if (ownedInProgress.some(workerInprogressFileIsActionableSync)) return true;
        if (ownedVerifier.length > 0) return true;
        if (ownedInProgress.length > 0) return false;
        return todo.some((file) => workerTodoFileIsClaimableSync(file));
      }
      return (
        inprogress.some(workerInprogressFileIsActionableSync) ||
        verifier.length > 0 ||
        todo.some((file) => workerTodoFileIsClaimableSync(file))
      );
    }
    if (role === "verifier") {
      return listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern).length > 0;
    }
    if (role === "wiki-maintainer") {
      return wikiHasPendingRunnerWorkSync(boardRoot);
    }
  } catch {
    return true;
  }
  return false;
}

export function computeQueueFingerprint(role: string, boardRoot: string): string {
  const entries: { dir: string; mode: "mtime" | "names" }[] = [];
  if (role === "planner") {
    migrateLegacyTicketQueuesSync(boardRoot);
    entries.push({ dir: "tickets/prd", mode: "mtime" });
    entries.push({ dir: "tickets/done", mode: "names" });
    entries.push({ dir: "tickets/todo", mode: "names" });
    entries.push({ dir: "tickets/inprogress", mode: "names" });
    entries.push({ dir: "tickets/verifier", mode: "names" });
  } else if (role === "worker") {
    entries.push({ dir: "tickets/inprogress", mode: "mtime" });
    entries.push({ dir: "tickets/verifier", mode: "mtime" });
    entries.push({ dir: "tickets/todo", mode: "mtime" });
  } else if (role === "verifier") {
    entries.push({ dir: "tickets/verifier", mode: "mtime" });
  } else if (role === "wiki-maintainer") {
    return computeWikiSourceHashSync(boardRoot).hash.slice(0, 12);
  }
  const parts: string[] = [];
  for (const { dir, mode } of entries) {
    const full = path.join(boardRoot, dir);
    if (!fsSync.existsSync(full)) continue;
    try {
      for (const f of fsSync.readdirSync(full).sort()) {
        if (mode === "names") {
          parts.push(`${dir}/${f}`);
          continue;
        }
        try {
          const st = fsSync.statSync(path.join(full, f));
          parts.push(`${dir}/${f}:${st.mtimeMs}`);
        } catch {}
      }
    } catch {}
  }
  return nodeCrypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

export function appendRunnerLog(_boardRoot: string, _runnerId: string, _fields: Record<string, unknown>): void {
  // Disabled: Autoflow no longer writes per-runner event logs.
}
