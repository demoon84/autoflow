#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

assert_same() {
  local left="$1"
  local right="$2"

  if ! cmp -s "$left" "$right"; then
    echo "Mirror drift detected:" >&2
    echo "  left:  $left" >&2
    echo "  right: $right" >&2
    diff -u "$left" "$right" >&2 || true
    exit 1
  fi
}

mirror_files=(
  "finish-ticket-owner.sh"
  "board-guard.sh"
  "state-db.sh"
  "start-ticket-owner.legacy.sh"
  "runner-common.sh"
  "watch-board.sh"
  "start-todo.sh"
)

for name in "${mirror_files[@]}"; do
  assert_same "${REPO_ROOT}/.autoflow/scripts/${name}" "${REPO_ROOT}/runtime/board-scripts/${name}"
done

echo "status=ok"
