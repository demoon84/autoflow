#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

require_line() {
  local file="$1"
  local expected="$2"

  if ! grep -Fqx -- "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

heartbeat_file="${project_dir}/.autoflow/automations/heartbeat-set.toml"
heartbeat_before="${project_dir}/heartbeat-set.before"
cp "$heartbeat_file" "$heartbeat_before"

add_output="${project_dir}/runner-add.out"
"${REPO_ROOT}/bin/autoflow" runners add heartbeat-sync-smoke doctor "$project_dir" .autoflow \
  agent=manual mode=one-shot enabled=false >"$add_output"
require_line "$add_output" "status=ok"
require_line "$add_output" "result=runner_added"

remove_output="${project_dir}/runner-remove.out"
"${REPO_ROOT}/bin/autoflow" runners remove heartbeat-sync-smoke "$project_dir" .autoflow >"$remove_output"
require_line "$remove_output" "status=ok"
require_line "$remove_output" "result=runner_removed"

if ! cmp -s "$heartbeat_before" "$heartbeat_file"; then
  echo "Expected runners add/remove not to rewrite heartbeat-set.toml by default." >&2
  echo "--- before ---" >&2
  cat "$heartbeat_before" >&2
  echo "--- after ---" >&2
  cat "$heartbeat_file" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
