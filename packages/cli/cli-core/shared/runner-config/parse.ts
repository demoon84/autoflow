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

export function parseRunnerConfig(ctx: ProjectContext): Array<Record<string, string>> {
    const config = runnerConfigPath(ctx);
    if (!fs.existsSync(config)) {
        return [];
    }
    const text = fs.readFileSync(config, "utf8");
    const blocks = text.split(/\[\[runners\]\]/g).slice(1);
    return blocks.map((block) => {
        const item: Record<string, string> = {};
        for (const line of block.split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/);
            if (!match) {
                continue;
            }
            item[match[1] || ""] = parseTomlScalar(match[2] || "");
        }
        return item;
    }).filter((item) => item.id);
}
