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

const aPaths = concretePaths(a);
const bPaths = concretePaths(b);

if (aPaths.length === 0 || bPaths.length === 0) {
  process.stdout.write(`unresolvable: at least one ticket has no concrete Allowed Paths\n`);
  process.exit(1);
}

let conflict = false;
for (const ap of aPaths) {
  const apNorm = ap.replace(/\/+$/, "");
  for (const bp of bPaths) {
    const bpNorm = bp.replace(/\/+$/, "");
    if (apNorm === bpNorm || apNorm.startsWith(bpNorm + "/") || bpNorm.startsWith(apNorm + "/")) {
      process.stdout.write(`${ap} <-> ${bp}\n`);
      conflict = true;
    }
  }
}

process.exit(conflict ? 1 : 0);
