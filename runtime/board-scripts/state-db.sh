#!/usr/bin/env bash
# state-db.sh — thin wrapper around state-db.ts (TypeScript via tsx).
# Legacy bash version preserved as state-db.legacy.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TSX="${PROJECT_ROOT}/node_modules/.bin/tsx"
if [ ! -x "$TSX" ]; then
  TSX="npx --yes tsx"
fi
exec $TSX "$SCRIPT_DIR/state-db.ts" "$@"
