// Single source of truth for Autoflow ticket file naming.
//
// Canonical format:
//   - PRD files: PRD-NNN.md
//   - TODO files: TODO-NNN.md
//
// Older names such as PRD-username-NNN.md and TODO-username-NNN.md are still
// parsed as legacy board data, but new IDs are always numeric.
//
// Legacy prefixes (prd_, project_, Todo-, tickets_) are NOT accepted any more.
// The promokit migration script has been run to rename every on-disk artifact
// and every cross-reference to the new convention; the runtime/CLI no longer
// needs to fall back to the old patterns. If you find a legacy hit, treat it
// as data corruption and surface a blocker rather than silently accepting it.

export type TicketKind = "prd" | "todo";

export const TICKET_ID_PATTERN_SOURCE = "(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\\d+";
export const PRD_FILENAME_PATTERN = new RegExp(`^PRD-(${TICKET_ID_PATTERN_SOURCE})\\.md$`);
export const TODO_FILENAME_PATTERN = new RegExp(`^TODO-(${TICKET_ID_PATTERN_SOURCE})\\.md$`);
export const PRD_KEY_PATTERN = new RegExp(`\\bPRD-(${TICKET_ID_PATTERN_SOURCE})\\b`);
export const TODO_KEY_PATTERN = new RegExp(`\\bTODO-(${TICKET_ID_PATTERN_SOURCE})\\b`);
export const TICKET_KEY_PATTERN = new RegExp(`\\b(PRD|TODO)-(${TICKET_ID_PATTERN_SOURCE})\\b`);

export function ticketPrefix(kind: TicketKind): "PRD" | "TODO" {
    return kind === "prd" ? "PRD" : "TODO";
}

export function normalizeTicketId(id: string | number): string {
    const raw = String(id).trim().replace(/\.md$/i, "").replace(/^(?:PRD|TODO)-/i, "");
    const scoped = raw.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
    if (scoped) return scoped[2].padStart(3, "0");
    const cleaned = raw.match(/^(\d+)$/)?.[1] ?? raw.replace(/\D+/g, "");
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
    const match = trimmed.match(new RegExp(`^(PRD|TODO)-(${TICKET_ID_PATTERN_SOURCE})$`));
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
