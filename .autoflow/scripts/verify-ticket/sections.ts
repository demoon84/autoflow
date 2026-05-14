import {read, write, escapeRe} from "./io";

export function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return match[1].replace(/^`+|`+$/g, "").trim();
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
      write(file, lines.join("\n"));
      return;
    }
    if (inSection && fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1 ${value}`);
      write(file, lines.join("\n"));
      return;
    }
  }
  if (sectionStart >= 0) lines.push(`- ${field}: ${value}`);
  else lines.push("", `## ${section}`, "", `- ${field}: ${value}`);
  write(file, lines.join("\n"));
}

export function replaceSection(file: string, section: string, body: string): void {
  const content = read(file);
  const re = new RegExp(`(^## ${escapeRe(section)}\\b[^\\n]*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string) => `${heading}\n${body.trim()}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## ${section}\n\n${body.trim()}\n`;
  write(file, next);
}

export function appendNote(file: string, note: string): void {
  const content = read(file);
  const bullet = `- ${note}`;
  const re = /(^## Notes\b[^\n]*\n)([\s\S]*?)(?=^## |\Z)/m;
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string, body: string) => `${heading}${body}${body.endsWith("\n") ? "" : "\n"}${bullet}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## Notes\n\n${bullet}\n`;
  write(file, next);
}
