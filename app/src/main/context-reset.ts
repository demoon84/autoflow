import fsSync from "node:fs";
import path from "node:path";
import { appendRunnerLog, normalizeRunnerRole } from "./board-queue";
import {
  defaultBoardDirName,
  ptyRunnerKey,
  ptyRunnerMatchesRequestedScope,
  ptyRunnerMeta
} from "./pty-scope";
import { writePtyRunnerStateFile } from "./runner-state-write";
import { autoflowShellCommand } from "./shell-path";

const contextResetTimers = new Map<string, ContextResetEntry>();
const contextResetLastInjected = new Map<string, { at: number; mode: string; trigger: string; reason: string }>();

type ContextResetEntry = {
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  trigger: string;
  mode: string;
};

type MetaLike = {
  projectRoot?: string;
  boardDirName?: string;
  runnerId?: string;
  initialPromptSentAt?: string;
  [key: string]: unknown;
};

type PtyManagerLike = {
  get?: (runnerKey: string) => { lastDataAt?: number; status?: string } | null | undefined;
  injectContextReset?: (runnerKey: string, mode: string) => boolean;
  snapshot?: (runnerKey: string) => string | undefined;
};

export function normalizeContextResetMode(raw: unknown): string {
  const mode = String(raw || "").trim().toLowerCase();
  return ["compact", "clear", "auto"].includes(mode) ? mode : "compact";
}

export function resolveContextResetMode(requestedMode: string, cumulativeTokens: number, threshold: number): string {
  if (requestedMode === "auto") {
    return cumulativeTokens >= threshold ? "clear" : "compact";
  }
  return requestedMode === "clear" ? "clear" : "compact";
}

