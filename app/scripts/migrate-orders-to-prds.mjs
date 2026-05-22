#!/usr/bin/env node
// One-off migration: convert every tickets/order/order_*.md into an
// equivalent tickets/prd/PRD-*.md, preserving the original content under
// `## Original Order`. Backup all order files into
// tickets/done/.legacy-orders/.
//
// Usage:
//   node app/scripts/migrate-orders-to-prds.mjs <board-root>
//
// Default board-root: ./.autoflow under cwd.

import fs from "node:fs";
import path from "node:path";

const boardRoot = path.resolve(process.argv[2] || path.join(process.cwd(), ".autoflow"));
const orderDir = path.join(boardRoot, "tickets", "order");
const prdDir = path.join(boardRoot, "tickets", "prd");
const backupDir = path.join(boardRoot, "tickets", "done", ".legacy-orders");
const doneRoot = path.join(boardRoot, "tickets", "done");

if (!fs.existsSync(boardRoot)) {
  process.exit(1);
}
if (!fs.existsSync(orderDir)) {
  process.exit(0);
}

fs.mkdirSync(prdDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function extractHeading(text) {
  return (text.match(/^#\s+(.+)$/m)?.[1] || "").trim();
}

function extractOrderTitle(text) {
  const heading = extractHeading(text);
  const m = heading.match(/^Order\s+\d+:\s*(.+)$/i);
  return (m?.[1] || heading || "Migrated order").trim();
}

function extractSection(text, heading) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (line === `## ${heading}`) { inSection = true; continue; }
    if (inSection && /^## /.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join("\n").trimEnd();
}

function extractScalar(text, section, field) {
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const fieldRe = new RegExp(`^- ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (line === `## ${section}`) { inSection = true; continue; }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const m = line.match(fieldRe);
    if (m) return m[1].replace(/^`+|`+$/g, "").trim();
  }
  return "";
}

function bulletItems(text, heading) {
  return extractSection(text, heading)
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1] || "")
    .map((value) => value.replace(/^`+|`+$/g, "").trim())
    .filter((value) => value && value !== "TBD" && !/^TODO\b/i.test(value));
}

function firstBulletAcross(text, headings) {
  for (const heading of headings) {
    const items = bulletItems(text, heading);
    if (items.length > 0) return items[0];
  }
  return "";
}

function normalizePriority(value) {
  const clean = String(value || "normal").toLowerCase();
  return ["critical", "high", "normal", "low"].includes(clean) ? clean : "normal";
}

function normalizeChangeType(value) {
  const clean = String(value || "code").toLowerCase();
  return ["code", "docs", "cleanup", "infra"].includes(clean) ? clean : "code";
}

function nextPrdId(used) {
  let n = 1;
  while (used.has(String(n).padStart(3, "0"))) n += 1;
  return String(n).padStart(3, "0");
}

function collectExistingPrdIds() {
  const ids = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const m = entry.name.match(/^PRD-(\d+)\.md$/);
      if (m) ids.add(m[1].padStart(3, "0"));
    }
  };
  walk(prdDir);
  walk(doneRoot);
  return ids;
}

