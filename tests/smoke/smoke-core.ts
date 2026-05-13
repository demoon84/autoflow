#!/usr/bin/env npx tsx

import * as fs from "node:fs";
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
    requireLine(runNodeScript(autoflow, ["status", "."]), "initialized=true");
    requireLine(runNodeScript(autoflow, ["doctor", "."]), "status=ok");
    requireLine(runNodeScript(autoflow, ["runners", "list", "."]), "status=ok");
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
        "start-ticket-owner.ts",
        "finish-ticket-owner.ts",
        "merge-ready-ticket.ts",
        "verify-ticket-owner.ts",
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

function assertDryRunRole(role: string): void {
    const autoflow = path.join(REPO_ROOT, "bin", "autoflow");
    const output = runNodeScript(autoflow, ["run", role, ".", "--dry-run"]);
    requireLine(output, "status=ok");
    requireLine(output, "dry_run=true");
}

export function runNamedSmoke(name: string): void {
    assertNoRepoOwnedShellFiles();
    assertRuntimeScriptsAreTypeScriptOnly();
    assertCliBasics();

    if (name.includes("runtime") || name.includes("mirror")) {
        assertActiveRuntimeMirror();
    }
    if (name.includes("ticket-owner") || name.includes("worker")) {
        assertDryRunRole("ticket");
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
