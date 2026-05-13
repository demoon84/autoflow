#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const dryRun = process.argv.includes("--dry-run");

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function out(key: string, value: string | number): void {
  process.stdout.write(`${key}=${value}\n`);
}

function relToBoard(file: string): string {
  const rel = path.relative(boardRoot, file);
  return rel.startsWith("..") ? file : rel;
}

function collectFiles(root: string, pattern: RegExp, maxDepth = 10): string[] {
  const files: string[] = [];
  function walk(dir: string, depth: number): void {
    if (depth > maxDepth || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, depth + 1);
      } else if (pattern.test(name)) {
        files.push(full);
      }
    }
  }
  walk(root, 0);
  return files.sort();
}

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function extractField(file: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(?:-\\s*)?${escaped}:\\s*(.*)$`, "m");
  return read(file).match(re)?.[1]?.trim() || "";
}

function extractResultSummary(file: string): string {
  return read(file).match(/^- Summary:\s*(.*)$/m)?.[1]?.trim() || "";
}

function firstNonBlank(file: string): string {
  return read(file).split(/\r?\n/).find((line) => line.trim())?.replace(/^#\s*/, "").trim() || path.basename(file);
}

function ticketList(files: string[], limit: number): string {
  if (files.length === 0) return "- No completed tickets found.\n";
  return files.slice(0, limit).map((file) => {
    const id = extractField(file, "ID") || path.basename(file, ".md");
    const title = extractField(file, "Title") || id;
    const summary = extractResultSummary(file);
    const source = relToBoard(file);
    return summary
      ? `- \`${id}\` - ${title}. ${summary} Source: \`${source}\`.`
      : `- \`${id}\` - ${title}. Source: \`${source}\`.`;
  }).join("\n") + "\n";
}

function plainFileList(files: string[], empty: string, limit: number): string {
  if (files.length === 0) return `- ${empty}\n`;
  return files.slice(0, limit).map((file) => `- ${firstNonBlank(file)}. Source: \`${relToBoard(file)}\`.`).join("\n") + "\n";
}

function rejectList(files: string[], limit: number): string {
  if (files.length === 0) return "- No reject records.\n";
  return files.slice(0, limit).map((file) => {
    const reason = extractField(file, "Reason");
    const name = path.basename(file, ".md");
    return reason
      ? `- ${name}. Reason: ${reason}. Source: \`${relToBoard(file)}\`.`
      : `- ${name}. Source: \`${relToBoard(file)}\`.`;
  }).join("\n") + "\n";
}

function defaultPage(kind: "index" | "log" | "overview"): string {
  if (kind === "index") {
    return "# Wiki Index\n\nThis index catalogs wiki pages maintained from Autoflow work.\n";
  }
  if (kind === "log") {
    return "# Wiki Log\n\nThis page contains a derived Autoflow work timeline.\n";
  }
  return "# Project Overview\n\n## Summary\n\n- This page is maintained from Autoflow specs, tickets, verification records, logs, and approved conversation summaries.\n";
}

function normalizedForCompare(text: string): string {
  return text.split(/\r?\n/).filter((line) => !/^- Last (updated|rebuilt): /.test(line)).join("\n");
}

function replaceManagedSection(file: string, section: string, body: string, fallback: string): boolean {
  const begin = `<!-- AUTOFLOW:BEGIN ${section} -->`;
  const end = `<!-- AUTOFLOW:END ${section} -->`;
  const source = fs.existsSync(file) ? read(file) : fallback;
  const replacement = `${begin}\n${body.replace(/\n?$/, "\n")}${end}`;
  const re = new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const next = re.test(source)
    ? source.replace(re, replacement)
    : `${source.replace(/\n?$/, "\n\n")}${replacement}\n`;
  if (normalizedForCompare(source) === normalizedForCompare(next)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, "utf8");
  return true;
}

function appendHistory(status: string, timestamp: string, counts: Record<string, number>, changedCount: number): string {
  const history = path.join(boardRoot, "runners", "state", "wiki-baseline.history");
  fs.mkdirSync(path.dirname(history), { recursive: true });
  fs.appendFileSync(history, [
    "---",
    `checked_at=${timestamp}`,
    `status=${status}`,
    `wiki_root=${path.join(boardRoot, "wiki")}`,
    `changed_file_count=${changedCount}`,
    `ticket_done_count=${counts.done}`,
    `reject_count=${counts.rejects}`,
    `log_count=${counts.logs}`,
    `handoff_count=${counts.handoffs}`,
    "",
  ].join("\n"), "utf8");
  return history;
}

