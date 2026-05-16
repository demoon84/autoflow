#!/usr/bin/env npx tsx
/*
 * run-hook.ts — deprecated file-watch hook dispatcher placeholder.
 */

process.stdout.write([
  "status=deprecated",
  "reason=file_watch_hook_removed",
  "next_action=Use realtime runner wakeups and runner-tool TS entrypoints instead.",
].join("\n") + "\n");
