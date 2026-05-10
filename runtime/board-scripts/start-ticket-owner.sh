#!/usr/bin/env bash
# start-ticket-owner.sh — thin wrapper around start-ticket-owner.js.
# Legacy bash version preserved as start-ticket-owner.legacy.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/start-ticket-owner.js" "$@"
