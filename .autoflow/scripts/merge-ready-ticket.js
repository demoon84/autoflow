#!/usr/bin/env node
'use strict';

/**
 * merge-ready-ticket.js
 *
 * Thin Node.js entry point for the merge-ready finalizer.
 * Delegates all logic to merge-ready-ticket.legacy.sh.
 *
 * Usage: node merge-ready-ticket.js <ticket-id-or-path> [options]
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptDir = __dirname;
const legacyScript = path.join(scriptDir, 'merge-ready-ticket.legacy.sh');

const result = spawnSync('bash', [legacyScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[merge-ready-ticket] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
