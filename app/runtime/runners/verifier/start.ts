#!/usr/bin/env -S npx tsx
/**
 * start-verifier.ts
 *
 * Watches tickets/verifier/ for verify_pending tickets and triggers the
 * verifier runner wake. Called by worker finalization after the sanity
 * gate passes when AUTOFLOW_VERIFIER_ENABLED=1.
 *
 * Writes runners/state/verifier.verifier-realtime-wakeup.pending to trigger
 * the realtime-enabled verifier loop runner.
 */

import fs from 'fs';
import path from 'path';

const boardRoot = process.env.BOARD_ROOT
  || path.join(process.cwd(), '.autoflow');

const verifierDir = path.join(boardRoot, 'tickets', 'verifier');
const stateDir = path.join(boardRoot, 'runners', 'state');
const wakeupMarker = path.join(stateDir, 'verifier.verifier-realtime-wakeup.pending');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hasPendingTickets(): boolean {
  try {
    const files = fs.readdirSync(verifierDir);
    return files.some(f => f.startsWith('Todo-') && f.endsWith('.md'));
  } catch {
    return false;
  }
}

function writeWakeupMarker(): void {
  ensureDir(stateDir);
  fs.writeFileSync(wakeupMarker, `triggered_at=${new Date().toISOString()}\n`, 'utf8');
}

function main(): void {
  ensureDir(verifierDir);

  if (hasPendingTickets()) {
    writeWakeupMarker();
    process.stdout.write(`verifier_wakeup=triggered\nverifier_dir=${verifierDir}\n`);
  } else {
    process.stdout.write(`verifier_wakeup=no_pending_tickets\n`);
  }
}

main();
