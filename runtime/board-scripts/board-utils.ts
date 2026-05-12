/*
 * board-utils.ts — Common helpers for autoflow board scripts (Phase 1+ JS
 * migration). Mirrors the most-used functions in `.autoflow/scripts/common.sh`
 * with stable JS APIs. New .ts scripts in this dir should import from this
 * module instead of reimplementing parsers / state writers per file.
 *
 * 1원칙 mantra: every helper here is best-effort. Errors do not throw out
 * to callers — they return null/false/[] so the caller can decide whether
 * to halt or continue.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ─── Time / formatting ──────────────────────────────────────────────
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export function trimSpaces(s: unknown): string {
  return String(s == null ? "" : s).replace(/^[\s]+|[\s]+$/g, "");
}

export function stripMarkdownCodeTicks(s: unknown): string {
  return String(s == null ? "" : s).replace(/^`+|`+$/g, "").trim();
}

// ─── Roots ──────────────────────────────────────────────────────────
export function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT) return path.resolve(process.env.PROJECT_ROOT);
  if (process.env.AUTOFLOW_PROJECT_ROOT) return path.resolve(process.env.AUTOFLOW_PROJECT_ROOT);
  return process.cwd();
}

export function resolveBoardRoot(): string {
  if (process.env.AUTOFLOW_BOARD_ROOT) return path.resolve(process.env.AUTOFLOW_BOARD_ROOT);
  if (process.env.BOARD_ROOT) return path.resolve(process.env.BOARD_ROOT);
  return path.join(resolveProjectRoot(), ".autoflow");
}

export function gitRootPath(cwd?: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export function gitHeadCommit(cwd?: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export function boardRelativePath(absPath: string, boardRoot?: string): string {
  const root = boardRoot || resolveBoardRoot();
  const rel = path.relative(root, absPath);
  return rel.startsWith("..") ? absPath : rel;
}

export function normalizeRuntimePath(p: string): string {
  if (!p) return "";
  if (path.isAbsolute(p)) return p;
  return p.replace(/^[.][/]/, "");
}

// ─── File IO ────────────────────────────────────────────────────────
export function readFileSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function writeFileSafe(p: string, content: string): boolean {
  try {
    fs.writeFileSync(p, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

// ─── Ticket markdown parsing ────────────────────────────────────────
const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Read top-level scalar field "- FieldName: value" anywhere in the file. */
export function ticketScalarField(file: string, fieldName: string): string {
  const text = readFileSafe(file);
  if (!text) return "";
  const m = text.match(new RegExp(`^- ${reEscape(fieldName)}\\s*:\\s*(.*)$`, "m"));
  return m ? trimSpaces(m[1]) : "";
}

/** Read scalar field within a specific "## Section" block. */
export function extractScalarFieldInSection(
  file: string,
  sectionTitle: string,
  fieldName: string
): string {
  const text = readFileSafe(file);
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${reEscape(sectionTitle)}\\b`);
  const fieldRe = new RegExp(`^- ${reEscape(fieldName)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const m = line.match(fieldRe);
    if (m) return trimSpaces(m[1]);
  }
  return "";
}

/** Replace (or add) scalar field in a section. Returns true on success. */
export function replaceScalarFieldInSection(
  file: string,
  sectionTitle: string,
  fieldName: string,
  newValue: string
): boolean {
  const text = readFileSafe(file);
  if (!text) return false;
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(
    `^## ${reEscape(sectionTitle.replace(/^## /, ""))}\\b`
  );
  const fieldRe = new RegExp(`^(- ${reEscape(fieldName)}\\s*:\\s*).*$`);
  let inSection = false;
  let sectionStart = -1;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      if (!replaced) {
        lines.splice(i, 0, `- ${fieldName}: ${newValue}`);
        replaced = true;
      }
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    if (fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1${newValue}`);
      replaced = true;
      break;
    }
  }
  if (!replaced && sectionStart >= 0) {
    lines.push(`- ${fieldName}: ${newValue}`);
    replaced = true;
  }
  if (!replaced) {
    lines.push("");
    lines.push(`## ${sectionTitle.replace(/^## /, "")}`);
    lines.push("");
    lines.push(`- ${fieldName}: ${newValue}`);
    replaced = true;
  }
  return writeFileSafe(file, lines.join("\n"));
}

