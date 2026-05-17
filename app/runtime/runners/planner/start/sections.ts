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
  const handoffSource = extractSectionLines(file, "Conversation Handoff")
    .map((line) => {
      const m = line.match(/^\s*-\s*Source:\s*(.+)$/);
      return m ? m[1].replace(/`/g, "").trim() : "";
    })
    .find(Boolean) ?? "";
  const handoffOrder = handoffSource.match(/tickets\/order\/order_[A-Za-z0-9._-]+\.md/)?.[0] || "";
  if (handoffOrder) return handoffOrder;

  for (const line of extractSectionLines(file, "Source")) {
    const m = line.match(/^\s*-\s*Order:\s*(.+)$/);
    const orderRef = (m?.[1] || "").replace(/`/g, "").trim();
    if (/^tickets\/order\/order_[A-Za-z0-9._-]+\.md$/.test(orderRef)) return orderRef;
  }

  const text = utils.readFileSafe(file);
  return text.match(/tickets\/order\/order_[A-Za-z0-9._-]+\.md/)?.[0] || "";
}
