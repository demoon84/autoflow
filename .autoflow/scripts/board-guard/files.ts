import {fs, path, BOARD_ROOT, TICKETS_ROOT, utils} from "./context";

export const TICKET_PATTERN = /^(Todo-d{3}|tickets_d{3}).md$/;

export function listFiles(dir: string, opts: { pattern?: RegExp; depth?: number } = {}): string[] {
    const out: string[] = [];
    const {pattern, depth = 1} = opts;
    const walk = (d: string, level: number): void => {
        if (level > depth) return;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, {withFileTypes: true});
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full, level + 1);
            else if (!pattern || pattern.test(e.name)) out.push(full);
        }
    };
    walk(dir, 1);
    return out;
}

export function guardTicketFiles(): string[] {
    const out: string[] = [];
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier"]) {
        const root = path.join(TICKETS_ROOT, dir);
        out.push(...listFiles(root, {pattern: TICKET_PATTERN, depth: 1}));
    }
    out.push(...listFiles(path.join(TICKETS_ROOT, "done"), {pattern: TICKET_PATTERN, depth: 5}));
    return out;
}

export function activeTicketFiles(): string[] {
    const out: string[] = [];
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier"]) {
        const root = path.join(TICKETS_ROOT, dir);
        out.push(...listFiles(root, {pattern: TICKET_PATTERN, depth: 1}));
    }
    return out;
}

export function ticketWorktreeBoardState(file: string): string {
    if (file.startsWith(path.join(TICKETS_ROOT, "todo")) ||
        file.startsWith(path.join(TICKETS_ROOT, "inprogress")) ||
        file.startsWith(path.join(TICKETS_ROOT, "ready-to-merge")) ||
        file.startsWith(path.join(TICKETS_ROOT, "merge-blocked")) ||
        file.startsWith(path.join(TICKETS_ROOT, "verifier"))) {
        return "active";
    }
    if (file.startsWith(path.join(TICKETS_ROOT, "done"))) return "done";
    return "unknown";
}

export function ticketFileForId(ref: string): string {
    const ticketNum = ref.replace(/^(Todo-|tickets_)/, "");
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier"]) {
        for (const prefix of ["Todo-", "tickets_"]) {
            const f = path.join(TICKETS_ROOT, dir, `${prefix}${ticketNum}.md`);
            if (fs.existsSync(f)) return f;
        }
    }
    const all = listFiles(path.join(TICKETS_ROOT, "done"), {
        pattern: new RegExp(`^(Todo-|tickets_)${ticketNum}\\.md$`),
        depth: 5
    });
    return all[0] || "";
}

export function sectionExists(file: string, section: string): boolean {
    const text = utils.readFileSafe(file);
    if (!text) return false;
    return text.split(/\r?\n/).some((line) => line === `## ${section}`);
}

export function fieldInSectionPresent(file: string, section: string, field: string): boolean {
    const text = utils.readFileSafe(file);
    if (!text) return false;
    const lines = text.split(/\r?\n/);
    let inSection = false;
    const fieldRe = new RegExp(`^\\s*[-*]\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
    for (const line of lines) {
        if (line === `## ${section}`) {
            inSection = true;
            continue;
        }
        if (/^## /.test(line) && inSection) {
            inSection = false;
            continue;
        }
        if (!inSection) continue;
        if (fieldRe.test(line)) return true;
    }
    return false;
}

export function markdownScalar(file: string, section: string, field: string): string {
    const v = utils.extractScalarFieldInSection(file, section, field);
    return v.replace(/\r/g, "").replace(/^`+|`+$/g, "").trim();
}

export function relPath(absPath: string): string {
    return path.relative(BOARD_ROOT, absPath);
}
