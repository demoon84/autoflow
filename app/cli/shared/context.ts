import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import * as crypto from "node:crypto";

export {fs, path, spawnSync, crypto};

// Repo root resolution. When the Autoflow CLI runs as its own process
// (`autoflow` shell script -> tsx -> autoflow.ts), process.argv[1] points at
// autoflow.ts and the cli sits at <repo>/app/cli. When the desktop main
// process imports these helpers in-process to skip subprocess overhead, the
// argv[1] heuristic is wrong, so we honor an explicit AUTOFLOW_REPO_ROOT env
// override the desktop sets before requiring any CLI module.
function resolveRepoRoot(): string {
    const override = process.env.AUTOFLOW_REPO_ROOT;
    if (override && fs.existsSync(path.join(override, "package.json"))) {
        return override;
    }
    const cliDir = path.dirname(path.resolve(process.argv[1] || __filename));
    return path.resolve(cliDir, "..", "..");
}

export const REPO_ROOT = resolveRepoRoot();
export const CLI_DIR = path.join(REPO_ROOT, "app", "cli");

// User-scope share root. Holds static board templates/rules/agents/state-schema
// shared across every project install. Override with AUTOFLOW_SHARE_ROOT;
// otherwise defaults to ~/.autoflow/share.
export function resolveShareRoot(): string {
    const override = process.env.AUTOFLOW_SHARE_ROOT;
    if (override && override.trim()) {
        return path.resolve(override);
    }
    return path.join(os.homedir(), ".autoflow", "share");
}

export const SHARE_ROOT = resolveShareRoot();

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
