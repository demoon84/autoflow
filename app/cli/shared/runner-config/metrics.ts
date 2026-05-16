import {type ProjectContext} from "../context";
import {parseRunnerConfig} from "./parse";
import {intState, readRunnerState} from "./state";

export function runnerOwnsCodeMetrics(runner: Record<string, string>): boolean {
    const id = runner.id || "";
    const role = runner.role || "";
    return role === "worker" || role === "ticket" || id === "worker" || id.startsWith("worker-");
}

export function codeMetricTotals(ctx: ProjectContext, runners = parseRunnerConfig(ctx)): Record<string, number> {
    const totals = {
        files: 0,
        insertions: 0,
        deletions: 0,
        volume: 0,
        net: 0,
    };
    for (const runner of runners) {
        if (!runnerOwnsCodeMetrics(runner)) continue;
        const state = readRunnerState(ctx, runner.id || "");
        totals.files += intState(state, "cumulative_code_files_changed");
        totals.insertions += intState(state, "cumulative_code_insertions");
        totals.deletions += intState(state, "cumulative_code_deletions");
        totals.volume += intState(state, "cumulative_code_volume");
        totals.net += intState(state, "cumulative_code_net_delta");
    }
    return totals;
}
