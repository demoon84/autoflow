import {path, type ProjectContext} from "../context";
import {isRunnerProcessAlive, readRunnerStateFile, serializeRunnerStateFields, writeRunnerStateFile} from "../../../shared/runner-state-store";

export const runnerTokenAccountingKeys = [
    "cumulative_tokens",
    "cumulative_total_tokens",
    "cumulative_cache_read_tokens",
    "cumulative_cache_create_tokens",
    "cumulative_llm_request_count",
    "last_turn_tokens",
    "last_turn_total_tokens",
    "last_turn_input_tokens",
    "last_turn_output_tokens",
    "last_turn_cache_read_tokens",
    "last_turn_cache_create_tokens",
    "last_turn_llm_request_count",
    "last_turn_at",
    "last_turn_tick_id",
    "last_turn_role",
    "token_source",
    "last_token_usage_source",
];

export const runnerTokenStateDefaults: Record<string, string> = {
    cumulative_tokens: "0",
    cumulative_total_tokens: "0",
    cumulative_cache_read_tokens: "0",
    cumulative_cache_create_tokens: "0",
    cumulative_llm_request_count: "0",
    last_turn_tokens: "0",
    last_turn_total_tokens: "0",
    last_turn_input_tokens: "0",
    last_turn_output_tokens: "0",
    last_turn_cache_read_tokens: "0",
    last_turn_cache_create_tokens: "0",
    last_turn_llm_request_count: "0",
    last_turn_at: "",
    last_turn_tick_id: "",
    last_turn_role: "",
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

export function runnerTokenAccountingResetFields(): Record<string, string> {
    return Object.fromEntries(
        runnerTokenAccountingKeys.map((key) => [key, runnerTokenStateDefaults[key] ?? ""])
    );
}

export function readRunnerState(ctx: ProjectContext, runnerId: string): Record<string, string> {
    const stateFile = path.join(ctx.boardRoot, "runners", "state", `${runnerId}.state`);
    const state = readRunnerStateFile(stateFile);
    return normalizeStaleRunnerState(stateFile, runnerId, state);
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
    writeRunnerStateFile(stateFile, next, new Set(Object.keys(updates)));
}

export function pidIsRunning(pidValue: string): boolean {
    return isRunnerProcessAlive(pidValue);
}

const staleStartingStateMs = 120_000;

function stateTimestampMs(state: Record<string, string>): number {
    const raw = state.control_requested_at || state.updated_at || state.last_event_at || "";
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function shouldRepairStaleStartingState(state: Record<string, string>): boolean {
    const status = state.status || "idle";
    if (status !== "starting" || pidIsRunning(state.pid || "")) {
        return false;
    }
    const timestampMs = stateTimestampMs(state);
    if (!timestampMs) return true;
    return Date.now() - timestampMs > staleStartingStateMs;
}

function normalizeStaleRunnerState(
    stateFile: string,
    runnerId: string,
    state: Record<string, string>,
): Record<string, string> {
    const status = state.status || "idle";
    const staleRunning = status === "running" && !pidIsRunning(state.pid || "");
    const staleStarting = shouldRepairStaleStartingState(state);
    if (!staleRunning && !staleStarting) {
        return state;
    }

    const timestamp = new Date().toISOString();
    const next: Record<string, string> = {
        ...runnerTokenStateDefaults,
        ...state,
        id: state.id || runnerId,
        runner_id: state.runner_id || runnerId,
        status: "stopped",
        runner_status: "stopped",
        pid: "",
        stopped_by: "",
        last_stop_reason: staleStarting ? "stale_starting_no_pid" : state.pid ? "stale_dead_pid" : "stale_no_pid",
        last_result: "loop_stopped",
        control_action: "",
        control_source: "",
        control_requested_at: "",
        control_force: "",
        last_event_at: timestamp,
        updated_at: timestamp,
    };
    for (const key of [
        "active_item",
        "active_ticket_id",
        "active_ticket_title",
        "active_stage",
        "active_spec_ref",
        "active_ticket_path",
    ]) {
        next[key] = "";
    }

    try {
        writeRunnerStateFile(stateFile, next);
    } catch {
        // A read path should still return the repaired view even if disk write fails.
    }
    return next;
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