export function scheduleContextReset(
  runnerId: string,
  meta: MetaLike | undefined | null,
  opts: { mode?: string; trigger?: string; reason?: string } = {}
): void {
  const enabled = (process.env.AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS ?? "1") !== "0";
  if (!enabled || !runnerId || !meta?.projectRoot) return;

  const boardDirName = String(meta.boardDirName || defaultBoardDirName());
  const boardRoot = path.join(String(meta.projectRoot), boardDirName);
  const runnerKey = ptyRunnerMeta.has(runnerId) ? runnerId : ptyRunnerKey(String(meta.projectRoot), boardDirName, runnerId);
  const publicRunnerId = String(meta.runnerId || runnerId);
  const thresholdRaw = Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD || "100000", 10);
  const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 100000;
  const respawnFallback = (process.env.AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK ?? "1") !== "0";
  const requestedMode = normalizeContextResetMode(opts.mode || process.env.AUTOFLOW_CONTEXT_RESET_MODE || "compact");
  const trigger = String(opts.trigger || opts.reason || "ticket_boundary");
  const resetReason = String(opts.reason || trigger);
  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_DELAY_MS || "3000", 10) || 3000);
  const minIdleMs = Math.max(0, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_MIN_IDLE_MS || "2500", 10) || 2500);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_MAX_ATTEMPTS || "24", 10) || 24);
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_DEDUP_MS || "300000", 10) || 300000);
  const key = runnerKey;
  const existing = contextResetTimers.get(key);

  if (existing?.timer && requestedMode !== "clear") {
    appendRunnerLog(boardRoot, publicRunnerId, {
      event: "context_reset_already_scheduled",
      runner_id: publicRunnerId,
      mode: requestedMode,
      trigger,
      reason: resetReason,
      existing_trigger: existing.trigger || "",
      existing_attempts: String(existing.attempt || 0)
    });
    return;
  }
  if (existing?.timer) clearTimeout(existing.timer);

  const now = Date.now();
  const recent = contextResetLastInjected.get(key);
  if (recent?.at && now - recent.at < dedupMs && requestedMode !== "clear") {
    appendRunnerLog(boardRoot, publicRunnerId, {
      event: "context_reset_deduped",
      runner_id: publicRunnerId,
      mode: requestedMode,
      trigger,
      reason: resetReason,
      last_mode: recent.mode || "",
      last_trigger: recent.trigger || "",
      last_reason: recent.reason || "",
      age_ms: String(Math.max(0, now - recent.at)),
      dedup_ms: String(dedupMs)
    });
    return;
  }

  const entry: ContextResetEntry = {
    attempt: 0,
    timer: null,
    trigger,
    mode: requestedMode
  };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    contextResetTimers.delete(key);
  };

  const scheduleNext = (waitMs: number) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;

      const mgr = (globalThis as any).__autoflowPtyManager as PtyManagerLike | undefined;
      const runner = mgr && typeof mgr.get === "function" ? mgr.get(runnerKey) : null;
      if (
        !mgr ||
        !runner ||
        runner.status !== "running" ||
        !ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot: String(meta.projectRoot), boardDirName })
      ) {
        appendRunnerLog(boardRoot, publicRunnerId, {
          event: "context_reset_cancelled",
          runner_id: publicRunnerId,
          trigger,
          reason: resetReason,
          cause: "runner_not_running"
        });
        clearEntry();
        return;
      }

      const lastDataAt = Number.isFinite(runner?.lastDataAt) ? Number(runner.lastDataAt) : 0;
      const idleMs = lastDataAt ? Date.now() - lastDataAt : Number.POSITIVE_INFINITY;
      if (idleMs < minIdleMs) {
        if (entry.attempt >= maxAttempts) {
          appendRunnerLog(boardRoot, publicRunnerId, {
            event: "context_reset_deferred_timeout",
            runner_id: publicRunnerId,
            trigger,
            reason: resetReason,
            idle_ms: String(Math.max(0, Math.round(idleMs))),
            attempts: String(entry.attempt)
          });
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }

      let cumulativeTokens = 0;
      try {
        const statePath = path.join(boardRoot, "runners", "state", `${publicRunnerId}.state`);
        const raw = fsSync.readFileSync(statePath, "utf8");
        const m = raw.match(/(?:^|\n)cumulative_tokens=(\d+)/);
        if (m) cumulativeTokens = Number.parseInt(m[1], 10) || 0;
      } catch {}
      const mode = resolveContextResetMode(requestedMode, cumulativeTokens, threshold);
      const injected = mgr.injectContextReset?.(runnerKey, mode);
      if (!injected) {
        appendRunnerLog(boardRoot, publicRunnerId, {
          event: "context_reset_inject_failed",
          runner_id: publicRunnerId,
          mode,
          trigger,
          reason: resetReason
        });
        clearEntry();
        return;
      }

      appendRunnerLog(boardRoot, publicRunnerId, {
        event: "context_reset",
        runner_id: publicRunnerId,
        mode,
        trigger,
        reason: resetReason,
        cumulative_before: cumulativeTokens,
        threshold,
      });
      contextResetLastInjected.set(key, {
        at: Date.now(),
        mode,
        trigger,
        reason: resetReason
      });
      clearEntry();

      // post_context_reset / context_reset_recovery sweep: /compact 또는 /clear
      // 입력으로 runner 컨텍스트가 비워진 뒤에는 파일 변경이 없어도
      // planner/worker/verifier/wiki queue 를 한 번 재평가해 active 작업이 다시
      // handoff turn 으로 주입되도록 한다. 이때 force=true 로 호출해 동일
      // fingerprint 의 dedup 으로 retry 가 조용히 drop 되는 것을 막는다.
      // fingerprint guard 와 maxAttempts 자체는 schedule 내부에서 계속 유지된다.
      // 각 scheduler 는 내부 idle/prompt-readiness 검사로 /compact 입력과
      // handoff prompt 가 같은 prompt line 에서 충돌하지 않도록 대기한다.
      appendRunnerLog(boardRoot, publicRunnerId, {
        event: "context_reset_recovery_scheduled",
        runner_id: publicRunnerId,
        mode,
        trigger,
        reason: resetReason
      });
      void writePtyRunnerStateFile(runnerKey, {
        context_reset_recovery_event: "scheduled",
        context_reset_recovery_reason: resetReason,
        context_reset_recovery_trigger: trigger,
        context_reset_recovery_mode: mode,
        context_reset_recovery_at: new Date().toISOString()
      });
      try {
        const { scheduleAllHandoffTurnsForScope } = require("./handoff-turns");
        scheduleAllHandoffTurnsForScope({
          projectRoot: String(meta.projectRoot),
          boardDirName,
          boardRoot,
          reasons: ["context-reset"],
          force: true
        });
      } catch {}

      if (respawnFallback) {
        const beforeData = runner.lastDataAt;
        setTimeout(() => {
          const r = mgr.get?.(runnerKey);
          if (!r || r.status !== "running") return;
          if (r.lastDataAt === beforeData) {
            appendRunnerLog(boardRoot, publicRunnerId, {
              event: "context_reset_no_output",
              runner_id: publicRunnerId,
              mode,
              threshold,
            });
          }
        }, 30000);
      }
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };

  contextResetTimers.set(key, entry);
  appendRunnerLog(boardRoot, publicRunnerId, {
    event: "context_reset_scheduled",
    runner_id: publicRunnerId,
    mode: requestedMode,
    trigger,
    reason: resetReason,
    delay_ms: String(delayMs),
    min_idle_ms: String(minIdleMs),
    max_attempts: String(maxAttempts)
  });
  scheduleNext(delayMs);
}

