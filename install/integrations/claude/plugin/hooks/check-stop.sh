#!/usr/bin/env bash
# Autoflow Stop hook for Claude Code.
#
# Runs only inside Autoflow-spawned claude PTY sessions, because only those
# sessions get AUTOFLOW_NODE_RUNTIME + AUTOFLOW_CLI_ENTRY pre-populated in
# the environment. When a user starts Claude Code by hand the env vars are
# absent and this hook exits 0 (no-op) so it never breaks plain sessions.
#
# When env is present, invoke `<autoflow> tool check-stop` exactly the same
# way the codex Stop hook does (same TS implementation), and forward its
# stdout (a top-level `decision: "block"` JSON blob with a reason) plus exit
# code to Claude Code.

set -u

if [ -z "${AUTOFLOW_NODE_RUNTIME:-}" ] || [ -z "${AUTOFLOW_CLI_ENTRY:-}" ]; then
  exit 0
fi

if [ ! -x "$AUTOFLOW_NODE_RUNTIME" ] && [ ! -f "$AUTOFLOW_NODE_RUNTIME" ]; then
  # Stale env (e.g. autoflow app moved on disk). Fail open so we don't
  # block claude turns indefinitely; the worker startup scan will still
  # surface pending work the next time the runner is a
  exit 0
fi
if [ ! -f "$AUTOFLOW_CLI_ENTRY" ]; then
  exit 0
fi

if [ "${AUTOFLOW_CLI_NEEDS_ELECTRON:-0}" = "1" ]; then
  ELECTRON_RUN_AS_NODE=1 exec "$AUTOFLOW_NODE_RUNTIME" "$AUTOFLOW_CLI_ENTRY" tool check-stop
else
  exec "$AUTOFLOW_NODE_RUNTIME" "$AUTOFLOW_CLI_ENTRY" tool check-stop
fi
