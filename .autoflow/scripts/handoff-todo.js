#!/usr/bin/env node
'use strict';

/**
 * handoff-todo.js
 *
 * Node primary implementation for the deprecated legacy todo -> verifier
 * handoff. The 4-runner topology verifies via finish-ticket-owner + verifier,
 * but this compatibility command still needs deterministic behavior for older
 * boards and smoke tests.
 *
 * The legacy shell fallback was removed after the Node implementation became
 * the single owner of this deprecated compatibility path.
 */

const fs = require('node:fs');
const path = require('node:path');

const scriptDir = __dirname;

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

function projectRoot() {
  return path.resolve(process.env.AUTOFLOW_PROJECT_ROOT || process.env.PROJECT_ROOT || path.join(scriptDir, '..', '..'));
}

function boardRoot() {
  return path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(projectRoot(), '.autoflow'));
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeId(value) {
  const m = String(value || '').match(/(\d+)/);
  return m ? m[1].padStart(3, '0') : '';
}

function ticketPath(state, id) {
  return path.join(boardRoot(), 'tickets', state, `Todo-${id}.md`);
}

function listTickets(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => /^Todo-\d+\.md$|^tickets_\d+\.md$/.test(name))
      .sort()
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

function field(text, name) {
  const re = new RegExp(`^- ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'm');
  const m = text.match(re);
  return m ? trim(m[1]) : '';
}

function sectionScalar(text, section, name) {
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const sectionRe = new RegExp(`^## ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const fieldRe = new RegExp(`^- ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`);
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const m = line.match(fieldRe);
    if (m) return trim(m[1]);
  }
  return '';
}

function replaceScalar(text, section, name, value) {
  const lines = text.split(/\r?\n/);
  const sectionName = section.replace(/^##\s*/, '');
  const sectionRe = new RegExp(`^## ${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const fieldRe = new RegExp(`^(- ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*).*$`);
  let inSection = false;
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (sectionRe.test(lines[i])) {
      inSection = true;
      sectionStart = i;
      continue;
    }
    if (/^## /.test(lines[i]) && inSection) {
      lines.splice(i, 0, `- ${name}: ${value}`);
      return lines.join('\n');
    }
    if (inSection && fieldRe.test(lines[i])) {
      lines[i] = lines[i].replace(fieldRe, `$1${value}`);
      return lines.join('\n');
    }
  }
  if (sectionStart >= 0) {
    lines.splice(sectionStart + 1, 0, `- ${name}: ${value}`);
  } else {
    lines.push('', `## ${sectionName}`, '', `- ${name}: ${value}`);
  }
  return lines.join('\n');
}

function replaceSection(text, section, block) {
  const sectionName = section.replace(/^##\s*/, '');
  const header = `## ${sectionName}`;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === header);
  const newBlock = [header, '', ...String(block).split(/\r?\n/)];
  if (start < 0) {
    return `${text.replace(/\s*$/, '')}\n\n${newBlock.join('\n')}\n`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  lines.splice(start, end - start, ...newBlock);
  return lines.join('\n');
}

function appendNote(text, note) {
  const marker = '\n## Notes';
  const idx = text.indexOf(marker);
  const line = `- ${note}`;
  if (idx < 0) return `${text.replace(/\s*$/, '')}\n\n## Notes\n\n${line}\n`;
  const nextHeader = text.slice(idx + marker.length).search(/\n## /);
  if (nextHeader < 0) return `${text.replace(/\s*$/, '')}\n${line}\n`;
  const split = idx + marker.length + nextHeader;
  return `${text.slice(0, split).replace(/\s*$/, '')}\n${line}\n${text.slice(split)}`;
}

function contextValue(key) {
  const candidates = [
    path.join(boardRoot(), 'automations', 'state', 'thread-context.env'),
    path.join(boardRoot(), 'runners', 'state', 'thread-context.env'),
  ];
  for (const file of candidates) {
    const text = read(file);
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      if (line.slice(0, eq) === key) return line.slice(eq + 1);
    }
  }
  return '';
}

function clearActiveTicketContext() {
  const candidates = [
    path.join(boardRoot(), 'automations', 'state', 'thread-context.env'),
    path.join(boardRoot(), 'runners', 'state', 'thread-context.env'),
  ];
  let changed = false;
  for (const file of candidates) {
    const text = read(file);
    if (!text) continue;
    const next = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^(active_ticket_id|active_ticket_path|active_stage)=.*$/, '$1='))
      .join('\n');
    if (next !== text) {
      write(file, next);
      changed = true;
    }
  }
  return changed;
}