export function runnerIdForContextResetQueueChange(relPath: unknown): string {
  const match = String(relPath || "").match(/^runners\/state\/([A-Za-z0-9_.-]+)-context-reset\.queue\.jsonl$/);
  return match ? match[1] : "";
}

export function readPendingRunnerContextResetEvents(boardRoot: string, runnerId: string): unknown[] {
  if (!boardRoot || !runnerId) return [];
  const queuePath = path.join(boardRoot, "runners", "state", `${runnerId}-context-reset.queue.jsonl`);
  const pointerPath = path.join(boardRoot, "runners", "state", `${runnerId}-context-reset.pointer`);
  let pointer = "";
  try {
    pointer = fsSync.readFileSync(pointerPath, "utf8").trim();
  } catch {}
  const events: unknown[] = [];
  let latest = pointer;
  try {
    const raw = fsSync.readFileSync(queuePath, "utf8");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      try {
        const event = JSON.parse(line);
        const at = String(event?.at || "");
        if (!at || (pointer && at <= pointer)) continue;
        events.push(event);
        if (!latest || at > latest) latest = at;
      } catch {}
    }
  } catch {
    return [];
  }
  if (latest && latest !== pointer) {
    try {
      fsSync.writeFileSync(pointerPath, `${latest}\n`, "utf8");
    } catch {}
  }
  return events;
}

export function contextResetEventIsSchedulable(event: { tool?: string; reason?: string; backend_status?: string } | undefined | null): boolean {
  const tool = String(event?.tool || event?.reason || "");
  const backendStatus = String(event?.backend_status || "");
  if (tool === "worker.submit-to-verifier" || backendStatus === "verify_pending") return false;
  if (tool.startsWith("verifier.")) return false;
  return true;
}

export function markRunnerInitialPromptSent(runnerId: string): void {
  const meta = ptyRunnerMeta.get(runnerId);
  if (!meta) return;
  (meta as MetaLike).initialPromptSentAt = new Date().toISOString();
}

export function runnerInitialPromptWasSent(meta: MetaLike | undefined | null): boolean {
  const sentAt = Date.parse(String(meta?.initialPromptSentAt || ""));
  return Number.isFinite(sentAt) && sentAt > 0;
}

export function runnerPromptFileSegment(value: unknown): string {
  return String(value || "runner").replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80) || "runner";
}

export function writeRunnerStartupPromptFile(
  { projectRoot, boardDirName, runnerId, prompt }: { projectRoot: string; boardDirName: string; runnerId: string; prompt: string }
): string {
  const stateDir = path.join(projectRoot, boardDirName || defaultBoardDirName(), "runners", "state");
  fsSync.mkdirSync(stateDir, { recursive: true });
  const promptPath = path.join(stateDir, `${runnerPromptFileSegment(runnerId)}-startup-prompt.md`);
  const tmpPath = `${promptPath}.${process.pid}.${Date.now()}.tmp`;
  fsSync.writeFileSync(tmpPath, String(prompt || "").replace(/[\r\n]+$/, "") + "\n", "utf8");
  fsSync.renameSync(tmpPath, promptPath);
  return promptPath;
}

