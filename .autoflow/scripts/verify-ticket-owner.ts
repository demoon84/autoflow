#!/usr/bin/env npx tsx
/*
 * verify-ticket-owner.ts
 *
 * Cross-platform verification evidence recorder for ticket-owner turns.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const workerId = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || "worker";

main();

function main(): void {
  const [ticketRef, overrideCommand = ""] = process.argv.slice(2);
  if (!ticketRef) {
    process.stderr.write("Usage: verify-ticket-owner.ts <ticket-id-or-path> [verification-command]\n");
    process.exit(1);
  }

  const ticketFile = resolveTicketFile(ticketRef);
  if (!ticketFile) {
    printPairs({
      status: "idle",
      reason: "ticket_owner_verify_ticket_missing",
      ticket_ref: ticketRef,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }

  const ticketId = idFromPath(ticketFile);
  const workingRoot = ticketWorkingRoot(ticketFile);
  const verificationCommand = process.env.AUTOFLOW_VERIFY_COMMAND || overrideCommand || scalar(ticketFile, "Verification", "Command") || specVerificationCommand(ticketFile);
  const startedAt = nowIso();

  if (!verificationCommand) {
    appendNote(ticketFile, `Ticket owner verification blocked at ${startedAt}: missing verification command.`);
    printPairs({
      status: "blocked",
      reason: "missing_verification_command",
      ticket: ticketFile,
      ticket_id: ticketId,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  const result = spawnSync(verificationCommand, {
    cwd: workingRoot,
    env: {
      ...process.env,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      AUTOFLOW_PROJECT_ROOT: projectRoot,
      BOARD_ROOT: boardRoot,
      PROJECT_ROOT: projectRoot,
    },
    shell: true,
    encoding: "utf8",
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const finishedAt = nowIso();
  const passed = exitCode === 0;
  const resultLine = passed ? "passed" : "failed";
  const output = formatOutput(`${result.stdout || ""}${result.stderr || ""}`, exitCode);

  replaceSection(ticketFile, "Verification", `- Command: \`${verificationCommand}\`
- Working Root: \`${workingRoot}\`
- Result: ${resultLine} by ${workerId} at ${finishedAt}
- Exit Code: ${exitCode}
- Started At: ${startedAt}${output ? `\n- Output:\n\`\`\`\n${output}\n\`\`\`` : ""}`);
  replaceScalar(ticketFile, "Ticket", "Last Updated", finishedAt);
  appendNote(ticketFile, `Ticket owner verification ${resultLine} by ${workerId} at ${finishedAt}: command exited ${exitCode}`);

  printPairs({
    status: passed ? "pass" : "fail",
    ticket: ticketFile,
    ticket_id: ticketId,
    working_root: workingRoot,
    command: verificationCommand,
    exit_code: String(exitCode),
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: passed
      ? `AI must inspect this verification evidence, manually merge verified changes into PROJECT_ROOT if not already integrated, rerun any needed verification after merge, then use scripts/finish-ticket-owner.ts ${ticketId} pass "<short summary>" as a finalization tool.`
      : `Fix inside scope and rerun verification, or scripts/finish-ticket-owner.ts ${ticketId} fail "<concrete reject reason>"`,
  });
}

function resolveTicketFile(ref: string): string {
  const normalized = ref.replace(/^[.][/]/, "");
  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;
  if (normalized.includes("/")) {
    const candidate = path.join(boardRoot, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  const id = normalizeId(ref);
  for (const state of ["inprogress", "todo", "verifier"]) {
    for (const name of [`Todo-${id}.md`, `tickets_${id}.md`]) {
      const candidate = path.join(boardRoot, "tickets", state, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

function ticketWorkingRoot(ticketFile: string): string {
  const worktree = scalar(ticketFile, "Worktree", "Path");
  return worktree && fs.existsSync(worktree) ? worktree : projectRoot;
}

function specVerificationCommand(ticketFile: string): string {
  const ref = referenceValue(ticketFile, "PRD");
  if (!ref) return "";
  const specFile = path.isAbsolute(ref) ? ref : path.join(boardRoot, ref);
  return scalar(specFile, "Verification", "Command");
}

function referenceValue(file: string, field: string): string {
  return scalar(file, "References", field);
}

function formatOutput(output: string, exitCode: number): string {
  const clean = output.replace(/\r/g, "").trim();
  if (!clean) return "";
  const lines = clean.split("\n");
  const max = exitCode === 0 ? positiveInt(process.env.AUTOFLOW_VERIFY_PASS_OUTPUT_LINES || "", 40) : positiveInt(process.env.AUTOFLOW_VERIFY_FAIL_OUTPUT_LINES || process.env.AUTOFLOW_VERIFY_OUTPUT_LINES || "", 200);
  if (lines.length <= max) return clean;
  const first = Math.max(1, Math.floor(max / 2));
  const last = Math.max(1, max - first);
  return [
    ...lines.slice(0, first),
    `[... truncated: ${lines.length - first - last} lines omitted between first ${first} and last ${last} lines ...]`,
    ...lines.slice(-last),
  ].join("\n");
}

function scalar(file: string, section: string, field: string): string {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^- ${escapeRe(field)}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const match = line.match(fieldRe);
    if (match) return match[1].replace(/^`+|`+$/g, "").trim();
  }
  return "";
}

function replaceScalar(file: string, section: string, field: string, value: string): void {
  const lines = read(file).split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRe(section)}\\b`);
  const fieldRe = new RegExp(`^(- ${escapeRe(field)}\\s*:).*?$`);
  let inSection = false;
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      lines.splice(i, 0, `- ${field}: ${value}`);
      write(file, lines.join("\n"));
      return;
    }
    if (inSection && fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1 ${value}`);
      write(file, lines.join("\n"));
      return;
    }
  }
  if (sectionStart >= 0) lines.push(`- ${field}: ${value}`);
  else lines.push("", `## ${section}`, "", `- ${field}: ${value}`);
  write(file, lines.join("\n"));
}

function replaceSection(file: string, section: string, body: string): void {
  const content = read(file);
  const re = new RegExp(`(^## ${escapeRe(section)}\\b[^\\n]*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string) => `${heading}\n${body.trim()}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## ${section}\n\n${body.trim()}\n`;
  write(file, next);
}

function appendNote(file: string, note: string): void {
  const content = read(file);
  const bullet = `- ${note}`;
  const re = /(^## Notes\b[^\n]*\n)([\s\S]*?)(?=^## |\Z)/m;
  const next = re.test(content)
    ? content.replace(re, (_match, heading: string, body: string) => `${heading}${body}${body.endsWith("\n") ? "" : "\n"}${bullet}\n\n`)
    : `${content.replace(/\n*$/, "\n")}\n## Notes\n\n${bullet}\n`;
  write(file, next);
}

function idFromPath(file: string): string {
  const match = path.basename(file).match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function normalizeId(value: string): string {
  const match = value.match(/(\d+)/);
  return match ? String(Number.parseInt(match[1], 10)).padStart(3, "0") : "";
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function write(file: string, content: string): void {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) process.stdout.write(`${key}=${value ?? ""}\n`);
}
