#!/usr/bin/env bash
# merge-ready-ticket.sh — thin wrapper around merge-ready-ticket.js.
# Legacy bash version preserved as merge-ready-ticket.legacy.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/merge-ready-ticket.js" "$@"
