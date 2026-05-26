import * as os from "node:os";
import {fs, path, REPO_ROOT, SHARE_ROOT, type ProjectContext} from "./context";
import {readInstallSourceEntries, type InstallSourceEntry} from "./manifest";
import {writeFileAtomic} from "./fs";
import {coreBundledShareRoot, resolveAutoflowCore, type ResolvedAutoflowCore} from "./core";

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

export type ViteSidecarWatchIgnoreStatus = "not_detected" | "created" | "updated" | "unchanged" | "skipped" | "error";

export type ViteSidecarWatchIgnoreSummary = {
    status: ViteSidecarWatchIgnoreStatus;
    files: string[];
    skipped: string[];
    patterns: string[];
    reason: string;
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

function renderInstallTemplate(content: string, ctx: ProjectContext, core: ResolvedAutoflowCore = resolveAutoflowCore(ctx)): string {
    return content
        .replaceAll("{{BOARD_DIR}}", ctx.boardDirName)
        .replaceAll("{{SHARE_ROOT}}", core.shareRoot)
        .replaceAll("{{CORE_ROOT}}", core.coreRoot)
        .replaceAll("{{RUNTIME_ROOT}}", core.runtimeRoot)
        .replaceAll("{{INSTALL_ROOT}}", core.installRoot)
        .replaceAll("{{CODEX_HOME}}", codexHomeRoot())
        .replaceAll("{{CLAUDE_HOME}}", claudeHomeRoot())
        .replaceAll("{{USER_HOME}}", os.homedir());
}

function hostGuidanceStaleMatches(text: string): string[] {
    const checks: Array<[string, RegExp]> = [
        ["legacy-script-entrypoint", /\b(?:scripts\/)?(?:runner-tool|start-ticket|verify-ticket|finish-ticket|update-wiki)\.ts\b/],
        ["legacy-runner-label", /\b(?:Plan AI|Planner AI|Impl AI|Wiki AI)\b/],
        ["verifier-ai-label", /\bVerifier AI\b/],
        ["coordinator-active-contract", /\b(?:autoflow runners start coordinator-1|coordinator runner remains reachable|new installs can opt in|looped coordinator)\b/i],
        ["legacy-aprd-atodo-trigger", /(?:#|\/|\$)(?:aprd|atodo)\b/i],
        ["legacy-4-runner-flow", /\b4-runner\b|기본\s*4[- ]runner/i],
        ["legacy-db-wiki", /\bwiki-search\.db\b|DB-only|wiki_chunks/i],
        ["legacy-work-lane", /\btickets\/work\/|Work ticket|work ticket/i],
        ["legacy-goal-trigger", /\b(?:create_goal|update_goal|get_goal)\b|(?:^|[^A-Za-z0-9_])\/goal\b|Goal Acceptance|goal complete|goal 기능|goal 활성화/i],
    ];
    return checks.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

function installSummaryPath(ctx: ProjectContext, dest: string): string {
    const relative = path.relative(ctx.projectRoot, dest).split(path.sep).join("/");
    return relative.startsWith("../") || relative === ".." ? dest : relative;
}

function syncInstallFile(src: string, dest: string, ctx: ProjectContext, overwrite: boolean, renderTemplate: boolean, core: ResolvedAutoflowCore): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const relative = installSummaryPath(ctx, dest);
    const content = renderTemplate ? renderInstallTemplate(fs.readFileSync(src, "utf8"), ctx, core) : fs.readFileSync(src);
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

function syncInstallTree(srcRoot: string, destRoot: string, ctx: ProjectContext, overwrite: boolean, renderTemplate: boolean, skipShell: boolean, core: ResolvedAutoflowCore): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    if (!fs.existsSync(srcRoot)) {
        throw new Error(`Install source not found: ${srcRoot}`);
    }
    const stat = fs.statSync(srcRoot);
    if (!stat.isDirectory()) {
        return syncInstallFile(srcRoot, destRoot, ctx, overwrite, renderTemplate, core);
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
            syncInstallTree(src, path.join(destRoot, name), ctx, overwrite, renderTemplate, skipShell, core)
        );
    }
    return summary;
}

function shouldOverwriteInstallSource(entry: InstallSourceEntry, upgrade: boolean): boolean {
    if (entry.overwrite === "always") return true;
    if (entry.overwrite === "upgrade") return upgrade;
    return false;
}

function sourcePath(entry: InstallSourceEntry, coreRoot = REPO_ROOT): string {
    return path.join(coreRoot, entry.path);
}

function sameResolvedPath(left: string, right: string): boolean {
    const normalize = (value: string): string => path.resolve(value || "").replace(/[\\/]+$/, "");
    return normalize(left) === normalize(right);
}

function coreUsesBundledShare(core: ResolvedAutoflowCore): boolean {
    return sameResolvedPath(core.shareRoot, coreBundledShareRoot(core.coreRoot));
}

function targetPath(ctx: ProjectContext, entry: InstallSourceEntry, core: ResolvedAutoflowCore = resolveAutoflowCore(ctx)): string {
    if (entry.target === "{{BOARD_ROOT}}") {
        return ctx.boardRoot;
    }
    if (entry.target === "{{USER_SHARE_ROOT}}") {
        return core.shareRoot;
    }
    const renderedTarget = renderInstallTemplate(entry.target, ctx, core);
    if (entry.type === "user_share") {
        return path.isAbsolute(renderedTarget) ? renderedTarget : path.join(core.shareRoot, renderedTarget);
    }
    if (entry.type === "user_home") {
        return path.isAbsolute(renderedTarget) ? renderedTarget : path.join(os.homedir(), renderedTarget);
    }
    const base = entry.type === "board" ? ctx.boardRoot : ctx.projectRoot;
    return path.isAbsolute(renderedTarget) ? renderedTarget : path.join(base, renderedTarget);
}

export function codexHomeRoot(): string {
    const override = process.env.CODEX_HOME;
    return override && override.trim() ? path.resolve(override) : path.join(os.homedir(), ".codex");
}

export function claudeHomeRoot(): string {
    const override = process.env.CLAUDE_HOME || process.env.CLAUDE_CONFIG_DIR;
    return override && override.trim() ? path.resolve(override) : path.join(os.homedir(), ".claude");
}

export function detectHostGuidanceDrift(ctx: ProjectContext): HostGuidanceDrift[] {
    const hostGuidanceTargets = new Set(["AGENTS.md", "CLAUDE.md"]);
    const findings: HostGuidanceDrift[] = [];
    const core = resolveAutoflowCore(ctx);
    for (const entry of readInstallSourceEntries(core.coreRoot)) {
        if (entry.type !== "host" || !hostGuidanceTargets.has(entry.target)) {
            continue;
        }
        const dest = targetPath(ctx, entry, core);
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
            expected = entry.template ? renderInstallTemplate(fs.readFileSync(sourcePath(entry, core.coreRoot), "utf8"), ctx, core) : fs.readFileSync(sourcePath(entry, core.coreRoot), "utf8");
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
    const core = resolveAutoflowCore(ctx);
    const boardEntries = readInstallSourceEntries(core.coreRoot).filter((entry) => entry.type === "board");
    if (boardEntries.length === 0) {
        throw new Error("install/manifest.toml has no board install source.");
    }
    const upgrade = Boolean(options.overwrite);
    for (const entry of boardEntries) {
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry, core.coreRoot), targetPath(ctx, entry, core), ctx, shouldOverwriteInstallSource(entry, upgrade), entry.template, entry.skipShell, core)
        );
    }
    return summary;
}

