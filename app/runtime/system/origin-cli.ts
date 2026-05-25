#!/usr/bin/env npx tsx
/*
 * origin-cli.ts — lightweight origin ledger queries for skills and runners.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import {resolveTsxCommand} from "../shared/tsx";

type OriginRow = {
  source?: string;
  trigger_kind?: string;
  trigger_ts?: string;
  user_prompt_excerpt?: string;
  prd_path?: string;
  prd_key?: string;
  ticket_id?: string;
  ticket_status?: string;
  commit_hash?: string;
  commit_subject?: string;
  done_at?: string;
  path?: string;
  title?: string;
};

type FallbackOriginRow = {
  row: OriginRow;
  mtimeMs: number;
};

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const subcmd = process.argv[2] || "status";
const args = process.argv.slice(3);

function out(line = "") {
  process.stdout.write(`${line}\n`);
}

function sqlString(value: string): string {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function oneLine(value: string, max = 220): string {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

function parseLimit(values: string[], fallback = 10): number {
  const index = values.findIndex((value) => value === "--limit");
  if (index < 0) return fallback;
  const parsed = Number.parseInt(values[index + 1] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : fallback;
}

function termsFromArgs(values: string[]): string[] {
  const terms: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] || "";
    if (value === "--limit") {
      index += 1;
      continue;
    }
    if (value === "--term") {
      const next = values[index + 1] || "";
      if (next) terms.push(next);
      index += 1;
      continue;
    }
    if (!value.startsWith("--")) {
      terms.push(value);
    }
  }
  return terms.map((term) => term.trim()).filter(Boolean);
}

function stateDbPath(): string {
  return path.join(boardRoot, "state.db");
}

function sqliteAvailable(): boolean {
  const result = spawnSync("sqlite3", ["--version"], {encoding: "utf8"});
  return !result.error && result.status === 0;
}

function queryStateDb(sql: string): OriginRow[] {
  const db = stateDbPath();
  if (!fs.existsSync(db) || !sqliteAvailable()) {
    return [];
  }
  const result = spawnSync("sqlite3", ["-json", db, sql], {encoding: "utf8"});
  if (result.error || result.status !== 0 || !(result.stdout || "").trim()) {
    return [];
  }
  try {
    return JSON.parse(result.stdout) as OriginRow[];
  } catch {
    return [];
  }
}

function walkMarkdown(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop() || "";
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push(full);
      }
    }
  }
  return result;
}

function titleFromMarkdown(text: string): string {
  const heading = text.match(/^#\s+(.+)$/m);
  if (heading) return oneLine(heading[1] || "");
  const title = text.match(/^- Title:\s*(.+)$/m);
  return title ? oneLine(title[1] || "") : "";
}

function ticketIdFromRelPath(relPath: string): string {
  const match = relPath.match(/TODO-(\d+)\.md$/);
  return match ? `TODO-${match[1]}` : "";
}

function fallbackRows(): OriginRow[] {
  const roots = [
    path.join(boardRoot, "tickets", "done"),
    path.join(boardRoot, "tickets", "prd"),
    path.join(boardRoot, "tickets", "todo"),
    path.join(boardRoot, "tickets", "inprogress"),
    path.join(boardRoot, "tickets", "verifier")
  ];
  const rows: FallbackOriginRow[] = roots.flatMap((root) =>
    walkMarkdown(root).map((filePath) => {
      let text = "";
      let mtimeMs = 0;
      try {
        text = fs.readFileSync(filePath, "utf8");
      } catch {}
      try {
        mtimeMs = fs.statSync(filePath).mtimeMs;
      } catch {}
      const rel = path.relative(boardRoot, filePath).replace(/\\/g, "/");
      return {
        mtimeMs,
        row: {
          source: "markdown",
          trigger_kind: "autoflow",
          prd_path: rel,
          path: rel,
          prd_key: rel.match(/PRD-\d+/i)?.[0] || "",
          ticket_id: ticketIdFromRelPath(rel),
          ticket_status: rel.includes("tickets/done/") ? "done" : rel.split("/")[1] || "",
          title: titleFromMarkdown(text),
          user_prompt_excerpt: oneLine(text, 360)
        }
      };
    })
  );
  return rows
    .sort((left, right) => right.mtimeMs - left.mtimeMs || (left.row.path || "").localeCompare(right.row.path || ""))
    .map((entry) => entry.row);
}

function rowsFromState(limit: number): OriginRow[] {
  return queryStateDb(`
    SELECT
      source,
      trigger_kind,
      trigger_ts,
      user_prompt_excerpt,
      prd_path,
      prd_key,
      ticket_id,
      ticket_status,
      commit_hash,
      commit_subject,
      done_at
    FROM origin_chain
    ORDER BY COALESCE(done_at, trigger_ts) DESC
    LIMIT ${limit}
  `);
}

function searchRows(terms: string[], limit: number): OriginRow[] {
  const searchable = [
    "user_prompt_excerpt",
    "prd_path",
    "prd_key",
    "ticket_id",
    "ticket_status",
    "commit_hash",
    "commit_subject"
  ].map((key) => `COALESCE(${key}, '')`).join(" || ' ' || ");
  const where = terms.length
    ? `WHERE ${terms.map((term) => `LOWER(${searchable}) LIKE LOWER('%' || ${sqlString(term)} || '%')`).join(" AND ")}`
    : "";
  const stateRows = queryStateDb(`
    SELECT
      source,
      trigger_kind,
      trigger_ts,
      user_prompt_excerpt,
      prd_path,
      prd_key,
      ticket_id,
      ticket_status,
      commit_hash,
      commit_subject,
      done_at
    FROM origin_chain
    ${where}
    ORDER BY COALESCE(done_at, trigger_ts) DESC
    LIMIT ${limit}
  `);
  if (stateRows.length) {
    return stateRows;
  }
  const lowered = terms.map((term) => term.toLowerCase());
  return fallbackRows()
    .filter((row) => {
      const haystack = [
        row.path,
        row.prd_path,
        row.prd_key,
        row.ticket_id,
        row.ticket_status,
        row.title,
        row.user_prompt_excerpt
      ].join(" ").toLowerCase();
      return lowered.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

function rowsOfTicket(ticketId: string, limit: number): OriginRow[] {
  const numeric = ticketId.match(/\d+/)?.[0] || ticketId;
  const normalized = numeric ? numeric.padStart(3, "0") : ticketId;
  const stateRows = queryStateDb(`
    SELECT source, trigger_kind, trigger_ts, user_prompt_excerpt, prd_path, prd_key,
           ticket_id, ticket_status, commit_hash, commit_subject, done_at
    FROM origin_chain
    WHERE ticket_id = ${sqlString(normalized)}
       OR ticket_id = ${sqlString(`TODO-${normalized}`)}
    ORDER BY COALESCE(done_at, trigger_ts) DESC
    LIMIT ${limit}
  `);
  if (stateRows.length) return stateRows;
  return fallbackRows()
    .filter((row) => (row.ticket_id || "").match(/\d+/)?.[0]?.padStart(3, "0") === normalized)
    .slice(0, limit);
}

function rowsOfCommit(commit: string, limit: number): OriginRow[] {
  const stateRows = queryStateDb(`
    SELECT source, trigger_kind, trigger_ts, user_prompt_excerpt, prd_path, prd_key,
           ticket_id, ticket_status, commit_hash, commit_subject, done_at
    FROM origin_chain
    WHERE commit_hash LIKE ${sqlString(`${commit}%`)}
       OR commit_subject LIKE '%' || ${sqlString(commit)} || '%'
    ORDER BY COALESCE(done_at, trigger_ts) DESC
    LIMIT ${limit}
  `);
  return stateRows.slice(0, limit);
}

function printRows(rows: OriginRow[]) {
  out("status=ok");
  out(`result_count=${rows.length}`);
  rows.forEach((row, index) => {
    const prefix = `result.${index + 1}.`;
    out(`${prefix}source=${row.source || ""}`);
    out(`${prefix}trigger_kind=${row.trigger_kind || ""}`);
    out(`${prefix}trigger_ts=${row.trigger_ts || ""}`);
    out(`${prefix}path=${row.path || row.prd_path || ""}`);
    out(`${prefix}prd_key=${row.prd_key || ""}`);
    out(`${prefix}ticket_id=${row.ticket_id || ""}`);
    out(`${prefix}ticket_status=${row.ticket_status || ""}`);
    out(`${prefix}commit_hash=${row.commit_hash || ""}`);
    out(`${prefix}commit_subject=${oneLine(row.commit_subject || "")}`);
    out(`${prefix}title=${oneLine(row.title || "")}`);
    out(`${prefix}excerpt=${oneLine(row.user_prompt_excerpt || "")}`);
  });
}

function runOriginSync(values: string[]): never {
  const stateDbScript = path.join(scriptDir, "state-db.ts");
  if (!fs.existsSync(stateDbScript)) {
    process.stderr.write(`state db tool not found: ${stateDbScript}\n`);
    process.exit(1);
  }
  const runner = resolveTsxCommand(scriptDir);
  const result = spawnSync(runner.command, [...runner.args, stateDbScript, "origin-sync", ...values], {
    stdio: "inherit",
    env: {
      ...process.env,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      BOARD_ROOT: boardRoot,
      AUTOFLOW_PROJECT_ROOT: projectRoot,
      PROJECT_ROOT: projectRoot
    }
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(typeof result.status === "number" ? result.status : 1);
}

if (subcmd === "status") {
  out("status=ok");
  out("origin.status=available");
  out(`board_root=${boardRoot}`);
  out(`project_root=${projectRoot}`);
  out(`state_db=${stateDbPath()}`);
  out(`state_db_present=${fs.existsSync(stateDbPath()) ? "true" : "false"}`);
  process.exit(0);
}

if (subcmd === "list") {
  printRows(rowsFromState(parseLimit(args)).concat(fallbackRows()).slice(0, parseLimit(args)));
  process.exit(0);
}

if (subcmd === "search") {
  printRows(searchRows(termsFromArgs(args), parseLimit(args)));
  process.exit(0);
}

if (subcmd === "of-ticket") {
  printRows(rowsOfTicket(args[0] || "", parseLimit(args)));
  process.exit(0);
}

if (subcmd === "of-commit") {
  printRows(rowsOfCommit(args[0] || "", parseLimit(args)));
  process.exit(0);
}

if (subcmd === "sync") {
  runOriginSync(args);
}

out("status=error");
out(`reason=unknown_origin_subcommand`);
out(`subcommand=${subcmd}`);
out(`board_root=${boardRoot}`);
out(`project_root=${projectRoot}`);
process.exit(1);
