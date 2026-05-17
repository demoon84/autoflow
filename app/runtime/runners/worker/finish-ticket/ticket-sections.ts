import {read, write, stripTicks, escapeRe, unique} from "./io";

function sectionBodyRange(content: string, section: string): {bodyStart: number; bodyEnd: number} | null {
  const headingRe = new RegExp(`(^|\\n)## ${escapeRe(section)}\\b[^\\n]*(?:\\n|$)`);
  const match = headingRe.exec(content);
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  const nextHeadingRe = /\n## /g;
  nextHeadingRe.lastIndex = bodyStart;
  const nextHeading = nextHeadingRe.exec(content);
  return {
    bodyStart,
    bodyEnd: nextHeading ? nextHeading.index : content.length,
  };
}

export function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  let inSection = false;
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return stripTicks(match[1].trim());
  }
  return "";
}

export function replaceScalar(file: string, section: string, field: string, value: string): void {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^(- ${escapeRe(field)}\\s*:).*?$`);
  let inSection = false;
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      lines.splice(i, 0, `- ${field}: ${value}`);
      write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
      return;
    }
    if (inSection && fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1 ${value}`);
      write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
      return;
    }
  }
  if (sectionStart >= 0) {
    lines.push(`- ${field}: ${value}`);
  } else {
    lines.push("", `## ${section}`, "", `- ${field}: ${value}`);
  }
  write(file, `${lines.join("\n").replace(/\n*$/, "\n")}`);
}

export function removeScalars(file: string, section: string, fields: string[]): void {
  const fieldNames = new Set(fields.map((field) => field.toLowerCase()));
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = /^-\s*([^:]+?)\s*:/;
  let inSection = false;
  let changed = false;
  const next: string[] = [];
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      next.push(line);
      continue;
    }
    if (/^## /.test(line) && inSection) {
      inSection = false;
    }
    const match = inSection ? line.match(fieldRe) : null;
    if (match && fieldNames.has(match[1].trim().toLowerCase())) {
      changed = true;
      continue;
    }
    next.push(line);
  }
  if (changed) {
    write(file, `${next.join("\n").replace(/\n*$/, "\n")}`);
  }
}

export function replaceSection(file: string, section: string, body: string): void {
  const content = read(file);
  const range = sectionBodyRange(content, section);
  const next = range
    ? `${content.slice(0, range.bodyStart)}\n${body.trim()}\n\n${content.slice(range.bodyEnd).replace(/^\n/, "")}`
    : `${content.replace(/\n*$/, "\n")}\n## ${section}\n\n${body.trim()}\n`;
  write(file, next);
}

export function appendNote(file: string, note: string): void {
  const content = read(file);
  const bullet = `- ${note}`;
  const range = sectionBodyRange(content, "Notes");
  const next = range
    ? `${content.slice(0, range.bodyStart)}\n${[content.slice(range.bodyStart, range.bodyEnd).trim(), bullet].filter(Boolean).join("\n")}\n\n${content.slice(range.bodyEnd).replace(/^\n/, "")}`
    : `${content.replace(/\n*$/, "\n")}\n## Notes\n\n${bullet}\n`;
  write(file, next);
}

export function appendReplanReason(file: string, reason: string): void {
  if (read(file).includes("## Replan Reason")) return;
  write(file, `${read(file).replace(/\n*$/, "\n")}\n## Replan Reason\n\n- ${reason}\n`);
}

export function updateGoalRuntime(file: string, status: string, finishedAt: string): void {
  replaceScalar(file, "Goal Runtime", "Status", status);
  replaceScalar(file, "Goal Runtime", "Updated At", finishedAt);
}

export function normalizedChangeType(ticketFile: string): string {
  const value = scalar(ticketFile, "Ticket", "Change Type").toLowerCase();
  return ["docs", "cleanup", "infra"].includes(value) ? value : "code";
}

export function failureClass(ticketFile: string): string {
  return scalar(ticketFile, "Recovery State", "Failure Class");
}

export function markRecoveryResolved(ticketFile: string, detectedBy: string, evidence: string): void {
  const status = scalar(ticketFile, "Recovery State", "Status");
  const failure = scalar(ticketFile, "Recovery State", "Failure Class");
  if (!status && !failure) return;
  replaceSection(ticketFile, "Recovery State", `- Status: resolved
- Detected By: ${detectedBy}
- Failure Class:
- Evidence: ${evidence}
- Planner Decision:
- Worker Resume Instruction: Continue normal worker flow.
- Last Recovery At: ${new Date().toISOString()}`);
}

export function doneWhenItems(text: string): string[] {
  const items: string[] = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^## Done When\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (inSection && /^\s*[-*]\s+\[[ xX]\]/.test(line)) items.push(line);
  }
  return items;
}

export function allowedPaths(ticketFile: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of read(ticketFile).split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const value = stripTicks(match[1]).replace(/^[.][/]/, "").replace(/\/+$/, "");
    if (
      value &&
      !/^(TBD|TODO:?|N\/A|NA|NONE)$/i.test(value) &&
      !/^TODO:?/i.test(value) &&
      !value.startsWith("/") &&
      !value.startsWith("../") &&
      !/[*?\[\]]/.test(value)
    ) out.push(value);
  }
  return unique(out);
}
