import {utils} from "./context";

export type SplitMapEntry = {
  title: string;
  fields: Record<string, string[]>;
  index: number;
};

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

function canonicalSplitField(raw: string): string {
  const key = raw.toLowerCase().replace(/[`*_]/g, "").replace(/[\s-]+/g, " ").trim();
  const compact = key.replace(/\s+/g, "");
  const aliases: Record<string, string> = {
    title: "title",
    name: "title",
    prd: "title",
    todo: "title",
    ticket: "title",
    제목: "title",
    goal: "goal",
    목표: "goal",
    scope: "scope",
    "in scope": "scope",
    범위: "scope",
    allowedpaths: "allowed_paths",
    allowedpath: "allowed_paths",
    paths: "allowed_paths",
    path: "allowed_paths",
    files: "allowed_paths",
    file: "allowed_paths",
    허용경로: "allowed_paths",
    verification: "verification",
    command: "verification",
    test: "verification",
    검증: "verification",
    donewhen: "done_when",
    acceptancecriteria: "done_when",
    criteria: "done_when",
    완료조건: "done_when",
    notes: "notes",
    note: "notes",
    risk: "notes",
    hints: "notes",
    hint: "notes",
    메모: "notes",
    depends: "depends_on",
    dependson: "depends_on",
    dependency: "depends_on",
    depends_on: "depends_on",
  };
  return aliases[key] || aliases[compact] || "";
}

function listLineValue(line: string): { indent: number; value: string } | null {
  const match = line.match(/^(\s*)(?:[-*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/);
  if (!match) return null;
  return { indent: match[1].length, value: match[2].trim() };
}

function parseFieldSegment(segment: string): { key: string; value: string } | null {
  const match = segment.match(/^([^:]{1,48}):\s*(.*)$/);
  if (!match) return null;
  const key = canonicalSplitField(match[1]);
  if (!key) return null;
  return { key, value: match[2].trim() };
}

function addSplitField(entry: SplitMapEntry, key: string, value: string): void {
  const clean = value.trim();
  if (!clean || clean === "TBD" || clean === "...") return;
  if (!entry.fields[key]) entry.fields[key] = [];
  entry.fields[key].push(clean);
  if (key === "title" && !entry.title) entry.title = clean;
}

function addSplitValue(entry: SplitMapEntry, value: string): void {
  const segments = value.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  let consumedField = false;
  for (const segment of segments) {
    const field = parseFieldSegment(segment);
    if (field) {
      addSplitField(entry, field.key, field.value);
      consumedField = true;
    } else if (!consumedField && !entry.title) {
      entry.title = segment;
    } else if (segment) {
      addSplitField(entry, "notes", segment);
    }
  }
}

export function extractSplitMap(file: string, headings: string[]): SplitMapEntry[] {
  const lines = headings.flatMap((heading) => extractSectionLines(file, heading));
  const entries: SplitMapEntry[] = [];
  let current: SplitMapEntry | null = null;

  function startEntry(value: string): void {
    current = { title: "", fields: {}, index: entries.length + 1 };
    addSplitValue(current, value);
    if (!current.title) current.title = current.fields.goal?.[0] || current.fields.scope?.[0] || `Split ${current.index}`;
    entries.push(current);
  }

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const list = listLineValue(rawLine);
    const value = list ? list.value : rawLine.trim();
    const isTopLevel = list ? list.indent === 0 : !/^\s/.test(rawLine);
    if (isTopLevel) {
      startEntry(value);
      continue;
    }
    if (!current) startEntry(value);
    else addSplitValue(current, value);
  }

  return entries.filter((entry) => entry.title || Object.keys(entry.fields).length > 0);
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
