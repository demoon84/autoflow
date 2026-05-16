import * as shared from "../../shared";

const {fs, path, out, fail, defaultBoardDirName, projectContext, ensureBoard, ensureDir, writeFileAtomic, parseArgs, firstFlag, allFlags, hasFlag, walkMarkdownFiles, oneLine} = shared;

type SkillContext = {
    projectRoot: string;
    boardDirName: string;
    boardRoot: string;
};

type SkillRecord = {
    key: string;
    name: string;
    category: string;
    source: "curated" | "local" | "archived" | "legacy";
    file: string;
    relPath: string;
    pinned: boolean;
};

function safeSegment(value: string, fallback = "skill"): string {
    const cleaned = value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || fallback;
}

function skillContext(positionals: string[]): SkillContext {
    return projectContext(
        positionals[0] || process.env.AUTOFLOW_PROJECT_ROOT || ".",
        positionals[1] || process.env.AUTOFLOW_BOARD_DIR_NAME || defaultBoardDirName()
    );
}

function frontmatter(text: string): Record<string, string> {
    if (!text.startsWith("---")) return {};
    const end = text.indexOf("\n---", 3);
    if (end < 0) return {};
    const values: Record<string, string> = {};
    for (const line of text.slice(3, end).split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*?)\s*$/);
        if (!match) continue;
        values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
}

function skillRecordFromFile(ctx: SkillContext, file: string, source: SkillRecord["source"], root: string): SkillRecord {
    const text = fs.readFileSync(file, "utf8");
    const meta = frontmatter(text);
    const relToRoot = path.relative(root, file).split(path.sep).join("/");
    const category = relToRoot.endsWith("/SKILL.md")
        ? relToRoot.split("/").slice(0, -2).join("/") || "general"
        : "legacy";
    const rawName = meta.name || meta.title || (relToRoot.endsWith("/SKILL.md") ? relToRoot.split("/").slice(-2, -1)[0] : path.basename(file, ".md"));
    const name = safeSegment(rawName, "skill");
    const key = category === "legacy" ? name : `${category}/${name}`;
    return {
        key,
        name,
        category,
        source,
        file,
        relPath: path.relative(ctx.boardRoot, file).split(path.sep).join("/"),
        pinned: /^true$/i.test(meta.pinned || ""),
    };
}

function collectSkills(ctx: SkillContext): SkillRecord[] {
    const curatedRoot = path.join(ctx.boardRoot, "wiki", "skills");
    const localRoot = path.join(ctx.boardRoot, "wiki", "skills-local");
    const archiveRoot = path.join(localRoot, ".archive");
    const records: SkillRecord[] = [];
    if (fs.existsSync(curatedRoot)) {
        for (const file of walkMarkdownFiles(curatedRoot)) {
            records.push(skillRecordFromFile(ctx, file, file.endsWith("/SKILL.md") ? "curated" : "legacy", curatedRoot));
        }
    }
    if (fs.existsSync(localRoot)) {
        for (const file of walkMarkdownFiles(localRoot)) {
            if (file.includes(`${path.sep}.archive${path.sep}`)) continue;
            if (file.endsWith(`${path.sep}SKILL.md`)) {
                records.push(skillRecordFromFile(ctx, file, "local", localRoot));
            }
        }
    }
    if (fs.existsSync(archiveRoot)) {
        for (const file of walkMarkdownFiles(archiveRoot)) {
            if (file.endsWith(`${path.sep}SKILL.md`)) {
                records.push(skillRecordFromFile(ctx, file, "archived", archiveRoot));
            }
        }
    }
    return records.sort((a, b) => a.key.localeCompare(b.key) || a.source.localeCompare(b.source));
}

function findSkill(ctx: SkillContext, selector: string): SkillRecord {
    const wanted = selector.toLowerCase();
    const records = collectSkills(ctx);
    const match = records.find((record) => [
        record.key,
        record.name,
        `${record.category}/${record.name}`,
        record.relPath,
        path.basename(record.file, ".md"),
    ].map((value) => value.toLowerCase()).includes(wanted));
    return match || fail(`Skill not found: ${selector}`);
}

function readUsage(ctx: SkillContext): Record<string, Record<string, unknown>> {
    const file = path.join(ctx.boardRoot, "wiki", "skills-local", ".usage.json");
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as Record<string, Record<string, unknown>>
            : {};
    } catch {
        return {};
    }
}