export function syncUserShareInstallAssets(ctx: ProjectContext, options: {overwrite?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const core = resolveAutoflowCore(ctx);
    if (coreUsesBundledShare(core)) {
        return summary;
    }
    const shareEntries = readInstallSourceEntries(core.coreRoot).filter((entry) => entry.type === "user_share");
    if (shareEntries.length === 0) {
        return summary;
    }
    const upgrade = Boolean(options.overwrite);
    fs.mkdirSync(core.shareRoot, {recursive: true});
    for (const entry of shareEntries) {
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry, core.coreRoot), targetPath(ctx, entry, core), ctx, shouldOverwriteInstallSource(entry, upgrade), entry.template, entry.skipShell, core)
        );
    }
    return summary;
}

export function cleanupObsoleteUserShareFiles(ctx: ProjectContext): string[] {
    const core = resolveAutoflowCore(ctx);
    if (coreUsesBundledShare(core)) {
        return [];
    }
    const obsolete = [
        path.join(core.shareRoot, "reference", "ticket-template.md"),
        path.join(core.shareRoot, "reference", "todo-template.md"),
        path.join(core.shareRoot, "reference", "hook-logs.md"),
        path.join(core.shareRoot, "protocols", "recovery.md"),
    ];
    const removed: string[] = [];
    for (const file of obsolete) {
        if (!fs.existsSync(file)) continue;
        fs.rmSync(file, {recursive: true, force: true});
        removed.push(path.relative(core.shareRoot, file).split(path.sep).join("/"));
    }
    return removed;
}

export function migrateRunnerConfigToLocal(ctx: ProjectContext): string[] {
    const core = resolveAutoflowCore(ctx);
    const local = path.join(ctx.boardRoot, "runners", "config.local.toml");
    const legacy = path.join(ctx.boardRoot, "runners", "config.toml");
    const template = path.join(core.shareRoot, "reference", "runners", "config.toml");
    const changed: string[] = [];
    const readIfExists = (file: string): string => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const templateText = readIfExists(template);
    const matchesTemplate = (text: string): boolean => Boolean(templateText) && text === templateText;
    const hasDeprecatedRunnerArrayConfig = (text: string): boolean => /\[\[runners\]\]/.test(text);

    fs.mkdirSync(path.dirname(local), {recursive: true});
    if (fs.existsSync(legacy)) {
        fs.rmSync(legacy, {force: true});
        changed.push("removed:runners/config.toml");
    }

    if (fs.existsSync(local)) {
        const text = fs.readFileSync(local, "utf8");
        if (hasDeprecatedRunnerArrayConfig(text)) {
            fs.rmSync(local, {force: true});
            changed.push("removed:runners/config.local.toml:default-runner-config");
        } else if (matchesTemplate(text)) {
            fs.rmSync(local, {force: true});
            changed.push("removed:runners/config.local.toml:matches-global-default");
        }
    }

    const oldBackup = path.join(ctx.boardRoot, "runners", "state", "config.local.legacy-runners.toml");
    const previousBackup = path.join(ctx.boardRoot, "runners", "state", "config.local.previous-runners.toml");
    if (fs.existsSync(oldBackup)) {
        fs.rmSync(oldBackup, {force: true});
        changed.push("removed:runners/state/config.local.legacy-runners.toml");
    }
    if (fs.existsSync(previousBackup)) {
        fs.rmSync(previousBackup, {force: true});
        changed.push("removed:runners/state/config.local.previous-runners.toml");
    }

    return changed;
}

export function userShareRoot(coreRoot = REPO_ROOT): string {
    return process.env.AUTOFLOW_SHARE_ROOT && process.env.AUTOFLOW_SHARE_ROOT.trim()
        ? SHARE_ROOT
        : coreBundledShareRoot(coreRoot);
}

export function syncUserHomeInstallAssets(ctx: ProjectContext, options: {overwrite?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const core = resolveAutoflowCore(ctx);
    const homeEntries = readInstallSourceEntries(core.coreRoot).filter((entry) => entry.type === "user_home");
    if (homeEntries.length === 0) {
        return summary;
    }
    const upgrade = Boolean(options.overwrite);
    for (const entry of homeEntries) {
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry, core.coreRoot), targetPath(ctx, entry, core), ctx, shouldOverwriteInstallSource(entry, upgrade), entry.template, entry.skipShell, core)
        );
    }
    return summary;
}

function isHostGuidanceEntry(entry: InstallSourceEntry): boolean {
    return entry.type === "host" && (entry.target === "AGENTS.md" || entry.target === "CLAUDE.md");
}

export function syncProjectHostInstallAssets(ctx: ProjectContext, options: {overwriteSkills?: boolean; overwriteHostGuidance?: boolean} = {}): InstallAssetSummary {
    const summary = emptyInstallAssetSummary();
    const overwriteSkills = Boolean(options.overwriteSkills);
    const overwriteHostGuidance = Boolean(options.overwriteHostGuidance);
    const core = resolveAutoflowCore(ctx);
    const hostEntries = readInstallSourceEntries(core.coreRoot).filter((entry) => entry.type === "host");
    for (const entry of hostEntries) {
        const overwrite = shouldOverwriteInstallSource(entry, overwriteSkills) || (overwriteHostGuidance && isHostGuidanceEntry(entry));
        mergeInstallAssetSummary(
            summary,
            syncInstallTree(sourcePath(entry, core.coreRoot), targetPath(ctx, entry, core), ctx, overwrite, entry.template, entry.skipShell, core)
        );
    }
    return summary;
}

const viteConfigFileNames = [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.cts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
];

type PropertyValueSpan = {
    valueStart: number;
    valueEnd: number;
};

type ConfigObjectSpan = {
    start: number;
    end: number;
};

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function viteSidecarWatchIgnorePatterns(ctx: ProjectContext): string[] {
    const boardDirName = ctx.boardDirName.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    return uniqueStrings([
        boardDirName ? `**/${boardDirName}/**` : "",
        "**/.agents/**",
        "**/.claude/**",
        "**/.codex/**",
    ]);
}

function projectUsesVite(ctx: ProjectContext): boolean {
    const packageJson = path.join(ctx.projectRoot, "package.json");
    if (!fs.existsSync(packageJson)) return false;
    try {
        const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
            scripts?: Record<string, unknown>;
            dependencies?: Record<string, unknown>;
            devDependencies?: Record<string, unknown>;
            optionalDependencies?: Record<string, unknown>;
            peerDependencies?: Record<string, unknown>;
        };
        for (const deps of [parsed.dependencies, parsed.devDependencies, parsed.optionalDependencies, parsed.peerDependencies]) {
            if (deps && Object.prototype.hasOwnProperty.call(deps, "vite")) return true;
        }
        return Object.values(parsed.scripts || {}).some((value) => /\bvite\b/.test(String(value || "")));
    } catch {
        return false;
    }
}

