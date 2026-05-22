import {fs, path, boardRoot} from "./context";
import {scalar} from "./sections";

export function resolveTicketFile(ref: string): string {
  const normalized = ref.replace(/^[.][/]/, "");
  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;
  if (normalized.includes("/")) {
    const candidate = path.join(boardRoot, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  const id = normalizeId(ref);
  for (const state of ["inprogress", "todo", "verifier"]) {
    for (const name of [`TODO-${id}.md`, `TODO-${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

export function ticketWorkingRoot(ticketFile: string): string {
  const worktree = scalar(ticketFile, "Worktree", "Path");
  return worktree && fs.existsSync(worktree) ? worktree : "";
}

export function specVerificationCommand(ticketFile: string): string {
  const ref = referenceValue(ticketFile, "PRD");
  if (!ref) return "";
  const specFile = path.isAbsolute(ref) ? ref : path.join(boardRoot, ref);
  return scalar(specFile, "Verification", "Command");
}

export function referenceValue(file: string, field: string): string {
  return scalar(file, "References", field);
}

export function idFromPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

export function normalizeId(value: string): string {
  const match = value.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}
