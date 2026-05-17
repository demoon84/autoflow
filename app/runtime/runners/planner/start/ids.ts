import {path, BOARD_ROOT, utils} from "./context";

export function normalizeId(raw: string): string {
  const base = path.basename(String(raw || "")).replace(/\.md$/i, "");
  const match = base.match(/(\d+)/);
  if (!match) return "";
  return String(Number.parseInt(match[1], 10)).padStart(3, "0");
}

export function extractNumericId(file: string): string {
  return normalizeId(path.basename(file));
}

export function boardRelativePath(file: string): string {
  return utils.boardRelativePath(file, BOARD_ROOT);
}

export function ticketPath(state: string, id: string): string {
  return path.join(BOARD_ROOT, "tickets", state, `Todo-${id}.md`);
}

export function projectKeyFromSpecRef(specRef: string): string {
  return path.basename(specRef).replace(/\.md$/i, "") || "unlinked-project";
}

export function doneSpecPathForSpecRef(specRef: string): string {
  return path.join(BOARD_ROOT, "tickets", "done", projectKeyFromSpecRef(specRef), path.basename(specRef));
}
