import * as fs from "node:fs";
import * as path from "node:path";

export type RunnerStateFields = Record<string, string>;

export function parseRunnerStateText(text: string): RunnerStateFields {
    const state: RunnerStateFields = {};
    for (const line of text.split(/\r?\n/)) {
        const index = line.indexOf("=");
        if (index <= 0) {
            continue;
        }
        state[line.slice(0, index)] = line.slice(index + 1);
    }
    return state;
}

export function serializeRunnerStateFields(state: RunnerStateFields): string {
    return Object.entries(state).map(([key, value]) => `${key}=${value ?? ""}`).join("\n") + "\n";
}

export function readRunnerStateFile(file: string): RunnerStateFields {
    try {
        return parseRunnerStateText(fs.readFileSync(file, "utf8"));
    } catch {
        return {};
    }
}

export function writeRunnerStateFile(file: string, state: RunnerStateFields): void {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, serializeRunnerStateFields(state), "utf8");
    fs.renameSync(tempFile, file);
}

export function isRunnerProcessAlive(pidValue: string | number): boolean {
    const pid = typeof pidValue === "number" ? pidValue : Number.parseInt(pidValue || "", 10);
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException)?.code === "EPERM";
    }
}
