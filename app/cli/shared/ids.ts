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

function reservationDirForTicketsRoot(dir: string): string {
    return path.join(path.dirname(dir), "runners", "state", "id-reservations");
}

function listReservedIds(dir: string, prefix: string): number[] {
    const reservationsDir = reservationDirForTicketsRoot(dir);
    if (!fs.existsSync(reservationsDir)) {
        return [];
    }
    const prefixPattern = prefix === "prd" ? "(?:prd|project)" : escapeRe(prefix);
    const suffixPattern = prefix === "order" ? "(?:_retry_.*)?" : "";
    const re = new RegExp(`^${prefixPattern}_(\\d+)${suffixPattern}\\.lock$`, "i");
    const ids: number[] = [];
    for (const entry of fs.readdirSync(reservationsDir, {withFileTypes: true})) {
        if (!entry.isFile()) continue;
        const match = entry.name.match(re);
        if (!match) continue;
        const id = Number.parseInt(match[1], 10);
        if (Number.isFinite(id)) ids.push(id);
    }
    return ids;
}

function reserveNumericId(dir: string, prefix: string, id: string): boolean {
    const reservationsDir = reservationDirForTicketsRoot(dir);
    fs.mkdirSync(reservationsDir, {recursive: true});
    const reservationFile = path.join(reservationsDir, `${prefix}_${id}.lock`);
    try {
        fs.writeFileSync(reservationFile, `${process.pid}\n`, {flag: "wx"});
        return true;
    } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code) : "";
        if (code === "EEXIST") return false;
        throw error;
    }
}

export function nextNumericId(dir: string, prefix: string, explicit?: string): string {
    if (explicit) {
        return explicit.padStart(3, "0");
    }
    let candidate = Math.max(0, ...listMarkdownIds(dir, prefix), ...listReservedIds(dir, prefix)) + 1;
    for (let attempts = 0; attempts < 1000; attempts += 1) {
        const id = String(candidate).padStart(3, "0");
        if (reserveNumericId(dir, prefix, id)) return id;
        candidate += 1;
    }
    throw new Error(`Unable to reserve ${prefix} id after 1000 attempts`);
}
