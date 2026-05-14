#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {execFileSync} from "node:child_process";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fail(message: string): never {
    process.stderr.write(`FAIL: ${message}\n`);
    process.exit(1);
}

function pass(message: string): void {
    process.stdout.write(`PASS: ${message}\n`);
}

function runNodeScript(script: string, args: string[] = []): string {
    try {
        return execFileSync(process.execPath, [script, ...args], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(`${script} ${args.join(" ")} failed: ${detail}`);
    }
}

function tsxCli(): string {
    try {
        return require.resolve("tsx/cli", {paths: [REPO_ROOT]});
    } catch {
        fail("tsx CLI is required for smoke tests");
    }
}

function runTsScript(script: string, args: string[] = [], cwd = REPO_ROOT, env: NodeJS.ProcessEnv = process.env): string {
    try {
        return execFileSync(process.execPath, [tsxCli(), script, ...args], {
            cwd,
            env,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(`${script} ${args.join(" ")} failed: ${detail}`);
    }
}

function commandWorks(command: string, args: string[] = []): boolean {
    try {
        execFileSync(command, args, {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "ignore", "ignore"],
        });
        return true;
    } catch {
        return false;
    }
}

function requireLine(output: string, expected: string): void {
    if (!output.split(/\r?\n/).some((line) => line === expected)) {
        fail(`missing line '${expected}' in output:\n${output}`);
    }
}

function walkFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) {
        return out;
    }
    for (const name of fs.readdirSync(dir)) {
        if (name === ".git" || name === "node_modules") {
            continue;
        }
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walkFiles(full, out);
        } else {
            out.push(full);
        }
    }
    return out;
}

function repoOwnedShellFiles(): string[] {
    return walkFiles(REPO_ROOT)
        .filter((file) => file.endsWith(".sh"))
        .map((file) => path.relative(REPO_ROOT, file))
        .sort();
}

function assertNoRepoOwnedShellFiles(): void {
    const shellFiles = repoOwnedShellFiles();
    if (shellFiles.length > 0) {
        fail(`repo-owned .sh files remain:\n${shellFiles.join("\n")}`);
    }
}

