#!/usr/bin/env bash
# finish-ticket-owner.sh — thin wrapper around finish-ticket-owner.js.
# Legacy bash version preserved as finish-ticket-owner.legacy.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/finish-ticket-owner.js" "$@"
