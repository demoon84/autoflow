#!/usr/bin/env bash
# integrate-worktree.sh — thin wrapper around integrate-worktree.ts (TypeScript via tsx).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TSX="${PROJECT_ROOT}/node_modules/.bin/tsx"
if [ ! -x "$TSX" ]; then
  TSX="npx --yes tsx"
fi
exec $TSX "$SCRIPT_DIR/integrate-worktree.ts" "$@"