function assertCliBasics(): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    requireLine(runNodeScript(autoflow, ["tool", "list", "."]), "status=ok");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "autoflow-cli-basics-"));
    try {
        runNodeScript(autoflow, ["init", tempRoot, ".autoflow"]);
        assertInstalledHostAssets(tempRoot, ".autoflow");
        const statusOutput = runNodeScript(autoflow, ["status", tempRoot, ".autoflow"]);
        requireLine(statusOutput, "initialized=true");
        requireLine(statusOutput, "host_codex_skill_order_present=true");
        assertUpgradeInstallsMissingHostAssets(tempRoot, ".autoflow");
        requireLine(runNodeScript(autoflow, ["doctor", tempRoot, ".autoflow"]), "status=ok");
        requireLine(runNodeScript(autoflow, ["runners", "list", tempRoot, ".autoflow"]), "status=ok");
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

function assertInstalledHostAssets(projectRoot: string, boardDirName: string): void {
    const required = [
        "AGENTS.md",
        "CLAUDE.md",
        ".claude/skills/autoflow/SKILL.md",
        ".claude/skills/order/SKILL.md",
        ".claude/autoflow-plugin/.claude-plugin/plugin.json",
        ".claude/autoflow-plugin/skills/autoflow/SKILL.md",
        ".claude/autoflow-plugin/skills/order/SKILL.md",
        ".codex/skills/autoflow/SKILL.md",
        ".codex/skills/autoflow/agents/openai.yaml",
        ".codex/skills/order/SKILL.md",
        ".codex/skills/order/agents/openai.yaml",
    ];
    for (const relative of required) {
        const file = path.join(projectRoot, ...relative.split("/"));
        if (!fs.existsSync(file)) {
            fail(`init did not install host asset: ${relative}`);
        }
        const content = fs.readFileSync(file, "utf8");
        if (content.includes("{{BOARD_DIR}}")) {
            fail(`host asset still has an unresolved board token: ${relative}`);
        }
    }
    const codexSkill = fs.readFileSync(path.join(projectRoot, ".codex", "skills", "autoflow", "SKILL.md"), "utf8");
    if (!codexSkill.includes(`${boardDirName}/tickets/prd/prd_NNN.md`)) {
        fail("Codex autoflow skill did not render the board directory name");
    }
    assertSkillUsesWikiRag(codexSkill, "Codex autoflow skill");
    const codexOrderSkill = fs.readFileSync(path.join(projectRoot, ".codex", "skills", "order", "SKILL.md"), "utf8");
    assertSkillUsesWikiRag(codexOrderSkill, "Codex order skill");
    const claudePluginSkill = fs.readFileSync(path.join(projectRoot, ".claude", "autoflow-plugin", "skills", "autoflow", "SKILL.md"), "utf8");
    if (!claudePluginSkill.includes(`${boardDirName}/tickets/prd/prd_NNN.md`)) {
        fail("Claude autoflow plugin skill did not render the board directory name");
    }
    assertSkillUsesWikiRag(claudePluginSkill, "Claude autoflow plugin skill");
    const claudePluginOrderSkill = fs.readFileSync(path.join(projectRoot, ".claude", "autoflow-plugin", "skills", "order", "SKILL.md"), "utf8");
    assertSkillUsesWikiRag(claudePluginOrderSkill, "Claude order plugin skill");
}

function assertSkillUsesWikiRag(content: string, label: string): void {
    if (!content.includes(`autoflow wiki query --term "<keyword>" --rag --limit 3`)) {
        fail(`${label} does not instruct lookup against LLM Wiki RAG`);
    }
}

function assertUpgradeInstallsMissingHostAssets(projectRoot: string, boardDirName: string): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const missingAssets = [
        ".claude/skills/order/SKILL.md",
        ".claude/autoflow-plugin/.claude-plugin/plugin.json",
        ".claude/autoflow-plugin/skills/order/SKILL.md",
        ".codex/skills/order/SKILL.md",
        ".codex/skills/order/agents/openai.yaml",
    ];
    for (const relative of missingAssets) {
        fs.rmSync(path.join(projectRoot, ...relative.split("/")), {force: true});
    }

    const upgradeOutput = runNodeScript(autoflow, ["upgrade", projectRoot, boardDirName]);
    requireLine(upgradeOutput, `mode=upgrade`);
    for (const relative of missingAssets) {
        const file = path.join(projectRoot, ...relative.split("/"));
        if (!fs.existsSync(file)) {
            fail(`upgrade did not install missing host asset: ${relative}`);
        }
    }
    const statusOutput = runNodeScript(autoflow, ["status", projectRoot, boardDirName]);
    requireLine(statusOutput, "host_claude_skill_order_present=true");
    requireLine(statusOutput, "host_claude_plugin_present=true");
    requireLine(statusOutput, "host_claude_plugin_skill_order_present=true");
    requireLine(statusOutput, "host_codex_skill_order_present=true");
}

function assertRuntimeScriptsAreTypeScriptOnly(): void {
    const roots = [
        path.join(REPO_ROOT, "runtime", "board-scripts"),
        path.join(REPO_ROOT, ".autoflow", "scripts"),
        path.join(REPO_ROOT, "packages", "cli"),
    ];
    for (const root of roots) {
        const shellFiles = walkFiles(root).filter((file) => file.endsWith(".sh"));
        if (shellFiles.length > 0) {
            fail(`shell runtime files remain under ${path.relative(REPO_ROOT, root)}:\n${shellFiles.map((file) => path.relative(REPO_ROOT, file)).join("\n")}`);
        }
    }
}

function assertActiveRuntimeMirror(): void {
    const names = [
        "common.ts",
        "runner-common.ts",
        "start-plan.ts",
        "start-ticket.ts",
        "finish-ticket.ts",
        "merge-ready-ticket.ts",
        "verify-ticket.ts",
        "update-wiki.ts",
    ];
    for (const name of names) {
        const runtime = path.join(REPO_ROOT, "runtime", "board-scripts", name);
        const active = path.join(REPO_ROOT, ".autoflow", "scripts", name);
        if (!fs.existsSync(runtime)) {
            fail(`missing runtime script ${name}`);
        }
        if (!fs.existsSync(active)) {
            fail(`missing active script ${name}`);
        }
    }
}

