#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  "${REPO_ROOT}/bin/autoflow" runners stop planner "$project_dir" >/dev/null 2>&1 || true
  rm -rf "$project_dir"
}
trap cleanup EXIT

marker_count() {
  grep -c '^invoked$' "${project_dir}/adapter.marker" 2>/dev/null || true
}

wait_for_marker_count() {
  local expected="$1"
  local attempts="${2:-20}"
  local count

  for _ in $(seq 1 "$attempts"); do
    count="$(marker_count)"
    [ -n "$count" ] || count=0
    if [ "$count" = "$expected" ]; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for marker count ${expected}" >&2
  cat "${project_dir}/adapter.marker" 2>/dev/null >&2 || true
  exit 1
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  interval_seconds=5 \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null
"${REPO_ROOT}/bin/autoflow" order create "$project_dir" .autoflow \
  --title "no progress drain smoke" \
  --request "Keep the planner queue populated while the adapter makes no board changes." >/dev/null
git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" runners start planner "$project_dir" .autoflow >/dev/null
wait_for_marker_count 1 20
sleep 2

count="$(marker_count)"
[ -n "$count" ] || count=0
if [ "$count" != "1" ]; then
  echo "Expected no immediate no-progress queue drain, got ${count} adapter invocations" >&2
  cat "${project_dir}/adapter.marker" 2>/dev/null >&2 || true
  cat "${project_dir}/.autoflow/runners/logs/planner.log" >&2
  exit 1
fi

if grep -q 'event=queue_drain_continue' "${project_dir}/.autoflow/runners/logs/planner.log"; then
  echo "Unexpected queue_drain_continue without queue progress" >&2
  cat "${project_dir}/.autoflow/runners/logs/planner.log" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
