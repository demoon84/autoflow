#!/usr/bin/env npx tsx

/*
 * TypeScript common helper surface for board scripts.
 *
 * The historical shell common helper was removed. Runtime scripts now import
 * board-utils.ts directly; this file keeps a named common module for callers
 * that need a stable helper entry while avoiding any shell dependency.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {execFileSync} from "node:child_process";

export * from "./board-utils";

export function autoflowMktemp(prefix = "autoflow."): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    return dir;
}

export function autoflowPidIsRunning(pidValue: string | number | undefined): boolean {
    const pid = Number(pidValue);
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
}

export function autoflowProcessChildren(pidValue: string | number | undefined): number[] {
    const pid = Number(pidValue);
    if (!Number.isInteger(pid) || pid <= 0) {
        return [];
    }
    try {
        const output = execFileSync("pgrep", ["-P", String(pid)], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        return output.split(/\s+/).filter(Boolean).map((item) => Number(item)).filter((item) => Number.isInteger(item));
    } catch {
        return [];
    }
}

export function autoflowNormalizeExistingPath(input: string): string {
    if (!input) {
        return "";
    }
    const resolved = path.resolve(input);
    try {
        if (fs.existsSync(resolved)) {
            return fs.realpathSync(resolved);
        }
    } catch {
        return resolved.replace(/[\\/]+$/, "");
    }
    return resolved.replace(/[\\/]+$/, "");
}

if (require.main === module) {
    process.stdout.write("status=ok\nhelper=common.ts\n");
}
