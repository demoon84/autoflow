import {path} from "./context";
import {trimSpaces, stripMarkdownCodeTicks} from "./format";
import {readFileSafe, writeFileSafe} from "./files";

// ─── Ticket markdown parsing ────────────────────────────────────────
const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Read top-level scalar field "- FieldName: value" anywhere in the file. */
export function ticketScalarField(file: string, fieldName: string): string {
  const text = readFileSafe(file);
  if (!text) return "";
  const m = text.match(new RegExp(`^- ${reEscape(fieldName)}\\s*:\\s*(.*)$`, "m"));
  return m ? trimSpaces(m[1]) : "";
}

/** Read scalar field within a specific "## Section" block. */
export function extractScalarFieldInSection(
  file: string,
  sectionTitle: string,
  fieldName: string
): string {
  const text = readFileSafe(file);
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${reEscape(sectionTitle)}\\b`);
  const fieldRe = new RegExp(`^- ${reEscape(fieldName)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const m = line.match(fieldRe);
    if (m) return trimSpaces(m[1]);
  }
  return "";
}

/** Replace (or add) scalar field in a section. Returns true on success. */
export function replaceScalarFieldInSection(
  file: string,
  sectionTitle: string,
  fieldName: string,
  newValue: string
): boolean {
  const text = readFileSafe(file);
  if (!text) return false;
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(
    `^## ${reEscape(sectionTitle.replace(/^## /, ""))}\\b`
  );
  const fieldRe = new RegExp(`^(- ${reEscape(fieldName)}\\s*:)[\\t ]*.*$`);
  let inSection = false;
  let sectionStart = -1;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      if (!replaced) {
        lines.splice(i, 0, `- ${fieldName}: ${newValue}`);
        replaced = true;
      }
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    if (fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1 ${newValue}`);
      replaced = true;
      break;
    }
  }
  if (!replaced && sectionStart >= 0) {
    let insertAt = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, `- ${fieldName}: ${newValue}`);
    replaced = true;
  }
  if (!replaced) {
    lines.push("");
    lines.push(`## ${sectionTitle.replace(/^## /, "")}`);
    lines.push("");
    lines.push(`- ${fieldName}: ${newValue}`);
    replaced = true;
  }
  return writeFileSafe(file, lines.join("\n"));
}

/** Append a bullet line to "## Notes" section (creates if absent). */
export function appendNote(file: string, text: string): boolean {
  const content = readFileSafe(file);
  if (!content) return false;
  const audit = `- ${text}`;
  const m = content.match(/(\n## Notes[ \t]*\n)([\s\S]*?)(?=\n## |\Z)/);
  let next: string;
  if (m && typeof m.index === "number") {
    const before = content.slice(0, m.index + m[1].length);
    const body = m[2] || "";
    const after = content.slice(m.index + m[0].length);
    next = `${before}${body}${body.endsWith("\n") ? "" : "\n"}${audit}\n${after}`;
  } else {
    next = `${content}${content.endsWith("\n") ? "" : "\n"}\n## Notes\n\n${audit}\n`;
  }
  return writeFileSafe(file, next);
}

/** Extract "## Allowed Paths" bullets. Strips backticks, ignores blanks/"...". */
export function extractTicketAllowedPaths(file: string): string[] {
  const text = readFileSafe(file);
  if (!text) return [];
  const out: string[] = [];
  let inSection = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(raw)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(raw) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const m = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!m) continue;
    const v = m[1].replace(/`/g, "").trim();
    if (!v || v === "...") continue;
    out.push(v);
  }
  return out;
}

export function allowedPathIsConcreteRepoPath(p: string): boolean {
  if (!p) return false;
  if (/^TODO:?/i.test(p)) return false;
  if (p.startsWith("/")) return false;
  if (p.startsWith("../") || p.includes("/../")) return false;
  if (/[*?\[\]]/.test(p)) return false;
  return true;
}

export function ticketConcreteAllowedPaths(file: string): string[] {
  const all = extractTicketAllowedPaths(file).filter(allowedPathIsConcreteRepoPath);
  return [...new Set(all)].sort();
}

export function ticketWorktreeField(file: string, fieldName: string): string {
  return extractScalarFieldInSection(file, "Worktree", fieldName);
}

export function ticketWorktreePathFromFile(file: string): string {
  return stripMarkdownCodeTicks(ticketWorktreeField(file, "Path"));
}

/** Pull NNN from "Todo-NNN.md" filename or content "- ID: Todo-NNN". */
export function extractNumericId(file: string): string {
  const base = path.basename(file).replace(/\.md$/i, "");
  const m = base.match(/(\d+)$/);
  if (m) return m[1];
  const id = ticketScalarField(file, "ID");
  if (id) {
    const inner = id.match(/(\d+)/);
    if (inner) return inner[1];
  }
  return "";
}
