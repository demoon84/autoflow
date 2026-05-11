#!/usr/bin/env bash
# handoff-todo.sh — thin wrapper around handoff-todo.js.
# Legacy bash version preserved as handoff-todo.legacy.sh.
# Note: handoff-todo is DEPRECATED in the 3-runner topology.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/handoff-todo.js" "$@"
