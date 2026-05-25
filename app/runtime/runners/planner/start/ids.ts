import {path, BOARD_ROOT, utils} from "./context";

export function normalizeId(raw: string): string {
  const base = path.basename(String(raw || "")).replace(/\.md$/i, "");
  const scoped = base.replace(/^(?:PRD|TODO)-/i, "").match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
  if (scoped) return scoped[2].padStart(3, "0");
  const match = base.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

export function extractNumericId(file: string): string {
  const id = normalizeId(path.basename(file));
  const match = id.match(/(\d+)$/);
  return match ? match[1] : "";
}

export function idNamespace(id: string): string {
  const normalized = normalizeId(id);
  const match = normalized.match(/^(.+)-\d+$/);
  return match ? match[1] : "";
}

export function ticketIdNamespace(): string {
  return "";
}

export function boardRelativePath(file: string): string {
  return utils.boardRelativePath(file, BOARD_ROOT);
}

export function ticketPath(state: string, id: string): string {
  return path.join(BOARD_ROOT, "tickets", state, `TODO-${id}.md`);
}

export function projectKeyFromSpecRef(specRef: string): string {
  return path.basename(specRef).replace(/\.md$/i, "") || "unlinked-project";
}

export function doneSpecPathForSpecRef(specRef: string): string {
  return path.join(BOARD_ROOT, "tickets", "done", projectKeyFromSpecRef(specRef), path.basename(specRef));
}
