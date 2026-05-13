#!/usr/bin/env npx tsx
/*
 * watch-board.ts — deprecated script-driven file watcher placeholder.
 */

process.stdout.write([
  "status=deprecated",
  "reason=file_watch_loop_removed",
  "next_action=Use runner realtime wakeup or heartbeat runners instead of watch-board.",
].join("\n") + "\n");