export function buildRunnerStartupScan({ role, runnerId }: { role: string; runnerId: string }): string {
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "planner", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete; this starts the current assignment lease if needed.`,
        `  2. If snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
        `  3. If work is needed, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources; do not open or follow references outside that scope.`,
        `  4. Create the worker-facing work item set for the selected PRD; every archived PRD must produce at least one work item before idling.`,
        `  5. Rerun queue-snapshot once after the work item handoff or after confirming there is no actionable PRD input; the final snapshot closes the planner assignment when the PRD handoff is complete, then summarize.`
      ].join("\n");
    case "worker":
      return [
        `Worktree 계약 (반드시 지켜야 함):`,
        `  - 모든 TODO 는 PRD worktree (autoflow/prd-<id>) 안에서 작업한다. 작업 전에 그 worktree 로 cd.`,
        `  - 별도 TODO worktree/branch 는 만들지 않는다. claim/worktree-ensure 가 반환하는 path 가 곧 PRD worktree.`,
        `  - PROJECT_ROOT(main) 에서 직접 편집하지 않는다.`,
        `  - 작업 후 직접 git commit 하지 않는다. submit-to-verifier 를 호출해서 verifier 검토를 먼저 받는다.`,
        `  - verifier pass 후 worker finalize-approved 만 호출하면 도구가 자동으로 PRD worktree 에 commit 한다. 이게 같은 PRD 의 마지막 TODO 이면 finalize-approved 가 자동으로 main 으로 squash merge + PRD branch/worktree 삭제까지 처리한다.`,
        `  - 직접 \`git commit\`, \`git merge --squash\`, \`git worktree remove\` 같은 명령을 호출하지 않는다. 시스템 도구만 호출한다.`,
        `  - revise: working tree 의 변경을 수정하고 다시 submit-to-verifier 호출.`,
        `  - replan: request-replan 호출. working tree 변경은 PRD worktree 에 그대로 두고 ticket 만 다시 todo 로.`,
        `  - merge 충돌이 발생하면 worker LLM 가 PRD worktree 안에서 직접 해결한 뒤 도구를 다시 호출.`,
        `Atomic rule: 동시에 최대 1 개의 active ticket.`,
        `Startup scan order:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
        `  2. If active-get.active_get_terminal=true or active-get.ai_followup_reason=worker_ticket_waiting_for_verifier, summarize the compact result without opening source files or running work-snapshot; leave this runner idle and waiting for the next handoff.`,
        `  3. If active-get.ai_followup_reason=verifier_passed_worker_finalization_pending, finalize 한다: PRD worktree 안에서 검증을 다시 한 번 실행 → worker finalize-approved 호출. finalize-approved 가 자동으로 PRD worktree commit + (마지막 TODO 면) main squash merge 까지 처리한다. 직접 git 명령을 추가로 실행하지 않는다.`,
        `  4. If active-get.ai_followup_reason=verifier_revision_requested, do not idle and do not claim another ticket. Inspect only the scoped ticket/worktree, fix the verifier reason inside Allowed Paths (PRD worktree 안에서), rerun local verification, then submit-to-verifier again.`,
        `  5. If active-get.ai_followup_reason=verifier_replan_requested, do not idle and do not claim another ticket. Inspect only the scoped ticket, then run worker request-replan for that ticket.`,
        `  6. If active-get.ai_followup_recommended=true, inspect only active-get.ai_followup_scope.inspect_only_recent_sources and resume that ticket. If the ticket is blocked, do one runner-owned blocked-handling pass (Allowed Paths 안 수정, 좁은 Done When/Allowed Paths 보정, verifier/replan 라우팅) before any no-work decision.`,
        `  7. If no owned ticket exists, always run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "work-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once before deciding there is no work; active-get=false is not an idle decision.`,
        `  8. If work-snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
        `  9. If a candidate exists, inspect only work-snapshot.ai_followup_scope.inspect_only_recent_sources, then claim/worktree-ensure that one work item before product edits. claim/worktree-ensure 가 반환하는 path 는 PRD worktree (autoflow/prd-<id>) 이므로 거기로 cd 하고 작업한다.`,
        `  10. Do not inspect unrelated tickets or project files outside the selected ticket's Allowed Paths.`
      ].join("\n");
    case "verifier":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "verifier", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete.`,
        `  2. If snapshot.ai_followup_recommended=false, summarize the compact result without opening source files; leave this runner idle and waiting for the next handoff.`,
        `  3. If a verifier ticket exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, then run verifier evidence for that one ticket.`,
        `  4. Make exactly one semantic pass/revise/replan decision, run the matching verifier tool, rerun queue-snapshot once, then summarize.`
      ].join("\n");
    case "wiki-maintainer":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--max-items", "12"])}\` first and let it complete; do not poll it at one-second intervals.`,
        `  2. If tick.ai_followup_recommended is false, summarize the tick result without opening source files; leave this runner idle and waiting for the next handoff.`,
        `  3. If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources; do not open or follow references outside that scope.`,
        `  4. Write or update at most one focused wiki page per turn via wiki write-page (DB upsert; no .autoflow/wiki markdown), then run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--skip-telemetry", "--max-items", "12"])}\` once.`,
        `  5. If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the focused update and remaining count, then let the Stop hook continue the next wiki turn. When no follow-up remains, summarize and leave this runner idle.`
      ].join("\n");
    default:
      return "";
  }
}