function jsSingleQuoted(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function lineIndentAt(text: string, index: number): string {
    const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
    const match = text.slice(lineStart, index).match(/^\s*/);
    return match ? match[0] : "";
}

function skipSpaceAndComments(text: string, index: number, boundary: number): number {
    let i = index;
    for (;;) {
        while (i < boundary && /\s/.test(text[i])) i += 1;
        if (text[i] === "/" && text[i + 1] === "/") {
            i += 2;
            while (i < boundary && text[i] !== "\n") i += 1;
            continue;
        }
        if (text[i] === "/" && text[i + 1] === "*") {
            const close = text.indexOf("*/", i + 2);
            i = close >= 0 && close < boundary ? close + 2 : boundary;
            continue;
        }
        return i;
    }
}

function readQuotedToken(text: string, index: number): {value: string; end: number} | null {
    const quote = text[index];
    if (quote !== "\"" && quote !== "'" && quote !== "`") return null;
    let value = "";
    let escaped = false;
    for (let i = index + 1; i < text.length; i += 1) {
        const ch = text[i];
        if (escaped) {
            value += ch;
            escaped = false;
            continue;
        }
        if (ch === "\\") {
            escaped = true;
            continue;
        }
        if (ch === quote) {
            return {value, end: i + 1};
        }
        value += ch;
    }
    return null;
}

function readIdentifierToken(text: string, index: number): {value: string; end: number} | null {
    if (!/[$A-Za-z_]/.test(text[index] || "")) return null;
    let end = index + 1;
    while (end < text.length && /[$0-9A-Za-z_]/.test(text[end])) end += 1;
    return {value: text.slice(index, end), end};
}

function findMatchingBracket(text: string, openIndex: number, openChar: string, closeChar: string): number {
    let depth = 0;
    let state: "code" | "single" | "double" | "template" | "line" | "block" = "code";
    let escaped = false;
    for (let i = openIndex; i < text.length; i += 1) {
        const ch = text[i];
        const next = text[i + 1];
        if (state === "line") {
            if (ch === "\n") state = "code";
            continue;
        }
        if (state === "block") {
            if (ch === "*" && next === "/") {
                state = "code";
                i += 1;
            }
            continue;
        }
        if (state === "single" || state === "double" || state === "template") {
            const quote = state === "single" ? "'" : state === "double" ? "\"" : "`";
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) state = "code";
            continue;
        }
        if (ch === "/" && next === "/") {
            state = "line";
            i += 1;
            continue;
        }
        if (ch === "/" && next === "*") {
            state = "block";
            i += 1;
            continue;
        }
        if (ch === "'") {
            state = "single";
            continue;
        }
        if (ch === "\"") {
            state = "double";
            continue;
        }
        if (ch === "`") {
            state = "template";
            continue;
        }
        if (ch === openChar) depth += 1;
        if (ch === closeChar) {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function findValueEnd(text: string, valueStart: number, boundary: number): number {
    let state: "code" | "single" | "double" | "template" | "line" | "block" = "code";
    let escaped = false;
    let curly = 0;
    let square = 0;
    let paren = 0;
    for (let i = valueStart; i < boundary; i += 1) {
        const ch = text[i];
        const next = text[i + 1];
        if (state === "line") {
            if (ch === "\n") state = "code";
            continue;
        }
        if (state === "block") {
            if (ch === "*" && next === "/") {
                state = "code";
                i += 1;
            }
            continue;
        }
        if (state === "single" || state === "double" || state === "template") {
            const quote = state === "single" ? "'" : state === "double" ? "\"" : "`";
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) state = "code";
            continue;
        }
        if (ch === "/" && next === "/") {
            state = "line";
            i += 1;
            continue;
        }
        if (ch === "/" && next === "*") {
            state = "block";
            i += 1;
            continue;
        }
        if (ch === "'") {
            state = "single";
            continue;
        }
        if (ch === "\"") {
            state = "double";
            continue;
        }
        if (ch === "`") {
            state = "template";
            continue;
        }
        if (ch === "{") curly += 1;
        else if (ch === "}") {
            if (curly === 0 && square === 0 && paren === 0) return i;
            curly -= 1;
        } else if (ch === "[") square += 1;
        else if (ch === "]") square -= 1;
        else if (ch === "(") paren += 1;
        else if (ch === ")") paren -= 1;
        else if (ch === "," && curly === 0 && square === 0 && paren === 0) return i;
    }
    return boundary;
}

function findTopLevelPropertyValue(text: string, objectStart: number, objectEnd: number, propertyName: string): PropertyValueSpan | null {
    let index = objectStart + 1;
    while (index < objectEnd) {
        index = skipSpaceAndComments(text, index, objectEnd);
        const quoted = readQuotedToken(text, index);
        const identifier = quoted ? null : readIdentifierToken(text, index);
        const token = quoted || identifier;
        if (!token) {
            index += 1;
            continue;
        }
        let cursor = skipSpaceAndComments(text, token.end, objectEnd);
        if (text[cursor] !== ":") {
            index = token.end;
            continue;
        }
        cursor = skipSpaceAndComments(text, cursor + 1, objectEnd);
        const valueEnd = findValueEnd(text, cursor, objectEnd);
        if (token.value === propertyName) {
            return {valueStart: cursor, valueEnd};
        }
        index = valueEnd + 1;
    }
    return null;
}

function findConfigObject(text: string): ConfigObjectSpan | null {
    for (const marker of ["export default defineConfig", "module.exports = defineConfig"]) {
        const markerIndex = text.indexOf(marker);
        if (markerIndex < 0) continue;
        const parenIndex = text.indexOf("(", markerIndex + marker.length);
        if (parenIndex < 0) continue;
        const objectStart = text.indexOf("{", parenIndex + 1);
        if (objectStart < 0) continue;
        const objectEnd = findMatchingBracket(text, objectStart, "{", "}");
        if (objectEnd > objectStart) return {start: objectStart, end: objectEnd};
    }

    for (const marker of ["export default", "module.exports ="]) {
        const markerIndex = text.indexOf(marker);
        if (markerIndex < 0) continue;
        const objectStart = text.indexOf("{", markerIndex + marker.length);
        if (objectStart < 0) continue;
        if (text.slice(markerIndex + marker.length, objectStart).trim() !== "") continue;
        const objectEnd = findMatchingBracket(text, objectStart, "{", "}");
        if (objectEnd > objectStart) return {start: objectStart, end: objectEnd};
    }

    return null;
}

function objectNeedsCommaBeforeInsert(text: string, objectStart: number, objectEnd: number): boolean {
    const body = text.slice(objectStart + 1, objectEnd).trim();
    return body.length > 0 && !body.endsWith(",");
}

function trailingWhitespaceStart(text: string, start: number, end: number): number {
    const body = text.slice(start, end);
    const match = body.match(/\s*$/);
    return end - (match ? match[0].length : 0);
}

function renderIgnoredProperty(patterns: string[], indent: string): string {
    const itemIndent = `${indent}  `;
    return [
        `${indent}ignored: [`,
        ...patterns.map((pattern) => `${itemIndent}${jsSingleQuoted(pattern)},`),
        `${indent}],`,
    ].join("\n");
}

function renderWatchProperty(patterns: string[], indent: string): string {
    return [
        `${indent}watch: {`,
        renderIgnoredProperty(patterns, `${indent}  `),
        `${indent}},`,
    ].join("\n");
}

function renderServerProperty(patterns: string[], indent: string): string {
    return [
        `${indent}server: {`,
        renderWatchProperty(patterns, `${indent}  `),
        `${indent}},`,
    ].join("\n");
}

function patternAlreadyPresent(text: string, pattern: string): boolean {
    return text.includes(jsSingleQuoted(pattern)) || text.includes(`"${pattern.replace(/"/g, "\\\"")}"`) || text.includes(`\`${pattern.replace(/`/g, "\\`")}\``);
}

