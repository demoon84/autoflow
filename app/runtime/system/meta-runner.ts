#!/usr/bin/env node
// meta-runner.ts — Autoflow self-diagnostics: reads telemetry/state/logs and emits hints.
//
// Usage:
//   node meta-runner.ts [--board-root <path>] [--once] [--interval <seconds>]
//
// Diagnostics (4):
//   1. consecutive_timeout ≥ 3 → emit prompt cap 50% reduction hint
//   2. Same retry_fingerprint ≥ 2 times → emit "try different approach" hint into sticky-context
//   3. wake stall ≥ 10 min (no wake in wake-poll.log) → emit interval-reduction recommendation
//   4. output_truncated ratio ≥ 5% in last 24h → emit max_output_tokens increase recommendation
//
// Env knob: AUTOFLOW_META_RUNNER_ENABLED (default: off / 0)
// Env knob: AUTOFLOW_META_RUNNER_INTERVAL_SEC (default: 300 = 5 min)
//
// 1원칙: any read/parse failure is silently skipped; never blocks runners.

import fs from "node:fs";
import path from "node:path";

const BOARD_ROOT = process.env.BOARD_ROOT || path.join(process.cwd(), ".autoflow");
const ENABLED = (process.env.AUTOFLOW_META_RUNNER_ENABLED ?? "0") !== "0";
const INTERVAL_SEC = Number(process.env.AUTOFLOW_META_RUNNER_INTERVAL_SEC ?? "300");

// --- Data types ---

interface TokenEntry {
  runner: string;
  tickId?: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheCreate?: number;
  note?: string;
  output_truncated?: boolean;
  at?: string;
}

interface WakePollEntry {
  runner?: string;
  stall?: boolean;
  idle_seconds?: number;
  at?: string;
}

interface DiagnosticReport {
  timestamp: string;
  diagnostics: Array<{ id: string; runner?: string; severity: string; message: string; hint: string }>;
}

// --- Readers ---

function readJsonlFile<T>(filePath: string): T[] {
  try {
    return fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as T; } catch { return null; } })
      .filter(Boolean) as T[];
  } catch { return []; }
}

function readStateField(stateFile: string, key: string): string {
  try {
    const raw = fs.readFileSync(stateFile, "utf8");
    const m = raw.match(new RegExp(`(?:^|\\n)${key}=(\\S+)`));
    return m ? m[1] : "";
  } catch { return ""; }
}

function readOrderRetryFingerprints(boardRoot: string): Map<string, number> {
  const counts = new Map<string, number>();
  const orderDir = path.join(boardRoot, "tickets", "order");
  try {
    for (const f of fs.readdirSync(orderDir)) {
      if (!f.match(/order_.*_retry_.*\.md$/)) continue;
      try {
        const raw = fs.readFileSync(path.join(orderDir, f), "utf8");
        const m = raw.match(/^retry_fingerprint:\s*(\S+)/m);
        if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      } catch {}
    }
  } catch {}
  return counts;
}

// --- Hint emitters ---

function appendHintToStickyContext(boardRoot: string, runnerId: string, hint: string): void {
  const stickyPath = path.join(boardRoot, "runners", "state", `${runnerId}-sticky-context.md`);
  try {
    const existing = fs.existsSync(stickyPath) ? fs.readFileSync(stickyPath, "utf8") : "";
    if (existing.includes(hint)) return; // already injected
    const section = `\n## Meta-Runner Hints\n\n- ${hint}\n`;
    fs.writeFileSync(stickyPath, existing + section, "utf8");
  } catch {}
}

function writeMetaHintLog(boardRoot: string, report: DiagnosticReport): void {
  try {
    const logDir = path.join(boardRoot, "runners", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "meta-runner.log"),
      JSON.stringify(report) + "\n",
      "utf8"
    );
  } catch {}
}

// --- Diagnostics ---

function diagConsecutiveTimeout(boardRoot: string): Array<DiagnosticReport["diagnostics"][0]> {
  const results: DiagnosticReport["diagnostics"] = [];
  const stateDir = path.join(boardRoot, "runners", "state");
  try {
    for (const f of fs.readdirSync(stateDir)) {
      if (!f.endsWith(".state")) continue;
      const runnerId = f.replace(/\.state$/, "");
      const count = Number(readStateField(path.join(stateDir, f), "consecutive_timeout_count") || "0");
      if (count >= 3) {
        const hint = `consecutive_timeout_count=${count}: prompt cap 50% 축소 권장. AUTOFLOW_WORKER_PROMPT_BYTES 를 현재 값의 절반으로 조정하세요.`;
        appendHintToStickyContext(boardRoot, runnerId, hint);
        results.push({
          id: "consecutive_timeout",
          runner: runnerId,
          severity: "warning",
          message: `Runner ${runnerId}: consecutive_timeout_count=${count} (≥ 3)`,
          hint,
        });
      }
    }
  } catch {}
  return results;
}

