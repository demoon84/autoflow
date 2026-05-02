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

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

runner_log_dir="${project_dir}/.autoflow/runners/logs"
metrics_output="${project_dir}/metrics.out"
metrics_write_output="${project_dir}/metrics-write.out"

cat >"${runner_log_dir}/worker_2026-04-26T00-00-00Z_stdout.log" <<'LOG'
ticket work completed
tokens used
95,413
LOG

cat >"${runner_log_dir}/worker_2026-04-26T00-01-00Z_stderr.log" <<'LOG'
{"usage":{"total_tokens":1200}}
LOG

cat >"${runner_log_dir}/worker_2026-04-26T00-02-00Z_live_stdout.log" <<'LOG'
tokens used
999,999
LOG

# Regression: ticket markdown fields and wiki query snippet text echoed
# into a runner stdout log must NOT be counted as token reports. The
# snippet line below contains "Tokens Used:" plus a 9-digit fingerprint
# (`Last Progress Fingerprint: 335739843`) on the same line; previously
# this fingerprint was summed as 335,739,843 tokens.
cat >"${runner_log_dir}/planner_2026-04-26T00-03-00Z_stdout.log" <<'LOG'
result.7.snippet.1.text=- Tokens Used: - Continuation Suppressed: true - Last Event: rejected - Last Progress Fingerprint: 335739843  ## Recovery State
- Tokens Used:
  Continuation Suppressed: false
tokens used
92,473
LOG

"${REPO_ROOT}/bin/autoflow" metrics "$project_dir" >"$metrics_output"
require_line "$metrics_output" "status=ok"
require_line "$metrics_output" "autoflow_token_usage_count=189086"
require_line "$metrics_output" "autoflow_token_report_count=3"

"${REPO_ROOT}/bin/autoflow" metrics "$project_dir" --write >"$metrics_write_output"
require_line "$metrics_write_output" "written=true"
require_pattern "${project_dir}/.autoflow/metrics/daily.jsonl" '"autoflow_token_usage_count":189086'
require_pattern "${project_dir}/.autoflow/metrics/daily.jsonl" '"autoflow_token_report_count":3'

echo "status=ok"
echo "project_root=$project_dir"
