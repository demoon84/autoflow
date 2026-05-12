#!/usr/bin/env tsx
/*
 * state-db.ts — Autoflow sqlite state ledger (PRD 7 scaffold).
 * See state-db.js for full doc; CLI/output unchanged.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";


// Cross-mode (ESM + CJS via tsx) script-dir resolver: process.argv[1]
// is the path to the .ts file currently executing in either runtime.
const SCRIPT_DIR_HERE = require("node:path").dirname(process.argv[1] || "");
const BOARD_ROOT = path.resolve(
  process.env.AUTOFLOW_BOARD_ROOT ||
  process.env.BOARD_ROOT ||
  path.join(SCRIPT_DIR_HERE, "..")
);
const PROJECT_ROOT = path.resolve(
  process.env.PROJECT_ROOT ||
  process.env.AUTOFLOW_PROJECT_ROOT ||
  path.join(BOARD_ROOT, "..")
);

const STATE_DB = path.join(BOARD_ROOT, "state.db");
const SCHEMA_PATH = path.join(BOARD_ROOT, "state-schema", "v1.sql");
const STATE_DIR = path.join(BOARD_ROOT, "runners", "state");

function nowIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function ensureSqlite(): void {
  const probe = spawnSync("sqlite3", ["-version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    process.stderr.write("sqlite3 binary not found; install it or skip PRD 7 ledger.\n");
    process.exit(2);
  }
}

function sqlExec(sql: string): string {
  const r = spawnSync("sqlite3", [STATE_DB], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });
  if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
  return r.stdout || "";
}

function sqlQuery(sql: string): string {
  const r = spawnSync("sqlite3", [STATE_DB, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (r.status !== 0) return "";
  return (r.stdout || "").trim();
}

function sqlEsc(s: unknown): string {
  return String(s == null ? "" : s).replace(/'/g, "''");
}

function readKeyValueLine(filePath: string, key: string): string {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      if (line.slice(0, idx) === key) return line.slice(idx + 1);
    }
  } catch {}
  return "";
}

function fileMtimeEpoch(p: string): number {
  try {
    const stat = fs.statSync(p);
    return Math.floor(stat.mtimeMs / 1000);
  } catch {
    return 0;
  }
}

function listFiles(dir: string, predicate: (name: string) => boolean, depth = 1): string[] {
  const out: string[] = [];
  const walk = (d: string, level: number): void => {
    if (level > depth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full, level + 1);
      else if (predicate(e.name)) out.push(full);
    }
  };
  walk(dir, 1);
  return out;
}

function cmdInit(): void {
  ensureSqlite();
  if (!fs.existsSync(SCHEMA_PATH)) {
    process.stderr.write(`schema not found: ${SCHEMA_PATH}\n`);
    process.exit(2);
  }
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  sqlExec(sql);
  process.stdout.write(`state_db=${STATE_DB}\n`);
  process.stdout.write(`status=initialized\n`);
}

function cmdSchemaVersion(): void {
  ensureSqlite();
  if (!fs.existsSync(STATE_DB)) {
    process.stdout.write(`state_db=${STATE_DB}\n`);
    process.stdout.write(`status=not_initialized\n`);
    return;
  }
  const v = sqlQuery("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1");
  process.stdout.write(`state_db=${STATE_DB}\n`);
  process.stdout.write(`schema_version=${v || "unknown"}\n`);
}

function cmdSync(): void {
  ensureSqlite();
  if (!fs.existsSync(STATE_DB)) cmdInit();
  const now = nowIsoUtc();

  sqlExec(`DELETE FROM runner_state;\nDELETE FROM fingerprint;\nDELETE FROM board_count;`);

  let syncedRunners = 0;
  if (fs.existsSync(STATE_DIR)) {
    const stateFiles = listFiles(STATE_DIR, (n) => n.endsWith(".state"), 1).sort();
    for (const file of stateFiles) {
      const base = path.basename(file);
      const runnerId = base.replace(/\.state$/, "");
      if (runnerId === base) continue;
      const lastResult = readKeyValueLine(file, "last_result");
      const timeoutCount = readKeyValueLine(file, "consecutive_timeout_count");
      const activeId = readKeyValueLine(file, "active_ticket_id");
      const activeStage = readKeyValueLine(file, "active_stage");
      const mtime = fileMtimeEpoch(file);
      sqlExec(`INSERT OR REPLACE INTO runner_state
(runner_id, last_result, consecutive_timeout_count, active_ticket_id, active_stage, mtime_epoch, synced_at)
VALUES ('${sqlEsc(runnerId)}','${sqlEsc(lastResult)}',${timeoutCount === "" ? "NULL" : Number(timeoutCount) || 0},'${sqlEsc(activeId)}','${sqlEsc(activeStage)}',${mtime},'${now}');`);
      syncedRunners += 1;
    }
  }

  let syncedFp = 0;
  if (fs.existsSync(STATE_DIR)) {
    const fpFiles = listFiles(STATE_DIR, (n) => n.endsWith(".fingerprint"), 2);
    for (const file of fpFiles) {
      const mtime = fileMtimeEpoch(file);
      const rel = path.relative(BOARD_ROOT, file);
      sqlExec(`INSERT OR REPLACE INTO fingerprint (path, mtime_epoch, synced_at) VALUES ('${sqlEsc(rel)}',${mtime},'${now}');`);
      syncedFp += 1;
    }
  }

  for (const bucket of ["inbox", "backlog", "todo", "inprogress"]) {
    const dir = path.join(BOARD_ROOT, "tickets", bucket);
    let count = 0;
    try {
      count = fs.readdirSync(dir).filter((n) => n.endsWith(".md")).length;
    } catch {}
    sqlExec(`INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('${bucket}',${count},'${now}');`);
  }
  let doneTickets = 0;
  let doneProjects = 0;
  try {
    const doneDir = path.join(BOARD_ROOT, "tickets", "done");
    const projects = fs.readdirSync(doneDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    doneProjects = projects.length;
    for (const p of projects) {
      const subDir = path.join(doneDir, p.name);
      try {
        doneTickets += fs.readdirSync(subDir).filter((n) => /^Todo-.+\.md$/.test(n)).length;
      } catch {}
    }
  } catch {}
  sqlExec(`INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('done_tickets',${doneTickets},'${now}');`);
  sqlExec(`INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('done_projects',${doneProjects},'${now}');`);

  process.stdout.write(`status=synced\n`);
  process.stdout.write(`synced_runners=${syncedRunners}\n`);
  process.stdout.write(`synced_fingerprints=${syncedFp}\n`);
  process.stdout.write(`synced_at=${now}\n`);
}

function cmdDriftSummary(): void {
  ensureSqlite();
  if (!fs.existsSync(STATE_DB)) {
    process.stdout.write(`status=not_initialized\n`);
    return;
  }
  const sqliteRunners = parseInt(sqlQuery("SELECT COUNT(*) FROM runner_state") || "0", 10) || 0;
  let fsRunners = 0;
  try {
    fsRunners = fs.readdirSync(STATE_DIR).filter((n) => n.endsWith(".state")).length;
  } catch {}
  const sqliteFp = parseInt(sqlQuery("SELECT COUNT(*) FROM fingerprint") || "0", 10) || 0;
  const fsFp = listFiles(STATE_DIR, (n) => n.endsWith(".fingerprint"), 2).length;
  let drift = 0;
  if (sqliteRunners !== fsRunners) drift += 1;
  if (sqliteFp !== fsFp) drift += 1;
  process.stdout.write(`state_db=${STATE_DB}\n`);
  process.stdout.write(`sqlite_runners=${sqliteRunners} fs_runners=${fsRunners}\n`);
  process.stdout.write(`sqlite_fingerprints=${sqliteFp} fs_fingerprints=${fsFp}\n`);
  process.stdout.write(`drift_count=${drift}\n`);
}

function cmdOriginSync(extraArgs: string[]): void {
  ensureSqlite();
  const extractor = path.join(SCRIPT_DIR_HERE, "origin-extractor.py");
  const probe = spawnSync("python3", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
  if (probe.status !== 0) {
    process.stderr.write("python3 not found; skipping origin-sync.\n");
    process.stdout.write("status=skipped\n");
    process.stdout.write("reason=python3_missing\n");
    return;
  }
  if (!fs.existsSync(extractor)) {
    process.stderr.write(`extractor not found: ${extractor}\n`);
    process.stdout.write("status=skipped\n");
    process.stdout.write("reason=extractor_missing\n");
    return;
  }
  if (!fs.existsSync(STATE_DB)) cmdInit();
  spawnSync("python3", [extractor, "--board-root", BOARD_ROOT, "--project-root", PROJECT_ROOT, ...extraArgs], {
    stdio: "inherit"
  });
}

function help(): void {
  process.stderr.write(`Usage: state-db.ts <init|sync|origin-sync|drift-summary|schema-version>

Phase 1 scaffold (PRD 7). Set AUTOFLOW_STATE_DB=on to enable read-side
consumers in the future. Until then, this is informational only.
`);
}

const cmd = process.argv[2] || "help";
const rest = process.argv.slice(3);
switch (cmd) {
  case "init": cmdInit(); break;
  case "sync": cmdSync(); break;
  case "origin-sync": cmdOriginSync(rest); break;
  case "drift-summary": cmdDriftSummary(); break;
  case "schema-version": cmdSchemaVersion(); break;
  case "help":
  case "-h":
  case "--help": help(); break;
  default: help(); process.exit(1);
}
