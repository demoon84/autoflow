import {fs, path, type ProjectContext} from "../context";
import {writeFileAtomic} from "../fs";

export const runnerTokenStateDefaults: Record<string, string> = {
    cumulative_tokens: "0",
    last_turn_tokens: "0",
    last_turn_input_tokens: "0",
    last_turn_output_tokens: "0",
    last_turn_cache_read_tokens: "0",
    last_turn_cache_create_tokens: "0",
    last_turn_at: "",
    last_turn_tick_id: "",
    token_source: "none",
    last_token_usage_source: "none",
    cumulative_code_files_changed: "0",
    cumulative_code_insertions: "0",
    cumulative_code_deletions: "0",
    cumulative_code_volume: "0",
    cumulative_code_net_delta: "0",
    last_code_ticket_id: "",
    last_code_files_changed: "0",
    last_code_insertions: "0",
    last_code_deletions: "0",
    last_code_volume: "0",
    last_code_net_delta: "0",
    last_code_reported_at: "",
    code_source: "none",
};

export function readRunnerState(ctx: ProjectContext, runnerId: string): Record<string, string> {
    const stateFile = path.join(ctx.boardRoot, "runners", "state", `${runnerId}.state`);
    if (!fs.existsSync(stateFile)) {
        return {};
    }
    const state: Record<string, string> = {};
    for (const line of fs.readFileSync(stateFile, "utf8").split(/\r?\n/)) {
        const index = line.indexOf("=");
        if (index <= 0) {
            continue;
        }
        state[line.slice(0, index)] = line.slice(index + 1);
    }
    return state;
}

export function serializeRunnerState(state: Record<string, string>): string {
    return Object.entries(state).map(([key, value]) => `${key}=${value ?? ""}`).join("\n") + "\n";
}

export function writeRunnerState(ctx: ProjectContext, runnerId: string, updates: Record<string, string>): void {
    const stateFile = path.join(ctx.boardRoot, "runners", "state", `${runnerId}.state`);
    const existing = readRunnerState(ctx, runnerId);
    const next: Record<string, string> = {
        ...runnerTokenStateDefaults,
        ...existing,
        id: runnerId,
        runner_id: runnerId,
        ...updates,
        updated_at: new Date().toISOString(),
    };
    writeFileAtomic(stateFile, serializeRunnerState(next));
}

export function pidIsRunning(pidValue: string): boolean {
    const pid = Number.parseInt(pidValue || "", 10);
    if (!Number.isFinite(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException)?.code === "EPERM";
    }
}

export function intState(state: Record<string, string>, key: string): number {
    const parsed = Number.parseInt(state[key] || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function runnerEffectiveStateStatus(state: Record<string, string>): string {
    const status = state.status || "idle";
    if (status === "running" && !pidIsRunning(state.pid || "")) {
        return "stopped";
    }
    return status;
}
