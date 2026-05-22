// Single source of truth for Autoflow ticket file naming.
//
// Format (post-rename):
//   - PRD files: PRD-NNN.md   (uppercase prefix, dash separator, ≥3-digit id)
//   - TODO files: TODO-NNN.md (uppercase prefix, dash separator, ≥3-digit id)
//
// Legacy prefixes (prd_, project_, Todo-, tickets_) are NOT accepted any more.
// The promokit migration script has been run to rename every on-disk artifact
// and every cross-reference to the new convention; the runtime/CLI no longer
// needs to fall back to the old patterns. If you find a legacy hit, treat it
// as data corruption and surface a blocker rather than silently accepting it.

export type TicketKind = "prd" | "todo";

export const PRD_FILENAME_PATTERN = /^PRD-(\d+)\.md$/;
export const TODO_FILENAME_PATTERN = /^TODO-(\d+)\.md$/;
export const PRD_KEY_PATTERN = /\bPRD-(\d+)\b/;
export const TODO_KEY_PATTERN = /\bTODO-(\d+)\b/;
export const TICKET_KEY_PATTERN = /\b(PRD|TODO)-(\d+)\b/;

export function ticketPrefix(kind: TicketKind): "PRD" | "TODO" {
    return kind === "prd" ? "PRD" : "TODO";
}

export function normalizeTicketId(id: string | number): string {
    const raw = String(id).trim();
    const cleaned = raw.match(/(?:PRD|TODO)-?(\d+)$/i)?.[1] ?? raw.match(/^(\d+)$/)?.[1] ?? raw.replace(/\D+/g, "");
    if (!cleaned) return raw;
    return cleaned.length >= 3 ? cleaned : cleaned.padStart(3, "0");
}

export function ticketFilename(kind: TicketKind, id: string | number): string {
    return `${ticketPrefix(kind)}-${normalizeTicketId(id)}.md`;
}

export function ticketKey(kind: TicketKind, id: string | number): string {
    return `${ticketPrefix(kind)}-${normalizeTicketId(id)}`;
}

export function parseTicketFilename(name: string): { kind: TicketKind; id: string } | null {
    const baseName = name.split("/").pop() ?? name;
    const prdMatch = baseName.match(PRD_FILENAME_PATTERN);
    if (prdMatch) return { kind: "prd", id: prdMatch[1] };
    const todoMatch = baseName.match(TODO_FILENAME_PATTERN);
    if (todoMatch) return { kind: "todo", id: todoMatch[1] };
    return null;
}

export function parseTicketKey(key: string): { kind: TicketKind; id: string } | null {
    const trimmed = String(key || "").trim();
    const match = trimmed.match(/^(PRD|TODO)-(\d+)$/);
    if (!match) return null;
    return { kind: match[1] === "PRD" ? "prd" : "todo", id: match[2] };
}

export function isPrdFilename(name: string): boolean {
    const baseName = name.split("/").pop() ?? name;
    return PRD_FILENAME_PATTERN.test(baseName);
}

export function isTodoFilename(name: string): boolean {
    const baseName = name.split("/").pop() ?? name;
    return TODO_FILENAME_PATTERN.test(baseName);
}

export function isTicketFilename(name: string): boolean {
    return isPrdFilename(name) || isTodoFilename(name);
}

export function ticketDisplayId(name: string): string {
    const parsed = parseTicketFilename(name);
    if (parsed) return ticketKey(parsed.kind, parsed.id);
    const trimmed = name.replace(/\.md$/i, "");
    return parseTicketKey(trimmed)?.kind ? trimmed : trimmed;
}
