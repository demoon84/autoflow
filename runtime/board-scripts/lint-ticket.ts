#!/usr/bin/env tsx
/*
 * lint-ticket.ts — Done When / Global Acceptance Criteria vagueness linter.
 * See lint-ticket.sh for CLI/output contract.
 */

import * as fs from "node:fs";

const ticketPath = process.argv[2];
if (!ticketPath) {
  process.stderr.write("lint_status=block\n");
  process.stderr.write("reason=missing_argument\n");
  process.stderr.write("usage=lint-ticket.ts <ticket-or-prd-markdown-path>\n");
  process.exit(1);
}
if (!fs.existsSync(ticketPath)) {
  process.stdout.write("lint_status=block\n");
  process.stdout.write("reason=file_not_found\n");
  process.stdout.write(`lint_path=${ticketPath}\n`);
  process.exit(1);
}

const text = fs.readFileSync(ticketPath, "utf8");
const lintTarget: "ticket" | "prd" = /^# (Project )?PRD/m.test(text) ? "prd" : "ticket";

function extractChecklist(heading: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  const enterRe = new RegExp(`^#{2,}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  for (const line of lines) {
    if (enterRe.test(line)) { inSection = true; continue; }
    if (/^#{1,6}\s+/.test(line) && inSection) { inSection = false; continue; }
    if (!inSection) continue;
    if (/^\s*-\s*\[[ xX]\]\s*\S/.test(line)) { out.push(line); continue; }
    const bulletMatch = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!bulletMatch) continue;
    const body = bulletMatch[1].trim();
    if (!body || body === "..." || /^TBD\b/i.test(body)) continue;
    out.push(line);
  }
  return out;
}

const doneWhenItems = extractChecklist("Done When");
const gacItems = extractChecklist("Global Acceptance Criteria");

let checklistBody: string[];
let criteriaCount: number;
let selectedSection: string;
if (gacItems.length > doneWhenItems.length) {
  checklistBody = gacItems;
  criteriaCount = gacItems.length;
  selectedSection = "Global Acceptance Criteria";
} else {
  checklistBody = doneWhenItems;
  criteriaCount = doneWhenItems.length;
  selectedSection = "Done When";
}

let score = 0;
if (criteriaCount < 3) score += 2;

const vaguePattern = /잘 동작|정상 작동|정상 동작|올바르게|제대로|works correctly|works properly|as expected\b/g;
const negationPattern = /않|못|없|\bnot\b|n't|\bnever\b|\bno\b/;
const vagueMatches: string[] = [];
for (const line of checklistBody) {
  if (negationPattern.test(line)) continue;
  let m: RegExpExecArray | null;
  while ((m = vaguePattern.exec(line)) !== null) vagueMatches.push(m[0]);
}
const vagueMatchCount = vagueMatches.length;
const vagueTermsCsv = vagueMatchCount === 0 ? "" : [...new Set(vagueMatches)].sort().join(",");
score += Math.min(vagueMatchCount, 5);

const concretePattern = /`[^`]+`|exit [0-9]+|\.(md|sh|ts|tsx|js|jsx|py|json|toml|yaml|yml)\b|(>=|<=|==|!=) ?[0-9]+|[0-9]+(개|회|건|ms|s|%)/g;
let concreteSignalCount = 0;
for (const line of checklistBody) {
  const matches = line.match(concretePattern);
  if (matches) concreteSignalCount += matches.length;
}
if (concreteSignalCount === 0) score += 2;

let blockThreshold = parseInt(process.env.AUTOFLOW_LINT_BLOCK_THRESHOLD || "3", 10);
if (!Number.isFinite(blockThreshold) || blockThreshold <= 0) blockThreshold = 3;

let lintStatus: string;
let exitCode: number;
if (score === 0) { lintStatus = "ok"; exitCode = 0; }
else if (score < blockThreshold) { lintStatus = "warn"; exitCode = 0; }
else { lintStatus = "block"; exitCode = 1; }

process.stdout.write(`lint_status=${lintStatus}\n`);
process.stdout.write(`vagueness_score=${score}\n`);
process.stdout.write(`criteria_count=${criteriaCount}\n`);
process.stdout.write(`concrete_signal_count=${concreteSignalCount}\n`);
process.stdout.write(`vague_terms=${vagueTermsCsv}\n`);
process.stdout.write(`lint_target=${lintTarget}\n`);
process.stdout.write(`lint_path=${ticketPath}\n`);
process.stdout.write(`lint_section=${selectedSection}\n`);
process.stdout.write(`lint_block_threshold=${blockThreshold}\n`);
process.exit(exitCode);
