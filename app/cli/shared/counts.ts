import {fs, path, type ProjectContext} from "./context";

const ticketIdSource = "(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\\d+";
export const prdFilenameRe = new RegExp(`^PRD-${ticketIdSource}\\.md$`);
export const todoFilenameRe = new RegExp(`^TODO-${ticketIdSource}\\.md$`, "i");

export function countFiles(dir: string, pattern: RegExp): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    let count = 0;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            count += countFiles(full, pattern);
        } else if (pattern.test(name)) {
            count += 1;
        }
    }
    return count;
}

export function countTicketDirs(ctx: ProjectContext): Record<string, number> {
    const root = path.join(ctx.boardRoot, "tickets");
    const names = ["prd", "todo", "inprogress", "verifier", "done"];
    const counts: Record<string, number> = {};
    for (const name of names) {
        counts[name] = countFiles(path.join(root, name), /\.md$/);
    }
    return counts;
}

export function countTopLevelMarkdown(dir: string, pattern: RegExp): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    return fs.readdirSync(dir).filter((name) => pattern.test(name) && fs.statSync(path.join(dir, name)).isFile()).length;
}

export function fileContainsTicketStage(file: string, wantedStage: string): boolean {
    try {
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        let inTicket = false;
        for (const line of lines) {
            if (/^## Ticket\b/.test(line)) {
                inTicket = true;
                continue;
            }
            if (/^## /.test(line) && inTicket) {
                inTicket = false;
            }
            if (inTicket && line.trim() === `- Stage: ${wantedStage}`) {
                return true;
            }
        }
    } catch {
        return false;
    }
    return false;
}

export function countTicketStage(dir: string, wantedStage: string): number {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    return fs.readdirSync(dir)
        .filter((name) => todoFilenameRe.test(name))
        .filter((name) => fileContainsTicketStage(path.join(dir, name), wantedStage))
        .length;
}
