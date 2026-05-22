import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";

function migrateLegacyQueueDir(fromBucket: string, toBucket: string): void {
  const fromDir = path.join(TICKETS_ROOT, fromBucket);
  const toDir = path.join(TICKETS_ROOT, toBucket);
  if (!fs.existsSync(fromDir)) return;
  fs.mkdirSync(toDir, { recursive: true });
  for (const name of fs.readdirSync(fromDir)) {
    const from = path.join(fromDir, name);
    const to = path.join(toDir, name);
    if (!safeIsFile(from)) continue;
    if (fs.existsSync(to)) {
      if (name === ".gitkeep") fs.rmSync(from, { force: true });
      continue;
    }
    fs.renameSync(from, to);
  }
  try {
    fs.rmdirSync(fromDir);
  } catch {
    // Non-empty legacy dirs are left in place for human inspection.
  }
}

export function migrateLegacyQueueDirs(): void {
  migrateLegacyQueueDir("backlog", "prd");
}

export function listQueueItems(bucket: string, patterns: RegExp[], kind: string): QueueItem[] {
  if (bucket === "prd") migrateLegacyQueueDirs();
  const dir = path.join(TICKETS_ROOT, bucket);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => patterns.some((re) => re.test(name)))
    .map((name) => path.join(dir, name))
    .filter((file) => safeIsFile(file))
    .map((file) => readQueueItem(file, kind));
}

export function readQueueItem(file: string, kind: string): QueueItem {
  const text = utils.readFileSafe(file);
  const priority = normalizePriority(readAnyPriority(file, text));
  const rel = boardRel(file);
  return {
    kind,
    path: rel,
    id: idFromPath(file),
    priority,
    priority_rank: priorityRank(priority),
    title: readTitle(file, text),
    status: readStatus(file),
    stage: utils.extractScalarFieldInSection(file, "Ticket", "Stage"),
  };
}

export function readAnyPriority(file: string, text: string): string {
  const candidates = [
    utils.extractScalarFieldInSection(file, "Ticket", "Priority"),
    utils.extractScalarFieldInSection(file, "Project", "Priority"),
  ].filter(Boolean);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatter) {
    const m = frontmatter[1].match(/^\s*priority\s*:\s*(.+)$/im);
    if (m) candidates.push(m[1]);
  }
  return candidates[0] || "normal";
}

export function readTitle(file: string, text: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Ticket", "Title") ||
    utils.extractScalarFieldInSection(file, "Project", "Title") ||
    utils.extractScalarFieldInSection(file, "Project", "Name") ||
    (text.match(/^#\s+(.+)$/m)?.[1] || "")
  ).trim();
}

export function readStatus(file: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Project", "Status") ||
    utils.extractScalarFieldInSection(file, "Ticket", "Stage") ||
    ""
  ).trim();
}

export function normalizePriority(raw: string): string {
  const clean = String(raw || "normal").toLowerCase().replace(/[`"'\[\]:]/g, "").trim();
  if (["critical", "high", "normal", "low"].includes(clean)) return clean;
  if (["crit", "p0"].includes(clean)) return "critical";
  if (["p1"].includes(clean)) return "high";
  if (["medium", "default", "p2"].includes(clean)) return "normal";
  if (["p3"].includes(clean)) return "low";
  return "normal";
}

export function priorityRank(priority: string): number {
  return { critical: 0, high: 1, normal: 2, low: 3 }[normalizePriority(priority)] ?? 2;
}