function writeUsage(ctx: SkillContext, usage: Record<string, Record<string, unknown>>): void {
    writeFileAtomic(path.join(ctx.boardRoot, "wiki", "skills-local", ".usage.json"), `${JSON.stringify(usage, null, 2)}\n`);
}

function resolveTicket(ctx: SkillContext, ref: string): string {
    const direct = path.resolve(ref);
    if (fs.existsSync(direct)) return direct;
    const normalized = ref.match(/^Todo-\d+/i)?.[0] || ref.match(/^\d+$/)?.[0] || ref;
    const candidates = [
        path.join(ctx.boardRoot, "tickets", "inprogress", `${normalized}.md`),
        path.join(ctx.boardRoot, "tickets", "todo", `${normalized}.md`),
        path.join(ctx.boardRoot, "tickets", "verifier", `${normalized}.md`),
        ...walkMarkdownFiles(path.join(ctx.boardRoot, "tickets", "done")).filter((file) => path.basename(file, ".md") === normalized),
    ];
    return candidates.find((file) => fs.existsSync(file)) || fail(`Ticket not found: ${ref}`);
}

function ticketTitle(text: string, fallback: string): string {
    const scalar = text.match(/^\s*Title:\s*(.+)$/m)?.[1]?.trim();
    if (scalar) return scalar;
    return text.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function createSkill(ctx: SkillContext, parsed: ReturnType<typeof parseArgs>): void {
    if (/^(0|false|off)$/i.test(process.env.AUTOFLOW_SKILL_AUTO_EXTRACT || "")) {
        out("status=skipped");
        out("reason=skill_auto_extract_disabled");
        return;
    }
    const ticketRef = firstFlag(parsed, "from-ticket") || fail("Usage: autoflow skill create <project-root> <board-dir-name> --from-ticket <ticket>");
    const ticketFile = resolveTicket(ctx, ticketRef);
    const ticketText = fs.readFileSync(ticketFile, "utf8");
    const ticketId = path.basename(ticketFile, ".md");
    const patternType = safeSegment(firstFlag(parsed, "pattern-type") || "ticket_completion", "ticket_completion");
    const name = safeSegment(firstFlag(parsed, "name") || ticketId, ticketId);
    const file = path.join(ctx.boardRoot, "wiki", "skills-local", patternType, name, "SKILL.md");
    if (fs.existsSync(file) && !hasFlag(parsed, "force")) {
        out("status=skipped");
        out("reason=skill_exists");
        out(`skill_path=${file}`);
        return;
    }
    const title = ticketTitle(ticketText, ticketId);
    const createdAt = new Date().toISOString();
    const body = `---
name: "${name}"
description: "Learned from ${ticketId}: ${oneLine(title, 120).replace(/"/g, "'")}"
pattern_type: "${patternType}"
pinned: false
created_at: "${createdAt}"
created_from_ticket: "${ticketId}"
source_ticket_path: "${path.relative(ctx.boardRoot, ticketFile).split(path.sep).join("/")}"
---

# ${title}

## Context
- Source ticket: ${ticketId}
- Extracted at: ${createdAt}

## Pattern
Review the source ticket before using this skill. This generated entry is a durable placeholder for a recurring implementation or recovery pattern observed during ticket completion.
`;
    writeFileAtomic(file, body);
    out("status=ok");
    out("operation=create");
    out(`skill_path=${file}`);
    out(`ticket_path=${ticketFile}`);
}

function validateSkill(record: SkillRecord): {ok: boolean; reason: string} {
    const text = fs.readFileSync(record.file, "utf8");
    const stat = fs.statSync(record.file);
    if (stat.size > 1024 * 1024) return {ok: false, reason: "file_too_large"};
    if (text.length > 100 * 1024) return {ok: false, reason: "body_too_large"};
    if (!text.trim()) return {ok: false, reason: "empty_body"};
    if (!frontmatter(text).name && !frontmatter(text).title) return {ok: false, reason: "missing_name"};
    return {ok: true, reason: "ok"};
}

export function skillProject(args: string[]): void {
    const subcmd = args.shift() || "list";
    const parsed = parseArgs(args);
    const ctx = skillContext(parsed.positionals);
    ensureBoard(ctx);
    switch (subcmd) {
        case "list": {
            const records = collectSkills(ctx);
            out("status=ok");
            out(`skill_count=${records.length}`);
            records.forEach((record, index) => {
                const prefix = `skill.${index + 1}`;
                out(`${prefix}.key=${record.key}`);
                out(`${prefix}.source=${record.source}`);
                out(`${prefix}.path=${record.relPath}`);
                out(`${prefix}.pinned=${record.pinned ? "true" : "false"}`);
            });
            break;
        }
        case "view": {
            const record = findSkill(ctx, parsed.positionals[2] || fail("Skill selector required"));
            const usage = readUsage(ctx);
            const entry = usage[record.key] || {};
            entry.view_count = Number(entry.view_count || 0) + 1;
            entry.last_viewed_at = new Date().toISOString();
            usage[record.key] = entry;
            writeUsage(ctx, usage);
            out("status=ok");
            out(`skill_key=${record.key}`);
            out(`skill_path=${record.file}`);
            out("content_begin");
            process.stdout.write(fs.readFileSync(record.file, "utf8"));
            if (!fs.readFileSync(record.file, "utf8").endsWith("\n")) process.stdout.write("\n");
            out("content_end");
            break;
        }
        case "validate": {
            const record = findSkill(ctx, parsed.positionals[2] || fail("Skill selector required"));
            const result = validateSkill(record);
            out(`status=${result.ok ? "ok" : "fail"}`);
            out(`reason=${result.reason}`);
            out(`skill_path=${record.file}`);
            break;
        }
        case "archive": {
            const record = findSkill(ctx, parsed.positionals[2] || fail("Skill selector required"));
            if (record.source !== "local") fail("Only agent-created local skills can be archived.");
            if (record.pinned) fail("Pinned skills cannot be archived.");
            const target = path.join(ctx.boardRoot, "wiki", "skills-local", ".archive", record.category, record.name, "SKILL.md");
            ensureDir(path.dirname(target));
            fs.renameSync(record.file, target);
            out("status=ok");
            out("operation=archive");
            out(`skill_path=${target}`);
            break;
        }
        case "match": {
            const keywords = [
                ...allFlags(parsed, "keyword"),
                ...(firstFlag(parsed, "keywords") || "").split(/[\s,]+/),
            ].map((item) => item.toLowerCase()).filter(Boolean);
            const records = collectSkills(ctx).filter((record) => {
                if (keywords.length === 0) return true;
                const text = `${record.key}\n${fs.readFileSync(record.file, "utf8")}`.toLowerCase();
                return keywords.every((keyword) => text.includes(keyword));
            });
            out("status=ok");
            out(`match_count=${records.length}`);
            records.forEach((record, index) => {
                out(`match.${index + 1}.key=${record.key}`);
                out(`match.${index + 1}.path=${record.relPath}`);
            });
            break;
        }
        case "update-stats": {
            const record = findSkill(ctx, parsed.positionals[2] || fail("Skill selector required"));
            const result = firstFlag(parsed, "result") || "used";
            const usage = readUsage(ctx);
            const entry = usage[record.key] || {};
            entry.use_count = Number(entry.use_count || 0) + 1;
            if (result === "pass") entry.pass_count = Number(entry.pass_count || 0) + 1;
            if (result === "fail") entry.fail_count = Number(entry.fail_count || 0) + 1;
            entry.last_result = result;
            entry.last_used_at = new Date().toISOString();
            usage[record.key] = entry;
            writeUsage(ctx, usage);
            out("status=ok");
            out(`skill_key=${record.key}`);
            out(`result=${result}`);
            break;
        }
        case "create":
        case "auto-extract":
            createSkill(ctx, parsed);
            break;
        case "curator-status":
        case "curator-run": {
            if (/^(0|false|off)$/i.test(process.env.AUTOFLOW_CURATOR_ENABLED || "")) {
                out("status=skipped");
                out("reason=curator_disabled");
                break;
            }
            const local = collectSkills(ctx).filter((record) => record.source === "local");
            const archived = collectSkills(ctx).filter((record) => record.source === "archived");
            if (subcmd === "curator-run") {
                writeFileAtomic(path.join(ctx.boardRoot, "runners", "state", "skill-curator.state"), [
                    `status=ok`,
                    `last_run_at=${new Date().toISOString()}`,
                    `local_skill_count=${local.length}`,
                    `archived_skill_count=${archived.length}`,
                    `auxiliary_client=true`,
                    `main_prompt_cache_touched=false`,
                    "",
                ].join("\n"));
            }
            out("status=ok");
            out(`local_skill_count=${local.length}`);
            out(`archived_skill_count=${archived.length}`);
            out("auxiliary_client=true");
            out("main_prompt_cache_touched=false");
            break;
        }
        default:
            fail(`Unknown skill command: ${subcmd}`);
    }
}