function diagRetryFingerprint(boardRoot: string): Array<DiagnosticReport["diagnostics"][0]> {
  const results: DiagnosticReport["diagnostics"] = [];
  const fpMap = readOrderRetryFingerprints(boardRoot);
  for (const [fp, count] of fpMap.entries()) {
    if (count >= 2) {
      const hint = `retry_fingerprint ${fp} 이 ${count}회 누적됨 — 기존 접근과 다른 방법을 시도하세요 (Allowed Paths 또는 Done When 재설계).`;
      // Inject into all active worker sticky contexts
      const stateDir = path.join(boardRoot, "runners", "state");
      try {
        for (const f of fs.readdirSync(stateDir)) {
          if (f.endsWith("-sticky-context.md")) {
            const runnerId = f.replace(/-sticky-context\.md$/, "");
            appendHintToStickyContext(boardRoot, runnerId, hint);
          }
        }
      } catch {}
      results.push({
        id: "retry_fingerprint_repeat",
        severity: "warning",
        message: `retry_fingerprint ${fp}: ${count} occurrences (≥ 2)`,
        hint,
      });
    }
  }
  return results;
}

function diagWakeStall(boardRoot: string): Array<DiagnosticReport["diagnostics"][0]> {
  const results: DiagnosticReport["diagnostics"] = [];
  const logPath = path.join(boardRoot, "runners", "logs", "wake-poll.log");
  const entries = readJsonlFile<WakePollEntry>(logPath);
  if (!entries.length) return results;

  const now = Date.now();
  const STALL_MS = 10 * 60 * 1000; // 10 min
  const latest = entries[entries.length - 1];
  const latestAt = latest.at ? new Date(latest.at).getTime() : 0;
  if (now - latestAt >= STALL_MS) {
    results.push({
      id: "wake_stall",
      severity: "info",
      message: `Wake stall detected: last wake ${Math.round((now - latestAt) / 60000)}min ago`,
      hint: "interval_seconds 를 현재의 50%로 단축하거나 AUTOFLOW_RUNNER_REALTIME_ENABLED=1 을 활성화하세요.",
    });
  }
  return results;
}

function diagOutputTruncated(boardRoot: string): Array<DiagnosticReport["diagnostics"][0]> {
  const results: DiagnosticReport["diagnostics"] = [];
  const logsDir = path.join(boardRoot, "runners", "logs");
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const runnerTotals = new Map<string, { total: number; truncated: number }>();

  try {
    for (const f of fs.readdirSync(logsDir)) {
      if (!f.endsWith("-tokens.log") && !f.endsWith(".log")) continue;
      const entries = readJsonlFile<TokenEntry>(path.join(logsDir, f));
      for (const e of entries) {
        if (!e.runner || !e.at) continue;
        const age = now - new Date(e.at).getTime();
        if (age > DAY_MS) continue;
        const r = runnerTotals.get(e.runner) ?? { total: 0, truncated: 0 };
        r.total++;
        if (e.note?.includes("output_truncated=true") || e.output_truncated) r.truncated++;
        runnerTotals.set(e.runner, r);
      }
    }
  } catch {}

  for (const [runner, { total, truncated }] of runnerTotals.entries()) {
    if (total > 0 && truncated / total >= 0.05) {
      results.push({
        id: "output_truncated",
        runner,
        severity: "info",
        message: `Runner ${runner}: output_truncated ratio ${Math.round((truncated / total) * 100)}% in last 24h (${truncated}/${total})`,
        hint: `AUTOFLOW_${runner.toUpperCase()}_MAX_OUTPUT_TOKENS 를 현재 값의 1.5배로 상향하세요.`,
      });
    }
  }
  return results;
}

// --- Main loop ---

function runDiagnostics(): DiagnosticReport {
  const diagnostics = [
    ...diagConsecutiveTimeout(BOARD_ROOT),
    ...diagRetryFingerprint(BOARD_ROOT),
    ...diagWakeStall(BOARD_ROOT),
    ...diagOutputTruncated(BOARD_ROOT),
  ];
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    diagnostics,
  };
  writeMetaHintLog(BOARD_ROOT, report);
  return report;
}

function printReport(report: DiagnosticReport): void {
  process.stdout.write(`meta_runner_timestamp=${report.timestamp}\n`);
  process.stdout.write(`meta_runner_diagnostic_count=${report.diagnostics.length}\n`);
  for (const d of report.diagnostics) {
    process.stdout.write(
      `  [${d.severity}] ${d.id}${d.runner ? ` (${d.runner})` : ""}: ${d.message}\n`
    );
    process.stdout.write(`  hint: ${d.hint}\n`);
  }
  if (!report.diagnostics.length) {
    process.stdout.write("  all clear — no diagnostic issues detected\n");
  }
}

async function main(): Promise<void> {
  if (!ENABLED) {
    process.stdout.write("meta_runner_status=disabled (set AUTOFLOW_META_RUNNER_ENABLED=1 to activate)\n");
    process.exit(0);
  }

  const once = process.argv.includes("--once");

  const report = runDiagnostics();
  printReport(report);

  if (!once) {
    process.stdout.write(`meta_runner_status=running interval=${INTERVAL_SEC}s\n`);
    const tick = () => {
      const r = runDiagnostics();
      printReport(r);
    };
    setInterval(tick, INTERVAL_SEC * 1000);
  }
}

main().catch((e) => {
  process.stderr.write(`meta-runner error: ${e.message}\n`);
  process.exit(1);
});
