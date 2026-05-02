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
git -C "$project_dir" add .autoflow
git -C "$project_dir" commit -m "baseline board" >/dev/null

set_output="${project_dir}/runner-set.out"
list_output="${project_dir}/runner-list.out"
worker_index=""

"${REPO_ROOT}/bin/autoflow" runners set worker "$project_dir" .autoflow \
  model=gpt-5.5 \
  reasoning=medium >"$set_output"

require_line "$set_output" "status=ok"
require_line "$set_output" "result=config_updated"
require_line "$set_output" "config_path=${project_dir}/.autoflow/runners/config.local.toml"
require_line "$set_output" "model=gpt-5.5"
require_line "$set_output" "reasoning=medium"

if [ ! -f "${project_dir}/.autoflow/runners/config.local.toml" ]; then
  echo "Expected local runner config to be created." >&2
  exit 1
fi

if git -C "$project_dir" status --porcelain -- .autoflow/runners/config.toml | grep -q .; then
  echo "Tracked runner config should stay clean after runners set." >&2
  git -C "$project_dir" status --porcelain -- .autoflow/runners/config.toml >&2
  exit 1
fi

ignored_status="$(git -C "$project_dir" status --porcelain --ignored -- .autoflow/runners/config.local.toml)"
if [ "$ignored_status" != "!! .autoflow/runners/config.local.toml" ]; then
  echo "Expected config.local.toml to be ignored, got: $ignored_status" >&2
  exit 1
fi

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" .autoflow >"$list_output"
require_line "$list_output" "config_path=${project_dir}/.autoflow/runners/config.local.toml"
worker_index="$(awk -F= '$2 == "worker" && $1 ~ /^runner\.[0-9]+\.id$/ { split($1, parts, "."); print parts[2]; exit }' "$list_output")"
if [ -z "$worker_index" ]; then
  echo "Expected worker runner in list output." >&2
  cat "$list_output" >&2
  exit 1
fi
require_line "$list_output" "runner.${worker_index}.model=gpt-5.5"
require_line "$list_output" "runner.${worker_index}.reasoning=medium"

echo "status=ok"
echo "project_root=$project_dir"
