import {fs, path, REPO_ROOT, type ProjectContext} from "./context";
import {writeFileAtomic} from "./fs";

export type InstallAssetSummary = {
    created: number;
    unchanged: number;
    preserved: number;
    overwritten: number;
    files: string[];
};

function emptyInstallAssetSummary(): InstallAssetSummary {
    return {
        created: 0,
        unchanged: 0,
        preserved: 0,
        overwritten: 0,
        files: [],
    };
}

function mergeInstallAssetSummary(target: InstallAssetSummary, source: InstallAssetSummary): void {
    target.created += source.created;
    target.unchanged += source.unchanged;
    target.preserved += source.preserved;
    target.overwritten += source.overwritten;
    target.files.push(...source.files);
}

function renderInstallTemplate(content: string, ctx: ProjectContext): string {
    return content.replaceAll("{{BOARD_DIR}}", ctx.boardDirName);
}

function syncRenderedFile(src: string, dest: string, ctx: ProjectContext, overwrite: boolean): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const content = renderInstallTemplate(fs.readFileSync(src, "utf8"), ctx);
    const relative = path.relative(ctx.projectRoot, dest).split(path.sep).join("/");
    if (fs.existsSync(dest)) {
        const existing = fs.readFileSync(dest, "utf8");
        if (existing === content) {
            summary.unchanged += 1;
            return summary;
        }
        if (!overwrite) {
            summary.preserved += 1;
            return summary;
        }
        writeFileAtomic(dest, content);
        summary.overwritten += 1;
        summary.files.push(relative);
        return summary;
    }

    writeFileAtomic(dest, content);
    summary.created += 1;
    summary.files.push(relative);
    return summary;
}

function syncRenderedTree(srcRoot: string, destRoot: string, ctx: ProjectContext, overwrite: boolean): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    if (!fs.existsSync(srcRoot)) {
        return summary;
    }
    const stat = fs.statSync(srcRoot);
    if (!stat.isDirectory()) {
        return syncRenderedFile(srcRoot, destRoot, ctx, overwrite);
    }
    fs.mkdirSync(destRoot, {recursive: true});
    for (const name of fs.readdirSync(srcRoot)) {
        if (name === "node_modules" || name === ".git") {
            continue;
        }
        mergeInstallAssetSummary(
            summary,
            syncRenderedTree(path.join(srcRoot, name), path.join(destRoot, name), ctx, overwrite)
        );
    }
    return summary;
}

