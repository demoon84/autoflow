#!/usr/bin/env node
// promote-order-to-ticket.ts — Allowed Paths 자동 추론 + Express 자동 승격.
//
// Usage:
//   node promote-order-to-ticket.ts <order-file> [--board-root <path>] [--project-root <path>]
//
// Workflow:
//   1. Extract keyword candidates from the order body (filenames, module names, function-ish tokens).
//   2. Query `autoflow wiki query --rag <keywords>` to collect related file paths from wiki.
//   3. Confirm existence via `git grep -l <keyword>` in the project root.
//   4. If candidates ≤ 3 with sufficient specificity → Express auto-promote:
//        - Write Express: true + inferred Allowed Paths + Done When checklist into the order file.
//        - Append confidence marker to ## Notes.
//   5. If candidates > 3 or too broad → exit 2 (planner falls back to PRD flow).
//
// Exit codes:
//   0  — Express-promoted (order file updated)
//   1  — Error (file not found, etc.)
//   2  — Fallback to PRD flow (ambiguous / too many candidates)
//
// 1원칙: any query failure falls back to exit 2 (never blocks the planner).

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const BOARD_ROOT = process.env.BOARD_ROOT || path.join(process.cwd(), ".autoflow");
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const MAX_CANDIDATES = 3;
const CONFIDENCE_THRESHOLD = 2; // minimum keyword hits to count as confident

function parseArgs(): { orderFile: string; boardRoot: string; projectRoot: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] ?? "" : "";
  };
  const orderFile = args.find((a) => !a.startsWith("-")) ?? "";
  return {
    orderFile,
    boardRoot: get("--board-root") || BOARD_ROOT,
    projectRoot: get("--project-root") || PROJECT_ROOT,
  };
}

function extractKeywords(text: string): string[] {
  const candidates = new Set<string>();
  // Filenames with extension
  for (const m of text.matchAll(/[\w\-./]+\.(ts|js|tsx|jsx|sh|md|json|toml|py)\b/g)) {
    const base = path.basename(m[0]);
    if (base.length > 3) candidates.add(base);
  }
  // PascalCase identifiers (component/class names)
  for (const m of text.matchAll(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g)) {
    if (m[0].length > 4) candidates.add(m[0]);
  }
  // camelCase or snake_case function-ish tokens
  for (const m of text.matchAll(/\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+\b/g)) {
    if (m[0].length > 6) candidates.add(m[0]);
  }
  // Quoted strings that look like paths
  for (const m of text.matchAll(/['"`]([\w\-./]+)['"`]/g)) {
    if (m[1].includes("/") || m[1].includes(".")) candidates.add(path.basename(m[1]));
  }
  return [...candidates].slice(0, 10);
}

function queryWikiRag(boardRoot: string, keywords: string[]): string[] {
  const paths: string[] = [];
  if (!keywords.length) return paths;
  try {
    const result = spawnSync(
      "npx",
      ["tsx", path.join(__dirname, "..", "..", "system", "runner-wake.ts"), "wiki-rag", ...keywords],
      { cwd: PROJECT_ROOT, timeout: 10000, encoding: "utf8" }
    );
    // Parse lines that look like file paths from stdout
    for (const line of (result.stdout || "").split("\n")) {
      const m = line.match(/([\w\-./]+\.(ts|js|tsx|jsx|sh|md|json|toml|py))/);
      if (m) paths.push(m[1]);
    }
  } catch {}
  return [...new Set(paths)];
}

function gitGrepCandidates(projectRoot: string, keywords: string[]): string[] {
  const found = new Set<string>();
  for (const kw of keywords.slice(0, 5)) {
    try {
      const result = spawnSync(
        "git",
        ["grep", "-rl", "--", kw],
        { cwd: projectRoot, timeout: 8000, encoding: "utf8" }
      );
      for (const line of (result.stdout || "").split("\n")) {
        const f = line.trim();
        if (f && !f.startsWith(".autoflow/") && f.match(/\.(ts|js|tsx|jsx|sh|md|py)$/)) {
          found.add(f);
        }
      }
    } catch {}
  }
  return [...found];
}

function buildDoneWhen(text: string): string[] {
  const items: string[] = [];
  // Extract observable verbs with their objects
  const verbPatterns = [
    /(?:add|create|generate|write|implement|update|fix|remove|delete|rename|move|configure)\s+[^\n.,;]{5,60}/gi,
    /[^\n.]{0,20}(?:작동|생성|추가|수정|삭제|적용|확인|테스트)[^\n.]{0,40}/g,
  ];
  for (const pat of verbPatterns) {
    for (const m of text.matchAll(pat)) {
      const item = m[0].trim().replace(/^[-•*]\s*/, "").slice(0, 80);
      if (item.length > 10) items.push(item);
      if (items.length >= 3) break;
    }
    if (items.length >= 3) break;
  }
  if (!items.length) items.push("변경 사항이 의도한 대로 동작함");
  return items.slice(0, 3);
}

function readOrderSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const headerRe = /^## (.+)$/gm;
  let m;
  const positions: Array<{ name: string; start: number }> = [];
  while ((m = headerRe.exec(content)) !== null) {
    positions.push({ name: m[1].trim(), start: m.index + m[0].length });
  }
  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length
      ? positions[i + 1].start - positions[i + 1].name.length - 4
      : content.length;
    sections[positions[i].name] = content.slice(positions[i].start, end).trim();
  }
  return sections;
}

