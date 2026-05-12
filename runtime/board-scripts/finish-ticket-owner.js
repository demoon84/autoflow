#!/usr/bin/env node
'use strict';

/**
 * finish-ticket-owner.js
 *
 * Node primary entry point for ticket finalization.
 *
 * This file owns argument validation and the high-risk pass sanity preflight:
 * change-type diff threshold, Done When checklist completion, and Allowed
 * Paths product-diff matching. The legacy shell finalizer remains the
 * fallback/finalization engine for durable routing, verifier handoff, archive,
 * PR draft creation, and commit behavior; it intentionally re-runs the same
 * shell sanity gate before any pass can complete.
 *
 * Usage: node finish-ticket-owner.js <ticket-id-or-path> <pass|fail> [summary]
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const scriptDir = __dirname;
const legacyScript = path.join(scriptDir, 'finish-ticket-owner.legacy.sh');

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

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeId(value) {
  const m = String(value || '').match(/(\d+)/);
  return m ? m[1].padStart(3, '0') : '';
}

function usage() {
  process.stderr.write('Usage: finish-ticket-owner.js <ticket-id-or-path> <pass|fail> [summary-or-reject-reason]\n');
}

function resolveTicketFile(ref) {
  const root = boardRoot();
  const normalized = String(ref || '').replace(/^\.\//, '');
  if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;
  if (normalized.includes('/')) {
    const candidate = path.join(root, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  const id = normalizeId(ref);
  if (!id) return '';
  for (const state of ['inprogress', 'ready-to-merge', 'todo', 'verifier']) {
    const candidate = path.join(root, 'tickets', state, `Todo-${id}.md`);
    if (fs.existsSync(candidate)) return candidate;
    const legacy = path.join(root, 'tickets', state, `tickets_${id}.md`);
    if (fs.existsSync(legacy)) return legacy;
  }
  return '';
}

function sectionScalar(text, section, fieldName) {
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const fieldRe = new RegExp(`^- ${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`);
  let inSection = false;
  for (const line of lines) {
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const m = line.match(fieldRe);
    if (m) return trim(m[1]).replace(/^`+|`+$/g, '');
  }
  return '';
}

function doneWhenItems(text) {
  const items = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^## Done When\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    if (/^\s*- \[[ xX]\]/.test(line)) items.push(line);
  }
  return items;
}

function allowedPaths(text) {
  const out = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(line)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(line) && inSection) inSection = false;
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!m) continue;
    const value = m[1].replace(/`/g, '').trim();
    if (value) out.push(value);
  }
  return out;
}

function gitOutput(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function shortstatLineTotal(shortstat) {
  let total = 0;
  for (const match of String(shortstat || '').matchAll(/\b(\d+)\b/g)) {
    total += Number(match[1]);
  }
  return total;
}

function sanityPreflight(ticketFile) {
  const text = read(ticketFile);
  if (!text) return null;

  const worktreePath = sectionScalar(text, 'Worktree', 'Path');
  const baseCommit = sectionScalar(text, 'Worktree', 'Base Commit');
  let changeType = sectionScalar(text, 'Ticket', 'Change Type').toLowerCase();
  if (!['docs', 'cleanup', 'infra'].includes(changeType)) changeType = 'code';

  let minDiffLines = 1;
  if (changeType === 'docs' || changeType === 'cleanup') minDiffLines = 0;
  if (changeType === 'infra') {
    minDiffLines = Number(process.env.AUTOFLOW_INFRA_MIN_DIFF_LINES || '10');
    if (!Number.isInteger(minDiffLines) || minDiffLines < 0) minDiffLines = 10;
  }

  if (worktreePath && fs.existsSync(worktreePath) && baseCommit && minDiffLines > 0) {
    let shortstat = gitOutput(worktreePath, ['diff', '--shortstat', `${baseCommit}..HEAD`]);
    if (!trim(shortstat)) shortstat = gitOutput(worktreePath, ['diff', '--shortstat']);
    const total = shortstatLineTotal(shortstat);
    if (total < minDiffLines) {
      return {
        failure: changeType === 'infra' ? 'zero_diff_infra' : 'zero_diff',
        detail: `${changeType} change requires at least ${minDiffLines} changed line(s); saw ${total}`,
      };
    }
  }

  const checklist = doneWhenItems(text);
  if (checklist.length === 0) {
    return {
      failure: 'done_when_empty',
      detail: '## Done When section has no checklist items',
    };
  }
  const unchecked = checklist.filter((line) => /^\s*- \[ \]/.test(line)).length;
  if (unchecked > 0) {
    return {
      failure: 'done_when_unchecked',
      detail: `${unchecked} of ${checklist.length} Done When item(s) still unchecked`,
    };
  }

  if (!['docs', 'cleanup'].includes(changeType) && worktreePath && fs.existsSync(worktreePath) && baseCommit) {
    let names = gitOutput(worktreePath, ['diff', '--name-only', `${baseCommit}..HEAD`]);
    if (!trim(names)) names = gitOutput(worktreePath, ['diff', '--name-only']);
    const productNames = names
      .split(/\r?\n/)
      .map(trim)
      .filter(Boolean)
      .filter((name) => !name.startsWith('.autoflow/tickets/inprogress/Todo-'))
      .filter((name) => !name.startsWith('.autoflow/tickets/done/'));
    const paths = allowedPaths(text);
    const matched = productNames.some((name) => paths.some((allowed) => name === allowed || name.startsWith(`${allowed.replace(/\/$/, '')}/`)));
    if (!matched) {
      return {
        failure: 'allowed_paths_no_diff',
        detail: `no changed product file matches an Allowed Path (change_type=${changeType})`,
      };
    }
  }

  return null;
}

if (process.argv.length < 4 || process.argv.length > 5) {
  usage();
  process.exit(1);
}

const ticketRef = process.argv[2];
const outcome = process.argv[3];
if (!['pass', 'fail'].includes(outcome)) {
  usage();
  process.exit(1);
}

if (outcome === 'pass') {
  const ticketFile = resolveTicketFile(ticketRef);
  const sanityFailure = ticketFile ? sanityPreflight(ticketFile) : null;
  if (sanityFailure) {
    process.stderr.write(`[finish-ticket-owner] node sanity preflight detected ${sanityFailure.failure}: ${sanityFailure.detail}; delegating to finalizer for durable routing\n`);
  }
}

const result = spawnSync('bash', [legacyScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[finish-ticket-owner] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
