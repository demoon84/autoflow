import {fs, path, boardRoot, type PairMap} from "./context";

export function idFromTicketPath(file: string): string {
  return normalizeId(path.basename(file));
}

export function normalizeId(value: string): string {
  const raw = String(value || "").trim().replace(/\.md$/i, "").replace(/^(?:PRD|TODO)-/i, "");
  const scoped = raw.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
  if (scoped) return `${scoped[1].toLowerCase()}-${scoped[2].padStart(3, "0")}`;
  const match = raw.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

export function boardRel(file: string): string {
  const rel = path.relative(boardRoot, file);
  return rel.startsWith("..") ? file : rel;
}

export function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_") || "unknown";
}

export function stripTicks(value: string): string {
  return value.replace(/^`+|`+$/g, "").trim();
}

export function oneLine(value: string, maxLen = 1000): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!Number.isFinite(maxLen) || maxLen <= 0 || clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 24)).trimEnd()}... [truncated]`;
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

export function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export function printPairs(fields: PairMap): void {
  for (const [key, value] of Object.entries(fields)) {
    process.stdout.write(`${key}=${value ?? ""}\n`);
  }
}
