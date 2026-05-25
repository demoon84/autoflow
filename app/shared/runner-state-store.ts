import * as fs from "node:fs";
import * as path from "node:path";

export type RunnerStateFields = Record<string, string>;

const tokenAccountingKeys = [
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

const codeAccountingKeys = [
    "cumulative_code_files_changed",
    "cumulative_code_insertions",
    "cumulative_code_deletions",
    "cumulative_code_volume",
    "cumulative_code_net_delta",
    "last_code_ticket_id",
    "last_code_files_changed",
    "last_code_insertions",
    "last_code_deletions",
    "last_code_volume",
    "last_code_net_delta",
    "last_code_reported_at",
    "code_source",
];

function positiveStateInt(value: unknown): number {
    const parsed = Number.parseInt(String(value || "0"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isAuthoritativeTokenSource(value: unknown): boolean {
    return String(value || "").trim() === "llm_reported";
}

function stateTimestampMs(value: unknown): number {
    const ms = Date.parse(String(value || ""));
    return Number.isFinite(ms) ? ms : 0;
}

function copyFreshAccountingFields(
    target: RunnerStateFields,
    latest: RunnerStateFields,
    keys: string[],
    explicitKeys: Set<string>,
): void {
    for (const key of keys) {
        if (explicitKeys.has(key)) continue;
        if (latest[key] !== undefined) {
            target[key] = latest[key];
        }
    }
}

function preserveFreshAccountingFields(
    file: string,
    target: RunnerStateFields,
    explicitKeys = new Set<string>(),
): RunnerStateFields {
    const latest = readRunnerStateFile(file);
    const latestCumulative = positiveStateInt(latest.cumulative_tokens);
    const targetCumulative = positiveStateInt(target.cumulative_tokens);
    if (
        isAuthoritativeTokenSource(latest.token_source) &&
        (latestCumulative >= targetCumulative || !isAuthoritativeTokenSource(target.token_source))
    ) {
        copyFreshAccountingFields(target, latest, tokenAccountingKeys, explicitKeys);
    }

    const latestCodeVolume = positiveStateInt(latest.cumulative_code_volume);
    const targetCodeVolume = positiveStateInt(target.cumulative_code_volume);
    const latestCodeAt = stateTimestampMs(latest.last_code_reported_at);
    const targetCodeAt = stateTimestampMs(target.last_code_reported_at);
    if (
        (latest.code_source || "none") !== "none" &&
        (
            (target.code_source || "none") === "none" ||
            latestCodeAt > targetCodeAt ||
            (latestCodeAt === targetCodeAt && latestCodeVolume > targetCodeVolume)
        )
    ) {
        copyFreshAccountingFields(target, latest, codeAccountingKeys, explicitKeys);
    }
    return target;
}

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

export function writeRunnerStateFile(
    file: string,
    state: RunnerStateFields,
    explicitAccountingKeys = new Set<string>(),
): void {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(
        tempFile,
        serializeRunnerStateFields(preserveFreshAccountingFields(file, {...state}, explicitAccountingKeys)),
        "utf8",
    );
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