function insertIntoObject(text: string, objectStart: number, objectEnd: number, renderedProperty: string): string {
    const closingIndent = lineIndentAt(text, objectEnd);
    const insertAt = trailingWhitespaceStart(text, objectStart + 1, objectEnd);
    const prefix = text.slice(objectStart + 1, insertAt).trim().length > 0 && !text.slice(objectStart + 1, insertAt).trim().endsWith(",") ? "," : "";
    return `${text.slice(0, insertAt)}${prefix}\n${renderedProperty}\n${closingIndent}${text.slice(objectEnd)}`;
}

function patchIgnoredArray(text: string, arrayStart: number, arrayEnd: number, patterns: string[]): {text: string; changed: boolean} {
    const missing = patterns.filter((pattern) => !patternAlreadyPresent(text.slice(arrayStart, arrayEnd), pattern));
    if (missing.length === 0) return {text, changed: false};
    const closingIndent = lineIndentAt(text, arrayEnd);
    const itemIndent = `${closingIndent}  `;
    const insertAt = trailingWhitespaceStart(text, arrayStart + 1, arrayEnd);
    const body = text.slice(arrayStart + 1, insertAt).trim();
    const prefix = body.length > 0 && !body.endsWith(",") ? "," : "";
    const insert = `${prefix}\n${missing.map((pattern) => `${itemIndent}${jsSingleQuoted(pattern)},`).join("\n")}\n${closingIndent}`;
    return {text: `${text.slice(0, insertAt)}${insert}${text.slice(arrayEnd)}`, changed: true};
}

function patchViteConfigText(text: string, patterns: string[]): {text: string; status: "updated" | "unchanged" | "skipped"; reason: string} {
    const configObject = findConfigObject(text);
    if (!configObject) {
        return {text, status: "skipped", reason: "unsupported_config_shape"};
    }

    const server = findTopLevelPropertyValue(text, configObject.start, configObject.end, "server");
    if (!server) {
        const propertyIndent = `${lineIndentAt(text, configObject.end)}  `;
        return {
            text: insertIntoObject(text, configObject.start, configObject.end, renderServerProperty(patterns, propertyIndent)),
            status: "updated",
            reason: "added_server_watch_ignored",
        };
    }
    if (text[server.valueStart] !== "{") {
        return {text, status: "skipped", reason: "server_not_object_literal"};
    }
    const serverEnd = findMatchingBracket(text, server.valueStart, "{", "}");
    if (serverEnd < 0) return {text, status: "skipped", reason: "server_object_unclosed"};

    const watch = findTopLevelPropertyValue(text, server.valueStart, serverEnd, "watch");
    if (!watch) {
        const propertyIndent = `${lineIndentAt(text, serverEnd)}  `;
        return {
            text: insertIntoObject(text, server.valueStart, serverEnd, renderWatchProperty(patterns, propertyIndent)),
            status: "updated",
            reason: "added_watch_ignored",
        };
    }
    if (text[watch.valueStart] !== "{") {
        return {text, status: "skipped", reason: "watch_not_object_literal"};
    }
    const watchEnd = findMatchingBracket(text, watch.valueStart, "{", "}");
    if (watchEnd < 0) return {text, status: "skipped", reason: "watch_object_unclosed"};

    const ignored = findTopLevelPropertyValue(text, watch.valueStart, watchEnd, "ignored");
    if (!ignored) {
        const propertyIndent = `${lineIndentAt(text, watchEnd)}  `;
        return {
            text: insertIntoObject(text, watch.valueStart, watchEnd, renderIgnoredProperty(patterns, propertyIndent)),
            status: "updated",
            reason: "added_ignored",
        };
    }
    if (text[ignored.valueStart] !== "[") {
        return {text, status: "skipped", reason: "ignored_not_array_literal"};
    }
    const ignoredEnd = findMatchingBracket(text, ignored.valueStart, "[", "]");
    if (ignoredEnd < 0) return {text, status: "skipped", reason: "ignored_array_unclosed"};
    const patched = patchIgnoredArray(text, ignored.valueStart, ignoredEnd, patterns);
    if (!patched.changed) return {text, status: "unchanged", reason: "patterns_present"};
    return {text: patched.text, status: "updated", reason: "merged_ignored_patterns"};
}

function renderDefaultViteConfig(patterns: string[]): string {
    return [
        "export default {",
        renderServerProperty(patterns, "  "),
        "};",
        "",
    ].join("\n");
}

