import {utils} from "./context";

export function priorityRank(file: string): number {
  const text = utils.readFileSafe(file);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const candidates: string[] = [];
  if (frontmatter) {
    const m = frontmatter[1].match(/^\s*priority\s*:\s*(.+)$/im);
    if (m) candidates.push(m[1]);
  }
  const bodyPriority = text.match(/^\s*(?:-\s*)?[Pp]riority\s*:\s*(.+)$/m);
  if (bodyPriority) candidates.push(bodyPriority[1]);
  const title = text.match(/^\s*(?:-\s*)?Title\s*:\s*(.+)$/m) || text.match(/^#\s+(.+)$/m);
  if (title) {
    if (/\[critical\]|\[CRITICAL\]|🚨/.test(title[1])) return 0;
    if (/\[high\]|\[HIGH\]|⚠/.test(title[1])) return 1;
  }
  for (const value of candidates) {
    const rank = priorityValueToRank(value);
    if (rank !== null) return rank;
  }
  return 2;
}

export function priorityValueToRank(value: string): number | null {
  const clean = utils
    .trimSpaces(value.toLowerCase().replace(/#.*/, "").replace(/[`"'\[\]:]/g, ""));
  if (["critical", "crit", "p0"].includes(clean)) return 0;
  if (["high", "p1"].includes(clean)) return 1;
  if (["normal", "medium", "default", "p2"].includes(clean)) return 2;
  if (["low", "p3"].includes(clean)) return 3;
  return null;
}

export function normalizePriority(value: string): string {
  const rank = priorityValueToRank(value);
  if (rank === 0) return "critical";
  if (rank === 1) return "high";
  if (rank === 3) return "low";
  return "normal";
}

export function normalizeChangeType(value: string): string {
  const clean = utils.trimSpaces(value).toLowerCase();
  if (["docs", "cleanup", "infra"].includes(clean)) return clean;
  return "code";
}
