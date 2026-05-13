#!/usr/bin/env npx tsx
/*
 * finish-ticket-owner.ts
 *
 * Cross-platform ticket-owner finalizer. It owns pass/fail routing, mechanical
 * pass sanity checks, verifier handoff, AI-merge pause, done archival, and the
 * local completion commit without delegating to shell scripts.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

type PairMap = Record<string, string>;

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const workerId = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || "worker";
const timestamp = nowIso();

main();

function main(): void {
  const [ticketRef, outcome, message = ""] = process.argv.slice(2);
  if (!ticketRef || !["pass", "fail"].includes(outcome || "")) {
    process.stderr.write("Usage: finish-ticket-owner.ts <ticket-id-or-path> <pass|fail> [summary-or-reject-reason]\n");
    process.exit(1);
  }

  const ticketFile = resolveTicketFile(ticketRef);
  if (!ticketFile) {
    printPairs({
      status: "idle",
      reason: "ticket_owner_finish_ticket_missing",
      ticket_ref: ticketRef,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }

  const ticketId = idFromTicketPath(ticketFile);
  if (outcome === "fail") {
    routeToInboxRetry(ticketFile, ticketId, failureClass(ticketFile) || "rejected", message);
    return;
  }

  if (message) replaceScalar(ticketFile, "Result", "Summary", message);

  const sanity = sanityPreflight(ticketFile);
  if (sanity) {
    appendNote(ticketFile, `TS sanity gate refused pass at ${timestamp}: ${sanity.failure}; ${sanity.detail}`);
    routeToInboxRetry(ticketFile, ticketId, `shell_sanity_gate_${sanity.failure}`, sanity.detail);
    return;
  }

  if (shouldHandoffToVerifier(ticketId)) {
    handoffToVerifier(ticketFile, ticketId);
    return;
  }
  removeVerifierMarker(ticketId);

  const prep = prepareWorktreeForFinalization(ticketFile, ticketId);
  if (prep.status === "needs_ai_merge") {
    markNeedsAiMerge(ticketFile, ticketId, prep.reason);
    printPairs({
      status: "needs_ai_merge",
      outcome: "pass",
      reason: prep.reason,
      ticket: ticketFile,
      ticket_id: ticketId,
      worktree_path: prep.worktreePath,
      worktree_commit: prep.worktreeCommit,
      commit_status: "ai_merge_required",
      next_action: "AI must manually integrate the verified worktree changes into PROJECT_ROOT, resolve conflicts, rerun verification, and rerun finish. Runtime scripts will not perform the merge.",
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  const doneFile = archiveDone(ticketFile, ticketId);
  const commit = commitCompletion(doneFile, ticketId, message || scalar(doneFile, "Result", "Summary") || "complete ticket-owner work");
  cleanupWorktree(doneFile);
  clearActiveState();

  printPairs({
    status: "done",
    outcome: "pass",
    ticket: doneFile,
    ticket_id: ticketId,
    worktree_path: prep.worktreePath,
    worktree_commit: prep.worktreeCommit,
    inline_merge: "done; log written; wiki deferred to Wiki AI",
    "wiki.status": "ai_owned",
    "wiki.next_action": "Wiki AI inspects done/log sources and runs scripts/update-wiki.ts only when material baseline drift exists.",
    commit_status: commit.status === "committed" ? "committed_via_inline_merge" : commit.status,
    commit_hash: commit.hash,
    next_action: "AI merge finalization completed. Impl AI may pick the next todo ticket on the next tick.",
    board_root: boardRoot,
    project_root: projectRoot,
  });
}

function routeToInboxRetry(ticketFile: string, ticketId: string, failure: string, rejectMessage: string): void {
  const prdKey = scalar(ticketFile, "Ticket", "PRD Key");
  const title = scalar(ticketFile, "Ticket", "Title");
  if (rejectMessage) appendRejectReason(ticketFile, rejectMessage);
  const fpInput = `${prdKey}|${title}|${failure}|${rejectMessage}`;
  const fingerprint = crypto.createHash("sha256").update(fpInput).digest("hex").slice(0, 12);
  const inboxDir = path.join(boardRoot, "tickets", "inbox");
  fs.mkdirSync(inboxDir, { recursive: true });
  const prior = fs.readdirSync(inboxDir)
    .filter((name) => /^order_.*_retry_.*\.md$/.test(name))
    .filter((name) => read(path.join(inboxDir, name)).includes(`retry_fingerprint: ${fingerprint}`))
    .length;
  const retryCount = prior + 1;
  const retryMax = positiveInt(process.env.AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT || "", 3);
  const decision = retryCount >= retryMax ? "needs_user" : "retry";
  const compact = timestamp.replace(/[-:]/g, "");
  const retryFile = path.join(inboxDir, `order_${ticketId}_retry_${retryCount}_${compact}.md`);
  const snapshot = read(ticketFile);
  write(retryFile, `# Retry order from failed ticket ${ticketId}

source: retry
retry_count: ${retryCount}
retry_max: ${retryMax}
retry_decision: ${decision}
retry_fingerprint: ${fingerprint}
origin_ticket: ${ticketId}
origin_prd: ${prdKey}
failure_class: ${failure}
failed_at: ${timestamp}

## Original Title
- ${title}

## Reject Reason
\`\`\`
${rejectMessage || "(see ticket reject reason)"}
\`\`\`

## Retry Decision
- ${decision} (retry_count=${retryCount} of retry_max=${retryMax})

## Planner Hint
- Reuse the original PRD if possible. Adjust Allowed Paths or Done When to avoid the failure class above.

## Original Ticket

\`\`\`\`markdown
${snapshot}
\`\`\`\`
`);

  try { fs.unlinkSync(ticketFile); } catch {}
  clearActiveState();
  printPairs({
    status: "failed",
    outcome: "fail",
    failure_class: failure,
    ticket: "(removed; embedded in inbox retry order)",
    ticket_id: ticketId,
    "wiki.status": "ai_owned",
    commit_status: "not_committed_failed_ticket",
    inbox_retry_order: retryFile,
    retry_count: String(retryCount),
    retry_decision: decision,
    retry_fingerprint: fingerprint,
    board_root: boardRoot,
    project_root: projectRoot,
  });
}

function sanityPreflight(ticketFile: string): { failure: string; detail: string } | null {
  const text = read(ticketFile);
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const changeType = normalizedChangeType(ticketFile);
  let minDiffLines = changeType === "infra" ? positiveInt(process.env.AUTOFLOW_INFRA_MIN_DIFF_LINES || "", 10) : 1;
  if (changeType === "docs" || changeType === "cleanup") minDiffLines = 0;

  if (worktreePath && isGitWorktree(worktreePath) && baseCommit && minDiffLines > 0) {
    const lineCount = diffLineCount(worktreePath, baseCommit);
    if (lineCount < minDiffLines) {
      return {
        failure: changeType === "infra" ? "zero_diff_infra" : "zero_diff",
        detail: `${changeType} change requires at least ${minDiffLines} changed line(s); saw ${lineCount}`,
      };
    }
  }

  const checklist = doneWhenItems(text);
  if (checklist.length === 0) return { failure: "done_when_empty", detail: "## Done When section has no checklist items" };
  const unchecked = checklist.filter((line) => /^\s*[-*]\s+\[ \]/.test(line)).length;
  if (unchecked > 0) return { failure: "done_when_unchecked", detail: `${unchecked} of ${checklist.length} Done When item(s) still unchecked` };

  if (!["docs", "cleanup"].includes(changeType) && worktreePath && isGitWorktree(worktreePath) && baseCommit) {
    const names = changedFiles(worktreePath, baseCommit)
      .filter((name) => !name.startsWith(".autoflow/tickets/inprogress/"))
      .filter((name) => !name.startsWith(".autoflow/tickets/done/"));
    const allowed = allowedPaths(ticketFile);
    const matched = names.some((name) => allowed.some((ap) => pathsOverlap(name, ap)));
    if (!matched) {
      return {
        failure: "allowed_paths_no_diff",
        detail: `no changed product file matches an Allowed Path (change_type=${changeType})`,
      };
    }
  }

  return null;
}

function prepareWorktreeForFinalization(ticketFile: string, ticketId: string): { status: "ready" | "needs_ai_merge"; reason: string; worktreePath: string; worktreeCommit: string } {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
  const allowed = allowedPaths(ticketFile);
  if (!worktreePath || !isGitWorktree(worktreePath) || allowed.length === 0) {
    return { status: "ready", reason: "no_worktree_or_allowed_paths", worktreePath, worktreeCommit: scalar(ticketFile, "Worktree", "Worktree Commit") };
  }

  const changed = baseCommit ? changedFiles(worktreePath, baseCommit) : statusPaths(worktreePath);
  const scopedChanged = changed.filter((name) => allowed.some((ap) => pathsOverlap(name, ap)));
  if (scopedChanged.length > 0) {
    git(worktreePath, ["add", "-A", "--", ...allowed]);
    if (git(worktreePath, ["diff", "--cached", "--quiet"]).status !== 0) {
      git(worktreePath, ["commit", "-m", `autoflow ticket ${ticketId} code snapshot`]);
    }
  }

  const head = gitOut(worktreePath, ["rev-parse", "--verify", "HEAD"]);
  if (head) replaceScalar(ticketFile, "Worktree", "Worktree Commit", head);

  const needsMerge = scopedChanged.some((name) => {
    const owner = allowed.find((ap) => pathsOverlap(name, ap)) || name;
    return !projectRootPathMatchesWorktree(worktreePath, owner);
  });
  if (needsMerge) {
    replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
    return { status: "needs_ai_merge", reason: "ai_merge_required", worktreePath, worktreeCommit: head };
  }

  replaceScalar(ticketFile, "Worktree", "Integration Status", "integrated");
  return { status: "ready", reason: "", worktreePath, worktreeCommit: head };
}

function archiveDone(ticketFile: string, ticketId: string): string {
  const projectKey = scalar(ticketFile, "Ticket", "PRD Key") || `ticket_${ticketId}`;
  replaceScalar(ticketFile, "Ticket", "Stage", "done");
  replaceScalar(ticketFile, "Ticket", "Claimed By", "");
  replaceScalar(ticketFile, "Ticket", "Execution AI", "");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  replaceSection(ticketFile, "Verification", `- Result: passed by ${workerId} at ${timestamp}
- Log file: ${writeVerifierLog(ticketFile, ticketId)}`);
  appendNote(ticketFile, `Impl AI ${workerId} finalized ticket at ${timestamp}.`);

  const doneDir = path.join(boardRoot, "tickets", "done", safeSegment(projectKey));
  fs.mkdirSync(doneDir, { recursive: true });
  const doneFile = path.join(doneDir, path.basename(ticketFile));
  if (path.resolve(ticketFile) !== path.resolve(doneFile)) {
    if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
    fs.renameSync(ticketFile, doneFile);
  }
  return doneFile;
}

function commitCompletion(doneFile: string, ticketId: string, summary: string): { status: string; hash: string } {
  if (process.env.AUTOFLOW_OWNER_SKIP_COMMIT === "1") return { status: "skipped_by_env", hash: "" };
  const gitRoot = gitRootPath(projectRoot);
  if (!gitRoot) return { status: "not_git_repo", hash: "" };

  const boardRelPath = path.relative(gitRoot, boardRoot);
  const candidates = [
    path.relative(gitRoot, doneFile),
    path.join(boardRelPath, "tickets", "todo", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "todo", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "inprogress", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `Todo-${ticketId}.md`),
    path.join(boardRelPath, "tickets", "verifier", `tickets_${ticketId}.md`),
    path.join(boardRelPath, "logs"),
    ...allowedPaths(doneFile),
  ].filter((value) => value && !value.startsWith(".."));
  if (candidates.length > 0) git(gitRoot, ["add", "-A", "--", ...unique(candidates)]);

  if (git(gitRoot, ["diff", "--cached", "--quiet"]).status === 0) return { status: "no_changes", hash: "" };
  const prdKey = scalar(doneFile, "Ticket", "PRD Key");
  const prefix = prdKey ? `[${prdKey.toUpperCase()}][ticket_${ticketId}]` : `[ticket_${ticketId}]`;
  git(gitRoot, ["commit", "-m", `${prefix} ${oneLine(summary) || "complete ticket-owner work"}`]);
  return { status: "committed", hash: gitOut(gitRoot, ["rev-parse", "--verify", "HEAD"]) };
}

function handoffToVerifier(ticketFile: string, ticketId: string): void {
  const verifierDir = path.join(boardRoot, "tickets", "verifier");
  fs.mkdirSync(verifierDir, { recursive: true });
  const verifierTicket = path.join(verifierDir, `Todo-${ticketId}.md`);
  fs.copyFileSync(ticketFile, verifierTicket);
  replaceScalar(verifierTicket, "Ticket", "Stage", "verify_pending");
  const stateDir = path.join(boardRoot, "runners", "state");
  fs.mkdirSync(stateDir, { recursive: true });
  write(path.join(stateDir, "verifier.verifier-realtime-wakeup.pending"), `triggered_at=${timestamp}\nticket_id=${ticketId}\n`);
  printPairs({
    status: "verify_pending",
    ticket: ticketFile,
    ticket_id: ticketId,
    verifier_ticket: verifierTicket,
    next_action: `Verifier AI will inspect tickets/verifier/Todo-${ticketId}.md and either call finish-ticket-owner.ts pass (AUTOFLOW_SKIP_VERIFIER=1) or fail with verifier_semantic_mismatch.`,
  });
}

function shouldHandoffToVerifier(ticketId: string): boolean {
  if ((process.env.AUTOFLOW_VERIFIER_ENABLED || "1") === "0") return false;
  if ((process.env.AUTOFLOW_SKIP_VERIFIER || "0") === "1") return false;
  return !fs.existsSync(verifierMarker(ticketId));
}

function removeVerifierMarker(ticketId: string): void {
  try { fs.unlinkSync(verifierMarker(ticketId)); } catch {}
}

function verifierMarker(ticketId: string): string {
  return path.join(boardRoot, "runners", "state", `verifier-ok-${ticketId}.marker`);
}

function markNeedsAiMerge(ticketFile: string, ticketId: string, reason: string): void {
  replaceScalar(ticketFile, "Ticket", "Stage", "merging");
  replaceScalar(ticketFile, "Ticket", "Last Updated", timestamp);
  replaceScalar(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
  replaceSection(ticketFile, "Next Action", `- Next: continue AI-led merge for this ticket. Manually integrate verified worktree changes into PROJECT_ROOT/main inside Allowed Paths, resolve conflicts if needed, rerun required verification from PROJECT_ROOT, then rerun \`scripts/finish-ticket-owner.ts ${ticketId} pass "<summary>"\`. Do not claim another ticket or call merge-ready-ticket directly.`);
  appendNote(ticketFile, `Finish paused at ${timestamp}: ${reason}. AI must integrate worktree changes into PROJECT_ROOT before finalization.`);
}

function writeVerifierLog(ticketFile: string, ticketId: string): string {
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

function cleanupWorktree(ticketFile: string): void {
  const worktreePath = scalar(ticketFile, "Worktree", "Path");
  if (!worktreePath || !fs.existsSync(worktreePath)) return;
  if (!path.resolve(worktreePath).includes(`${path.sep}.autoflow${path.sep}worktrees${path.sep}`)) return;
  git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
}

function clearActiveState(): void {
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

function resolveTicketFile(ref: string): string {
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

function doneWhenItems(text: string): string[] {
  const items: string[] = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^## Done When\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (inSection && /^\s*[-*]\s+\[[ xX]\]/.test(line)) items.push(line);
  }
  return items;
}

function allowedPaths(ticketFile: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of read(ticketFile).split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const value = stripTicks(match[1]).replace(/^[.][/]/, "").replace(/\/+$/, "");
    if (value && !value.startsWith("/") && !value.startsWith("../") && !/[*?\[\]]/.test(value)) out.push(value);
  }
  return unique(out);
}

function changedFiles(cwd: string, baseCommit: string): string[] {
  return unique([
    ...gitLines(cwd, ["diff", "--name-only", `${baseCommit}..HEAD`]),
    ...gitLines(cwd, ["diff", "--name-only"]),
    ...gitLines(cwd, ["diff", "--cached", "--name-only"]),
    ...statusPaths(cwd),
  ]);
}

function statusPaths(cwd: string): string[] {
  return gitOut(cwd, ["status", "--porcelain", "--untracked-files=all"])
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3))
    .map((name) => name.includes(" -> ") ? name.split(" -> ").pop() || "" : name)
    .filter(Boolean);
}

function diffLineCount(cwd: string, baseCommit: string): number {
  const raw = [
    gitOut(cwd, ["diff", "--numstat", `${baseCommit}..HEAD`]),
    gitOut(cwd, ["diff", "--numstat"]),
    gitOut(cwd, ["diff", "--cached", "--numstat"]),
  ].join("\n");
  let total = 0;
  for (const line of raw.split(/\r?\n/)) {
    const [addRaw, delRaw] = line.trim().split(/\s+/);
    for (const value of [addRaw, delRaw]) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) total += parsed;
    }
  }
  return total;
}

function projectRootPathMatchesWorktree(worktreePath: string, relPath: string): boolean {
  const rootPath = path.join(projectRoot, relPath);
  const workPath = path.join(worktreePath, relPath);
  const rootExists = fs.existsSync(rootPath);
  const workExists = fs.existsSync(workPath);
  if (!rootExists && !workExists) return true;
  if (rootExists !== workExists) return false;
  if (fs.statSync(rootPath).isDirectory() && fs.statSync(workPath).isDirectory()) {
    const result = spawnSync("diff", ["-qr", rootPath, workPath], { encoding: "utf8" });
    return result.status === 0;
  }
  try {
    return fs.readFileSync(rootPath).equals(fs.readFileSync(workPath));
  } catch {
    return false;
  }
}

function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  let inSection = false;
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return stripTicks(match[1].trim());
  }
  return "";
}

function replaceScalar(file: string, section: string, field: string, value: string): void {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^(- ${escapeRe(field)}\\s*:).*?$`);
  let inSection = false;
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      lines.splice(i, 0, `- ${field}: ${value}`);
      write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
      return;
    }
    if (inSection && fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1 ${value}`);
      write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
      return;
    }
  }
  if (sectionStart >= 0) {
    lines.push(`- ${field}: ${value}`);
  } else {
    lines.push("", `## ${section}`, "", `- ${field}: ${value}`);
  }
  write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
}

function replaceSection(file: string, section: string, body: string): void {
  const content = read(file);
  const re = new RegExp(`(^## ${escapeRe(section)}\\b[^\\n]*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string) => `${heading}\n${body.trim()}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## ${section}\n\n${body.trim()}\n`;
  write(file, next);
}

function appendNote(file: string, note: string): void {
  const content = read(file);
  const bullet = `- ${note}`;
  const re = /(^## Notes\b[^\n]*\n)([\s\S]*?)(?=^## |\Z)/m;
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string, body: string) => `${heading}${body}${body.endsWith("\n") ? "" : "\n"}${bullet}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## Notes\n\n${bullet}\n`;
  write(file, next);
}

function appendRejectReason(file: string, reason: string): void {
  if (read(file).includes("## Reject Reason")) return;
  write(file, `${read(file).replace(/\n*$/, "\n")}\n## Reject Reason\n\n- ${reason}\n`);
}

function normalizedChangeType(ticketFile: string): string {
  const value = scalar(ticketFile, "Ticket", "Change Type").toLowerCase();
  return ["docs", "cleanup", "infra"].includes(value) ? value : "code";
}

function failureClass(ticketFile: string): string {
  return scalar(ticketFile, "Recovery State", "Failure Class");
}

function isGitWorktree(cwd: string): boolean {
  return git(cwd, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

function gitRootPath(cwd: string): string {
  return gitOut(cwd, ["rev-parse", "--show-toplevel"]);
}

function gitLines(cwd: string, args: string[]): string[] {
  return gitOut(cwd, args).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function gitOut(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function git(cwd: string, args: string[]): { status: number } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: typeof result.status === "number" ? result.status : 1 };
}

function pathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = aRaw.replace(/\/+$/, "");
  const b = bRaw.replace(/\/+$/, "");
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function idFromTicketPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function normalizeId(value: string): string {
  const match = value.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function boardRel(file: string): string {
  const rel = path.relative(boardRoot, file);
  return rel.startsWith("..") ? file : rel;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_") || "unknown";
}

function stripTicks(value: string): string {
  return value.replace(/^`+|`+$/g, "").trim();
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function printPairs(fields: PairMap): void {
  for (const [key, value] of Object.entries(fields)) {
    process.stdout.write(`${key}=${value ?? ""}\n`);
  }
}
