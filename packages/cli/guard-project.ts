#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";

const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function usage(): void {
    process.stderr.write("Usage:\n  guard-project.ts [project-root] [board-dir-name] [--strict]\n");
}

function defaultBoardDirName(): string {
    const manifest = path.join(REPO_ROOT, "scaffold", "manifest.toml");
    try {
        const text = fs.readFileSync(manifest, "utf8");
        const section = text.match(/\[install\]([\s\S]*?)(?:\n\[|$)/);
        const value = section?.[1]?.match(/^\s*default_board_dir\s*=\s*"([^"]+)"/m)?.[1];
        return value || ".autoflow";
    } catch {
        return ".autoflow";
    }
}

function stripSurroundingShellQuotes(value: string): string {
    let out = value;
    for (; ;) {
        if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
            out = out.slice(1, -1);
            continue;
        }
        break;
    }
    while (out.startsWith('"') || out.startsWith("'")) out = out.slice(1);
    return out;
}

function resolveProjectRoot(input: string): string {
    const normalized = stripSurroundingShellQuotes(input || ".");
    const resolved = path.resolve(normalized);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        process.stderr.write(`Project root not found: ${resolved}\n`);
        process.exit(1);
    }
    return resolved;
}

function boardRootPath(projectRoot: string, boardDirName: string): string {
    const clean = stripSurroundingShellQuotes(boardDirName || defaultBoardDirName());
    return path.isAbsolute(clean) ? clean : path.join(projectRoot, clean);
}

function parseArgs(argv: string[]): { positionals: string[]; strict: boolean } {
    const positionals: string[] = [];
    let strict = false;

    for (const arg of argv) {
        if (arg === "--strict") {
            strict = true;
            continue;
        }
        if (arg === "-h" || arg === "--help") {
            usage();
            process.exit(0);
        }
        positionals.push(arg);
    }

    return {positionals, strict};
}

const {positionals, strict} = parseArgs(process.argv.slice(2));
const projectRoot = resolveProjectRoot(positionals[0] || ".");
const boardRoot = boardRootPath(projectRoot, positionals[1] || defaultBoardDirName());

if (!fs.existsSync(boardRoot) || !fs.statSync(boardRoot).isDirectory()) {
    process.stderr.write(`Board root not found: ${boardRoot}\n`);
    process.exit(1);
}

function isExecutable(file: string): boolean {
    try {
        return (fs.statSync(file).mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

let guardScript = path.join(boardRoot, "scripts", "board-guard.js");
if (!isExecutable(guardScript)) {
    guardScript = path.join(REPO_ROOT, "runtime", "board-scripts", "board-guard.js");
}

const result = spawnSync(guardScript, strict ? ["--strict"] : [], {
    stdio: "inherit",
    env: {
        ...process.env,
        AUTOFLOW_BOARD_ROOT: boardRoot,
        AUTOFLOW_PROJECT_ROOT: projectRoot,
    },
});

if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
}

process.exit(typeof result.status === "number" ? result.status : 1);