function main(): void {
  if (!fs.existsSync(path.join(boardRoot, "tickets"))) {
    out("status", "blocked");
    out("reason", "board_not_initialized");
    out("board_root", boardRoot);
    out("project_root", projectRoot);
    return;
  }

  const doneTickets = collectFiles(path.join(boardRoot, "tickets", "done"), /^Todo-\d+\.md$/);
  const rejects = collectFiles(path.join(boardRoot, "tickets"), /^reject_\d+\.md$/);
  const logs = collectFiles(path.join(boardRoot, "logs"), /\.md$/);
  const handoffs = collectFiles(path.join(boardRoot, "conversations"), /^spec-handoff\.md$/);
  const timestamp = nowIso();

  const counts = {
    done: doneTickets.length,
    rejects: rejects.length,
    logs: logs.length,
    handoffs: handoffs.length,
  };

  const wikiRoot = path.join(boardRoot, "wiki");
  const indexBody = [
    "## Autoflow Work Map",
    "",
    `- Done tickets: ${counts.done}`,
    `- Reject records: ${counts.rejects}`,
    `- Verifier logs: ${counts.logs}`,
    `- Conversation handoffs: ${counts.handoffs}`,
    `- Last updated: ${timestamp}`,
    "",
    "## Completed Tickets",
    "",
    ticketList(doneTickets, 20).trimEnd(),
    "",
  ].join("\n");
  const logBody = [
    "## Derived Timeline",
    "",
    `- Last rebuilt: ${timestamp}`,
    "",
    "### Completed Tickets",
    "",
    ticketList(doneTickets, 20).trimEnd(),
    "",
    "### Verifier Logs",
    "",
    plainFileList(logs, "No verifier logs found.", 20).trimEnd(),
    "",
    "### Reject Records",
    "",
    rejectList(rejects, 20).trimEnd(),
    "",
    "### Conversation Handoffs",
    "",
    plainFileList(handoffs, "No conversation handoffs archived.", 20).trimEnd(),
    "",
  ].join("\n");
  const overviewBody = [
    "## Current Autoflow Summary",
    "",
    `- Project root: \`${projectRoot}\``,
    `- Board root: \`${boardRoot}\``,
    `- Done tickets: ${counts.done}`,
    `- Reject records: ${counts.rejects}`,
    `- Verifier logs: ${counts.logs}`,
    `- Conversation handoffs: ${counts.handoffs}`,
    `- Last updated: ${timestamp}`,
    "",
    "## Latest Completed Work",
    "",
    ticketList(doneTickets, 8).trimEnd(),
    "",
    "## Recent Handoffs",
    "",
    plainFileList(handoffs, "No conversation handoffs archived.", 5).trimEnd(),
    "",
  ].join("\n");

  if (dryRun) {
    out("status", "dry_run");
    out("project_root", projectRoot);
    out("board_root", boardRoot);
    out("wiki_root", wikiRoot);
    out("ticket_done_count", counts.done);
    out("reject_count", counts.rejects);
    out("log_count", counts.logs);
    out("handoff_count", counts.handoffs);
    return;
  }

  const changed: string[] = [];
  const indexFile = path.join(wikiRoot, "index.md");
  const logFile = path.join(wikiRoot, "log.md");
  const overviewFile = path.join(wikiRoot, "project-overview.md");
  if (replaceManagedSection(indexFile, "work-map", indexBody, defaultPage("index"))) changed.push(indexFile);
  if (replaceManagedSection(logFile, "derived-timeline", logBody, defaultPage("log"))) changed.push(logFile);
  if (replaceManagedSection(overviewFile, "project-summary", overviewBody, defaultPage("overview"))) changed.push(overviewFile);

  const status = changed.length > 0 ? "updated" : "unchanged";
  const historyFile = appendHistory(status, timestamp, counts, changed.length);
  out("status", status);
  out("project_root", projectRoot);
  out("board_root", boardRoot);
  out("wiki_root", wikiRoot);
  out("checked_at", timestamp);
  out("ticket_done_count", counts.done);
  out("reject_count", counts.rejects);
  out("log_count", counts.logs);
  out("handoff_count", counts.handoffs);
  out("changed_file_count", changed.length);
  out("history_file", historyFile);
  changed.forEach((file, index) => out(`updated_file.${index + 1}`, file));
}

main();
