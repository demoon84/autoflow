#!/usr/bin/env node
'use strict';

/**
 * handoff-todo.js
 *
 * Thin Node.js entry point for the legacy todo→verifier handoff.
 * Delegates all logic to handoff-todo.legacy.sh.
 *
 * Note: handoff-todo is DEPRECATED in the 3-runner topology.
 * Impl AI verifies and merges inline; this script exists only for
 * backwards compatibility with the legacy role-pipeline.
 *
 * Usage: node handoff-todo.js [ticket-id]
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptDir = __dirname;
const legacyScript = path.join(scriptDir, 'handoff-todo.legacy.sh');

const result = spawnSync('bash', [legacyScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`[handoff-todo] exec error: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
