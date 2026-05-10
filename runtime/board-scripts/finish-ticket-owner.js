#!/usr/bin/env node
'use strict';

/**
 * finish-ticket-owner.js
 *
 * Thin Node.js entry point for the ticket finalizer (pass/fail routing).
 * Delegates all logic to finish-ticket-owner.legacy.sh so the .sh thin
 * wrapper can call `node finish-ticket-owner.js "$@"` without forking bash twice.
 *
 * Usage: node finish-ticket-owner.js <ticket-id-or-path> <pass|fail> [summary]
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptDir = __dirname;
const legacyScript = path.join(scriptDir, 'finish-ticket-owner.legacy.sh');

const result = spawnSync('bash', [legacyScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[finish-ticket-owner] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
