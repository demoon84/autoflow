import {execFileSync, fs, path, BOARD_ROOT, PROJECT_ROOT, TICKETS_ROOT, utils} from "./context";
import {recordCheck, recordError, recordWarning} from "./reporter";
import {activeTicketFiles, fieldInSectionPresent, guardTicketFiles, listFiles, markdownScalar, relPath, sectionExists, ticketFileForId, ticketWorktreeBoardState, TICKET_PATTERN} from "./files";

export function checkDuplicateTicketIds(): void {
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

export function checkTodoWorktreeMetadata(): void {
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

export function checkActiveSections(): void {
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

export function checkRecoveryStateFields(): void {
    const fields = ["Status", "Detected By", "Failure Class", "Evidence", "Planner Decision", "Worker Resume Instruction", "Last Recovery At"];
    let missing = 0;
    const files = activeTicketFiles().sort();
    for (const file of files) {
        if (!sectionExists(file, "Recovery State")) continue;
        const rel = relPath(file);
        for (const f of fields) {
            if (f === "Worker Resume Instruction" && fieldInSectionPresent(file, "Recovery State", "Owner Resume Instruction")) {
                continue;
            }
            if (!fieldInSectionPresent(file, "Recovery State", f)) {
                missing += 1;
                recordWarning(`${rel} Recovery State missing field ${f}`);
            }
        }
    }
    recordCheck("recovery_state_fields", missing > 0 ? "warning" : "ok");
}

export function checkRecoveryStateValues(): void {
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

export function checkResolvedTicketWorktrees(): void {
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
        if (state === "done") {
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

export function checkResolvedTicketBranches(): void {
    try {
        execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "--is-inside-work-tree"], {
            stdio: ["ignore", "ignore", "ignore"]
        });
    } catch {
        recordCheck("resolved_ticket_branches", "ok");
        return;
    }

    const branches = utils.gitOutput(["for-each-ref", "--format=%(refname:short)", "refs/heads/autoflow/tickets_*"], PROJECT_ROOT)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .sort();
    if (branches.length === 0) {
        recordCheck("resolved_ticket_branches", "ok");
        return;
    }

    const worktreeBlocks = utils.gitOutput(["worktree", "list", "--porcelain"], PROJECT_ROOT).split(/\n\n+/).filter(Boolean);
    const checkedOut = new Map<string, string>();
    for (const block of worktreeBlocks) {
        const branchMatch = block.match(/^branch refs\/heads\/(.+)$/m);
        const wtMatch = block.match(/^worktree (.+)$/m);
        if (branchMatch && wtMatch) checkedOut.set(branchMatch[1], wtMatch[1]);
    }

    let stale = 0;
    for (const branch of branches) {
        const idMatch = branch.match(/tickets_(\d+)$/);
        const id = idMatch ? idMatch[1] : "";
        const ticketFile = id ? (ticketFileForId(`tickets_${id}`) || ticketFileForId(`Todo-${id}`)) : "";
        if (!ticketFile) {
            stale += 1;
            recordWarning(`${branch} exists but has no board ticket`);
            continue;
        }
        const state = ticketWorktreeBoardState(ticketFile);
        if (state === "active") continue;
        const rel = relPath(ticketFile);
        const wtPath = checkedOut.get(branch) || "";
        if (state === "done") {
            stale += 1;
            const integration = markdownScalar(ticketFile, "Worktree", "Integration Status");
            const detail = wtPath ? `checked out at ${wtPath}` : `not checked out`;
            recordWarning(`${branch} remains after done ticket ${rel} (Integration Status=${integration || "<empty>"}, ${detail})`);
        } else {
            stale += 1;
            recordWarning(`${branch} has ticket branch with unknown board state ${rel}`);
        }
    }
    recordCheck("resolved_ticket_branches", stale > 0 ? "warning" : "ok");
}

export function checkRogueProjectRootBoardPaths(): void {
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
