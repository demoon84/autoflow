#!/usr/bin/env tsx
/*
 * runner-wake.ts — wake event queue for autoflow runners.
 * See runner-wake.js for full doc; CLI/output unchanged.
 */

import * as fs from "node:fs";
import * as path from "node:path";


// Cross-mode (ESM + CJS via tsx) script-dir resolver: process.argv[1]
// is the path to the .ts file currently executing in either runtime.
const SCRIPT_DIR_HERE = require("node:path").dirname(process.argv[1] || "");
const ARGV = process.argv.slice(2);
const SUBCMD = ARGV[0];

function arg(name: string, fallback?: string): string | undefined {
  const i = ARGV.indexOf(name);
  if (i > 0 && ARGV[i + 1]) return ARGV[i + 1];
  return fallback;
}

function help(): void {
  process.stdout.write(`Usage: tsx runner-wake.ts <emit|poll|notify|peek|clear> [args]
  emit    --runner <id> --reason <text> [--kind <kind>]
  poll    --runner <id> [--limit <N>] [--since <iso>]
  notify  --target <id> --reason <text> [--kind <kind>]
  peek    --runner <id> [--limit <N>]
  clear   --runner <id>
`);
}

if (!SUBCMD || SUBCMD === "--help" || SUBCMD === "-h") {
  help();
  process.exit(0);
}

const BOARD_ROOT = path.resolve(
  process.env.AUTOFLOW_BOARD_ROOT ||
  process.env.BOARD_ROOT ||
  path.join(SCRIPT_DIR_HERE, "..")
);
const STATE_DIR = path.join(BOARD_ROOT, "runners", "state");
const MAX_QUEUE_LINES = parseInt(process.env.AUTOFLOW_WAKE_QUEUE_MAX || "200", 10);
const NOW = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

function warn(msg: string): void {
  process.stderr.write(`[runner-wake] ${msg}\n`);
}

function ensureStateDir(): void {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
}

function queuePath(runner: string): string {
  return path.join(STATE_DIR, `${runner}-wake.queue.jsonl`);
}
function pointerPath(runner: string): string {
  return path.join(STATE_DIR, `${runner}-wake.pointer`);
}

interface WakeEvent {
  reason: string;
  kind: string;
  at: string;
}

function emitEvent(runner: string | undefined, reason: string | undefined, kind: string | undefined): void {
  if (!runner) { warn("emit requires --runner"); process.exit(0); }
  if (!reason) { warn("emit requires --reason"); process.exit(0); }
  ensureStateDir();
  const event: WakeEvent = {
    reason: String(reason),
    kind: String(kind || "generic"),
    at: NOW()
  };
  const line = JSON.stringify(event) + "\n";
  try {
    fs.appendFileSync(queuePath(runner), line);
  } catch (err: any) {
    warn(`emit failed: ${err && err.message}`);
    process.exit(0);
  }
  try {
    const all = fs.readFileSync(queuePath(runner), "utf8").split(/\n/).filter(Boolean);
    if (all.length > MAX_QUEUE_LINES) {
      const tail = all.slice(all.length - MAX_QUEUE_LINES);
      fs.writeFileSync(queuePath(runner), tail.join("\n") + "\n");
    }
  } catch {}
}

function readQueue(runner: string): WakeEvent[] {
  try {
    const raw = fs.readFileSync(queuePath(runner), "utf8");
    return raw.split(/\n/).filter(Boolean).map((line): WakeEvent | null => {
      try { return JSON.parse(line) as WakeEvent; } catch { return null; }
    }).filter((e): e is WakeEvent => e !== null);
  } catch { return []; }
}

function readPointer(runner: string): string | null {
  try { return fs.readFileSync(pointerPath(runner), "utf8").trim() || null; }
  catch { return null; }
}

function writePointer(runner: string, iso: string): void {
  try { fs.writeFileSync(pointerPath(runner), iso + "\n"); } catch {}
}

function eventsAfter(events: WakeEvent[], sinceIso: string): WakeEvent[] {
  if (!sinceIso) return events;
  return events.filter((e) => String(e.at || "") > sinceIso);
}

function poll(runner: string | undefined, opts: { limit: number; since?: string }): never {
  if (!runner) { warn("poll requires --runner"); process.stdout.write("[]\n"); process.exit(0); }
  ensureStateDir();
  const events = readQueue(runner);
  const since = opts.since || readPointer(runner) || "";
  let pending = eventsAfter(events, since);
  if (opts.limit && pending.length > opts.limit) pending = pending.slice(0, opts.limit);
  process.stdout.write(JSON.stringify(pending) + "\n");
  if (pending.length > 0) {
    const lastAt = pending[pending.length - 1].at || NOW();
    writePointer(runner, lastAt);
  }
  process.exit(0);
}

function peek(runner: string | undefined, opts: { limit: number }): never {
  if (!runner) { warn("peek requires --runner"); process.stdout.write("[]\n"); process.exit(0); }
  const events = readQueue(runner);
  const since = readPointer(runner) || "";
  let pending = eventsAfter(events, since);
  if (opts.limit && pending.length > opts.limit) pending = pending.slice(0, opts.limit);
  process.stdout.write(JSON.stringify(pending) + "\n");
  process.exit(0);
}

function clear(runner: string | undefined): never {
  if (!runner) { warn("clear requires --runner"); process.exit(0); }
  try { fs.writeFileSync(queuePath(runner), ""); } catch {}
  try { fs.writeFileSync(pointerPath(runner), NOW() + "\n"); } catch {}
  process.exit(0);
}

switch (SUBCMD) {
  case "emit":
    emitEvent(arg("--runner"), arg("--reason"), arg("--kind"));
    process.exit(0);
    break;
  case "notify":
    emitEvent(arg("--target"), arg("--reason"), arg("--kind"));
    process.exit(0);
    break;
  case "poll": {
    const limit = parseInt(arg("--limit", "0") || "0", 10) || 0;
    poll(arg("--runner"), { limit, since: arg("--since") });
    break;
  }
  case "peek": {
    const limit = parseInt(arg("--limit", "0") || "0", 10) || 0;
    peek(arg("--runner"), { limit });
    break;
  }
  case "clear":
    clear(arg("--runner"));
    break;
  default:
    help();
    process.exit(0);
}
