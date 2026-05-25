import {fs, type ProjectContext} from "../context";
import {runnerConfigPath} from "./paths";

export function stripTomlInlineComment(line: string): string {
    let quote = "";
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index] || "";
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

export function parseTomlScalar(raw: string): string {
    const value = stripTomlInlineComment(raw).trim();
    const doubleQuoted = value.match(/^"((?:\\"|[^"])*)"/);
    if (doubleQuoted) {
        return (doubleQuoted[1] || "").replace(/\\"/g, "\"");
    }
    const singleQuoted = value.match(/^'([^']*)'/);
    if (singleQuoted) {
        return singleQuoted[1] || "";
    }
    return value.split(/\s+/)[0] || "";
}

function parseRunnerConfigSection(
    lines: string[],
    tableId = "",
): Record<string, string> {
    const item: Record<string, string> = {};
    for (const line of lines) {
        const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/);
        if (!match) {
            continue;
        }
        item[match[1] || ""] = parseTomlScalar(match[2] || "");
    }
    if (tableId && !item.id) {
        item.id = tableId;
    }
    return item;
}

function parseRunnerConfigText(text: string): Array<Record<string, string>> {
    const items: Array<Record<string, string>> = [];
    let current: {tableId: string; lines: string[]} | null = null;
    const flush = () => {
        if (!current) return;
        const item = parseRunnerConfigSection(current.lines, current.tableId);
        if (item.id) {
            items.push(item);
        }
        current = null;
    };

    for (const rawLine of text.split(/\r?\n/)) {
        const line = stripTomlInlineComment(rawLine).trim();
        const arrayHeader = line.match(/^\[\[runners\]\]$/);
        const namedHeader = line.match(/^\[runners\.([^\]]+)\]$/);
        if (arrayHeader || namedHeader) {
            flush();
            current = {
                tableId: namedHeader ? parseTomlScalar(namedHeader[1] || "") : "",
                lines: [],
            };
            continue;
        }
        if (/^\[/.test(line)) {
            flush();
            continue;
        }
        if (current) {
            current.lines.push(rawLine);
        }
    }
    flush();
    return items;
}

export function parseRunnerConfig(ctx: ProjectContext): Array<Record<string, string>> {
    const config = runnerConfigPath(ctx);
    if (!fs.existsSync(config)) {
        return [];
    }
    const text = fs.readFileSync(config, "utf8");
    return parseRunnerConfigText(text);
}
