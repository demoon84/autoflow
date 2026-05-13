#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import {autoflowPidIsRunning} from "./common";

export function runnerNowIso(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export function runnerBoardRoot(): string {
    if (process.env.AUTOFLOW_BOARD_ROOT) {
        return path.resolve(process.env.AUTOFLOW_BOARD_ROOT);
    }
    if (process.env.BOARD_ROOT) {
        return path.resolve(process.env.BOARD_ROOT);
    }
    const cwd = process.cwd();
    if (path.basename(cwd) === ".autoflow") {
        return cwd;
    }
    return path.join(cwd, ".autoflow");
}

export function runnerConfigBasePath(boardRoot = runnerBoardRoot()): string {
    return path.join(boardRoot, "runners", "config.toml");
}

export function runnerConfigLocalPath(boardRoot = runnerBoardRoot()): string {
    return path.join(boardRoot, "runners", "config.local.toml");
}

export function runnerConfigPath(boardRoot = runnerBoardRoot()): string {
    const local = runnerConfigLocalPath(boardRoot);
    return fs.existsSync(local) ? local : runnerConfigBasePath(boardRoot);
}

export function runnerConfigWritePath(boardRoot = runnerBoardRoot()): string {
    const local = runnerConfigLocalPath(boardRoot);
    if (!fs.existsSync(local)) {
        fs.mkdirSync(path.dirname(local), {recursive: true});
        fs.copyFileSync(runnerConfigBasePath(boardRoot), local);
    }
    return local;
}

export function runnerStateDir(boardRoot = runnerBoardRoot()): string {
    return path.join(boardRoot, "runners", "state");
}

export function runnerLogDir(boardRoot = runnerBoardRoot()): string {
    return path.join(boardRoot, "runners", "logs");
}

export function runnerPidIsRunning(pid: string | number | undefined): boolean {
    return autoflowPidIsRunning(pid);
}

export function ticketOwnerLockValue(runnerId: string, runnerPid = String(process.pid), spawnedAt = runnerNowIso()): string {
    return `${runnerId}:${runnerPid}:${spawnedAt}`;
}

export function ticketOwnerLockParse(raw: string): {runnerId: string; pid: string; spawnedAt: string} | null {
    const match = raw.match(/^(.+):([0-9]+):([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)$/);
    if (!match) {
        return null;
    }
    return {
        runnerId: match[1] || "",
        pid: match[2] || "",
        spawnedAt: match[3] || "",
    };
}

export function runnerEffectiveStateStatus(status = "idle", mode = "", pid = ""): string {
    if (status === "running" && mode === "loop" && !runnerPidIsRunning(pid)) {
        return "stopped";
    }
    return status || "idle";
}

if (require.main === module) {
    process.stdout.write("status=ok\nhelper=runner-common.ts\n");
    process.stdout.write(`board_root=${runnerBoardRoot()}\n`);
}
