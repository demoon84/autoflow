import {path, out, type ProjectContext} from "../context";
import {pidIsRunning, readRunnerState, runnerEffectiveStateStatus} from "./state";
import {runnerTokenAccounting} from "./metrics";
import {runnerConfigFingerprint, runnerStringFieldDefaults} from "./serialize";

function lastResultForOutput(state: Record<string, string>, effectiveStatus: string): string {
    const value = state.last_result || "";
    if (effectiveStatus === "stopped" && /^signal_/i.test(value)) {
        return "loop_stopped";
    }
    return value;
}

function activeStageCarriesWork(value: string): boolean {
    return /^(planning|generating-todo|claimed|executing|inprogress|verifying|verify_pending|verifier_pending|merging|revision_requested|replan_requested|blocked)$/.test(
        String(value || "").toLowerCase(),
    );
}

export function outputRunner(index: number, ctx: ProjectContext, runner: Record<string, string>): void {
    const prefix = `runner.${index}.`;
    const state = readRunnerState(ctx, runner.id || "");
    const stateStatus = runnerEffectiveStateStatus(state);
    const lastResult = lastResultForOutput(state, stateStatus);
    const configFingerprint = runnerConfigFingerprint(runner);
    const tokenAccounting = runnerTokenAccounting(ctx, runner.id || "");
    const field = (key: string, fallback = "") => runner[key] ?? fallback;
    const runtimePidIsAlive = stateStatus !== "stopped" && pidIsRunning(state.pid || "");
    const displayField = (key: string, fallback = "") => {
        if (runtimePidIsAlive && state[key]) return state[key];
        return field(key, fallback);
    };
    const assignmentStatus = (state.assignment_status || "").toLowerCase();
    const hasOpenAssignment = Boolean(assignmentStatus && !["completed", "released"].includes(assignmentStatus));
    const runtimeHasActiveWork = activeStageCarriesWork(state.active_stage || "") || Boolean(
        state.active_item ||
        state.active_ticket_title ||
        state.active_spec_ref,
    );
    const assignmentScopedFields = new Set(["assignment_role", "assignment_status", "assigned_item_ref"]);
    const runtimeScopedFields = new Set([
        "active_role",
        "active_item",
        "active_ticket_id",
        "active_ticket_title",
        "active_ticket_path",
        "active_stage",
        "active_spec_ref",
    ]);
    const activeField = (key: string) => {
        if (assignmentScopedFields.has(key) && !hasOpenAssignment) return "";
        if (runtimeScopedFields.has(key) && !hasOpenAssignment && !runtimeHasActiveWork) {
            return key === "active_stage" && (state.active_stage || "").toLowerCase() === "idle" ? "idle" : "";
        }
        if ((stateStatus === "idle" || stateStatus === "stopped") && !hasOpenAssignment && !runtimeHasActiveWork) {
            return "";
        }
        return state[key] || "";
    };

    out(`${prefix}id=${field("id")}`);
    out(`${prefix}role=${displayField("role")}`);
    out(`${prefix}agent=${displayField("agent", runnerStringFieldDefaults.agent)}`);
    out(`${prefix}codex_history=${displayField("codex_history", runnerStringFieldDefaults.codex_history)}`);
    out(`${prefix}model=${displayField("model", runnerStringFieldDefaults.model)}`);
    out(`${prefix}reasoning=${displayField("reasoning", runnerStringFieldDefaults.reasoning)}`);
    out(`${prefix}mode=${field("mode", "")}`);
    out(`${prefix}interval_seconds=${field("interval_seconds", "")}`);
    out(`${prefix}interval_effective_seconds=${field("interval_seconds", "")}`);
    out(`${prefix}enabled=${field("enabled", runnerStringFieldDefaults.enabled)}`);
    out(`${prefix}command=${field("command", "")}`);
    out(`${prefix}command_preview=${field("command", "")}`);
    out(`${prefix}config_fingerprint=${configFingerprint}`);
    out(`${prefix}applied_config_fingerprint=${state.applied_config_fingerprint || state.config_fingerprint || configFingerprint}`);
    out(`${prefix}config_applied_at=${state.config_applied_at || state.updated_at || state.last_event_at || ""}`);
    out(`${prefix}state_status=${stateStatus}`);
    // PID 는 stopped 가 아니고 실제 PID 가 살아 있을 때만 노출. idle/starting 도 PTY 가 살아 있으면 그대로 보여야
    // renderer 가 "중지됨" 으로 잘못 표시하지 않는다.
    out(`${prefix}pid=${stateStatus !== "stopped" && pidIsRunning(state.pid || "") ? state.pid || "" : ""}`);
    out(`${prefix}started_at=${state.started_at || ""}`);
    out(`${prefix}last_event_at=${state.last_event_at || state.updated_at || ""}`);
    out(`${prefix}last_adapter_chunk_at=${state.last_adapter_chunk_at || ""}`);
    out(`${prefix}active_role=${activeField("active_role") || activeField("assignment_role") || activeField("role")}`);
    out(`${prefix}assignment_role=${activeField("assignment_role")}`);
    out(`${prefix}assignment_status=${activeField("assignment_status")}`);
    out(`${prefix}assigned_item_ref=${activeField("assigned_item_ref")}`);
    out(`${prefix}active_item=${activeField("active_item")}`);
    out(`${prefix}active_ticket_id=${activeField("active_ticket_id")}`);
    out(`${prefix}active_ticket_title=${activeField("active_ticket_title")}`);
    out(`${prefix}active_ticket_path=${activeField("active_ticket_path")}`);
    out(`${prefix}active_stage=${activeField("active_stage")}`);
    out(`${prefix}active_spec_ref=${activeField("active_spec_ref")}`);
    out(`${prefix}last_result=${lastResult}`);
    out(`${prefix}artifact_status=${state.artifact_status || ""}`);
    out(`${prefix}artifact_runtime_status=${state.artifact_runtime_status || ""}`);
    out(`${prefix}artifact_prompt_status=${state.artifact_prompt_status || ""}`);
    out(`${prefix}artifact_stdout_status=${state.artifact_stdout_status || ""}`);
    out(`${prefix}artifact_stderr_status=${state.artifact_stderr_status || ""}`);
    out(`${prefix}last_log_line=${state.last_log_line || ""}`);
    out(`${prefix}cumulative_tokens=${tokenAccounting.cumulativeTokens}`);
    out(`${prefix}cumulative_total_tokens=${tokenAccounting.cumulativeTotalTokens}`);
    out(`${prefix}cumulative_cache_read_tokens=${tokenAccounting.cumulativeCacheReadTokens}`);
    out(`${prefix}cumulative_cache_create_tokens=${tokenAccounting.cumulativeCacheCreateTokens}`);
    out(`${prefix}cumulative_llm_request_count=${tokenAccounting.cumulativeLlmRequestCount}`);
    out(`${prefix}last_turn_tokens=${tokenAccounting.lastTurnTokens}`);
    out(`${prefix}last_turn_total_tokens=${tokenAccounting.lastTurnTotalTokens}`);
    out(`${prefix}last_turn_input_tokens=${tokenAccounting.lastTurnInputTokens}`);
    out(`${prefix}last_turn_output_tokens=${tokenAccounting.lastTurnOutputTokens}`);
    out(`${prefix}last_turn_cache_read_tokens=${tokenAccounting.lastTurnCacheReadTokens}`);
    out(`${prefix}last_turn_cache_create_tokens=${tokenAccounting.lastTurnCacheCreateTokens}`);
    out(`${prefix}last_turn_llm_request_count=${tokenAccounting.lastTurnLlmRequestCount}`);
    out(`${prefix}last_turn_at=${tokenAccounting.lastTurnAt}`);
    out(`${prefix}last_turn_tick_id=${tokenAccounting.lastTurnTickId}`);
    out(`${prefix}token_source=${tokenAccounting.tokenSource}`);
    out(`${prefix}last_token_usage_source=${tokenAccounting.lastTokenUsageSource}`);
    out(`${prefix}cumulative_code_files_changed=${state.cumulative_code_files_changed || "0"}`);
    out(`${prefix}cumulative_code_insertions=${state.cumulative_code_insertions || "0"}`);
    out(`${prefix}cumulative_code_deletions=${state.cumulative_code_deletions || "0"}`);
    out(`${prefix}cumulative_code_volume=${state.cumulative_code_volume || "0"}`);
    out(`${prefix}cumulative_code_net_delta=${state.cumulative_code_net_delta || "0"}`);
    out(`${prefix}last_code_ticket_id=${state.last_code_ticket_id || ""}`);
    out(`${prefix}last_code_files_changed=${state.last_code_files_changed || "0"}`);
    out(`${prefix}last_code_insertions=${state.last_code_insertions || "0"}`);
    out(`${prefix}last_code_deletions=${state.last_code_deletions || "0"}`);
    out(`${prefix}last_code_volume=${state.last_code_volume || "0"}`);
    out(`${prefix}last_code_net_delta=${state.last_code_net_delta || "0"}`);
    out(`${prefix}last_code_reported_at=${state.last_code_reported_at || ""}`);
    out(`${prefix}code_source=${state.code_source || "none"}`);
    out(`${prefix}state_path=${path.join(ctx.boardRoot, "runners", "state", `${runner.id}.state`)}`);
}
