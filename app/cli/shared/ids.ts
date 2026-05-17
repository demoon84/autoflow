import {fs, path} from "./context";

function escapeRe(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listMarkdownIds(dir: string, prefix: string): number[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const prefixPattern = prefix === "prd" ? "(?:prd|project)" : escapeRe(prefix);
    const suffixPattern = prefix === "order" ? "(?:_retry_.*)?" : "";
    const re = new RegExp(`^${prefixPattern}_(\\d+)${suffixPattern}\\.md$`, "i");
    const ids: number[] = [];
    const walk = (current: string): void => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const file = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(file);
                continue;
            }
            const match = entry.name.match(re);
            if (!match) {
                continue;
            }
            const id = Number.parseInt(match[1], 10);
            if (Number.isFinite(id)) {
                ids.push(id);
            }
        }
    };
    walk(dir);
    return ids;
}

export function nextNumericId(dir: string, prefix: string, explicit?: string): string {
    if (explicit) {
        return explicit.padStart(3, "0");
    }
    const max = Math.max(0, ...listMarkdownIds(dir, prefix));
    return String(max + 1).padStart(3, "0");
}
