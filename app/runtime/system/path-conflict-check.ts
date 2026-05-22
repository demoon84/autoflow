#!/usr/bin/env tsx
/*
 * path-conflict-check.ts — Allowed Paths overlap detector.
 *
 * Drop-in replacement for path-conflict-check.js. Same CLI / same
 * output / same exit codes. Wired into multi-worker dispatch (PRD 5).
 *
 * Usage: tsx path-conflict-check.ts <ticket-a.md> <ticket-b.md>
 *
 * Exit:
 *   0  no overlap
 *   1  overlap (stdout lists "a <-> b" pairs)
 *   2  usage / argument error
 */

import * as fs from "node:fs";
import * as path from "node:path";

const argv = process.argv.slice(2);
if (argv.length !== 2) {
  process.stderr.write(`Usage: tsx path-conflict-check.ts <ticket-a.md> <ticket-b.md>\n`);
  process.exit(2);
}
const [a, b] = argv;
for (const f of [a, b]) {
  if (!fs.existsSync(f)) {
    process.stderr.write(`missing ticket file: ${f}\n`);
    process.exit(2);
  }
}

function extractAllowedPaths(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const out: string[] = [];
  for (const raw of lines) {
    if (/^## Allowed Paths\b/.test(raw)) { inSection = true; continue; }
    if (/^## /.test(raw) && inSection) { inSection = false; continue; }
    if (!inSection) continue;
    const m = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!m) continue;
    const value = m[1].replace(/`/g, "").trim();
    if (!value || value === "...") continue;
    out.push(value);
  }
  return out;
}

function isConcreteRepoPath(p: string): boolean {
  if (!p) return false;
  if (/^TODO:?/i.test(p)) return false;
  if (p.startsWith("/")) return false;
  if (p.startsWith("../") || p.includes("/../")) return false;
  if (/[*?\[\]]/.test(p)) return false;
  return true;
}

function concretePaths(file: string): string[] {
  const paths = extractAllowedPaths(file).filter(isConcreteRepoPath);
  return [...new Set(paths)].sort();
}

function normalizeRelPath(raw: string): string {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

function pathConflictMode(): "files" | "strict" | "off" {
  const explicitMode = String(process.env.AUTOFLOW_PATH_CONFLICT_MODE || "").trim().toLowerCase();
  const raw = explicitMode || String(process.env.AUTOFLOW_PATH_CONFLICT_CHECK || "").trim().toLowerCase();
  if (["off", "0", "false", "no", "disabled", "none"].includes(raw)) return "off";
  if (["strict", "legacy", "directory", "directories", "dir"].includes(raw)) return "strict";
  return "files";
}

function projectRoot(): string {
  return path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || process.cwd());
}

function boardPathPrefix(): string {
  const boardRoot = process.env.BOARD_ROOT || process.env.AUTOFLOW_BOARD_ROOT || path.join(projectRoot(), ".autoflow");
  return path.basename(boardRoot) || ".autoflow";
}

function isBoardSidecarPath(raw: string): boolean {
  const rel = normalizeRelPath(raw);
  const prefix = boardPathPrefix();
  return rel === prefix || rel.startsWith(`${prefix}/`) || rel === ".autoflow" || rel.startsWith(".autoflow/");
}

function pathLooksDirectoryScope(raw: string): boolean {
  const text = String(raw || "").replace(/`/g, "").trim();
  const rel = normalizeRelPath(text);
  if (!rel) return false;
  if (/[\/\\]$/.test(text)) return true;
  try {
    return fs.statSync(path.join(projectRoot(), rel)).isDirectory();
  } catch {
    return false;
  }
}

function conflictComparablePath(raw: string): string {
  const rel = normalizeRelPath(raw);
  if (!rel || isBoardSidecarPath(rel)) return "";
  if (pathConflictMode() === "files" && pathLooksDirectoryScope(raw)) return "";
  return rel;
}

function pathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = normalizeRelPath(aRaw);
  const b = normalizeRelPath(bRaw);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function allowedPathsConflict(aRaw: string, bRaw: string): boolean {
  const mode = pathConflictMode();
  if (mode === "off") return false;
  if (mode === "strict") return pathsOverlap(aRaw, bRaw);
  const a = conflictComparablePath(aRaw);
  const b = conflictComparablePath(bRaw);
  return Boolean(a && b && a === b);
}

const aPaths = concretePaths(a);
const bPaths = concretePaths(b);

if (aPaths.length === 0 || bPaths.length === 0) {
  process.stdout.write(`unresolvable: at least one ticket has no concrete Allowed Paths\n`);
  process.exit(1);
}

let conflict = false;
for (const ap of aPaths) {
  for (const bp of bPaths) {
    if (allowedPathsConflict(ap, bp)) {
      process.stdout.write(`${ap} <-> ${bp}\n`);
      conflict = true;
    }
  }
}

process.exit(conflict ? 1 : 0);
