import fsSync from "node:fs";
import path from "node:path";

function scaffoldManifestPath(): string {
  const repoRoot = process.env.AUTOFLOW_REPO_ROOT || "";
  return path.join(repoRoot, "install", "manifest.toml");
}

export function stripTomlComment(line: string): string {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

export function parseTomlStringValue(rawValue: string): string {
  const value = rawValue.trim();
  const quotedMatch = value.match(/^"((?:\\"|[^"])*)"|^'([^']*)'/);
  if (quotedMatch) {
    return (quotedMatch[1] || quotedMatch[2] || "").replace(/\\"/g, "\"");
  }
  return value.split(/\s+/)[0] || "";
}

export function parseTomlManifestScalar(rawValue: string): string | boolean {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  return parseTomlStringValue(value);
}

export function scaffoldManifestValue(section: string, name: string, fallback: string): string {
  try {
    const content = fsSync.readFileSync(scaffoldManifestPath(), "utf8");
    let currentSection = "";

    for (const rawLine of content.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }

      if (currentSection !== section) continue;

      const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (valueMatch && valueMatch[1] === name) {
        const parsed = parseTomlStringValue(valueMatch[2]);
        return parsed || fallback;
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export type ScaffoldSourceEntry = {
  id: string;
  path: string;
  target: string;
  type: string;
  template: boolean;
};

export function readScaffoldManifestSourceEntries(): ScaffoldSourceEntry[] {
  const entries: ScaffoldSourceEntry[] = [];
  try {
    const content = fsSync.readFileSync(scaffoldManifestPath(), "utf8");
    const sections = new Map<string, Record<string, string | boolean>>();
    let currentSection = "";

    for (const rawLine of content.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        if (!sections.has(currentSection)) {
          sections.set(currentSection, {});
        }
        continue;
      }

      if (!currentSection) continue;

      const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (valueMatch) {
        const section = sections.get(currentSection) || {};
        section[valueMatch[1]] = parseTomlManifestScalar(valueMatch[2]);
        sections.set(currentSection, section);
      }
    }

    for (const [section, values] of sections) {
      if (!section.startsWith("sources.")) continue;
      const sourcePath = typeof values.path === "string" ? values.path : "";
      const target = typeof values.target === "string" ? values.target : "";
      const type = typeof values.type === "string" ? values.type : "";
      if (!sourcePath || !target || !type) continue;
      entries.push({
        id: section.slice("sources.".length),
        path: sourcePath,
        target,
        type,
        template: typeof values.template === "boolean" ? values.template : type === "host"
      });
    }
  } catch {
    return [];
  }
  return entries;
}
