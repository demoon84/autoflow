import {fs, path, REPO_ROOT} from "./context";

type ManifestValue = string | boolean;
type ManifestSections = Map<string, Record<string, ManifestValue>>;

export type InstallSourceType = "board" | "host" | "user_share" | "user_home";
export type InstallSourceOverwrite = "never" | "upgrade" | "always";

export type InstallSourceEntry = {
    id: string;
    path: string;
    target: string;
    type: InstallSourceType;
    overwrite: InstallSourceOverwrite;
    template: boolean;
    skipShell: boolean;
};

function stripTomlComment(line: string): string {
    let quote = "";
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (quote) {
            if (char === "\\") {
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

function parseTomlStringValue(rawValue: string): string {
    const value = rawValue.trim();
    const quotedMatch = value.match(/^"((?:\\"|[^"])*)"|^'([^']*)'/);
    if (quotedMatch) {
        return (quotedMatch[1] || quotedMatch[2] || "").replace(/\\"/g, "\"");
    }
    return value.split(/\s+/)[0] || "";
}

function parseManifestValue(rawValue: string): ManifestValue {
    const value = rawValue.trim();
    if (value === "true") return true;
    if (value === "false") return false;
    return parseTomlStringValue(value);
}

function manifestPath(coreRoot = REPO_ROOT): string {
    return path.join(coreRoot, "install", "manifest.toml");
}

function readManifestSections(coreRoot = REPO_ROOT): ManifestSections {
    const sections: ManifestSections = new Map();
    const content = fs.readFileSync(manifestPath(coreRoot), "utf8");
    let currentSection = "";
    for (const rawLine of content.split(/\r?\n/)) {
        const line = stripTomlComment(rawLine).trim();
        if (!line) {
            continue;
        }

        const sectionMatch = line.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            if (!sections.has(currentSection)) {
                sections.set(currentSection, {});
            }
            continue;
        }

        if (!currentSection) {
            continue;
        }

        const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
        if (valueMatch) {
            const section = sections.get(currentSection) || {};
            section[valueMatch[1]] = parseManifestValue(valueMatch[2]);
            sections.set(currentSection, section);
        }
    }
    return sections;
}

function stringValue(values: Record<string, ManifestValue>, name: string, fallback = ""): string {
    const value = values[name];
    return typeof value === "string" ? value : fallback;
}

function booleanValue(values: Record<string, ManifestValue>, name: string, fallback: boolean): boolean {
    const value = values[name];
    return typeof value === "boolean" ? value : fallback;
}

function sourceType(value: string, id: string): InstallSourceType {
    if (value === "board" || value === "host" || value === "user_share" || value === "user_home") {
        return value;
    }
    throw new Error(`Invalid install source type for sources.${id}: ${value || "(missing)"}`);
}

function sourceOverwrite(value: string, id: string): InstallSourceOverwrite {
    if (value === "never" || value === "upgrade" || value === "always") {
        return value;
    }
    throw new Error(`Invalid install source overwrite for sources.${id}: ${value || "(missing)"}`);
}

export function installManifestValue(section: string, name: string, fallback: string, coreRoot = REPO_ROOT): string {
    try {
        const values = readManifestSections(coreRoot).get(section);
        const parsed = values ? stringValue(values, name) : "";
        return parsed || fallback;
    } catch {
        return fallback;
    }
}

export function readInstallSourceEntries(coreRoot = REPO_ROOT): InstallSourceEntry[] {
    const entries: InstallSourceEntry[] = [];
    for (const [section, values] of readManifestSections(coreRoot)) {
        if (!section.startsWith("sources.")) {
            continue;
        }
        const id = section.slice("sources.".length);
        const sourcePath = stringValue(values, "path");
        const target = stringValue(values, "target");
        if (!sourcePath) {
            throw new Error(`Missing path for install source: sources.${id}`);
        }
        if (!target) {
            throw new Error(`Missing target for install source: sources.${id}`);
        }
        const type = sourceType(stringValue(values, "type"), id);
        entries.push({
            id,
            path: sourcePath,
            target,
            type,
            overwrite: sourceOverwrite(stringValue(values, "overwrite", "upgrade"), id),
            template: booleanValue(values, "template", type === "host"),
            skipShell: booleanValue(values, "skip_shell", false),
        });
    }
    return entries;
}
