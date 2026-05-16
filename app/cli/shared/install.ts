import {fs, path, REPO_ROOT, type ProjectContext} from "./context";
import {readInstallSourceEntries, type InstallSourceEntry} from "./manifest";
import {writeFileAtomic} from "./fs";

export type InstallAssetSummary = {
    created: number;
    unchanged: number;
    preserved: number;
    overwritten: number;
    files: string[];
};

export type HostGuidanceDrift = {
    file: string;
    status: "missing" | "ok" | "custom" | "stale";
    templateDrift: boolean;
    staleMatches: string[];
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

function hostGuidanceStaleMatches(text: string): string[] {
    const checks: Array<[string, RegExp]> = [
        ["legacy-script-entrypoint", /\b(?:scripts\/)?(?:runner-tool|start-ticket|verify-ticket|finish-ticket|merge-ready-ticket|update-wiki)\.ts\b/],
        ["legacy-runner-label", /\b(?:Plan AI|Planner AI|Impl AI|Wiki AI)\b/],
        ["verifier-ai-label", /\bVerifier AI\b/],
        ["coordinator-active-contract", /\b(?:autoflow runners start coordinator-1|coordinator runner remains reachable|new installs can opt in|looped coordinator)\b/i],
    ];
    return checks.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

function syncInstallFile(src: string, dest: string, ctx: ProjectContext, overwrite: boolean, renderTemplate: boolean): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const relative = path.relative(ctx.projectRoot, dest).split(path.sep).join("/");
    const content = renderTemplate ? renderInstallTemplate(fs.readFileSync(src, "utf8"), ctx) : fs.readFileSync(src);
    if (fs.existsSync(dest)) {
        const existing = renderTemplate ? fs.readFileSync(dest, "utf8") : fs.readFileSync(dest);
        if (existing instanceof Buffer && content instanceof Buffer ? existing.equals(content) : existing === content) {
            summary.unchanged += 1;
            return summary;
        }
        if (!overwrite) {
            summary.preserved += 1;
            return summary;
        }
        if (renderTemplate) {
            writeFileAtomic(dest, content as string);
        } else {
            fs.mkdirSync(path.dirname(dest), {recursive: true});
            fs.writeFileSync(dest, content);
        }
        summary.overwritten += 1;
        summary.files.push(relative);
        return summary;
    }

    if (renderTemplate) {
        writeFileAtomic(dest, content as string);
    } else {
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.writeFileSync(dest, content);
    }
    summary.created += 1;
    summary.files.push(relative);
    return summary;
}

function syncInstallTree(srcRoot: string, destRoot: string, ctx: ProjectContext, overwrite: boolean, renderTemplate: boolean, skipShell: boolean): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    if (!fs.existsSync(srcRoot)) {
        throw new Error(`Install source not found: ${srcRoot}`);
    }
    const stat = fs.statSync(srcRoot);
    if (!stat.isDirectory()) {
        return syncInstallFile(srcRoot, destRoot, ctx, overwrite, renderTemplate);
    }
    fs.mkdirSync(destRoot, {recursive: true});
    for (const name of fs.readdirSync(srcRoot)) {
        if (name === "node_modules" || name === ".git") {
            continue;
        }
        const src = path.join(srcRoot, name);
        if (skipShell && src.endsWith(".sh")) {
            continue;
        }
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(src, path.join(destRoot, name), ctx, overwrite, renderTemplate, skipShell)
        );
    }
    return summary;
}

function shouldOverwriteInstallSource(entry: InstallSourceEntry, upgrade: boolean): boolean {
    if (entry.overwrite === "always") return true;
    if (entry.overwrite === "upgrade") return upgrade;
    return false;
}

function sourcePath(entry: InstallSourceEntry): string {
    return path.join(REPO_ROOT, entry.path);
}

function targetPath(ctx: ProjectContext, entry: InstallSourceEntry): string {
    if (entry.target === "{{BOARD_ROOT}}") {
        return ctx.boardRoot;
    }
    const renderedTarget = renderInstallTemplate(entry.target, ctx);
    const base = entry.type === "board" ? ctx.boardRoot : ctx.projectRoot;
    return path.isAbsolute(renderedTarget) ? renderedTarget : path.join(base, renderedTarget);
}

