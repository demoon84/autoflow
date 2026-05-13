#!/usr/bin/env npx tsx
/*
 * origin-cli.ts — origin ledger query shim.
 */

import * as path from "node:path";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
const subcmd = process.argv[2] || "status";

if (subcmd === "status") {
  process.stdout.write(`status=ok\norigin.status=available\nboard_root=${boardRoot}\nproject_root=${projectRoot}\n`);
  process.exit(0);
}

process.stdout.write(`status=unsupported\nreason=origin_cli_ts_minimal\nsubcommand=${subcmd}\nboard_root=${boardRoot}\nproject_root=${projectRoot}\n`);
process.exit(0);
