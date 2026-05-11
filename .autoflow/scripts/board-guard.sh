#!/usr/bin/env bash
# board-guard.sh — thin wrapper around board-guard.ts (TypeScript via tsx).
# Legacy bash version preserved as board-guard.legacy.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TSX="${PROJECT_ROOT}/node_modules/.bin/tsx"
if [ ! -x "$TSX" ]; then
  TSX="npx --yes tsx"
fi
exec $TSX "$SCRIPT_DIR/board-guard.ts" "$@"