function ownerId() {
  return process.env.AUTOFLOW_WORKER_ID || process.env.RUNNER_ID || 'worker';
}

function workerMatches(raw, worker) {
  const value = trim(raw).replace(/:\d+:\d{4}-\d{2}-\d{2}T.*$/, '').replace(/-\d+$/, '').toLowerCase();
  const target = trim(worker).replace(/-\d+$/, '').toLowerCase();
  return value !== '' && value === target;
}

function resolveTicket(requested) {
  const root = boardRoot();
  if (requested) {
    const id = normalizeId(requested);
    if (id) {
      const candidate = ticketPath('inprogress', id);
      if (fs.existsSync(candidate)) return candidate;
    }
    let requestedPath = String(requested);
    if (!path.isAbsolute(requestedPath)) {
      if (/^(?:\.\/)?tickets\//.test(requestedPath)) {
        requestedPath = path.join(root, requestedPath.replace(/^\.\//, ''));
      } else {
        requestedPath = path.join(root, 'tickets', 'inprogress', requestedPath);
      }
    }
    if (fs.existsSync(requestedPath)) return requestedPath;
  }

  const activePath = contextValue('active_ticket_path');
  if (activePath) {
    const candidate = path.isAbsolute(activePath) ? activePath : path.join(root, activePath);
    if (fs.existsSync(candidate)) return candidate;
  }

  const activeId = normalizeId(contextValue('active_ticket_id'));
  if (activeId) {
    const candidate = ticketPath('inprogress', activeId);
    if (fs.existsSync(candidate)) return candidate;
  }

  const worker = ownerId();
  for (const candidate of listTickets(path.join(root, 'tickets', 'inprogress'))) {
    const text = read(candidate);
    if (
      workerMatches(field(text, 'Execution AI'), worker) ||
      workerMatches(field(text, 'AI'), worker) ||
      workerMatches(field(text, 'Claimed By'), worker)
    ) {
      return candidate;
    }
  }
  return '';
}

function failOrIdle(message, reason) {
  process.stdout.write(`status=idle\nreason=${reason}\nmessage=${message}\nboard_root=${boardRoot()}\nproject_root=${projectRoot()}\n`);
  process.exit(0);
}

if ((process.env.AUTOFLOW_ROLE || '') !== 'todo') {
  process.stderr.write('Expected AUTOFLOW_ROLE=todo for handoff-todo.js\n');
  process.exit(1);
}

const ticketFile = resolveTicket(process.argv[2] || '');
if (!ticketFile) failOrIdle('No inprogress todo ticket found for handoff.', 'no_inprogress_ticket');

const ticketId = normalizeId(path.basename(ticketFile));
const targetFile = ticketPath('verifier', ticketId);
const timestamp = nowIso();

if (fs.existsSync(targetFile)) {
  process.stderr.write(`Verifier ticket already exists: ${targetFile}\n`);
  process.exit(1);
}

let text = read(ticketFile);
const resultSummary = sectionScalar(text, 'Result', 'Summary');
text = replaceScalar(text, 'Ticket', 'Stage', 'verifier');
text = replaceScalar(text, 'Ticket', 'Last Updated', timestamp);
text = replaceSection(text, 'Verification', '- Run file:\n- Log file:\n- Result: pending');
text = replaceSection(text, 'Next Action', '- Next: verifier heartbeat should run the ticket checks from `tickets/verifier/`.');
text = replaceSection(text, 'Resume Context', '- Current state: implementation work is complete and the ticket has been handed off for verification.\n- Last runtime action: scripts/handoff-todo.* moved the ticket from `tickets/inprogress/` to `tickets/verifier/`.\n- Next reader: verifier should review Done When, Verification command, Notes, and the ticket worktree.');
if (!trim(resultSummary)) {
  text = replaceScalar(text, 'Result', 'Summary', 'Implementation completed; awaiting verifier.');
}
text = appendNote(text, `Handed off to verifier at ${timestamp} via scripts/handoff-todo.js`);

fs.mkdirSync(path.dirname(targetFile), { recursive: true });
write(ticketFile, text);
fs.renameSync(ticketFile, targetFile);

let context = 'no_context';
try {
  context = clearActiveTicketContext() ? 'active_cleared' : 'no_context';
} catch {
  context = 'no_context';
}

process.stdout.write(`status=ok\n`);
process.stdout.write(`ticket_id=${ticketId}\n`);
process.stdout.write(`handoff=${targetFile}\n`);
process.stdout.write(`stage=verifier\n`);
process.stdout.write(`board_root=${boardRoot()}\n`);
process.stdout.write(`project_root=${projectRoot()}\n`);
process.stdout.write(`context=${context}\n`);