/** Append a bullet line to "## Notes" section (creates if absent). */
export function appendNote(file: string, text: string): boolean {
  const content = readFileSafe(file);
  if (!content) return false;
  const audit = `- ${text}`;
  const m = content.match(/(\n## Notes[ \t]*\n)([\s\S]*?)(?=\n## |\Z)/);
  let next: string;
  if (m && typeof m.index === "number") {
    const before = content.slice(0, m.index + m[1].length);
    const body = m[2] || "";
    const after = content.slice(m.index + m[0].length);
    next = `${before}${body}${body.endsWith("\n") ? "" : "\n"}${audit}\n${after}`;
  } else {
    next = `${content}${content.endsWith("\n") ? "" : "\n"}\n## Notes\n\n${audit}\n`;
  }
  return writeFileSafe(file, next);
}

/** Extract "## Allowed Paths" bullets. Strips backticks, ignores blanks/"...". */
export function extractTicketAllowedPaths(file: string): string[] {
  const text = readFileSafe(file);
  if (!text) return [];
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
    const m = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!m) continue;
    const v = m[1].replace(/`/g, "").trim();
    if (!v || v === "...") continue;
    out.push(v);
  }
  return out;
}

export function allowedPathIsConcreteRepoPath(p: string): boolean {
  if (!p) return false;
  if (/^TODO:?/i.test(p)) return false;
  if (p.startsWith("/")) return false;
  if (p.startsWith("../") || p.includes("/../")) return false;
  if (/[*?\[\]]/.test(p)) return false;
  return true;
}

export function ticketConcreteAllowedPaths(file: string): string[] {
  const all = extractTicketAllowedPaths(file).filter(allowedPathIsConcreteRepoPath);
  return [...new Set(all)].sort();
}

export function ticketWorktreeField(file: string, fieldName: string): string {
  return extractScalarFieldInSection(file, "Worktree", fieldName);
}

export function ticketWorktreePathFromFile(file: string): string {
  return stripMarkdownCodeTicks(ticketWorktreeField(file, "Path"));
}

/** Pull NNN from "Todo-NNN.md" filename or content "- ID: Todo-NNN". */
export function extractNumericId(file: string): string {
  const base = path.basename(file).replace(/\.md$/i, "");
  const m = base.match(/(\d+)$/);
  if (m) return m[1];
  const id = ticketScalarField(file, "ID");
  if (id) {
    const inner = id.match(/(\d+)/);
    if (inner) return inner[1];
  }
  return "";
}

// ─── Runner state file IO ───────────────────────────────────────────
export function runnerStatePath(runnerId: string, boardRoot?: string): string {
  return path.join(boardRoot || resolveBoardRoot(), "runners", "state", `${runnerId}.state`);
}

export function readRunnerState(runnerId: string, boardRoot?: string): Map<string, string> {
  const map = new Map<string, string>();
  const text = readFileSafe(runnerStatePath(runnerId, boardRoot));
  if (!text) return map;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    map.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return map;
}

export function writeRunnerState(
  runnerId: string,
  map: Map<string, string>,
  boardRoot?: string
): boolean {
  const out = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  return writeFileSafe(runnerStatePath(runnerId, boardRoot), out);
}

export function updateRunnerState(
  runnerId: string,
  fields: Record<string, string | number | undefined | null>,
  boardRoot?: string
): boolean {
  const map = readRunnerState(runnerId, boardRoot);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    map.set(k, String(v));
  }
  map.set("updated_at", nowIso());
  return writeRunnerState(runnerId, map, boardRoot);
}

// ─── PID liveness (used by janitor + ownership lock) ────────────────
export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err && err.code === "EPERM";
  }
}

// ─── git helpers ────────────────────────────────────────────────────
export function gitOutput(args: string[], cwd?: string): string {
  try {
    return execFileSync("git", args, {
      cwd: cwd || resolveProjectRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}