function injectIntoOrder(filePath: string, allowedPaths: string[], doneWhen: string[]): void {
  let content = fs.readFileSync(filePath, "utf8");

  // Inject Express: true after "## Order" header if present, else after first header
  if (!content.includes("Express: true")) {
    content = content.replace(/(^## Order\b.*$)/m, "$1\n- Express: true");
  }

  // Replace or append Allowed Paths section
  const apSection = `## Allowed Paths\n\n${allowedPaths.map((p) => `- \`${p}\``).join("\n")}`;
  if (/^## Allowed Paths$/m.test(content)) {
    content = content.replace(/^## Allowed Paths\n[\s\S]*?(?=\n## |\s*$)/m, `${apSection}\n\n`);
  } else {
    content += `\n\n${apSection}`;
  }

  // Replace or append Done When section
  const dwSection = `## Done When\n\n${doneWhen.map((d) => `- [ ] ${d}`).join("\n")}`;
  if (/^## Done When$/m.test(content)) {
    content = content.replace(/^## Done When\n[\s\S]*?(?=\n## |\s*$)/m, `${dwSection}\n\n`);
  } else {
    content += `\n\n${dwSection}`;
  }

  // Append Notes confidence marker
  const marker = "Express auto-promoted (confidence: high)";
  if (!content.includes(marker)) {
    if (/^## Notes$/m.test(content)) {
      content = content.replace(/^## Notes$/m, `## Notes\n\n- ${marker}`);
    } else {
      content += `\n\n## Notes\n\n- ${marker}`;
    }
  }

  fs.writeFileSync(filePath, content, "utf8");
}

async function main(): Promise<void> {
  const { orderFile, boardRoot, projectRoot } = parseArgs();

  if (!orderFile || !fs.existsSync(orderFile)) {
    process.stderr.write(`promote-order-to-ticket: order file not found: ${orderFile}\n`);
    process.exit(1);
  }

  const raw = fs.readFileSync(orderFile, "utf8");
  const sections = readOrderSections(raw);

  // If order already has Allowed Paths, skip inference
  const existing = sections["Allowed Paths"] || "";
  if (existing.trim().length > 10) {
    process.stdout.write(`promote_status=skip reason=already_has_allowed_paths\n`);
    process.exit(2);
  }

  const requestText = sections["Request"] || sections["Goal"] || raw;
  const keywords = extractKeywords(requestText);

  if (!keywords.length) {
    process.stdout.write(`promote_status=fallback reason=no_keywords\n`);
    process.exit(2);
  }

  // Collect candidates from wiki RAG + git grep
  const wikiPaths = queryWikiRag(boardRoot, keywords);
  const grepPaths = gitGrepCandidates(projectRoot, keywords);

  // Score by frequency of keyword mentions
  const scoreMap = new Map<string, number>();
  for (const p of [...wikiPaths, ...grepPaths]) {
    const base = path.basename(p);
    let score = 0;
    for (const kw of keywords) {
      if (base.toLowerCase().includes(kw.toLowerCase())) score++;
    }
    scoreMap.set(p, (scoreMap.get(p) ?? 0) + score + 1);
  }

  const sorted = [...scoreMap.entries()]
    .filter(([, s]) => s >= CONFIDENCE_THRESHOLD)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => p);

  if (!sorted.length || sorted.length > MAX_CANDIDATES) {
    process.stdout.write(
      `promote_status=fallback reason=${!sorted.length ? "no_confident_candidates" : "too_many_candidates"} count=${sorted.length}\n`
    );
    process.exit(2);
  }

  const doneWhen = buildDoneWhen(requestText);

  injectIntoOrder(orderFile, sorted, doneWhen);

  process.stdout.write(
    `promote_status=promoted allowed_paths=${sorted.join(",")} confidence=high keywords=${keywords.slice(0, 5).join(",")}\n`
  );
}

main().catch((e) => {
  process.stderr.write(`promote-order-to-ticket error: ${e.message}\n`);
  process.exit(2);
});
