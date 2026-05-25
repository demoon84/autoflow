import fs from "node:fs/promises";
import path from "node:path";
import { ptyRunnerMeta } from "./pty-scope";

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

export const runnerTokenAccountingKeys: string[] = [
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

export const runnerCodeAccountingKeys: string[] = [
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

export function runnerTokenAccountingResetFields(): Record<string, string> {
  return Object.fromEntries(
    runnerTokenAccountingKeys.map((key) => [key, runnerTokenStateDefaults[key] ?? ""])
  );
}

export function isRunnerTokenSourceAuthoritative(source: unknown): boolean {
  return String(source || "").trim() === "llm_reported";
}

function parsePositiveStateInteger(value: unknown): number {
  const parsed = Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function copyStateKeys(target: Map<string, string>, source: Map<string, string>, keys: string[], explicitKeys: Set<string>): void {
  for (const key of keys) {
    if (explicitKeys.has(key) || !source.has(key)) continue;
    target.set(key, source.get(key) || "");
  }
}

export function preserveLatestRunnerAccountingFields(
  target: Map<string, string>,
  latest: Map<string, string>,
  explicitKeys: Set<string>
): void {
  const latestCumulative = parsePositiveStateInteger(latest.get("cumulative_tokens"));
  const targetCumulative = parsePositiveStateInteger(target.get("cumulative_tokens"));
  const latestTokenSource = latest.get("token_source") || "";
  const targetTokenSource = target.get("token_source") || "";
  if (
    isRunnerTokenSourceAuthoritative(latestTokenSource) &&
    (latestCumulative >= targetCumulative || !isRunnerTokenSourceAuthoritative(targetTokenSource))
  ) {
    copyStateKeys(target, latest, runnerTokenAccountingKeys, explicitKeys);
  }

  const latestCodeVolume = parsePositiveStateInteger(latest.get("cumulative_code_volume"));
  const targetCodeVolume = parsePositiveStateInteger(target.get("cumulative_code_volume"));
  if (
    (latest.get("code_source") || "none") !== "none" &&
    (latestCodeVolume > targetCodeVolume || (target.get("code_source") || "none") === "none")
  ) {
    copyStateKeys(target, latest, runnerCodeAccountingKeys, explicitKeys);
  }
}

type PtyRunnerLike = { status?: string; pid?: number | string; startedAt?: string };

export async function writePtyRunnerStateFile(runnerId: string, fields: Record<string, unknown>): Promise<void> {
  try {
    const meta = ptyRunnerMeta.get(runnerId);
    if (!meta) return;
    const publicRunnerId = String(meta.runnerId || runnerId);
    const stateDir = path.join(String(meta.projectRoot || ""), String(meta.boardDirName || ""), "runners", "state");
    await fs.mkdir(stateDir, { recursive: true });
    const statePath = path.join(stateDir, `${publicRunnerId}.state`);
    let existing = "";
    try { existing = await fs.readFile(statePath, "utf8"); } catch {}
    const lines = new Map<string, string>();
    for (const line of existing.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      lines.set(line.slice(0, eq), line.slice(eq + 1));
    }
    const ptyMgr = (globalThis as any).__autoflowPtyManager as { get?: (id: string) => PtyRunnerLike | null | undefined } | undefined;
    const ptyRunner = ptyMgr?.get ? ptyMgr.get(runnerId) : null;
    const isPtyAlive = Boolean(ptyRunner && ptyRunner.status === "running");
    if (isPtyAlive && ptyRunner) {
      const assignmentStatus = String(lines.get("assignment_status") || "").toLowerCase();
      const hasOpenAssignment = Boolean(assignmentStatus && !["completed", "released", "expired"].includes(assignmentStatus));
      const activeStage = String(lines.get("active_stage") || "").toLowerCase();
      const hasActiveWorkContext = Boolean(String(
        lines.get("active_item") ||
        lines.get("active_ticket_id") ||
        lines.get("active_ticket_path") ||
        lines.get("active_spec_ref") ||
        lines.get("assigned_item_ref") ||
        ""
      ).trim());
      const stateIsIdleWaiting =
        !hasOpenAssignment &&
        !hasActiveWorkContext &&
        (
          String(lines.get("status") || "").toLowerCase() === "idle" ||
          String(lines.get("runner_status") || "").toLowerCase() === "idle" ||
          activeStage === "idle"
        );
      lines.set("id", publicRunnerId);
      if (meta.role) lines.set("role", String(meta.role));
      if (meta.agent) lines.set("agent", String(meta.agent));
      lines.set("mode", "pty");
      if (!stateIsIdleWaiting) {
        lines.set("status", "running");
        lines.set("runner_status", "running");
      }
      if (ptyRunner.pid) lines.set("pid", String(ptyRunner.pid));
      if (meta.startedAt) lines.set("started_at", String(meta.startedAt));
      lines.set("stopped_by", "");
      if ((lines.get("last_stop_reason") || "").startsWith("startup_")) {
        lines.set("last_stop_reason", "");
      }
      if (/^(signal_|exit_)/i.test(lines.get("last_process_result") || "") || /^(user_stopped|loop_stopped)$/i.test(lines.get("last_process_result") || "")) {
        lines.set("last_process_result", "");
      }
      if (/^(user_stopped|loop_stopped)$/i.test(lines.get("last_result") || "")) {
        lines.set("last_result", "");
      }
    }
    for (const [key, value] of Object.entries(runnerTokenStateDefaults)) {
      if (!lines.has(key)) lines.set(key, value);
    }
    const explicitFields = new Set(Object.keys(fields || {}));
    for (const [k, v] of Object.entries(fields || {})) {
      if (v === undefined || v === null) continue;
      lines.set(k, String(v));
    }
    try {
      const latest = new Map<string, string>();
      const latestText = await fs.readFile(statePath, "utf8");
      for (const line of latestText.split(/\r?\n/)) {
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        latest.set(line.slice(0, eq), line.slice(eq + 1));
      }
      preserveLatestRunnerAccountingFields(lines, latest, explicitFields);
    } catch {}
    lines.set("updated_at", new Date().toISOString());
    const out = Array.from(lines.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const tmpPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, `${out}\n`, "utf8");
    await fs.rename(tmpPath, statePath);
  } catch {}
}

export function mirrorExistingPtyRunnerRunningState(
  runnerKey: string,
  existing: PtyRunnerLike | null | undefined,
  fields: Record<string, unknown> = {}
): boolean {
  if (!existing || existing.status !== "running") return false;
  void writePtyRunnerStateFile(runnerKey, {
    status: "running",
    runner_status: "running",
    mode: "pty",
    pid: String(existing.pid || ""),
    started_at: existing.startedAt || fields.started_at || "",
    last_event_at: new Date().toISOString(),
    stopped_by: "",
    last_stop_reason: "",
    last_process_result: "",
    control_action: "",
    control_source: "",
    control_requested_at: "",
    control_force: "",
    ...fields
  });
  return true;
}
