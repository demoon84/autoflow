import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";

export function replaceSectionBlock(file: string, section: string, body: string): boolean {
  const content = utils.readFileSafe(file);
  if (!content) return false;
  const heading = section.replace(/^##\s+/, "");
  const nextBody = ensureTrailingNewline(body.trim());
  const re = new RegExp(`(^## ${escapeRe(heading)}\\b[^\\n]*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  let next: string;
  if (re.test(content)) {
    next = content.replace(re, (_match, headingLine: string) => `${headingLine}\n${nextBody}\n`);
  } else {
    next = `${content}${content.endsWith("\n") ? "" : "\n"}\n## ${heading}\n\n${nextBody}`;
  }
  return utils.writeFileSafe(file, next);
}

export function bulletize(text: string): string {
  const trimmed = text.trim();
  return /^[-*]\s+/.test(trimmed) ? trimmed : `- ${trimmed}`;
}

export function cleanSectionLines(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .map((line) => line.trim())
    .filter((line) => line && line !== "...");
}

export function requireSection(content: string, section: string): void {
  if (!new RegExp(`^## ${escapeRe(section)}\\b`, "m").test(content)) {
    fail(2, `content is missing ## ${section}`);
  }
}

export function extractBulletSectionFromText(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim() || "")
    .filter((line) => line && line !== "...");
}

export function extractChecklistFromText(content: string, section: string): string[] {
  return extractSectionLines(content, section)
    .filter((line) => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
}

export function extractSectionLines(content: string, section: string): string[] {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) break;
    if (inSection) out.push(line);
  }
  return out;
}
