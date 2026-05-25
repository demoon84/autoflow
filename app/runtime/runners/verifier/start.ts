#!/usr/bin/env -S npx tsx
/**
 * start-verifier.ts
 *
 * Reports whether tickets/verifier/ has verify_pending tickets.
 */

import fs from 'fs';
import path from 'path';

const boardRoot = process.env.BOARD_ROOT
  || process.env.AUTOFLOW_BOARD_ROOT
  || path.join(process.cwd(), '.autoflow');

const verifierDir = path.join(boardRoot, 'tickets', 'verifier');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hasPendingTickets(): boolean {
  try {
    const files = fs.readdirSync(verifierDir);
    return files.some(f => /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i.test(f));
  } catch {
    return false;
  }
}

function main(): void {
  ensureDir(verifierDir);

  if (hasPendingTickets()) {
    process.stdout.write(`verifier_status=pending\nverifier_dir=${verifierDir}\n`);
  } else {
    process.stdout.write(`verifier_status=no_pending_tickets\n`);
  }
}

main();
