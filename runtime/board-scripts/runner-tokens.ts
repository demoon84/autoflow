#!/usr/bin/env tsx
/*
 * runner-tokens.ts — LLM-reported token usage tracker.
 * See runner-tokens.js for full doc; CLI/output unchanged.
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
  process.stdout.write(`Usage: tsx runner-tokens.ts <report|show> [args]
  report  --runner <id> [--tick-id <id>] --input <N> --output <N>
          [--cache-read <N>] [--cache-create <N>] [--note <text>]
  show    --runner <id>
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
const LOG_DIR = path.join(BOARD_ROOT, "runners", "logs");
const NOW = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

function warn(msg: string): void {
  process.stderr.write(`[runner-tokens] ${msg}\n`);
}

function ensureDirs(): void {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function statePath(runner: string): string {
  return path.join(STATE_DIR, `${runner}.state`);
}
function tokenLogPath(runner: string): string {
  return path.join(LOG_DIR, `${runner}-tokens.log`);
}

function readState(runner: string): string {
  try { return fs.readFileSync(statePath(runner), "utf8"); }
  catch { return ""; }
}
function writeState(runner: string, content: string): boolean {
  try { fs.writeFileSync(statePath(runner), content); return true; }
  catch (err: any) { warn(`state write failed: ${err && err.message}`); return false; }
}

function parseStateLines(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    map.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return map;
}

function serializeStateLines(map: Map<string, string>): string {
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

function parseInt0(s: unknown): number {
  const v = parseInt(String(s || "0"), 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

interface ReportOpts {
  tickId?: string;
  input?: string;
  output?: string;
  cacheRead?: string;
  cacheCreate?: string;
  note?: string;
}

function report(runner: string | undefined, opts: ReportOpts): never {
  if (!runner) { warn("report requires --runner"); process.exit(0); }
  const inputT = parseInt0(opts.input);
  const outputT = parseInt0(opts.output);
  const cacheR = parseInt0(opts.cacheRead);
  const cacheC = parseInt0(opts.cacheCreate);
  const turnTotal = inputT + outputT + cacheR + cacheC;
  if (turnTotal <= 0) {
    warn("report ignored: total tokens 0");
    process.exit(0);
  }

  ensureDirs();
  const state = readState(runner);
  if (!state) {
    warn(`state file missing for ${runner}; skipping (run runner-stage.js first)`);
    process.exit(0);
  }
  const map = parseStateLines(state);

  const tickId = String(opts.tickId || "");
  const lastTickId = map.get("last_turn_tick_id") || "";
  if (tickId && tickId === lastTickId) {
    process.stdout.write(`[runner-tokens] duplicate tick-id ${tickId}, skipped\n`);
    process.exit(0);
  }

  const prevCumulative = parseInt0(map.get("cumulative_tokens"));
  const newCumulative = prevCumulative + turnTotal;
  map.set("last_turn_tokens", String(turnTotal));
  map.set("last_turn_input_tokens", String(inputT));
  map.set("last_turn_output_tokens", String(outputT));
  map.set("last_turn_cache_read_tokens", String(cacheR));
  map.set("last_turn_cache_create_tokens", String(cacheC));
  map.set("last_turn_at", NOW());
  if (tickId) map.set("last_turn_tick_id", tickId);
  map.set("cumulative_tokens", String(newCumulative));
  map.set("token_source", "llm_reported");

  if (writeState(runner, serializeStateLines(map))) {
    process.stdout.write(`[runner-tokens] ${runner}: +${turnTotal} (cum=${newCumulative})\n`);
  }

  try {
    const entry = JSON.stringify({
      runner, tickId,
      input: inputT, output: outputT, cacheRead: cacheR, cacheCreate: cacheC,
      turnTotal, cumulative: newCumulative,
      note: String(opts.note || ""),
      at: NOW()
    }) + "\n";
    fs.appendFileSync(tokenLogPath(runner), entry);
  } catch {}

  process.exit(0);
}

function show(runner: string | undefined): never {
  if (!runner) { warn("show requires --runner"); process.exit(0); }
  const state = readState(runner);
  if (!state) {
    process.stdout.write("{}\n");
    process.exit(0);
  }
  const map = parseStateLines(state);
  const out = {
    runner,
    cumulative_tokens: parseInt0(map.get("cumulative_tokens")),
    last_turn_tokens: parseInt0(map.get("last_turn_tokens")),
    last_turn_input_tokens: parseInt0(map.get("last_turn_input_tokens")),
    last_turn_output_tokens: parseInt0(map.get("last_turn_output_tokens")),
    last_turn_cache_read_tokens: parseInt0(map.get("last_turn_cache_read_tokens")),
    last_turn_cache_create_tokens: parseInt0(map.get("last_turn_cache_create_tokens")),
    last_turn_at: map.get("last_turn_at") || "",
    last_turn_tick_id: map.get("last_turn_tick_id") || "",
    token_source: map.get("token_source") || ""
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(0);
}

switch (SUBCMD) {
  case "report":
    report(arg("--runner"), {
      tickId: arg("--tick-id"),
      input: arg("--input"),
      output: arg("--output"),
      cacheRead: arg("--cache-read"),
      cacheCreate: arg("--cache-create"),
      note: arg("--note")
    });
    break;
  case "show":
    show(arg("--runner"));
    break;
  default:
    help();
    process.exit(0);
}
