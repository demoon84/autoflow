import {path, type ProjectContext} from "../context";
import {isRunnerProcessAlive, readRunnerStateFile, serializeRunnerStateFields, writeRunnerStateFile} from "../../../shared/runner-state-store";

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
    return readRunnerStateFile(stateFile);
}

export function serializeRunnerState(state: Record<string, string>): string {
    return serializeRunnerStateFields(state);
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
    writeRunnerStateFile(stateFile, next);
}

export function pidIsRunning(pidValue: string): boolean {
    return isRunnerProcessAlive(pidValue);
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
