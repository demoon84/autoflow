#!/usr/bin/env tsx
/*
 * integrate-worktree.ts — stage + commit ticket worktree changes for
 * AI-led merge into PROJECT_ROOT.
 * See integrate-worktree.sh / .js for full doc; CLI/output unchanged.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as utils from "./board-utils";

const ticketArg = process.argv[2];
if (!ticketArg) {
  process.stderr.write(`Usage: integrate-worktree.ts <ticket-file>\n`);
  process.exit(1);
}

const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();

let ticketFile = utils.normalizeRuntimePath(ticketArg);
if (!path.isAbsolute(ticketFile)) ticketFile = path.join(BOARD_ROOT, ticketFile);

if (!fs.existsSync(ticketFile)) {
  process.stderr.write(`Ticket file not found: ${ticketFile}\n`);
  process.exit(1);
}

const timestamp = utils.nowIso();
const ticketId = utils.extractNumericId(ticketFile);
const worktreePath = utils.ticketWorktreePathFromFile(ticketFile);
const worktreeCommitField = utils.stripMarkdownCodeTicks(
  utils.ticketWorktreeField(ticketFile, "Worktree Commit")
);
const integrationStatus = utils.trimSpaces(
  utils.ticketWorktreeField(ticketFile, "Integration Status")
);

if (integrationStatus === "integrated" && worktreeCommitField) {
  process.stdout.write(`status=already_integrated\n`);
  process.stdout.write(`ticket_id=${ticketId}\n`);
  process.stdout.write(`worktree_commit=${worktreeCommitField}\n`);
  process.exit(0);
}

if (!worktreePath) {
  utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "no_worktree");
  utils.appendNote(ticketFile, `No worktree path recorded at ${timestamp}; verifier will commit board-only changes from PROJECT_ROOT.`);
  process.stdout.write(`status=no_worktree\n`);
  process.stdout.write(`ticket_id=${ticketId}\n`);
  process.exit(0);
}

const isGitWt = utils.gitOutput(["rev-parse", "--is-inside-work-tree"], worktreePath).trim();
if (isGitWt !== "true") {
  utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "worktree_missing");
  utils.appendNote(ticketFile, `Worktree path was missing during integration at ${timestamp}: ${worktreePath}`);
  process.stderr.write(`Worktree is not a git worktree: ${worktreePath}\n`);
  process.exit(1);
}

const gitRoot = utils.gitRootPath();
if (!gitRoot) {
  process.stderr.write(`PROJECT_ROOT is not inside a git repository: ${PROJECT_ROOT}\n`);
  process.exit(1);
}

const allowedPaths = utils.extractTicketAllowedPaths(ticketFile);
if (allowedPaths.length === 0) {
  utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "blocked_missing_allowed_paths");
  utils.appendNote(ticketFile, `Worktree integration blocked at ${timestamp}: Allowed Paths was empty.`);
  process.stderr.write(`Allowed Paths is empty; refusing to stage the whole worktree implicitly.\n`);
  process.exit(1);
}

const addPaths: string[] = [];
for (const p of allowedPaths) {
  const abs = path.join(worktreePath, p);
  let exists = fs.existsSync(abs);
  if (!exists) {
    const lsOut = utils.gitOutput(["ls-files", "--error-unmatch", "--", p], worktreePath);
    if (lsOut !== "") exists = true;
  }
  if (exists) addPaths.push(p);
  else utils.appendNote(ticketFile, `Allowed path was not present in worktree during integration at ${timestamp}, so it was skipped: ${p}`);
}

if (addPaths.length > 0) {
  utils.gitOutput(["add", "-A", "--", ...addPaths], worktreePath);
}

let staged = false;
try {
  execFileSync("git", ["diff", "--cached", "--quiet"], {
    cwd: worktreePath,
    stdio: ["ignore", "ignore", "ignore"]
  });
  staged = false;
} catch {
  staged = true;
}

if (!staged) {
  utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "no_code_changes");
  utils.appendNote(ticketFile, `No staged code changes found in worktree during integration at ${timestamp}.`);
  process.stdout.write(`status=no_code_changes\n`);
  process.stdout.write(`ticket_id=${ticketId}\n`);
  process.stdout.write(`worktree_path=${worktreePath}\n`);
  process.exit(0);
}

utils.gitOutput(["commit", "-m", `autoflow ticket ${ticketId} code snapshot`], worktreePath);
const wtCommit = utils.gitOutput(["rev-parse", "--verify", "HEAD"], worktreePath).trim();

utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Worktree Commit", wtCommit);
utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "needs_ai_merge");
utils.appendNote(ticketFile, `Worktree snapshot ${wtCommit} prepared at ${timestamp}; AI must manually merge it into PROJECT_ROOT. integrate-worktree did not run rebase, cherry-pick, conflict resolution, or product-code merge because scripts are tools, not merge actors.`);

process.stdout.write(`status=needs_ai_merge\n`);
process.stdout.write(`reason=ai_merge_required\n`);
process.stdout.write(`ticket_id=${ticketId}\n`);
process.stdout.write(`worktree_path=${worktreePath}\n`);
process.stdout.write(`worktree_commit=${wtCommit}\n`);
process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
process.exit(0);
