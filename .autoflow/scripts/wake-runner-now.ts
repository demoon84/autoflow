#!/usr/bin/env tsx
/*
 * wake-runner-now.ts — desktop PTY 가 fs.watch 로 안 깨우는 runner 를 즉시
 * 강제로 wake 한다. 두 가지 신호를 동시 발사:
 *
 *   1) runner-wake.ts emit  — wake queue 에 이벤트 append (LLM 이 turn 경계에
 *      서 polling). 영속적, PTY 동작과 무관.
 *   2) 대상 queue 디렉토리의 마지막 파일 mtime touch  — desktop 의 fs.watch
 *      가 이걸 보고 broadcast → 매핑된 role 의 PTY 에 `[wake] manual-poke`
 *      입력 주입.
 *
 * 사용:
 *   tsx wake-runner-now.ts <runner-id> [--reason <text>]
 *
 *   기본 reason: "manual-poke"
 *   runner-id 예: verifier / worker / worker-2 / planner / wiki
 *
 * 사용 예:
 *   tsx .autoflow/scripts/wake-runner-now.ts verifier
 *   tsx .autoflow/scripts/wake-runner-now.ts worker --reason resume-todo-303
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
if (argv.length < 1 || argv[0] === "-h" || argv[0] === "--help") {
  process.stdout.write(
    "Usage: tsx wake-runner-now.ts <runner-id> [--reason <text>]\n" +
    "  runner-id: verifier | worker | worker-2 | planner | wiki | ...\n"
  );
  process.exit(0);
}
const runnerId = argv[0];
const reasonIdx = argv.indexOf("--reason");
const reason = reasonIdx >= 0 ? argv[reasonIdx + 1] || "manual-poke" : "manual-poke";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const boardRoot = process.env.AUTOFLOW_BOARD_ROOT || path.resolve(scriptDir, "..");

// role 별 watch 대상 dir (desktop main.js 의 queueHasPendingWork 와 일치)
const ROLE_QUEUE_DIRS: Record<string, string[]> = {
  verifier: ["tickets/verifier"],
  worker: ["tickets/todo", "tickets/inprogress"],
  "worker-2": ["tickets/todo", "tickets/inprogress"],
  planner: ["tickets/inbox", "tickets/backlog"],
  wiki: ["tickets/done"],
};

// runner-id 의 prefix 만 매칭해도 OK (worker-3, worker-4 등 확장 대비)
function resolveQueueDirs(rid: string): string[] {
  if (ROLE_QUEUE_DIRS[rid]) return ROLE_QUEUE_DIRS[rid];
  if (rid.startsWith("worker")) return ROLE_QUEUE_DIRS["worker"];
  if (rid.startsWith("wiki")) return ROLE_QUEUE_DIRS["wiki"];
  if (rid.startsWith("planner")) return ROLE_QUEUE_DIRS["planner"];
  return [];
}

const queueDirs = resolveQueueDirs(runnerId);
if (queueDirs.length === 0) {
  process.stderr.write(`[wake-runner-now] unknown runner-id: ${runnerId}\n`);
  process.exit(2);
}

// 1) runner-wake.ts emit — 영속 큐에 이벤트 append
const wakeScript = path.join(scriptDir, "runner-wake.ts");
const tsxBin = path.join(path.dirname(scriptDir), "..", "node_modules", ".bin", "tsx");
const tsxExists = fs.existsSync(tsxBin);
if (fs.existsSync(wakeScript) && tsxExists) {
  const res = spawnSync(tsxBin, [wakeScript, "emit", "--runner", runnerId, "--reason", reason, "--kind", "manual"], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    process.stderr.write(`[wake-runner-now] runner-wake emit warning (exit ${res.status})\n`);
  }
}

// 2) queue dir 의 첫 파일 mtime touch → fs.watch 트리거
let touched = false;
for (const rel of queueDirs) {
  const dir = path.join(boardRoot, rel);
  if (!fs.existsSync(dir)) continue;
  try {
    const entries = fs
      .readdirSync(dir)
      .filter((f) => /^(Todo-\d+|tickets_\d+|order_\d+|prd_\d+).*\.md$/.test(f))
      .sort();
    if (entries.length === 0) continue;
    const target = path.join(dir, entries[0]);
    const now = new Date();
    fs.utimesSync(target, now, now);
    process.stdout.write(`[wake-runner-now] touched ${rel}/${entries[0]} (fs.watch trigger)\n`);
    touched = true;
    break;
  } catch (err: any) {
    process.stderr.write(`[wake-runner-now] touch ${rel} failed: ${err && err.message}\n`);
  }
}

if (!touched) {
  process.stderr.write(`[wake-runner-now] no queue file to touch for ${runnerId} — queue dirs empty\n`);
}

process.stdout.write(`[wake-runner-now] ok runner=${runnerId} reason=${reason}\n`);
process.exit(0);