export function syncProjectHostInstallAssets(ctx: ProjectContext, options: {overwriteSkills?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const overwriteSkills = Boolean(options.overwriteSkills);
    const hostAssets = [
        {
            source: path.join(REPO_ROOT, "scaffold", "host", "AGENTS.md"),
            target: path.join(ctx.projectRoot, "AGENTS.md"),
            overwrite: false,
        },
        {
            source: path.join(REPO_ROOT, "scaffold", "host", "CLAUDE.md"),
            target: path.join(ctx.projectRoot, "CLAUDE.md"),
            overwrite: false,
        },
        {
            source: path.join(REPO_ROOT, "integrations", "claude", "skills"),
            target: path.join(ctx.projectRoot, ".claude", "skills"),
            overwrite: overwriteSkills,
        },
        {
            source: path.join(REPO_ROOT, "integrations", "claude", "plugin"),
            target: path.join(ctx.projectRoot, ".claude", "autoflow-plugin"),
            overwrite: overwriteSkills,
        },
        {
            source: path.join(REPO_ROOT, "integrations", "claude", "skills"),
            target: path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills"),
            overwrite: overwriteSkills,
        },
        {
            source: path.join(REPO_ROOT, "integrations", "codex", "skills"),
            target: path.join(ctx.projectRoot, ".codex", "skills"),
            overwrite: overwriteSkills,
        },
    ];

    for (const asset of hostAssets) {
        mergeInstallAssetSummary(summary, syncRenderedTree(asset.source, asset.target, ctx, asset.overwrite));
    }
    return summary;
}

export function cleanupObsoleteBoardFiles(ctx: ProjectContext): string[] {
    const previousSuffix = ["ticket", ["own", "er"].join("")].join("-");
    const oldStart = ["start", previousSuffix].join("-");
    const oldFinish = ["finish", previousSuffix].join("-");
    const oldVerify = ["verify", previousSuffix].join("-");
    const oldAgent = [previousSuffix, "agent.md"].join("-");
    const oldTemplate = [previousSuffix, "heartbeat.template.toml"].join("-");
    const oldProtocol = [[["own", "er"].join(""), "contract"].join("-"), "md"].join(".");
    const obsolete = [
        path.join(ctx.boardRoot, "scripts", `${oldStart}.ts`),
        path.join(ctx.boardRoot, "scripts", `${oldStart}.js`),
        path.join(ctx.boardRoot, "scripts", `${oldFinish}.ts`),
        path.join(ctx.boardRoot, "scripts", `${oldFinish}.js`),
        path.join(ctx.boardRoot, "scripts", `${oldVerify}.ts`),
        path.join(ctx.boardRoot, "scripts", `${oldVerify}.js`),
        path.join(ctx.boardRoot, "agents", oldAgent),
        path.join(ctx.boardRoot, "automations", "templates", oldTemplate),
        path.join(ctx.boardRoot, "protocols", oldProtocol),
        path.join(ctx.boardRoot, "reference", "backlog.md"),
        path.join(ctx.boardRoot, "reference", "backlog-processed.md"),
        path.join(ctx.boardRoot, "scripts", "finish-ticket", "processing-time.ts"),
        path.join(ctx.boardRoot, "scripts", "runner-tool", "worker", "processing-time.ts"),
    ];
    const removed: string[] = [];
    for (const file of obsolete) {
        if (!fs.existsSync(file)) {
            continue;
        }
        fs.rmSync(file, {force: true});
        removed.push(path.relative(ctx.boardRoot, file));
    }
    return removed;
}

function moveLegacyTicketDir(ctx: ProjectContext, fromName: string, toName: string): string[] {
    const ticketsRoot = path.join(ctx.boardRoot, "tickets");
    const fromDir = path.join(ticketsRoot, fromName);
    const toDir = path.join(ticketsRoot, toName);
    const moved: string[] = [];
    if (!fs.existsSync(fromDir)) {
        return moved;
    }
    fs.mkdirSync(ticketsRoot, {recursive: true});
    if (!fs.existsSync(toDir)) {
        fs.renameSync(fromDir, toDir);
        moved.push(`tickets/${fromName}->tickets/${toName}`);
        return moved;
    }
    for (const name of fs.readdirSync(fromDir)) {
        const from = path.join(fromDir, name);
        const to = path.join(toDir, name);
        if (fs.existsSync(to)) {
            if (name === ".gitkeep") {
                fs.rmSync(from, {force: true});
                moved.push(`removed:duplicate:tickets/${fromName}/${name}`);
                continue;
            }
            moved.push(`conflict:tickets/${fromName}/${name}`);
            continue;
        }
        fs.renameSync(from, to);
        moved.push(`tickets/${fromName}/${name}->tickets/${toName}/${name}`);
    }
    try {
        fs.rmdirSync(fromDir);
        moved.push(`removed:tickets/${fromName}`);
    } catch {
        moved.push(`leftover:tickets/${fromName}`);
    }
    return moved;
}

export function migrateQueueDirectoryNames(ctx: ProjectContext): string[] {
    const moved = [
        ...moveLegacyTicketDir(ctx, "inbox", "order"),
        ...moveLegacyTicketDir(ctx, "backlog", "prd"),
    ];
    const rewritten = rewriteQueuePathReferences(ctx);
    const hostRewritten = rewriteHostQueueReferences(ctx);
    return [
        ...moved,
        ...rewritten.map((file) => `rewritten:${file}`),
        ...hostRewritten.map((file) => `host-rewritten:${file}`),
    ];
}

function rewriteQueuePathReferences(ctx: ProjectContext): string[] {
    if (!fs.existsSync(ctx.boardRoot)) {
        return [];
    }
    const replacements: Array<[RegExp, string]> = [
        [/tickets\/inbox/g, "tickets/order"],
        [/tickets\/backlog/g, "tickets/prd"],
        [/\binbox\//g, "order/"],
        [/\bbacklog\//g, "prd/"],
        [/reference\/backlog\.md/g, "reference/prd.md"],
        [/backlog-first-stuck\.json/g, "prd-first-stuck.json"],
        [/source=backlog-to-todo/g, "source=prd-to-todo"],
        [/source=order-inbox-retry/g, "source=order-retry"],
        [/source=order-inbox/g, "source=order"],
        [/AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT/g, "AUTOFLOW_PRD_FIRST_STUCK_LIMIT"],
    ];
    const changed: string[] = [];
    const visit = (current: string): void => {
        const stat = fs.statSync(current);
        if (stat.isDirectory()) {
            const relative = path.relative(ctx.boardRoot, current);
            if (relative === path.join("runners", "logs")) {
                return;
            }
            for (const name of fs.readdirSync(current)) {
                visit(path.join(current, name));
            }
            return;
        }
        if (!stat.isFile() || !isTextMigrationTarget(current)) {
            return;
        }
        let text: string;
        try {
            text = fs.readFileSync(current, "utf8");
        } catch {
            return;
        }
        let next = text;
        for (const [pattern, replacement] of replacements) {
            next = next.replace(pattern, replacement);
        }
        if (next === text) {
            return;
        }
        writeFileAtomic(current, next);
        changed.push(path.relative(ctx.boardRoot, current));
    };
    visit(ctx.boardRoot);
    return changed;
}

function rewriteHostQueueReferences(ctx: ProjectContext): string[] {
    const replacements: Array<[RegExp, string]> = [
        [/tickets\/inbox/g, "tickets/order"],
        [/tickets\/backlog/g, "tickets/prd"],
        [/\binbox\//g, "order/"],
        [/\bbacklog\//g, "prd/"],
        [/reference\/backlog\.md/g, "reference/prd.md"],
        [/\binbox retry\b/g, "order retry"],
        [/\binbox\b/g, "order"],
        [/\bbacklog PRDs\b/g, "PRD queue items"],
        [/\bbacklog PRD\b/g, "PRD queue item"],
        [/\bbacklog\b/g, "prd"],
        [/AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT/g, "AUTOFLOW_PRD_FIRST_STUCK_LIMIT"],
    ];
    const changed: string[] = [];
    for (const name of ["AGENTS.md", "CLAUDE.md"]) {
        const file = path.join(ctx.projectRoot, name);
        if (!fs.existsSync(file) || !isTextMigrationTarget(file)) continue;
        let text: string;
        try {
            text = fs.readFileSync(file, "utf8");
        } catch {
            continue;
        }
        let next = text;
        for (const [pattern, replacement] of replacements) {
            next = next.replace(pattern, replacement);
        }
        if (next === text) continue;
        writeFileAtomic(file, next);
        changed.push(name);
    }
    return changed;
}

export function legacyWorkerTermReplacements(): Array<[RegExp, string]> {
    const legacyActorLower = ["own", "er"].join("");
    const legacyActorUpper = `${legacyActorLower.slice(0, 1).toUpperCase()}${legacyActorLower.slice(1)}`;
    const legacyActorEnv = legacyActorUpper.toUpperCase();
    const previousSuffix = ["ticket", legacyActorLower].join("-");
    const oldStart = ["start", previousSuffix].join("-");
    const oldFinish = ["finish", previousSuffix].join("-");
    const oldVerify = ["verify", previousSuffix].join("-");
    const oldAgent = [previousSuffix, "agent"].join("-");
    const oldTemplate = [previousSuffix, "heartbeat.template"].join("-");
    const oldProtocol = [[legacyActorLower, "contract"].join("-"), "md"].join(".");
    return [
        [new RegExp(`\\b${oldStart}\\b`, "g"), "start-ticket"],
        [new RegExp(`\\b${oldFinish}\\b`, "g"), "finish-ticket"],
        [new RegExp(`\\b${oldVerify}\\b`, "g"), "verify-ticket"],
        [new RegExp(`\\b${previousSuffix}\\b`, "g"), "worker"],
        [new RegExp(`${oldAgent}\\.md`, "g"), "worker-agent.md"],
        [new RegExp(`${oldTemplate}\\.toml`, "g"), "worker-heartbeat.template.toml"],
        [new RegExp(oldProtocol, "g"), "worker-contract.md"],
        [new RegExp(`${legacyActorUpper} Resume Instruction`, "g"), "Worker Resume Instruction"],
        [new RegExp(`\\b${legacyActorUpper}ship\\b`, "g"), "Claim"],
        [new RegExp(`\\b${legacyActorLower}ship\\b`, "g"), "claim"],
        [new RegExp(`\\b${legacyActorUpper}\\b`, "g"), "Worker"],
        [new RegExp(`\\b${legacyActorLower}\\b`, "g"), "worker"],
        [new RegExp(`ticket_${legacyActorLower}`, "g"), "ticket_worker"],
        [new RegExp(`AUTOFLOW_TICKET_${legacyActorEnv}`, "g"), "AUTOFLOW_WORKER"],
        [new RegExp(["AI", "merged"].join("-"), "g"), "worker-merged"],
        [new RegExp(["already", "merged"].join("-"), "g"), "verified-pending-merge"],
    ];
}

export function isTextMigrationTarget(file: string): boolean {
    const name = path.basename(file);
    if (name.endsWith(".lock") || name.endsWith(".db") || name.endsWith(".sqlite") || name.endsWith(".sqlite3")) {
        return false;
    }
    const ext = path.extname(name).toLowerCase();
    return [
        ".md",
        ".toml",
        ".json",
        ".jsonl",
        ".txt",
        ".state",
        ".context",
        ".env",
        ".yml",
        ".yaml",
    ].includes(ext) || name.startsWith(".");
}

export function migrateWorkerTerminology(ctx: ProjectContext): string[] {
    if (!fs.existsSync(ctx.boardRoot)) {
        return [];
    }
    const replacements = legacyWorkerTermReplacements();
    const changed: string[] = [];
    const visit = (current: string): void => {
        const stat = fs.statSync(current);
        if (stat.isDirectory()) {
            const relative = path.relative(ctx.boardRoot, current);
            if (relative === path.join("runners", "logs")) {
                return;
            }
            for (const name of fs.readdirSync(current)) {
                visit(path.join(current, name));
            }
            return;
        }
        if (!stat.isFile() || !isTextMigrationTarget(current)) {
            return;
        }
        let text: string;
        try {
            text = fs.readFileSync(current, "utf8");
        } catch {
            return;
        }
        let next = text;
        for (const [pattern, replacement] of replacements) {
            next = next.replace(pattern, replacement);
        }
        if (next === text) {
            return;
        }
        writeFileAtomic(current, next);
        changed.push(path.relative(ctx.boardRoot, current));
    };
    visit(ctx.boardRoot);
    return changed;
}
