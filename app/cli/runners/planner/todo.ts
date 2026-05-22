import * as shared from "../../shared";
const {fs, path, out, fail, defaultBoardDirName, projectContext, ensureBoard, ensureDir, writeFile, parseArgs, firstFlag, allFlags, hasFlag, readRequestText, gitRun, gitState} = shared;

function todoWorktreePath(id: string, gitRoot: string): string {
    const configured = process.env.AUTOFLOW_WORKTREE_ROOT;
    if (configured) return path.join(path.resolve(configured), `TODO-${id}`);
    const repoName = path.basename(gitRoot);
    const home = process.env.HOME || "";
    let cacheRoot = "";
    if (process.env.XDG_CACHE_HOME) cacheRoot = path.join(process.env.XDG_CACHE_HOME, "autoflow", "worktrees");
    else if (home && process.platform === "darwin") cacheRoot = path.join(home, "Library", "Caches", "autoflow", "worktrees");
    else if (home) cacheRoot = path.join(home, ".cache", "autoflow", "worktrees");
    else cacheRoot = path.join(path.dirname(gitRoot), ".autoflow-worktrees");
    return path.join(cacheRoot, repoName, `TODO-${id}`);
}

function ensureAtodoWorktree(projectRoot: string, id: string, content: string): {branch: string; baseCommit: string; worktreePath: string; status: string} {
    const state = gitState(projectRoot);
    if (!state.available || !state.inside || !state.hasHead) {
        return {branch: "", baseCommit: "", worktreePath: "", status: state.available ? "skipped_not_git_repo" : "skipped_git_unavailable"};
    }
    const gitRoot = state.root || projectRoot;
    const branch = `autoflow/TODO-${id}`;
    const baseCommit = state.head;

    const exists = gitRun(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], gitRoot);
    if (exists.status !== 0) {
        const create = gitRun(["branch", branch, baseCommit], gitRoot);
        if (create.status !== 0) {
            return {branch, baseCommit, worktreePath: "", status: "failed_branch_create"};
        }
    }

    const worktreePath = todoWorktreePath(id, gitRoot);
    fs.mkdirSync(path.dirname(worktreePath), {recursive: true});
    gitRun(["worktree", "prune"], gitRoot);
    const isWorktree = gitRun(["rev-parse", "--is-inside-work-tree"], worktreePath).stdout.trim() === "true";
    if (!isWorktree) {
        if (fs.existsSync(worktreePath) && fs.readdirSync(worktreePath).length > 0) {
            return {branch, baseCommit, worktreePath, status: "failed_worktree_path_dirty"};
        }
        const add = gitRun(["worktree", "add", worktreePath, branch], gitRoot);
        if (add.status !== 0) {
            return {branch, baseCommit, worktreePath, status: "failed_worktree_add"};
        }
    }

    const ticketRel = path.posix.join(".autoflow", "tickets", "todo", `TODO-${id}.md`);
    const ticketAbs = path.join(worktreePath, ticketRel);
    fs.mkdirSync(path.dirname(ticketAbs), {recursive: true});
    fs.writeFileSync(ticketAbs, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    const stage = gitRun(["add", ticketRel], worktreePath);
    if (stage.status !== 0) {
        return {branch, baseCommit, worktreePath, status: "failed_git_add"};
    }
    const commit = gitRun(["commit", "-m", `[TODO-${id}] ticket init`], worktreePath);
    if (commit.status !== 0 && !/nothing to commit/.test(commit.stdout + commit.stderr)) {
        return {branch, baseCommit, worktreePath, status: "failed_git_commit"};
    }
    return {branch, baseCommit, worktreePath, status: "created"};
}

function listExistingTodoIds(ticketsRoot: string): number[] {
    const ids: number[] = [];
    if (!fs.existsSync(ticketsRoot)) return ids;
    const walk = (current: string): void => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            const match = entry.name.match(/^TODO-(\d+)\.md$/);
            if (!match) continue;
            const id = Number.parseInt(match[1], 10);
            if (Number.isFinite(id)) ids.push(id);
        }
    };
    walk(ticketsRoot);
    return ids;
}

function nextTodoId(ticketsRoot: string, explicit?: string): string {
    if (explicit) return String(Number.parseInt(explicit.replace(/\D/g, ""), 10) || Number(explicit)).padStart(3, "0");
    const max = listExistingTodoIds(ticketsRoot).reduce((m, v) => Math.max(m, v), 0);
    return String(max + 1).padStart(3, "0");
}

