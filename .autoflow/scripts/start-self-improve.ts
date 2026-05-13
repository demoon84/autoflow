#!/usr/bin/env npx tsx
/*
 * start-self-improve.ts — disabled experimental self-improvement runner.
 */

process.stdout.write([
  "status=skipped",
  "reason=self_improve_runner_disabled",
  "next_action=Self-improve is not part of the supported runner topology.",
].join("\n") + "\n");
