#!/usr/bin/env tsx
/*
 * board-guard.ts — Autoflow board invariant validator.
 * See board-guard.js for full doc; CLI/output unchanged.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {execFileSync} from "node:child_process";
import * as utils from "./board-utils";

const args = process.argv.slice(2);
let strict = false;
for (const a of args) {
    if (a === "--strict") strict = true;
    else if (a === "-h" || a === "--help") {
        process.stdout.write(`Usage:\n  board-guard.ts [--strict]\n\nValidates Autoflow board invariants after AI-authored markdown changes.\n`);
        process.exit(0);
    } else {
        process.stderr.write(`Unknown board-guard argument: ${a}\n`);
        process.exit(2);
    }
}

const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();
const TICKETS_ROOT = path.join(BOARD_ROOT, "tickets");

interface Check {
    id: string;
    status: string;
}

const checks: Check[] = [];
const errors: string[] = [];
const warnings: string[] = [];

function recordCheck(id: string, status: string): void {
    checks.push({id, status});
}

function recordError(msg: string): void {
    errors.push(msg);
}

function recordWarning(msg: string): void {
    warnings.push(msg);
}

function listFiles(dir: string, opts: { pattern?: RegExp; depth?: number } = {}): string[] {
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

const TICKET_PATTERN = /^(Todo-\d{3}|tickets_\d{3})\.md$/;

function guardTicketFiles(): string[] {
    const out: string[] = [];
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier", "reject"]) {
        const root = path.join(TICKETS_ROOT, dir);
        out.push(...listFiles(root, {pattern: TICKET_PATTERN, depth: 1}));
    }
    out.push(...listFiles(path.join(TICKETS_ROOT, "done"), {pattern: TICKET_PATTERN, depth: 5}));
    return out;
}

function activeTicketFiles(): string[] {
    const out: string[] = [];
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier"]) {
        const root = path.join(TICKETS_ROOT, dir);
        out.push(...listFiles(root, {pattern: TICKET_PATTERN, depth: 1}));
    }
    return out;
}

function ticketWorktreeBoardState(file: string): string {
    if (file.startsWith(path.join(TICKETS_ROOT, "todo")) ||
        file.startsWith(path.join(TICKETS_ROOT, "inprogress")) ||
        file.startsWith(path.join(TICKETS_ROOT, "ready-to-merge")) ||
        file.startsWith(path.join(TICKETS_ROOT, "merge-blocked")) ||
        file.startsWith(path.join(TICKETS_ROOT, "verifier"))) {
        return "active";
    }
    if (file.startsWith(path.join(TICKETS_ROOT, "reject"))) return "rejected";
    if (file.startsWith(path.join(TICKETS_ROOT, "done"))) return "done";
    return "unknown";
}

function ticketFileForId(ref: string): string {
    const ticketNum = ref.replace(/^(Todo-|tickets_)/, "");
    for (const dir of ["todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier", "reject"]) {
        for (const prefix of ["Todo-", "tickets_", "reject_"]) {
            const f = path.join(TICKETS_ROOT, dir, `${prefix}${ticketNum}.md`);
            if (fs.existsSync(f)) return f;
        }
    }
    const all = listFiles(path.join(TICKETS_ROOT, "done"), {
        pattern: new RegExp(`^(Todo-|tickets_|reject_)${ticketNum}\\.md$`),
        depth: 5
    });
    return all[0] || "";
}

function sectionExists(file: string, section: string): boolean {
    const text = utils.readFileSafe(file);
    if (!text) return false;
    return text.split(/\r?\n/).some((line) => line === `## ${section}`);
}

function fieldInSectionPresent(file: string, section: string, field: string): boolean {
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

function markdownScalar(file: string, section: string, field: string): string {
    const v = utils.extractScalarFieldInSection(file, section, field);
    return v.replace(/\r/g, "").replace(/^`+|`+$/g, "").trim();
}

function relPath(absPath: string): string {
    return path.relative(BOARD_ROOT, absPath);
}

function checkDuplicateTicketIds(): void {
    const all = guardTicketFiles().sort();
    const byId = new Map<string, string[]>();
    for (const file of all) {
        const id = path.basename(file).replace(/\.md$/, "");
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id)!.push(file);
    }
    let duplicates = 0;
    const dupIds: string[] = [];
    for (const [id, files] of byId) {
        if (files.length > 1) dupIds.push(id);
    }
    for (const id of dupIds.sort()) {
        const locations = byId.get(id)!.map(relPath).join(",");
        recordError(`${id} exists in multiple board states: ${locations}`);
        duplicates += 1;
    }
    recordCheck("duplicate_ticket_ids", duplicates > 0 ? "error" : "ok");
}

function checkTodoWorktreeMetadata(): void {
    const todoDir = path.join(TICKETS_ROOT, "todo");
    if (!fs.existsSync(todoDir)) {
        recordCheck("todo_worktree_metadata", "ok");
        return;
    }
    let stale = 0;
    const files = listFiles(todoDir, {pattern: TICKET_PATTERN, depth: 1}).sort();
    for (const file of files) {
        const rel = relPath(file);
        const p = markdownScalar(file, "Worktree", "Path");
        const branch = markdownScalar(file, "Worktree", "Branch");
        const baseCommit = markdownScalar(file, "Worktree", "Base Commit");
        const wtCommit = markdownScalar(file, "Worktree", "Worktree Commit");
        const integration = markdownScalar(file, "Worktree", "Integration Status");
        if (integration && integration !== "pending" && integration !== "pending_claim") {
            stale += 1;
            recordError(`${rel} is in todo but has Integration Status=${integration}`);
            continue;
        }
        if (p || branch || baseCommit || wtCommit) {
            stale += 1;
            recordError(`${rel} is in todo but still has worktree metadata`);
        }
    }
    recordCheck("todo_worktree_metadata", stale > 0 ? "error" : "ok");
}

function checkActiveSections(): void {
    const required = [
        "Ticket", "Goal", "Allowed Paths", "Worktree", "Goal Runtime",
        "Recovery State", "Done When", "Next Action", "Resume Context",
        "Verification", "Result"
    ];
    let missing = 0;
    const files = activeTicketFiles().sort();
    for (const file of files) {
        const rel = relPath(file);
        for (const s of required) {
            if (!sectionExists(file, s)) {
                missing += 1;
                recordWarning(`${rel} is missing section ## ${s}`);
            }
        }
    }
    recordCheck("active_ticket_sections", missing > 0 ? "warning" : "ok");
}

function checkRecoveryStateFields(): void {
    const fields = ["Status", "Detected By", "Failure Class", "Evidence", "Planner Decision", "Owner Resume Instruction", "Last Recovery At"];
    let missing = 0;
    const files = activeTicketFiles().sort();
    for (const file of files) {
        if (!sectionExists(file, "Recovery State")) continue;
        const rel = relPath(file);
        for (const f of fields) {
            if (!fieldInSectionPresent(file, "Recovery State", f)) {
                missing += 1;
                recordWarning(`${rel} Recovery State missing field ${f}`);
            }
        }
    }
    recordCheck("recovery_state_fields", missing > 0 ? "warning" : "ok");
}

function checkRecoveryStateValues(): void {
    const validStatuses = new Set(["healthy", "stalled", "blocked", "repairing", "requeued", "resolved", "needs_user"]);
    const validFailureClasses = new Set([
        "adapter_no_progress", "stale_todo_worktree", "missing_worktree", "dirty_root",
        "dirty_root_cleared", "dirty_project_root_conflict", "allowed_path_conflict",
        "shared_head_conflict", "verification_failed", "merge_conflict", "ambiguous_scope",
        "oversized_ticket", "tooling_failure", "retry_limit", "needs_user_decision",
        "leftover_worktree", "vague_completion_promise", "iteration_no_progress"
    ]);
    let invalid = 0;
    const files = activeTicketFiles().sort();
    for (const file of files) {
        if (!sectionExists(file, "Recovery State")) continue;
        const rel = relPath(file);
        const status = markdownScalar(file, "Recovery State", "Status");
        const failureClass = markdownScalar(file, "Recovery State", "Failure Class");
        if (!validStatuses.has(status)) {
            invalid += 1;
            recordWarning(`${rel} Recovery State has invalid Status=${status || "<empty>"}`);
        }
        if (failureClass && !validFailureClasses.has(failureClass)) {
            invalid += 1;
            recordWarning(`${rel} Recovery State has invalid Failure Class=${failureClass}`);
        }
    }
    recordCheck("recovery_state_values", invalid > 0 ? "warning" : "ok");
}

function checkResolvedTicketWorktrees(): void {
    try {
        execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "--is-inside-work-tree"], {
            stdio: ["ignore", "ignore", "ignore"]
        });
    } catch {
        recordCheck("resolved_ticket_worktrees", "ok");
        return;
    }

    const wtList = utils.gitOutput(["worktree", "list", "--porcelain"], PROJECT_ROOT);
    if (!wtList) {
        recordCheck("resolved_ticket_worktrees", "ok");
        return;
    }

    const blocks = wtList.split(/\n\n+/).filter(Boolean);
    let stale = 0;
    for (const block of blocks) {
        const wtMatch = block.match(/^worktree (.+)$/m);
        const branchMatch = block.match(/^branch refs\/heads\/(autoflow\/tickets_\d{3})$/m);
        const wtPath = wtMatch ? wtMatch[1] : "";
        const branch = branchMatch ? branchMatch[1] : "";
        if (!wtPath || !branch) continue;
        const ticketRef = branch.split("/").pop()!.replace(/^tickets_/, "Todo-");
        const ticketFile = ticketFileForId(ticketRef.replace(/^Todo-/, "tickets_")) || ticketFileForId(ticketRef);
        if (!ticketFile) {
            stale += 1;
            recordWarning(`${branch} has a ticket worktree but no board ticket: ${wtPath}`);
            continue;
        }
        const state = ticketWorktreeBoardState(ticketFile);
        const rel = relPath(ticketFile);
        if (state === "active") continue;
        if (state === "rejected" || state === "done") {
            stale += 1;
            let dirty = "";
            try {
                dirty = execFileSync("git", ["-C", wtPath, "status", "--porcelain"], {encoding: "utf8"}).trim();
            } catch {
            }
            if (dirty) recordWarning(`${branch} has dirty worktree for ${state} ticket ${rel}: ${wtPath}`);
            else recordWarning(`${branch} has leftover clean worktree for ${state} ticket ${rel}: ${wtPath}`);
        } else {
            stale += 1;
            recordWarning(`${branch} has ticket worktree with unknown board state ${rel}: ${wtPath}`);
        }
    }
    recordCheck("resolved_ticket_worktrees", stale > 0 ? "warning" : "ok");
}

function checkRogueProjectRootBoardPaths(): void {
    let rogue = 0;
    let trackedOutput = "";
    try {
        execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "--is-inside-work-tree"], {
            stdio: ["ignore", "ignore", "ignore"]
        });
        trackedOutput = utils.gitOutput(["ls-files", "--", ".autoflow"], PROJECT_ROOT)
            .split(/\r?\n/)
            .filter((l) => l && !l.startsWith(path.relative(PROJECT_ROOT, BOARD_ROOT) + "/"))
            .join("\n");
    } catch {
    }
    if (trackedOutput) {
        rogue += 1;
        const list = trackedOutput.split(/\r?\n/).slice(0, 10).join(",");
        recordError(`project root contains tracked board path copies: ${list}`);
    }
    const wikiAlias = path.join(PROJECT_ROOT, "wiki");
    if (fs.existsSync(wikiAlias) && wikiAlias !== BOARD_ROOT) {
        rogue += 1;
        recordError(`project root wiki/ exists; Autoflow wiki content must stay under ${BOARD_ROOT}/wiki`);
    }
    const usersAutoflow = path.join(PROJECT_ROOT, "Users");
    if (fs.existsSync(usersAutoflow)) {
        let foundCopy = false;
        const walk = (d: string, depth: number): void => {
            if (depth > 6 || foundCopy) return;
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(d, {withFileTypes: true});
            } catch {
                return;
            }
            for (const e of entries) {
                if (foundCopy) return;
                const full = path.join(d, e.name);
                if (e.isDirectory() && e.name === ".autoflow") {
                    foundCopy = true;
                    return;
                }
                if (e.isDirectory()) walk(full, depth + 1);
            }
        };
        walk(usersAutoflow, 1);
        if (foundCopy) {
            rogue += 1;
            recordError(`project root Users/ contains a copied absolute Autoflow board path`);
        }
    }
    recordCheck("rogue_project_root_board_paths", rogue > 0 ? "error" : "ok");
}

checkDuplicateTicketIds();
checkTodoWorktreeMetadata();
checkActiveSections();
checkRecoveryStateFields();
checkRecoveryStateValues();
checkResolvedTicketWorktrees();
checkRogueProjectRootBoardPaths();

if (strict && warnings.length > 0) {
    for (const w of warnings) errors.push(`strict mode: ${w}`);
}

let status = "ok";
if (errors.length > 0) status = "error";
else if (warnings.length > 0) status = "warning";

process.stdout.write(`status=${status}\n`);
process.stdout.write(`board_root=${BOARD_ROOT}\n`);
process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
process.stdout.write(`strict=${strict}\n`);
process.stdout.write(`error_count=${errors.length}\n`);
process.stdout.write(`warning_count=${warnings.length}\n`);
for (const c of checks) process.stdout.write(`check.${c.id}=${c.status}\n`);
errors.forEach((e, i) => process.stdout.write(`error.${i + 1}=${e}\n`));
warnings.forEach((w, i) => process.stdout.write(`warning.${i + 1}=${w}\n`));

process.exit(errors.length > 0 ? 1 : 0);
