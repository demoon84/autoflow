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
