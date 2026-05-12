#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

assert_same() {
  local active_rel="$1"
  local runtime_rel="$2"
  local active_file="${REPO_ROOT}/${active_rel}"
  local runtime_file="${REPO_ROOT}/${runtime_rel}"

  if ! cmp -s "$active_file" "$runtime_file"; then
    echo "Mirror mismatch:" >&2
    echo "  active:  ${active_rel}" >&2
    echo "  runtime: ${runtime_rel}" >&2
    diff -u "$active_file" "$runtime_file" >&2 || true
    exit 1
  fi
}

assert_same ".autoflow/scripts/board-guard.sh" "runtime/board-scripts/board-guard.sh"
assert_same ".autoflow/scripts/state-db.sh" "runtime/board-scripts/state-db.sh"
assert_same ".autoflow/scripts/lint-ticket.sh" "runtime/board-scripts/lint-ticket.sh"
assert_same ".autoflow/scripts/lint-ticket.ts" "runtime/board-scripts/lint-ticket.ts"
assert_same ".autoflow/scripts/path-conflict-check.sh" "runtime/board-scripts/path-conflict-check.sh"
assert_same ".autoflow/scripts/path-conflict-check.ts" "runtime/board-scripts/path-conflict-check.ts"
assert_same ".autoflow/scripts/integrate-worktree.sh" "runtime/board-scripts/integrate-worktree.sh"
assert_same ".autoflow/scripts/integrate-worktree.ts" "runtime/board-scripts/integrate-worktree.ts"

echo "status=ok"
