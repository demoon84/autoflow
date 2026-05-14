import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import * as crypto from "node:crypto";

export {fs, path, spawnSync, crypto};

export const CLI_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
export const REPO_ROOT = path.resolve(CLI_DIR, "..", "..");

export type ParsedArgs = {
    positionals: string[];
    flags: Map<string, string[]>;
    booleans: Set<string>;
};

export type ProjectContext = {
    projectRoot: string;
    boardDirName: string;
    boardRoot: string;
};

export type GitInstallStatus = {
    status: string;
    available: boolean;
    initialized: boolean;
    hasHead: boolean;
    head: string;
    root: string;
    gitignoreUpdated: boolean;
    detail: string;
};

export function out(line = ""): void {
    process.stdout.write(`${line}\n`);
}

export function err(line = ""): void {
    process.stderr.write(`${line}\n`);
}

export function fail(message: string, code = 1): never {
    err(message);
    process.exit(code);
}

export function shellQuoteStrip(value: string): string {
    let outValue = value;
    for (;;) {
        if ((outValue.startsWith("\"") && outValue.endsWith("\"")) || (outValue.startsWith("'") && outValue.endsWith("'"))) {
            outValue = outValue.slice(1, -1);
            continue;
        }
        break;
    }
    return outValue.replace(/^["']+/, "");
}

export function packageVersion(): string {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {version?: string};
        return parsed.version || "0.0.0-dev";
    } catch {
        return "0.0.0-dev";
    }
}

export function oneLine(value: string, max = 300): string {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}
