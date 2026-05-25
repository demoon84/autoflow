import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { requireSection, extractBulletSectionFromText, extractChecklistFromText, extractSectionLines } from "./sections";

export function readWritePayload(): { id?: JsonValue; reservation?: JsonValue; content: string } {
  const inputJson = getArg("--input-json");
  if (inputJson) {
    const parsed = JSON.parse(fs.readFileSync(inputJson, "utf8")) as { id?: JsonValue; reservation?: JsonValue; content?: unknown; contentFile?: unknown };
    const content = typeof parsed.content === "string"
      ? parsed.content
      : typeof parsed.contentFile === "string"
        ? fs.readFileSync(parsed.contentFile, "utf8")
        : "";
    if (!content.trim()) fail(2, "input JSON must contain content or contentFile");
    return { id: parsed.id, reservation: parsed.reservation, content: ensureTrailingNewline(content) };
  }

  const contentFile = getArg("--content-file");
  if (contentFile) {
    return { content: ensureTrailingNewline(fs.readFileSync(contentFile, "utf8")) };
  }

  if (!process.stdin.isTTY) {
    const content = fs.readFileSync(0, "utf8");
    if (content.trim()) return { content: ensureTrailingNewline(content) };
  }

  fail(2, "write command requires --content-file, --input-json, or stdin markdown");
}

export function validatePrdContent(content: string, id: string): void {
  requireSection(content, "Project");
  requireSection(content, "Allowed Paths");
  const contentId = extractIdFromContent(content, "prd");
  if (contentId && contentId !== id) fail(2, `content PRD id ${contentId} does not match target id ${id}`);
  if (extractBulletSectionFromText(content, "Allowed Paths").length === 0) {
    fail(2, "PRD content must include non-empty ## Allowed Paths bullets");
  }
}

export function validateTicketContent(content: string, id: string): void {
  for (const section of ["Ticket", "Goal", "Allowed Paths", "Done When", "Verification"]) {
    requireSection(content, section);
  }
  const contentId = extractIdFromContent(content, "ticket");
  if (contentId && contentId !== id) fail(2, `content ticket id ${contentId} does not match target id ${id}`);
  if (!new RegExp(`^-\\s*ID:\\s*(?:TODO|Todo)-${id}\\s*$`, "m").test(content)) {
    fail(2, `ticket content must contain "- ID: TODO-${id}"`);
  }
  if (extractBulletSectionFromText(content, "Allowed Paths").length === 0) {
    fail(2, "ticket content must include non-empty ## Allowed Paths bullets");
  }
  if (extractChecklistFromText(content, "Done When").length === 0) {
    fail(2, "ticket content must include non-empty ## Done When checklist items");
  }
}

export function pruneReservations(dir: string, ttlSec: number): void {
  const cutoff = Date.now() - ttlSec * 1000;
  for (const file of collectFiles(dir, /\.json$/, 1)) {
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch {}
  }
}

export function releaseReservation(raw: string): void {
  if (!raw) return;
  const reservation = resolveBoardPath(raw) || (path.isAbsolute(raw) ? raw : "");
  if (!reservation) return;
  const reservationsDir = path.join(BOARD_ROOT, "runners", "state", "id-reservations");
  if (!path.resolve(reservation).startsWith(path.resolve(reservationsDir) + path.sep)) return;
  try { fs.unlinkSync(reservation); } catch {}
}

export function validateNoUnsafeWrite(target: string, overwrite: boolean): void {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(TICKETS_ROOT) + path.sep)) {
    fail(2, `target must stay under tickets/: ${target}`);
  }
  if (fs.existsSync(resolved) && !overwrite) fail(1, `target already exists: ${boardRel(resolved)}`);
}

export function writeAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, target);
}

export function extractIdFromContent(content: string, kind: "prd" | "ticket"): string {
  const pattern = kind === "ticket"
    ? /\bTODO-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\b/
    : /\bPRD-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\b/;
  const m = content.match(pattern);
  return m ? normalizeId(m[1]) : "";
}
