#!/usr/bin/env npx tsx
/*
 * draft-pr.ts — Compose a PR body from a passed Autoflow ticket.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const [ticketFile = "", commitHash = ""] = process.argv.slice(2);

if (!ticketFile || !fs.existsSync(ticketFile)) {
  process.stderr.write("Usage: draft-pr.ts <ticket-file> [completion-commit-hash]\n");
  process.exit(2);
}

const ticketId = idFromPath(ticketFile);
const prdKey = ticketPrdKey(ticketFile);
const title = scalar(ticketFile, "Ticket", "Title");
const summary = scalar(ticketFile, "Result", "Summary") || "(see ticket)";
const verifyCmd = scalar(ticketFile, "Verification", "Command") || "(none)";
const baseCommit = scalar(ticketFile, "Worktree", "Base Commit");
const changeType = scalar(ticketFile, "Ticket", "Change Type") || "code";
const diffStat = baseCommit ? gitOut(projectRoot, ["diff", "--stat", `${baseCommit}..HEAD`]) : "";
const doneWhen = sectionChecklist(ticketFile, "Done When") || "(no Done When checklist recorded)";
const ticketRel = path.relative(boardRoot, ticketFile).startsWith("..") ? path.basename(ticketFile) : path.relative(boardRoot, ticketFile);
const prdDisplay = prdKey ? normalizePrdKey(prdKey) : "UNKNOWN-PRD";

process.stdout.write(`# [${prdDisplay}][TODO-${ticketId}] ${title}

## Summary

- ${summary}

## Done When

${doneWhen}

## Diff Stat

\`\`\`
${diffStat || "(diff stat 없음 - base_commit이 없을 수 있음)"}
\`\`\`

## Metadata

- Source ticket: \`${ticketRel}\`
- Change Type: \`${changeType}\`
- Verification command: \`${verifyCmd}\`
- Base commit: \`${baseCommit || "unknown"}\`
${commitHash ? `- Completion commit: \`${commitHash}\`\n` : ""}
Autoflow PR draft autogen이 생성했다.
`);

function normalizePrdKey(value: string): string {
  const trimmed = value.trim();
  const numeric = trimmed.match(/(?:PRD[-_]|prd_|project_)(\d+)/i);
  if (numeric) return `PRD-${numeric[1].padStart(3, "0")}`;
  return trimmed.toUpperCase().replace(/_/g, "-");
}

function ticketPrdKey(file: string): string {
  return normalizePrdKey(
    scalar(file, "Ticket", "PRD Key") ||
    scalar(file, "Ticket", "PRD") ||
    scalar(file, "References", "PRD") ||
    scalar(file, "Source", "PRD")
  );
}

function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return match[1].replace(/^`+|`+$/g, "").trim();
  }
  return "";
}

function sectionChecklist(file: string, section: string): string {
  const out: string[] = [];
  let inSection = false;
  for (const line of read(file).split(/\r?\n/)) {
    if (new RegExp(`^## ${escapeRe(section)}\\b`).test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (inSection && /^\s*[-*]\s+\[[ xX]\]/.test(line)) out.push(line);
  }
  return out.join("\n");
}

function gitOut(cwd: string, args: string[]): string {
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
}

function idFromPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