export function ensureViteSidecarWatchIgnores(ctx: ProjectContext): ViteSidecarWatchIgnoreSummary {
    const patterns = viteSidecarWatchIgnorePatterns(ctx);
    const configFiles = viteConfigFileNames
        .map((name) => path.join(ctx.projectRoot, name))
        .filter((file) => fs.existsSync(file));

    if (configFiles.length === 0) {
        if (!projectUsesVite(ctx)) {
            return {status: "not_detected", files: [], skipped: [], patterns, reason: "vite_not_detected"};
        }
        const file = path.join(ctx.projectRoot, "vite.config.mjs");
        writeFileAtomic(file, renderDefaultViteConfig(patterns));
        return {status: "created", files: ["vite.config.mjs"], skipped: [], patterns, reason: "created_vite_config"};
    }

    const changed: string[] = [];
    const unchanged: string[] = [];
    const skipped: string[] = [];
    for (const file of configFiles) {
        const rel = path.relative(ctx.projectRoot, file).split(path.sep).join("/");
        try {
            const original = fs.readFileSync(file, "utf8");
            const patched = patchViteConfigText(original, patterns);
            if (patched.status === "updated" && patched.text !== original) {
                writeFileAtomic(file, patched.text);
                changed.push(`${rel}:${patched.reason}`);
            } else if (patched.status === "unchanged") {
                unchanged.push(`${rel}:${patched.reason}`);
            } else {
                skipped.push(`${rel}:${patched.reason}`);
            }
        } catch (error) {
            skipped.push(`${rel}:error:${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (changed.length > 0) {
        return {status: "updated", files: changed, skipped, patterns, reason: "vite_config_updated"};
    }
    if (unchanged.length > 0 && skipped.length === 0) {
        return {status: "unchanged", files: unchanged, skipped: [], patterns, reason: "patterns_present"};
    }
    if (unchanged.length > 0) {
        return {status: "unchanged", files: unchanged, skipped, patterns, reason: "patterns_present_with_skips"};
    }
    return {status: "skipped", files: [], skipped, patterns, reason: "no_supported_vite_config"};
}

export function cleanupObsoleteBoardFiles(ctx: ProjectContext): string[] {
    const removedSignalName = ["wa", "ke"].join("");
    const removedSignalModel = `${removedSignalName}-model.md`;
    const removedRealtimeMarker = new RegExp(`\\.verifier-realtime-${removedSignalName}up\\.pending$`);
    const removedSignalState = new RegExp(`-${removedSignalName}\\.(queue\\.jsonl|pointer)$`);
    const obsolete = [
        path.join(ctx.boardRoot, "scripts"),
        path.join(ctx.boardRoot, "automations", ["heart", "beat-set.toml"].join("")),
        path.join(ctx.boardRoot, "automations", removedSignalModel),
        path.join(ctx.boardRoot, "automations", "templates"),
        // 공통 문서는 active core share로 이동했다. 보드 안 복제본은 upgrade 때 제거한다.
        path.join(ctx.boardRoot, "agents"),
        path.join(ctx.boardRoot, "protocols"),
        path.join(ctx.boardRoot, "reference"),
        path.join(ctx.boardRoot, "rules"),
        path.join(ctx.boardRoot, "state-schema"),
        // Completion and verifier evidence now lives in ticket markdown, not board-level logs/.
        path.join(ctx.boardRoot, "logs"),
        // Runner runtime logs are no longer written. Drop the whole directory on upgrade.
        path.join(ctx.boardRoot, "runners", "logs"),
        path.join(ctx.boardRoot, "runners", "state", "wiki-baseline.history"),
        path.join(ctx.boardRoot, "runners", "state", "wiki-search.db"),
        path.join(ctx.boardRoot, "runners", "state", "config.local.previous-runners.toml"),
        path.join(ctx.boardRoot, "runners", "state", "config.local.legacy-runners.toml"),
        // Sticky-context per-runner caches no longer used.
        // (handled below via state-dir scan)
        // Project-local generated-data folders do not need nested boilerplate docs.
        path.join(ctx.boardRoot, "metrics", "README.md"),
        path.join(ctx.boardRoot, "metrics", "wiki"),
        path.join(ctx.boardRoot, "runners", "state", "README.md"),
        // Automation 운영 문서는 active core share로 이동했다.
        path.join(ctx.boardRoot, "automations", "README.md"),
        path.join(ctx.boardRoot, "automations", "legacy-file-watch.md"),
        path.join(ctx.boardRoot, "automations", "non-goals.md"),
        path.join(ctx.boardRoot, "automations", "operating-principles.md"),
        path.join(ctx.boardRoot, "automations", "topology.md"),
        path.join(ctx.boardRoot, "automations", "triggers.md"),
        path.join(ctx.boardRoot, "automations", "state", "README.md"),
        path.join(ctx.boardRoot, "automations", "state", "context-lifecycle.md"),
        path.join(ctx.boardRoot, "automations", "state", "worker-identity.md"),
    ];
    const stateDir = path.join(ctx.boardRoot, "runners", "state");
    try {
        for (const entry of fs.readdirSync(stateDir)) {
            if (removedSignalState.test(entry) || removedRealtimeMarker.test(entry)) {
                obsolete.push(path.join(stateDir, entry));
                continue;
            }
            // Trusted token log caches are stale after the token log itself was removed.
            if (entry.endsWith(".trusted-log-cache.json")) {
                obsolete.push(path.join(stateDir, entry));
                continue;
            }
            // Sticky context caches are stale: ticket markdown is the source of truth.
            if (entry.endsWith("-sticky-context.md")) {
                obsolete.push(path.join(stateDir, entry));
                continue;
            }
            // Semantic-lint per-page fingerprint directories are stale (semantic lint removed).
            if (entry.endsWith(".semantic-lint.pages.d")) {
                obsolete.push(path.join(stateDir, entry));
                continue;
            }
            // Startup/handoff prompt snapshots are generated per old fixed-runner
            // sessions. Runner assignments now rebuild prompts from contracts.
            if (entry.endsWith("-startup-prompt.md") || entry.endsWith("-handoff-prompt.md")) {
                obsolete.push(path.join(stateDir, entry));
                continue;
            }
            // Old DB-only wiki staging files are superseded by .autoflow/wiki/*.md.
            if (/^wiki-(?:prd|todo)-.+\.md$/i.test(entry) || /^wiki-upsert\..+\.md$/i.test(entry)) {
                obsolete.push(path.join(stateDir, entry));
            }
        }
    } catch {}
    const obsoleteEmptyDirs: string[] = [];
    const removed: string[] = [];
    for (const file of obsolete) {
        if (!fs.existsSync(file)) {
            continue;
        }
        fs.rmSync(file, {recursive: true, force: true});
        removed.push(path.relative(ctx.boardRoot, file));
    }
    for (const dir of obsoleteEmptyDirs) {
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            continue;
        }
        const entries = fs.readdirSync(dir).filter((entry) => entry !== ".gitkeep" && entry !== ".DS_Store");
        if (entries.length > 0) {
            continue;
        }
        fs.rmSync(dir, {recursive: true, force: true});
        removed.push(path.relative(ctx.boardRoot, dir));
    }
    return removed;
}

export function cleanupObsoleteHostFiles(ctx: ProjectContext): string[] {
    const obsolete = [
        path.join(ctx.projectRoot, ".claude", "skills", "autoflow"),
        path.join(ctx.projectRoot, ".claude", "skills", "agoal"),
        path.join(ctx.projectRoot, ".claude", "skills", "order"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "autoflow"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "agoal"),
        path.join(ctx.projectRoot, ".claude", "autoflow-plugin", "skills", "order"),
        path.join(ctx.projectRoot, ".codex", "skills", "autoflow"),
        path.join(ctx.projectRoot, ".codex", "skills", "agoal"),
        path.join(ctx.projectRoot, ".codex", "skills", "order"),
        // Older autoflow installs also dropped skills under `.agents/skills/`;
        // current installers no longer write there but legacy boards still
        // carry the folders, so clean them on every upgrade.
        path.join(ctx.projectRoot, ".agents", "skills", "autoflow"),
        path.join(ctx.projectRoot, ".agents", "skills", "order"),
    ];
    const removed: string[] = [];
    for (const file of obsolete) {
        if (!fs.existsSync(file)) continue;
        fs.rmSync(file, { recursive: true, force: true });
        removed.push(path.relative(ctx.projectRoot, file));
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

function boardRel(ctx: ProjectContext, file: string): string {
    return path.relative(ctx.boardRoot, file).split(path.sep).join("/");
}

function safeReadText(file: string): string {
    try {
        return fs.readFileSync(file, "utf8");
    } catch {
        return "";
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMarkdownFiles(root: string): string[] {
    const files: string[] = [];
    const visit = (current: string): void => {
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(current, {withFileTypes: true});
        } catch {
            return;
        }
        for (const entry of entries) {
            const next = path.join(current, entry.name);
            if (entry.isDirectory()) {
                visit(next);
            } else if (entry.isFile() && entry.name.endsWith(".md")) {
                files.push(next);
            }
        }
    };
    visit(root);
    return files.sort();
}

function scalarInSection(text: string, section: string, field: string): string {
    let inSection = false;
    const headingRe = /^##\s+(.+?)\s*$/;
    const fieldRe = new RegExp(`^-\\s*${escapeRegExp(field)}\\s*:\\s*(.*?)\\s*$`, "i");
    for (const line of text.split(/\r?\n/)) {
        const heading = line.match(headingRe);
        if (heading) {
            inSection = heading[1].trim().toLowerCase() === section.toLowerCase();
            continue;
        }
        if (!inSection) continue;
        const match = line.match(fieldRe);
        if (match) return match[1].trim();
    }
    return "";
}

function removeScalarFieldsInSectionText(text: string, section: string, fields: string[]): {text: string; changed: boolean} {
    let inSection = false;
    let changed = false;
    const fieldNames = new Set(fields.map((field) => field.toLowerCase()));
    const headingRe = /^##\s+(.+?)\s*$/;
    const fieldRe = /^-\s*([^:]+?)\s*:/;
    const next: string[] = [];
    for (const line of text.split(/\r?\n/)) {
        const heading = line.match(headingRe);
        if (heading) {
            inSection = heading[1].trim().toLowerCase() === section.toLowerCase();
            next.push(line);
            continue;
        }
        const field = inSection ? line.match(fieldRe) : null;
        if (field && fieldNames.has(field[1].trim().toLowerCase())) {
            changed = true;
            continue;
        }
        next.push(line);
    }
    return {text: next.join("\n"), changed};
}


export function archiveLegacyOrderQueue(ctx: ProjectContext): string[] {
    const orderDir = path.join(ctx.boardRoot, "tickets", "order");
    if (!fs.existsSync(orderDir)) return [];
    let names: string[] = [];
    try {
        names = fs.readdirSync(orderDir).filter((name) => name.endsWith(".md")).sort();
    } catch {
        return [];
    }
    if (names.length === 0) {
        try { fs.rmdirSync(orderDir); } catch {}
        return [];
    }
    const archiveDir = path.join(ctx.boardRoot, "tickets", "done", ".legacy-orders");
    fs.mkdirSync(archiveDir, { recursive: true });
    const archived: string[] = [];
    for (const name of names) {
        const from = path.join(orderDir, name);
        const to = path.join(archiveDir, name);
        if (fs.existsSync(to)) {
            fs.rmSync(from, { force: true });
            archived.push(`removed-duplicate:tickets/order/${name}`);
            continue;
        }
        fs.renameSync(from, to);
        archived.push(`tickets/order/${name}->tickets/done/.legacy-orders/${name}`);
    }
    try { fs.rmdirSync(orderDir); } catch {}
    return archived;
}

const verifierDecisionFields = [
    "Semantic Decision",
    "Semantic Reason",
    "Semantic Checked At",
    "Semantic Log",
    "Semantic Marker",
];

export function migrateStaleVerifyPendingDecisionFields(ctx: ProjectContext): string[] {
    const migrated: string[] = [];
    const ticketRoots = [
        path.join(ctx.boardRoot, "tickets", "inprogress"),
        path.join(ctx.boardRoot, "tickets", "verifier"),
    ];
    for (const root of ticketRoots) {
        if (!fs.existsSync(root)) continue;
        let names: string[] = [];
        try {
            names = fs.readdirSync(root).filter((name) => /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(name)).sort();
        } catch {
            continue;
        }
        for (const name of names) {
            const file = path.join(root, name);
            const text = safeReadText(file);
            if (!text) continue;
            const stage = scalarInSection(text, "Ticket", "Stage").toLowerCase();
            const decision = scalarInSection(text, "Verification", "Semantic Decision");
            if (stage !== "verify_pending" || !decision) continue;
            const stripped = removeScalarFieldsInSectionText(text, "Verification", verifierDecisionFields);
            if (!stripped.changed) continue;
            writeFileAtomic(file, stripped.text);
            migrated.push(boardRel(ctx, file));
        }
    }
    return migrated;
}

function rewriteQueuePathReferences(ctx: ProjectContext): string[] {
    if (!fs.existsSync(ctx.boardRoot)) {
        return [];
    }
    const replacements: Array<[RegExp, string]> = [
        [/tickets\/backlog/g, "tickets/prd"],
        [/\bbacklog\//g, "prd/"],
        [/reference\/backlog\.md/g, "reference/prd.md"],
        [/backlog-first-stuck\.json/g, "prd-first-stuck.json"],
        [/source=backlog-to-todo/g, "source=prd-to-todo"],
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
        [/tickets\/backlog/g, "tickets/prd"],
        [/\bbacklog\//g, "prd/"],
        [/reference\/backlog\.md/g, "reference/prd.md"],
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
    const oldProtocol = [[legacyActorLower, "contract"].join("-"), "md"].join(".");
    return [
        [new RegExp(`\\b${oldStart}\\b`, "g"), "start-ticket"],
        [new RegExp(`\\b${oldFinish}\\b`, "g"), "finish-ticket"],
        [new RegExp(`\\b${oldVerify}\\b`, "g"), "verify-ticket"],
        [new RegExp(`\\b${previousSuffix}\\b`, "g"), "worker"],
        [new RegExp(`${oldAgent}\\.md`, "g"), "worker-agent.md"],
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

// ----------------------------------------------------------------------------
// Ticket naming migration: PRD-NNN.md / Todo-NNN.md / project_NNN / tickets_NNN
// → PRD-NNN.md / TODO-NNN.md. Runs on every `autoflow upgrade` so a board can
// catch up to the new convention without a one-shot script. Idempotent: once
// every file/dir/reference is in the new form the function detects no work
// and returns empty arrays.
// ----------------------------------------------------------------------------

export type TicketNamingMigrationSummary = {
    visited: number;
    contentChanged: string[];
    replacements: number;
    filesRenamed: Array<{from: string; to: string}>;
    dirsRenamed: Array<{from: string; to: string}>;
};

const TICKET_NAMING_CONTENT_RULES: ReadonlyArray<{pattern: RegExp; replacement: string}> = [
    // Regex alternation flattening must come first so the generic prefix
    // swaps below don't end up with PRD-\d+|tickets_\d+ in the same group.
    {pattern: /\(Todo-\\d\+\|tickets_\\d\+\)/g, replacement: "TODO-\\d+"},
    {pattern: /\(\?:Todo-\|tickets_\)/g, replacement: "TODO-"},
    {pattern: /\(\?:prd\|project\)_/g, replacement: "PRD-"},
    {pattern: /\(prd\|project\)_/g, replacement: "(PRD)-"},
    // Digit-bearing identifiers, including slug ids like `prd_198_some_slug`.
    {pattern: /\bprd_(\d+)(?=_|[^A-Za-z0-9_])/g, replacement: "PRD-$1"},
    {pattern: /\bproject_(\d+)(?=_|[^A-Za-z0-9_])/g, replacement: "PRD-$1"},
    {pattern: /\bprd_(\d+)$/gm, replacement: "PRD-$1"},
    {pattern: /\bproject_(\d+)$/gm, replacement: "PRD-$1"},
    {pattern: /\bTodo-(\d+)\b/g, replacement: "TODO-$1"},
    {pattern: /\btickets_(\d+)\b/g, replacement: "TODO-$1"},
    // Template-literal placeholders: `prd_${id}.md`, `Todo-${id}.md`.
    {pattern: /\bprd_\$\{/g, replacement: "PRD-${"},
    {pattern: /\bproject_\$\{/g, replacement: "PRD-${"},
    {pattern: /\bTodo-\$\{/g, replacement: "TODO-${"},
    {pattern: /\btickets_\$\{/g, replacement: "TODO-${"},
    // Regex anchors: /^prd_…/, /^Todo-…/
    {pattern: /\^prd_(?=[\\(0-9])/g, replacement: "^PRD-"},
    {pattern: /\^project_(?=[\\(0-9])/g, replacement: "^PRD-"},
    {pattern: /\^Todo-(?=[\\(0-9])/g, replacement: "^TODO-"},
    {pattern: /\^tickets_(?=[\\(0-9])/g, replacement: "^TODO-"},
    {pattern: /\bprd_(?=\\d)/g, replacement: "PRD-"},
    {pattern: /\bproject_(?=\\d)/g, replacement: "PRD-"},
    {pattern: /\bTodo-(?=\\d)/g, replacement: "TODO-"},
    {pattern: /\btickets_(?=\\d)/g, replacement: "TODO-"},
    // Frontmatter / ID lines.
    {pattern: /(PRD Key:\s*)prd_(\d+)/g, replacement: "$1PRD-$2"},
    {pattern: /(PRD Key:\s*)project_(\d+)/g, replacement: "$1PRD-$2"},
    {pattern: /(ID:\s*)prd_(\d+)/g, replacement: "$1PRD-$2"},
    {pattern: /(ID:\s*)project_(\d+)/g, replacement: "$1PRD-$2"},
    {pattern: /(ID:\s*)Todo-(\d+)/g, replacement: "$1TODO-$2"},
    {pattern: /(ID:\s*)tickets_(\d+)/g, replacement: "$1TODO-$2"},
];

const TICKET_NAMING_FILE_RULES: ReadonlyArray<{pattern: RegExp; replacement: string}> = [
    {pattern: /^prd_(\d+)(\.md)$/, replacement: "PRD-$1$2"},
    {pattern: /^project_(\d+)(\.md)$/, replacement: "PRD-$1$2"},
    {pattern: /^Todo-(\d+)(\.md)$/, replacement: "TODO-$1$2"},
    {pattern: /^tickets_(\d+)(\.md)$/, replacement: "TODO-$1$2"},
];

const TICKET_NAMING_DIR_RULES: ReadonlyArray<{pattern: RegExp; replacement: string}> = [
    {pattern: /^prd_(\d+)$/, replacement: "PRD-$1"},
    {pattern: /^project_(\d+)$/, replacement: "PRD-$1"},
    {pattern: /^Todo-(\d+)$/, replacement: "TODO-$1"},
    {pattern: /^tickets_(\d+)$/, replacement: "TODO-$1"},
];

function rewriteTicketNamingContent(raw: string): {next: string; replacements: number} {
    let next = raw;
    let count = 0;
    for (const rule of TICKET_NAMING_CONTENT_RULES) {
        next = next.replace(rule.pattern, (...args) => {
            count += 1;
            return rule.replacement.replace(/\$(\d)/g, (_, idx) => {
                const groupIdx = Number(idx);
                const value = args[groupIdx];
                return typeof value === "string" ? value : "";
            });
        });
    }
    return {next, replacements: count};
}

function shouldVisitTicketNamingPath(name: string): boolean {
    // Always skip noisy entries; do NOT skip dot-prefixed folders like
    // `.legacy-orders/` because the board uses them for archives.
    if (name === ".git" || name === ".DS_Store") return false;
    return true;
}

function isTicketNamingContentTarget(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return [".md", ".toml", ".json", ".jsonl", ".txt", ".sql", ".state", ".context", ".log", ".pointer", ".history"].includes(ext);
}

export function migrateTicketNaming(ctx: ProjectContext): TicketNamingMigrationSummary {
    const summary: TicketNamingMigrationSummary = {
        visited: 0,
        contentChanged: [],
        replacements: 0,
        filesRenamed: [],
        dirsRenamed: [],
    };
    if (!fs.existsSync(ctx.boardRoot)) return summary;

    // Pass 1 — content rewrite. Walk first so file IO uses the original paths.
    const rewriteVisit = (current: string): void => {
        const entries = fs.readdirSync(current, {withFileTypes: true});
        for (const entry of entries) {
            if (!shouldVisitTicketNamingPath(entry.name)) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                rewriteVisit(full);
                continue;
            }
            if (!entry.isFile()) continue;
            if (!isTicketNamingContentTarget(full)) continue;
            summary.visited += 1;
            let raw: string;
            try {
                raw = fs.readFileSync(full, "utf8");
            } catch {
                continue;
            }
            const {next, replacements} = rewriteTicketNamingContent(raw);
            if (next === raw) continue;
            try {
                writeFileAtomic(full, next);
            } catch {
                continue;
            }
            summary.contentChanged.push(path.relative(ctx.boardRoot, full));
            summary.replacements += replacements;
        }
    };
    rewriteVisit(ctx.boardRoot);

    // Pass 2 — rename files. Walk depth-first.
    const renameFileVisit = (current: string): void => {
        const entries = fs.readdirSync(current, {withFileTypes: true});
        for (const entry of entries) {
            if (!shouldVisitTicketNamingPath(entry.name)) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                renameFileVisit(full);
                continue;
            }
            if (!entry.isFile()) continue;
            for (const rule of TICKET_NAMING_FILE_RULES) {
                const newName = entry.name.replace(rule.pattern, rule.replacement);
                if (newName === entry.name) continue;
                const newPath = path.join(current, newName);
                try {
                    fs.renameSync(full, newPath);
                    summary.filesRenamed.push({
                        from: path.relative(ctx.boardRoot, full),
                        to: path.relative(ctx.boardRoot, newPath),
                    });
                } catch {
                    // ignore — concurrent installer, permission issue, etc.
                }
                break;
            }
        }
    };
    renameFileVisit(ctx.boardRoot);

    // Pass 3 — rename directories. Bottom-up so children remain valid paths.
    const renameDirVisit = (current: string): void => {
        const entries = fs.readdirSync(current, {withFileTypes: true});
        for (const entry of entries) {
            if (!shouldVisitTicketNamingPath(entry.name)) continue;
            if (!entry.isDirectory()) continue;
            const full = path.join(current, entry.name);
            renameDirVisit(full);
            for (const rule of TICKET_NAMING_DIR_RULES) {
                const newName = entry.name.replace(rule.pattern, rule.replacement);
                if (newName === entry.name) continue;
                const newPath = path.join(current, newName);
                try {
                    fs.renameSync(full, newPath);
                    summary.dirsRenamed.push({
                        from: path.relative(ctx.boardRoot, full),
                        to: path.relative(ctx.boardRoot, newPath),
                    });
                } catch {
                    // ignore
                }
                break;
            }
        }
    };
    renameDirVisit(ctx.boardRoot);

    return summary;
}

export type PreviousWorkflowTerminologyMigrationSummary = {
    filesChanged: string[];
    replacements: number;
};

export type PreviousRunnerResidueCleanupSummary = {
    filesChanged: string[];
    replacements: number;
};

const PREVIOUS_WORKFLOW_CONTENT_RULES: ReadonlyArray<{pattern: RegExp; replacement: string}> = [
    {pattern: /direct goal 또는 branch 없는 초기 PRD/g, replacement: "초기 PRD"},
    {pattern: /atodo 또는 Branch 없는 legacy PRD/g, replacement: "초기 PRD"},
    {pattern: /Branch 없는 legacy PRD/g, replacement: "branch 없는 초기 PRD"},
    {pattern: /([/#$])aprd\b/gi, replacement: "$1autoflow"},
    {pattern: /([/#$])atodo\b/gi, replacement: "$1autoflow"},
    {pattern: /\baprd\b/gi, replacement: "PRD intake"},
    {pattern: /\batodo-direct\b/gi, replacement: "direct-goal"},
    {pattern: /\batodo direct intake\b/gi, replacement: "direct goal intake"},
    {pattern: /\batodo intake\b/gi, replacement: "goal intake"},
    {pattern: /\batodo\b/gi, replacement: "direct goal"},
    {pattern: /\blegacy PRD\b/g, replacement: "initial PRD"},
    {pattern: /\.autoflow\/tickets\/todo\/(TODO-[A-Za-z0-9_.-]+\.md)/g, replacement: ".autoflow work item $1"},
    {pattern: /tickets\/todo\/(TODO-[A-Za-z0-9_.-]+\.md)/g, replacement: "work item $1"},
    {pattern: /\btickets\/todo\//g, replacement: "work item queue/"},
    {pattern: /\b4-runner\b/g, replacement: "fixed runner"},
    {pattern: /\bDB-only\b/g, replacement: "markdown-first"},
    {pattern: /\bwiki-search\.db\b/g, replacement: "qmd optional index"},
    {pattern: /\bwiki_chunks\b/g, replacement: "markdown wiki chunks"},
    {pattern: /\bMerge Queue\b/g, replacement: "Worker Finalization Queue"},
    {pattern: /\brunner-tool merge finalize-approved\b/g, replacement: "runner-tool worker finalize-approved"},
    {pattern: /merge 역할/g, replacement: "worker finalization"},
    {pattern: /\bmerge role\b/g, replacement: "worker finalization"},
];

function rewritePreviousWorkflowTerminology(raw: string): {next: string; replacements: number} {
    let next = raw;
    let replacements = 0;
    for (const rule of PREVIOUS_WORKFLOW_CONTENT_RULES) {
        next = next.replace(rule.pattern, (...args) => {
            replacements += 1;
            return rule.replacement.replace(/\$(\d)/g, (_, idx) => {
                const groupIdx = Number(idx);
                const value = args[groupIdx];
                return typeof value === "string" ? value : "";
            });
        });
    }
    return {next, replacements};
}

export function migratePreviousWorkflowTerminology(ctx: ProjectContext): PreviousWorkflowTerminologyMigrationSummary {
    const summary: PreviousWorkflowTerminologyMigrationSummary = {
        filesChanged: [],
        replacements: 0,
    };
    if (!fs.existsSync(ctx.boardRoot)) return summary;

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
        let raw: string;
        try {
            raw = fs.readFileSync(current, "utf8");
        } catch {
            return;
        }
        const {next, replacements} = rewritePreviousWorkflowTerminology(raw);
        if (next === raw) {
            return;
        }
        writeFileAtomic(current, next);
        summary.filesChanged.push(path.relative(ctx.boardRoot, current));
        summary.replacements += replacements;
    };
    visit(ctx.boardRoot);
    return summary;
}

function previousRunnerIdPattern(flags = "g"): RegExp {
    const previousRunnerToken = ["slo", "t"].join("");
    return new RegExp(`\\b${previousRunnerToken}-\\d+\\b`, flags);
}

function textHasPreviousRunnerId(value: string): boolean {
    return previousRunnerIdPattern("").test(value);
}

function replacePreviousRunnerResidue(raw: string): {next: string; replacements: number} {
    let next = raw;
    let replacements = 0;
    const previousRunnerToken = ["slo", "t"].join("");
    const replace = (pattern: RegExp, replacement: string) => {
        next = next.replace(pattern, () => {
            replacements += 1;
            return replacement;
        });
    };
    const previousRunnerSource = previousRunnerIdPattern("").source;
    replace(new RegExp(`\\b${previousRunnerSource}\\s+through\\s+${previousRunnerSource}\\b`, "g"), "planner through wiki");
    replace(new RegExp(`\\bAI:\\s*${previousRunnerSource}\\b`, "g"), "AI: worker");
    replace(new RegExp(`\\brunner=${previousRunnerSource}\\b`, "g"), "runner=worker");
    replace(new RegExp(`\\bpassed by ${previousRunnerSource}\\b`, "g"), "passed by worker");
    replace(new RegExp(`\\bWorker runner ${previousRunnerSource} finalized\\b`, "g"), "Worker runner finalized");
    replace(previousRunnerIdPattern("g"), "worker");
    replace(new RegExp(`\\brunner ${previousRunnerToken}s\\b`, "g"), "runners");
    replace(new RegExp(`\\b${previousRunnerToken}s stopped\\b`, "g"), "runners stopped");
    replace(new RegExp(`\\b${previousRunnerToken} cleanup\\b`, "g"), "runner cleanup");
    return {next, replacements};
}

function resolvePreviousRunnerConflictBlocks(raw: string): {next: string; replacements: number} {
    let replacements = 0;
    const next = raw.replace(
        /^<<<<<<<[^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>>[^\n]*(?:\n|$)/gm,
        (block, left: string, right: string) => {
            if (!textHasPreviousRunnerId(block)) return block;
            const leftHasPrevious = textHasPreviousRunnerId(left);
            const rightHasPrevious = textHasPreviousRunnerId(right);
            replacements += 1;
            if (leftHasPrevious && !rightHasPrevious) return right;
            if (rightHasPrevious && !leftHasPrevious) return left;
            return right || left;
        }
    );
    return {next, replacements};
}

function rewritePreviousRunnerResidue(raw: string): {next: string; replacements: number} {
    const resolved = resolvePreviousRunnerConflictBlocks(raw);
    const replaced = replacePreviousRunnerResidue(resolved.next);
    return {
        next: replaced.next,
        replacements: resolved.replacements + replaced.replacements,
    };
}

export function cleanupPreviousRunnerResidue(ctx: ProjectContext): PreviousRunnerResidueCleanupSummary {
    const summary: PreviousRunnerResidueCleanupSummary = {
        filesChanged: [],
        replacements: 0,
    };
    if (!fs.existsSync(ctx.boardRoot)) return summary;

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
        let raw: string;
        try {
            raw = fs.readFileSync(current, "utf8");
        } catch {
            return;
        }
        const {next, replacements} = rewritePreviousRunnerResidue(raw);
        if (next === raw) {
            return;
        }
        writeFileAtomic(current, next);
        summary.filesChanged.push(path.relative(ctx.boardRoot, current));
        summary.replacements += replacements;
    };
    visit(ctx.boardRoot);
    return summary;
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