function oneLine(value, max = 240) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function buildPrd(orderFile, prdId, sourceOrderRef) {
  const text = readFile(orderFile);
  const title = extractOrderTitle(text);
  const request = extractSection(text, "Request").trim() || title;
  const priority = normalizePriority(extractScalar(text, "Order", "Priority"));
  const changeType = normalizeChangeType(extractScalar(text, "Order", "Change Type"));
  const allowedPaths = bulletItems(text, "Allowed Paths Hints");
  const allowedPathsFallback = bulletItems(text, "Allowed Paths");
  const finalAllowedPaths = (allowedPaths.length > 0 ? allowedPaths : allowedPathsFallback);
  const scopeHints = bulletItems(text, "Scope Hints");
  const verificationCommand = firstBulletAcross(text, ["Verification Hints", "Verification"]) || "none-shell";
  const plannerHints = bulletItems(text, "Planner Hints");
  const splitMap = extractSection(text, "PRD Split Map").trim();
  const todoSplitMap = splitMap.replace(/PRD Split Map/gi, "Todo Split Map");
  const inScopeText = scopeHints.length > 0 ? scopeHints.join("; ") : oneLine(request);
  const allowedPathsBlock = (finalAllowedPaths.length > 0 ? finalAllowedPaths : ["TBD"])
    .map((p) => `- ${p}`).join("\n");
  const modulesBlock = (finalAllowedPaths.length > 0 ? finalAllowedPaths : ["TBD"])
    .map((p) => `- Module: \`${p}\`\n- Path: \`${p}\``).join("\n");
  const plannerHintsBlock = plannerHints.length > 0
    ? plannerHints.map((item) => `- order 플래너 힌트: ${item}`).join("\n") + "\n"
    : "";

  return `# PRD PRD-${prdId}: ${title}

## Project

- ID: PRD-${prdId}
- Title: ${title}
- AI: order-migration
- Status: draft
- Priority: ${priority}
- Change Type: ${changeType}
- Requires Secrets: []

## Source

- Origin: migrated-from-order
- User Request: "${oneLine(request)}"
- Related Work: ${sourceOrderRef}

## Problem

${oneLine(request, 600) || "see Original Order"}

## Goal

${title}

## Scope

- In Scope: ${inScopeText}
- Out of Scope: 원 order 에 명시되지 않은 독립 기능, 광범위한 리팩터링, 외부 릴리스 작업.
- Assumptions: order 본문 의도를 유지하고 안전한 최소 구현 범위로 좁힌다.
- Remaining Unknowns: order 가 비워둔 상세는 planner 가 todo 단계에서 구체화한다.

## Main Screens / Modules

${modulesBlock}

## Allowed Paths

${allowedPathsBlock}

## Global Acceptance Criteria

- [ ] Allowed Paths 안의 변경이 Goal 결과를 반영한다.
- [ ] 검증 명령 \`${verificationCommand}\` 가 exit 0 으로 끝나거나, 명령이 \`none-shell\` 이면 파일 검토 근거가 기록된다.
- [ ] 최종 diff 가 Allowed Paths 밖의 파일을 포함하지 않는다.

## Verification

- Command: ${verificationCommand}
- Notes: order 가 제공한 검증 힌트를 우선한다. 명령이 \`none-shell\` 이면 todo 에서 파일 검토 근거와 Done When 상태를 기록한다.

${todoSplitMap ? `## Todo Split Map\n\n${todoSplitMap}\n\n` : ""}## Conversation Handoff

- Source: ${sourceOrderRef}
- Summary: ${oneLine(request, 200)}

## Notes

- order-migration: ${nowIso()} 에 ${path.basename(orderFile)} 에서 생성했다.
${plannerHintsBlock}- 원본 order 전문은 \`## Original Order\` 에 보존한다.

## Original Order

\`\`\`\`markdown
${text.trimEnd()}
\`\`\`\`
`;
}

function main() {
  const orderFiles = fs.readdirSync(orderDir)
    .filter((name) => /^order_.*\.md$/.test(name))
    .sort();
  if (orderFiles.length === 0) {
    return;
  }

  const usedPrdIds = collectExistingPrdIds();
  const created = [];
  const conflicted = [];
  const archived = [];

  for (const name of orderFiles) {
    const orderFile = path.join(orderDir, name);
    const sourceOrderRef = `tickets/done/.legacy-orders/${name}`;
    const idMatch = name.match(/^order_(\d+)/);
    let prdId = idMatch ? idMatch[1].padStart(3, "0") : "";
    if (!prdId || usedPrdIds.has(prdId)) {
      const original = prdId;
      prdId = nextPrdId(usedPrdIds);
      if (original) conflicted.push(`${name}->PRD-${prdId}.md (original PRD-${original} already exists)`);
    }
    usedPrdIds.add(prdId);
    const prdContent = buildPrd(orderFile, prdId, sourceOrderRef);
    const prdFile = path.join(prdDir, `PRD-${prdId}.md`);
    fs.writeFileSync(prdFile, prdContent, "utf8");
    created.push(`PRD-${prdId}.md (from ${name})`);

    const backupTarget = path.join(backupDir, name);
    if (fs.existsSync(backupTarget)) fs.rmSync(backupTarget, { force: true });
    fs.renameSync(orderFile, backupTarget);
    archived.push(`${name}->tickets/done/.legacy-orders/${name}`);
  }

  try { fs.rmdirSync(orderDir); } catch {}

  void conflicted;
}

main();