function assertScaffoldVersionStatus(): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "autoflow-version-"));
    try {
        const initOutput = runNodeScript(autoflow, ["init", tempRoot, ".autoflow"]);
        const statusOutput = runNodeScript(autoflow, ["status", tempRoot, ".autoflow"]);
        requireLine(statusOutput, "version_status=up_to_date");
        if (commandWorks("git", ["--version"])) {
            requireLine(initOutput, "git_status=initialized_baseline_committed");
            requireLine(statusOutput, "git_initialized=true");
            requireLine(statusOutput, "git_head_present=true");
            requireLine(statusOutput, `git_root=${fs.realpathSync.native(tempRoot)}`);
            execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
                cwd: tempRoot,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
        }
        fs.writeFileSync(path.join(tempRoot, ".autoflow", ".autoflow-version"), "legacy\n");
        runNodeScript(autoflow, ["upgrade", tempRoot, ".autoflow"]);
        requireLine(runNodeScript(autoflow, ["status", tempRoot, ".autoflow"]), "version_status=up_to_date");
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

function assertDryRunRole(role: string): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `autoflow-${role}-dry-run-`));
    try {
        runNodeScript(autoflow, ["init", tempRoot, ".autoflow"]);
        const output = runNodeScript(autoflow, ["run", role, tempRoot, ".autoflow", "--dry-run"]);
        requireLine(output, "status=ok");
        requireLine(output, "dry_run=true");
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

function assertVerifierPassWaitsForWorkerMerge(): void {
    if (!commandWorks("git", ["--version"])) {
        return;
    }
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "autoflow-verifier-before-merge-"));
    try {
        fs.mkdirSync(path.join(tempRoot, "src"), {recursive: true});
        fs.writeFileSync(path.join(tempRoot, "src", "app.txt"), "before\n");
        runNodeScript(autoflow, ["init", tempRoot, ".autoflow"]);

        const nodeBin = path.join(tempRoot, "node_modules", ".bin");
        fs.mkdirSync(nodeBin, {recursive: true});
        const sourceTsx = path.join(REPO_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
        const targetTsx = path.join(nodeBin, process.platform === "win32" ? "tsx.cmd" : "tsx");
        if (fs.existsSync(sourceTsx) && !fs.existsSync(targetTsx)) {
            fs.symlinkSync(sourceTsx, targetTsx);
        }

        const boardRoot = path.join(tempRoot, ".autoflow");
        const ticket = path.join(boardRoot, "tickets", "todo", "Todo-001.md");
        fs.writeFileSync(ticket, `# Todo-001 Verifier-before-merge smoke

## Ticket

- ID: Todo-001
- PRD Key: prd_smoke
- Title: Verifier-before-merge smoke
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Confirm verifier pass does not archive or merge before the worker merge step.

## Allowed Paths

- \`src/app.txt\`

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Worker Resume Instruction:
- Last Recovery At:

## Done When

- [ ] src/app.txt changed in the ticket worktree.

## Next Action

- Claim this ticket.

## Verification

- Command: smoke
- Result:
`);
        const scriptEnv = {
            ...process.env,
            AUTOFLOW_PROJECT_ROOT: tempRoot,
            PROJECT_ROOT: tempRoot,
            AUTOFLOW_BOARD_ROOT: boardRoot,
            BOARD_ROOT: boardRoot,
            AUTOFLOW_RUNNER_ID: "worker",
            RUNNER_ID: "worker",
        };
        const runnerTool = path.join(boardRoot, "scripts", "runner-tool.ts");
        const claimOutput = runTsScript(runnerTool, ["worker", "claim", "--ticket", "Todo-001", "--runner", "worker"], boardRoot, scriptEnv);
        const claim = JSON.parse(claimOutput) as {worktree_path?: string};
        const worktreePath = claim.worktree_path || "";
        if (!worktreePath || !fs.existsSync(worktreePath)) {
            fail(`claim did not create a worktree: ${claimOutput}`);
        }

        fs.writeFileSync(path.join(worktreePath, "src", "app.txt"), "after\n");
        const inprogress = path.join(boardRoot, "tickets", "inprogress", "Todo-001.md");
        fs.writeFileSync(
            inprogress,
            fs.readFileSync(inprogress, "utf8").replace("- [ ] src/app.txt changed in the ticket worktree.", "- [x] src/app.txt changed in the ticket worktree.")
        );

        const finish = path.join(boardRoot, "scripts", "finish-ticket.ts");
        const handoffOutput = runTsScript(finish, ["001", "pass", "local pass"], boardRoot, scriptEnv);
        requireLine(handoffOutput, "status=verify_pending");

        const verifierEnv = {
            ...scriptEnv,
            AUTOFLOW_ROLE: "verifier",
            AUTOFLOW_RUNNER_ID: "verifier",
            RUNNER_ID: "verifier",
        };
        const verifierOutput = runTsScript(
            runnerTool,
            ["verifier", "finish-pass", "--ticket", "Todo-001", "--summary", "semantic ok", "--runner", "verifier"],
            boardRoot,
            verifierEnv
        );
        const verifier = JSON.parse(verifierOutput) as {removed_verifier_ticket?: boolean};
        if (!verifier.removed_verifier_ticket) {
            fail(`verifier did not remove its review copy: ${verifierOutput}`);
        }

        const doneFile = path.join(boardRoot, "tickets", "done", "prd_smoke", "Todo-001.md");
        if (fs.existsSync(doneFile)) {
            fail("verifier pass archived ticket before worker merge");
        }
        const updated = fs.readFileSync(inprogress, "utf8");
        if (!updated.includes("- Stage: verified_pending_merge")) {
            fail("verifier pass did not hand control back to worker for merge");
        }
        if (!fs.existsSync(path.join(boardRoot, "runners", "state", "verifier-ok-001.marker"))) {
            fail("verifier pass did not record the verifier marker");
        }
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

function assertMetricsTicketDurations(): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "autoflow-metrics-duration-"));
    try {
        runNodeScript(autoflow, ["init", tempRoot, ".autoflow"]);
        const boardRoot = path.join(tempRoot, ".autoflow");
        const inprogressDir = path.join(boardRoot, "tickets", "inprogress");
        fs.mkdirSync(inprogressDir, {recursive: true});
        const ticket = path.join(inprogressDir, "Todo-001.md");
        fs.writeFileSync(ticket, `# Todo-001 Duration smoke

## Ticket

- ID: Todo-001
- PRD Key: prd_smoke
- Title: Duration smoke
- Stage: executing
- Last Updated: 2026-05-13T00:10:00Z

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Processing Started At:
- Processing Started Epoch:
- Processing Finished At:
- Processing Finished Epoch:
- Processing Seconds: 0
- Updated At:
- Tick Count: 2
- Time Used Seconds: 0

## Notes

- Impl AI worker finalized ticket at 2026-05-13T00:10:00Z.
`);
        const runnerTool = path.join(boardRoot, "scripts", "runner-tool.ts");
        const toolEnv = {
            ...process.env,
            PROJECT_ROOT: tempRoot,
            AUTOFLOW_PROJECT_ROOT: tempRoot,
            BOARD_ROOT: boardRoot,
            AUTOFLOW_BOARD_ROOT: boardRoot,
            RUNNER_ID: "worker",
            AUTOFLOW_RUNNER_ID: "worker",
        };
        runTsScript(runnerTool, ["worker", "processing-time", "--ticket", "tickets/inprogress/Todo-001.md", "--event", "start", "--at", "2026-05-13T00:00:00Z"], boardRoot, toolEnv);
        runTsScript(runnerTool, ["worker", "processing-time", "--ticket", "tickets/inprogress/Todo-001.md", "--event", "complete", "--at", "2026-05-13T00:04:00Z"], boardRoot, toolEnv);
        fs.writeFileSync(ticket, fs.readFileSync(ticket, "utf8").replace("- Stage: executing", "- Stage: done"));
        const doneDir = path.join(boardRoot, "tickets", "done", "prd_smoke");
        fs.mkdirSync(doneDir, {recursive: true});
        fs.renameSync(ticket, path.join(doneDir, "Todo-001.md"));
        const output = runNodeScript(autoflow, ["metrics", tempRoot, ".autoflow"]);
        requireLine(output, "ticket_done_count=1");
        requireLine(output, "autoflow_todo_processing_ticket_count=1");
        requireLine(output, "autoflow_todo_processing_seconds=240");
        requireLine(output, "autoflow_todo_lead_seconds=600");
        requireLine(output, "autoflow_avg_ticks_per_done_ticket=2");
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

export function runNamedSmoke(name: string): void {
    assertNoRepoOwnedShellFiles();
    assertRuntimeScriptsAreTypeScriptOnly();
    assertCliBasics();

    if (name.includes("runtime") || name.includes("mirror")) {
        assertActiveRuntimeMirror();
        assertScaffoldVersionStatus();
    }
    if (name.includes("worker")) {
        assertDryRunRole("ticket");
        assertVerifierPassWaitsForWorkerMerge();
    }
    if (name.includes("metrics")) {
        assertMetricsTicketDurations();
    }
    if (name.includes("planner") || name.includes("start-plan")) {
        assertDryRunRole("planner");
    }
    if (name.includes("verifier")) {
        assertDryRunRole("verifier");
    }
    if (name.includes("wiki")) {
        assertDryRunRole("wiki");
    }

    pass(`${name} smoke passed`);
}
