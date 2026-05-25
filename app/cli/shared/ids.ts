import {fs, path} from "./context";

function escapeRe(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listMarkdownIds(dir: string, prefix: string): number[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const prefixPattern = prefix === "prd" ? "(?:prd|project)" : escapeRe(prefix);
    const re = new RegExp(`^${prefixPattern}[-_](?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?(\\d+)\\.md$`, "i");
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

export function ticketIdNamespace(projectRoot = process.cwd()): string {
    void projectRoot;
    return "";
}

function parseScopedMarkdownId(name: string, prefix: string): {namespace: string; numeric: number; id: string} | null {
    const prefixPattern = prefix === "prd" ? "(?:prd|project)" : escapeRe(prefix);
    const re = new RegExp(`^${prefixPattern}[-_]((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?)(\\d+)\\.md$`, "i");
    const match = name.match(re);
    if (!match) return null;
    const namespace = (match[1] || "").replace(/-$/, "").toLowerCase();
    const numeric = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numeric)) return null;
    const id = namespace ? `${namespace}-${String(numeric).padStart(3, "0")}` : String(numeric).padStart(3, "0");
    return {namespace, numeric, id};
}

function listScopedMarkdownIds(dir: string, prefix: string, namespace: string): number[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const ids: number[] = [];
    const wanted = namespace.toLowerCase();
    const walk = (current: string): void => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const file = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(file);
                continue;
            }
            const parsed = parseScopedMarkdownId(entry.name, prefix);
            if (parsed && parsed.namespace === wanted) {
                ids.push(parsed.numeric);
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
    const re = new RegExp(`^${prefixPattern}_(?:(?:[A-Za-z0-9][A-Za-z0-9_.-]*)_)?(\\d+)\\.lock$`, "i");
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

function listScopedReservedIds(dir: string, prefix: string, namespace: string): number[] {
    const reservationsDir = reservationDirForTicketsRoot(dir);
    if (!fs.existsSync(reservationsDir)) {
        return [];
    }
    const re = new RegExp(`^${escapeRe(prefix)}_${escapeRe(namespace)}_(\\d+)\\.lock$`, "i");
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

function reserveScopedId(dir: string, prefix: string, namespace: string, id: string): boolean {
    const reservationsDir = reservationDirForTicketsRoot(dir);
    fs.mkdirSync(reservationsDir, {recursive: true});
    const reservationFile = path.join(reservationsDir, `${prefix}_${namespace}_${id}.lock`);
    try {
        fs.writeFileSync(reservationFile, `${process.pid}\n`, {flag: "wx"});
        return true;
    } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code) : "";
        if (code === "EEXIST") return false;
        throw error;
    }
}

export function normalizeScopedTicketId(value: string, namespace = ""): string {
    const raw = String(value || "")
        .trim()
        .replace(/\.md$/i, "")
        .replace(/^(?:PRD|TODO|project|ticket)[-_]/i, "");
    const scoped = raw.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
    if (scoped) {
        return String(Number.parseInt(scoped[2], 10)).padStart(3, "0");
    }
    const numeric = raw.match(/(\d+)/);
    if (!numeric) return raw;
    const id = String(Number.parseInt(numeric[1], 10)).padStart(3, "0");
    return id;
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

export function nextNamespacedId(dir: string, prefix: string, projectRoot?: string, explicit?: string): string {
    void projectRoot;
    if (explicit) {
        return normalizeScopedTicketId(explicit);
    }
    return nextNumericId(dir, prefix);
}
