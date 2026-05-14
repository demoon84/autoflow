import {path, BOARD_ROOT, utils} from "./context";

export function normalizeId(raw: string): string {
  const digits = raw.replace(/^.*_/, "").replace(/\.md$/i, "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Number.parseInt(digits, 10)).padStart(3, "0");
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
