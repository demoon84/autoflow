import {fs, path, BOARD_ROOT, utils} from "../context";
import {boardRelativePath, doneSpecPathForSpecRef, projectKeyFromSpecRef} from "../ids";
import {archiveFile, collectFiles, filesEqual} from "../files";

export function projectKeyHasTicket(projectKey: string): boolean {
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^TODO-\d+\.md$/)) {
    const current = utils.ticketScalarField(file, "PRD Key") || projectKeyFromSpecRef(utils.extractScalarFieldInSection(file, "References", "PRD"));
    if (utils.trimSpaces(current) === projectKey) return true;
  }
  return false;
}

export function archiveSpecToDoneIfNeeded(specRef: string): string {
  const normalized = specRef.replace(/`/g, "");
  if (normalized.startsWith("tickets/done/")) return normalized;
  const source = path.join(BOARD_ROOT, normalized);
  const target = doneSpecPathForSpecRef(normalized);
  const targetRef = boardRelativePath(target);
  if (fs.existsSync(target)) {
    if (fs.existsSync(source) && filesEqual(source, target)) fs.rmSync(source);
    return targetRef;
  }
  if (fs.existsSync(source)) archiveFile(source, target);
  return targetRef;
}
