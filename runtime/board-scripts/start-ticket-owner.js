#!/usr/bin/env node
'use strict';

/**
 * start-ticket-owner.js
 *
 * Entry point for the Impl AI worker startup sequence.
 * Implements the ownership lock hybrid (liveness check + takeover decision) in
 * Node.js, then delegates full ticket orchestration to start-ticket-owner.legacy.sh.
 *
 * Token format: runner_id:pid:YYYY-MM-DDTHH:MM:SSZ
 *
 * Claim decisions:
 *   unclaimed               — no token on ticket
 *   owned_same_pid          — same runner, same PID → resume
 *   takeover_same_runner    — same runner, different PID (PTY restart) → takeover
 *   blocked_other_runner_alive — different alive runner → blocked
 *   takeover_stale_pid      — different dead runner → takeover
 *   owned_legacy            — legacy single-field token, same runner
 *   takeover_legacy         — legacy single-field token, different runner
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const scriptDir = __dirname;
const legacyScript = path.join(scriptDir, 'start-ticket-owner.legacy.sh');

// ---------------------------------------------------------------------------
// Ownership lock helpers
// ---------------------------------------------------------------------------

const LOCK_TOKEN_RE = /^(.+):(\d+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/;

/** Parse a structured lock token. Returns {runnerId, pid, spawnedAt} or null. */
function parseLockToken(raw) {
  if (!raw) return null;
  const m = LOCK_TOKEN_RE.exec(raw.trim());
  if (!m) return null;
  return { runnerId: m[1], pid: parseInt(m[2], 10), spawnedAt: m[3] };
}

/**
 * Check if a process is running via POSIX signal 0.
 * Returns true even when we get EPERM (process exists but no permission to signal).
 */
function isPidRunning(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true; // exists, no permission
    return false;
  }
}

/** Canonical worker id normalisation: strip trailing `-N` numeric suffix. */
function canonicalWorkerId(id) {
  if (!id) return '';
  return id.replace(/-\d+$/, '').toLowerCase();
}

/** Check if two worker ids refer to the same logical runner. */
function workerIdMatches(fieldValue, currentRunner) {
  if (!fieldValue || !currentRunner) return false;
  if (canonicalWorkerId(fieldValue) === canonicalWorkerId(currentRunner)) return true;
  return false;
}

/**
 * Decide how the current runner should treat an existing lock token on a ticket.
 * @param {string} raw - raw "Claimed By" / "Execution AI" / "AI" field value
 * @param {string} currentRunner - current runner id (env AUTOFLOW_WORKER_ID or 'worker')
 * @param {number} currentPid - current runner PID (env AUTOFLOW_TICKET_OWNER_PID or process.pid)
 * @returns {'unclaimed'|'owned_same_pid'|'takeover_same_runner'|'blocked_other_runner_alive'|'takeover_stale_pid'|'owned_legacy'|'takeover_legacy'}
 */
function ownershipClaimDecision(raw, currentRunner, currentPid) {
  if (!raw || raw.trim() === '') return 'unclaimed';

  const parsed = parseLockToken(raw);
  if (parsed) {
    if (workerIdMatches(parsed.runnerId, currentRunner)) {
      if (parsed.pid === currentPid) return 'owned_same_pid';
      return 'takeover_same_runner';
    }
    // Different runner
    if (isPidRunning(parsed.pid)) return 'blocked_other_runner_alive';
    return 'takeover_stale_pid';
  }

  // Legacy token (plain runner-id string, no pid/timestamp)
  if (workerIdMatches(raw.trim(), currentRunner)) return 'owned_legacy';
  return 'takeover_legacy';
}

// ---------------------------------------------------------------------------
// Pre-flight ownership check (best-effort, non-blocking)
// ---------------------------------------------------------------------------

function runOwnershipPreFlight() {
  const currentRunner = process.env.AUTOFLOW_WORKER_ID || 'worker';
  const currentPid = parseInt(process.env.AUTOFLOW_TICKET_OWNER_PID || String(process.pid), 10);
  const boardRoot = process.env.AUTOFLOW_BOARD_ROOT
    || path.resolve(scriptDir, '..');

  const inprogressDir = path.join(boardRoot, 'tickets', 'inprogress');
  let entries;
  try {
    entries = fs.readdirSync(inprogressDir);
  } catch {
    return; // inprogress dir missing — no pre-flight needed
  }

  const ticketFiles = entries.filter(f => /^Todo-\d+\.md$|^tickets_\d+\.md$/.test(f));
  for (const fname of ticketFiles) {
    const fpath = path.join(inprogressDir, fname);
    let content;
    try {
      content = fs.readFileSync(fpath, 'utf8');
    } catch {
      continue;
    }

    // Extract Claimed By / Execution AI / AI fields from ## Ticket section
    const claimedBy = extractTicketField(content, 'Claimed By')
      || extractTicketField(content, 'Execution AI')
      || extractTicketField(content, 'AI');

    if (!claimedBy) continue;

    const decision = ownershipClaimDecision(claimedBy, currentRunner, currentPid);
    // Emit diagnostic when we detect a live foreign lock
    if (decision === 'blocked_other_runner_alive') {
      process.stderr.write(
        `[start-ticket-owner] ownership pre-flight: ${fname} held by alive pid (${claimedBy}), will defer to legacy script\n`
      );
    }
  }
}

/** Extract a scalar field value from a markdown ticket body in ## Ticket section. */
function extractTicketField(content, fieldName) {
  const re = new RegExp(`^- ${fieldName}:[\\t ]*(.+)$`, 'm');
  const m = re.exec(content);
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------------------
// Main: run pre-flight then hand off to legacy shell implementation
// ---------------------------------------------------------------------------

try {
  runOwnershipPreFlight();
} catch (err) {
  // Non-blocking: pre-flight failure must never block the worker (1원칙)
  process.stderr.write(`[start-ticket-owner] pre-flight skipped: ${err && err.message}\n`);
}

const result = spawnSync('bash', [legacyScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[start-ticket-owner] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