export function todoProject(args: string[]): void {
    if (args.includes("--help") || args.includes("-h")) {
        out(`Usage: autoflow todo create [project-root] [board-dir-name] --title <text> [--goal <text>] --allowed-path <path>... [--done <text>]... [--verification <command>]

Options:
  --id NNN                    Use an explicit todo id.
  --title text                Ticket title (required).
  --goal text                 Goal one-liner. Defaults to title.
  --from-file path            Read additional notes / progress body from a file (appended to Notes section).
  --prd-key key               Reference PRD key (e.g. PRD-042). Defaults to plan-ai-direct.
  --allowed-path path         Allowed implementation path. May be repeated. Required.
  --done text                 Done When checklist item. May be repeated.
  --verification command      Verification command. Defaults to 'none-shell'.
  --priority value            Priority (critical | high | normal | low). Defaults to normal.
  --change-type value         Change type (code | docs | cleanup | infra). Defaults to code.
  --note text                 Extra Notes bullet. May be repeated.
  --force                     Overwrite an existing todo id.`);
        return;
    }
    const subcmd = args[0] === "create" ? args.shift() : "create";
    if (subcmd !== "create") {
        fail(`Unknown todo command: ${subcmd || ""}`);
    }
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    ensureBoard(ctx);

    const ticketsRoot = path.join(ctx.boardRoot, "tickets");
    const todoDir = path.join(ticketsRoot, "todo");
    ensureDir(todoDir);

    const id = nextTodoId(ticketsRoot, firstFlag(parsed, "id"));
    const ticketFile = path.join(todoDir, `TODO-${id}.md`);
    if (fs.existsSync(ticketFile) && !hasFlag(parsed, "force")) {
        fail(`Todo already exists: ${ticketFile}`);
    }

    const title = firstFlag(parsed, "title") || `Todo ${id}`;
    const goal = firstFlag(parsed, "goal") || title;
    const prdKey = firstFlag(parsed, "prd-key") || "";
    const priority = firstFlag(parsed, "priority") || "normal";
    const changeType = firstFlag(parsed, "change-type") || "code";
    const allowedPaths = allFlags(parsed, "allowed-path");
    if (allowedPaths.length === 0) {
        fail("autoflow todo create requires at least one --allowed-path");
    }
    const verification = firstFlag(parsed, "verification") || "none-shell";
    const doneWhen = allFlags(parsed, "done");
    const notes = allFlags(parsed, "note");
    const bodyFromFile = readRequestText(parsed, "from-file");

    const doneLines = doneWhen.length > 0
        ? doneWhen.map((item) => /^\s*-\s*\[[ xX]\]/.test(item) ? item.trim() : `- [ ] ${item.trim()}`)
        : [
            `- [ ] ${allowedPaths[0]} 안의 변경이 "${goal}" 결과를 반영한다.`,
            `- [ ] 검증 명령 \`${verification}\` 가 exit 0으로 끝나거나, 명령이 \`none-shell\` 이면 파일 검토 근거가 기록된다.`,
            `- [ ] 최종 diff가 Allowed Paths 밖의 파일을 포함하지 않는다.`,
        ];

    const notesLines = [
        `- atodo intake at ${new Date().toISOString()}`,
        ...notes.map((item) => `- ${item.trim()}`),
        ...(bodyFromFile ? [`- ${bodyFromFile.split(/\r?\n/).filter(Boolean).join(" ").slice(0, 240)}`] : []),
    ];

    const content = `# Ticket

## Ticket

- ID: TODO-${id}
- PRD Key: ${prdKey}
- PRD Slice: 1/1
- Plan Candidate: atodo direct intake
- Title: ${title}
- Priority: ${priority}
- Change Type: ${changeType}
- Stage: todo
- AI: atodo
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- ${goal}

## References

- PRD: ${prdKey ? `tickets/prd/${prdKey}.md` : ""}
- Feature Spec:
- Plan Source: atodo-direct

## Reference Notes

- Project Note:
- Plan Note:
- Ticket Note: [[TODO-${id}]]

## Allowed Paths

${allowedPaths.map((item) => `- ${item}`).join("\n")}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Done When

${doneLines.join("\n")}

## Next Action

- 워커 러너가 이 todo ticket을 claim하고, mini-plan을 작성한 뒤 Allowed Paths 안에서 구현하고, 검증 근거를 기록한 다음 검증 러너 handoff로 진행한다.

## Resume Context

- Current state: atodo가 직접 등록한 todo ticket이다.
- Last completed action: atodo CLI 또는 스킬이 ${new Date().toISOString()}에 이 ticket을 작성했다.
- First thing to inspect on resume: Goal, Allowed Paths, Done When.

## Notes

${notesLines.join("\n")}

## Verification

- Command: ${verification}
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
`;

    writeFile(ticketFile, content, true);

    const wt = ensureAtodoWorktree(ctx.projectRoot, id, content);

    out("status=ok");
    out(`todo_id=TODO-${id}`);
    out(`path=${ticketFile}`);
    out(`branch=${wt.branch}`);
    out(`base_commit=${wt.baseCommit}`);
    out(`worktree_path=${wt.worktreePath}`);
    out(`worktree_status=${wt.status}`);
}
