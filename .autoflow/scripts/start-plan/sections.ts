import {utils} from "./context";

export function extractSectionLines(file: string, heading: string): string[] {
  return extractSectionText(file, heading).split(/\r?\n/);
}

export function extractSectionText(file: string, heading: string): string {
  const text = utils.readFileSafe(file);
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (line === `## ${heading}`) {
      inSection = true;
      continue;
    }
    if (inSection && /^## /.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join("\n").trimEnd();
}

export function extractBulletSection(file: string, heading: string): string[] {
  return extractSectionLines(file, heading)
    .map((line) => {
      const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      return m ? m[1].replace(/`/g, "").trim() : "";
    })
    .filter((value) => value && value !== "...");
}

export function extractChecklist(file: string, heading: string): string[] {
  return extractSectionLines(file, heading).filter((line) => /^\s*-\s*\[[ xX]\]/.test(line));
}

export function extractSpecSourceOrderRef(file: string): string {
  return extractSectionLines(file, "Conversation Handoff")
    .map((line) => {
      const m = line.match(/^\s*-\s*Source:\s*(.+)$/);
      return m ? m[1].replace(/`/g, "").trim() : "";
    })
    .find(Boolean) ?? "";
}