export function detectHostGuidanceDrift(ctx: ProjectContext): HostGuidanceDrift[] {
    const hostGuidanceTargets = new Set(["AGENTS.md", "CLAUDE.md"]);
    const findings: HostGuidanceDrift[] = [];
    for (const entry of readInstallSourceEntries()) {
        if (entry.type !== "host" || !hostGuidanceTargets.has(entry.target)) {
            continue;
        }
        const dest = targetPath(ctx, entry);
        const file = path.relative(ctx.projectRoot, dest).split(path.sep).join("/");
        if (!fs.existsSync(dest)) {
            findings.push({
                file,
                status: "missing",
                templateDrift: true,
                staleMatches: [],
            });
            continue;
        }
        let expected = "";
        let existing = "";
        try {
            expected = entry.template ? renderInstallTemplate(fs.readFileSync(sourcePath(entry), "utf8"), ctx) : fs.readFileSync(sourcePath(entry), "utf8");
            existing = fs.readFileSync(dest, "utf8");
        } catch {
            findings.push({
                file,
                status: "missing",
                templateDrift: true,
                staleMatches: [],
            });
            continue;
        }
        const staleMatches = hostGuidanceStaleMatches(existing);
        const templateDrift = existing !== expected;
        findings.push({
            file,
            status: staleMatches.length > 0 ? "stale" : templateDrift ? "custom" : "ok",
            templateDrift,
            staleMatches,
        });
    }
    return findings;
}

export function syncBoardInstallAssets(ctx: ProjectContext, options: {overwrite?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const boardEntries = readInstallSourceEntries().filter((entry) => entry.type === "board");
    if (boardEntries.length === 0) {
        throw new Error("install/manifest.toml has no board install source.");
    }
    const upgrade = Boolean(options.overwrite);
    for (const entry of boardEntries) {
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry), targetPath(ctx, entry), ctx, shouldOverwriteInstallSource(entry, upgrade), entry.template, entry.skipShell)
        );
    }
    return summary;
}

export function syncProjectHostInstallAssets(ctx: ProjectContext, options: {overwriteSkills?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const overwriteSkills = Boolean(options.overwriteSkills);
    const hostEntries = readInstallSourceEntries().filter((entry) => entry.type === "host");
    for (const entry of hostEntries) {
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry), targetPath(ctx, entry), ctx, shouldOverwriteInstallSource(entry, overwriteSkills), entry.template, entry.skipShell)
        );
    }
    return summary;
}

export function cleanupObsoleteBoardFiles(ctx: ProjectContext): string[] {
    const previousSuffix = ["ticket", ["own", "er"].join("")].join("-");
    const oldAgent = [previousSuffix, "agent.md"].join("-");
    const oldTemplate = [previousSuffix, "heartbeat.template.toml"].join("-");
    const oldProtocol = [[["own", "er"].join(""), "contract"].join("-"), "md"].join(".");
    const obsolete = [
        path.join(ctx.boardRoot, "scripts"),
        path.join(ctx.boardRoot, "agents", "adapters", "README.md"),
        path.join(ctx.boardRoot, "agents", "adapters", "opencode.md"),
        path.join(ctx.boardRoot, "agents", "coordinator-agent.md"),
        path.join(ctx.boardRoot, "agents", "merge-bot-agent.md"),
        path.join(ctx.boardRoot, "agents", "todo-queue-agent.md"),
        path.join(ctx.boardRoot, "agents", oldAgent),
        path.join(ctx.boardRoot, "automations", "templates", oldTemplate),
        path.join(ctx.boardRoot, "protocols", oldProtocol),
        path.join(ctx.boardRoot, "reference", "backlog.md"),
        path.join(ctx.boardRoot, "reference", "backlog-processed.md"),
    ];
    const removed: string[] = [];
    for (const file of obsolete) {
        if (!fs.existsSync(file)) {
            continue;
        }
        fs.rmSync(file, {recursive: true, force: true});
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
            if (relative === path.join("runners", "logs") || relative === path.join("runners", "state", "wiki-embed-models")) {
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
            if (relative === path.join("runners", "logs") || relative === path.join("runners", "state", "wiki-embed-models")) {
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
