import {fs} from "./context";

export function listMarkdownIds(dir: string, prefix: string): number[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const re = new RegExp(`^${prefix}_(\\d+)\\.md$`, "i");
    return fs.readdirSync(dir)
        .map((name) => name.match(re)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));
}

export function nextNumericId(dir: string, prefix: string, explicit?: string): string {
    if (explicit) {
        return explicit.padStart(3, "0");
    }
    const max = Math.max(0, ...listMarkdownIds(dir, prefix));
    return String(max + 1).padStart(3, "0");
}
