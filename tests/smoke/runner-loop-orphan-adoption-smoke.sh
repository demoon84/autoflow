#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
fake_pid=""
fake_orphan_pid=""
started_fake_pid=""

cleanup() {
  if [ -n "${fake_pid:-}" ]; then
    kill "$fake_pid" 2>/dev/null || true
  fi
  if [ -n "${fake_orphan_pid:-}" ]; then
    kill "$fake_orphan_pid" 2>/dev/null || true
  fi
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

start_fake_loop_worker() {
  if command -v setsid >/dev/null 2>&1; then
    setsid bash -c 'while :; do sleep 60; done' \
      "${REPO_ROOT}/packages/cli/runners-project.sh" \
      loop-worker worker "$project_dir" .autoflow >/dev/null 2>&1 &
  else
    nohup bash -c 'while :; do sleep 60; done' \
      "${REPO_ROOT}/packages/cli/runners-project.sh" \
      loop-worker worker "$project_dir" .autoflow >/dev/null 2>&1 &
  fi
  started_fake_pid="$!"
  disown "$started_fake_pid" 2>/dev/null || true
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

start_fake_loop_worker
fake_pid="$started_fake_pid"
sleep 0.2
if ! kill -0 "$fake_pid" 2>/dev/null; then
  echo "Expected fake loop worker to stay running." >&2
  exit 1
fi

start_output="${project_dir}/runner-start.out"
if ! "${REPO_ROOT}/bin/autoflow" runners start worker "$project_dir" .autoflow > "$start_output" 2>&1; then
  echo "Expected runners start to succeed." >&2
  cat "$start_output" >&2
  exit 1
fi
require_line "$start_output" "status=ok"
require_line "$start_output" "result=already_running_adopted"
require_line "$start_output" "pid=${fake_pid}"

stop_output="${project_dir}/runner-stop.out"
if ! "${REPO_ROOT}/bin/autoflow" runners stop worker "$project_dir" .autoflow > "$stop_output" 2>&1; then
  echo "Expected runners stop to succeed." >&2
  cat "$stop_output" >&2
  exit 1
fi
require_line "$stop_output" "status=ok"
if kill -0 "$fake_pid" 2>/dev/null; then
  echo "Expected adopted fake loop worker to be stopped." >&2
  cat "$stop_output" >&2
  exit 1
fi
fake_pid=""

start_fake_loop_worker
fake_orphan_pid="$started_fake_pid"
sleep 0.2
orphan_stop_output="${project_dir}/runner-stop-orphan.out"
if ! "${REPO_ROOT}/bin/autoflow" runners stop worker "$project_dir" .autoflow > "$orphan_stop_output" 2>&1; then
  echo "Expected orphan runners stop to succeed." >&2
  cat "$orphan_stop_output" >&2
  exit 1
fi
require_line "$orphan_stop_output" "status=ok"
require_line "$orphan_stop_output" "result=already_stopped_orphan_loop_workers_1"
if kill -0 "$fake_orphan_pid" 2>/dev/null; then
  echo "Expected orphan fake loop worker to be stopped." >&2
  cat "$orphan_stop_output" >&2
  exit 1
fi
fake_orphan_pid=""

echo "status=ok"
echo "project_root=$project_dir"
