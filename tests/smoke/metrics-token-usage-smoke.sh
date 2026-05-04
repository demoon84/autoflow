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
config_path="${project_dir}/.autoflow/runners/config.toml"
metrics_output="${project_dir}/metrics.out"
metrics_write_output="${project_dir}/metrics-write.out"
telemetry_metrics_output="${project_dir}/telemetry-metrics.out"
telemetry_run_output="${project_dir}/telemetry-run.out"
telemetry_usage_output="${project_dir}/telemetry-usage.out"

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
require_line "$metrics_output" "autoflow_token_usage_count=0"
require_line "$metrics_output" "autoflow_token_report_count=0"

"${REPO_ROOT}/bin/autoflow" metrics "$project_dir" --write >"$metrics_write_output"
require_line "$metrics_write_output" "written=true"
require_pattern "${project_dir}/.autoflow/metrics/daily.jsonl" '"autoflow_token_usage_count":0'
require_pattern "${project_dir}/.autoflow/metrics/daily.jsonl" '"autoflow_token_report_count":0'

mkdir -p "${project_dir}/.autoflow/tickets/todo"
cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: token telemetry fixture
- Title: token telemetry fixture
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- fixture adapter completion should record telemetry.

## References

- PRD:
- Feature Spec:
- Plan Source: smoke-fixture

## Reference Notes

- Project Note:
- Plan Note:
- Ticket Note:

## Allowed Paths

- `README.md`

## Worktree
- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Goal Runtime
- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `true` exits 0.
- [ ] `.autoflow/telemetry/runs.jsonl` has positive worker tokens.
- [ ] `packages/cli/metrics-project.sh <tmp> .autoflow` reports positive token metrics.

## Next Action
- run fixture adapter.

## Resume Context

- Current state: fixture.
- Last completed action: none.
- First thing to inspect on resume: telemetry.

## Notes

- fixture.

## Verification
- Command: `true`
- Run file:
- Result:

## Result

- Summary:
- Remaining risk:
TICKET

perl -0pi -e 's/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "loop"\ninterval_seconds = 60\nenabled = true\ncommand = ""/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "one-shot"\ninterval_seconds = 60\nenabled = true\ncommand = "printf '\''fixture adapter stdout without token marker\\nmore generated output for estimation\\n'\''"/' "$config_path"

cat >"${project_dir}/.autoflow/metrics/token-cache.tsv" <<'CACHE'
/tmp/stale/worker_2026-04-25T00-00-00Z_stdout.log	worker	2026-04-25T00:00:00Z	0
CACHE

cat >"${project_dir}/.autoflow/metrics/telemetry-runs.jsonl" <<'LEGACY'
{"runner_id":"worker","result":"success","token_input":999999999,"token_output":999999999}
LEGACY

AUTOFLOW_WORKTREE_ROOT="${project_dir}/.autoflow/worktrees" \
  "${REPO_ROOT}/packages/cli/run-role.sh" ticket "$project_dir" .autoflow --runner worker >"$telemetry_run_output"
require_line "$telemetry_run_output" "adapter_exit_code=0"

if [ ! -s "${project_dir}/.autoflow/telemetry/runs.jsonl" ]; then
  echo "Expected telemetry runs file to be written" >&2
  exit 1
fi

telemetry_assertion="$(
  jq -rs '
    map(select(.runner_id == "worker" and .result == "success")) | last
    | select(. != null)
    | select((.token_input | tonumber) > 0)
    | select((.token_output | tonumber) > 0)
    | select(((.token_input | tonumber) + (.token_output | tonumber)) > 0)
    | "ok"
  ' "${project_dir}/.autoflow/telemetry/runs.jsonl" 2>/dev/null || true
)"
if [ "$telemetry_assertion" != "ok" ]; then
  echo "Expected positive token_input/token_output in fresh telemetry row" >&2
  cat "${project_dir}/.autoflow/telemetry/runs.jsonl" >&2
  exit 1
fi

"${REPO_ROOT}/packages/cli/telemetry-project.sh" --project-root "$project_dir" token-usage --runner worker >"$telemetry_usage_output"
require_pattern "$telemetry_usage_output" '^token_usage=[1-9][0-9]*$'

rm -rf "${project_dir}/.autoflow/runners/state/cli-cache"
"${REPO_ROOT}/packages/cli/metrics-project.sh" "$project_dir" .autoflow >"$telemetry_metrics_output"
require_pattern "$telemetry_metrics_output" '^autoflow_token_usage_count=[1-9][0-9]*$'
require_pattern "$telemetry_metrics_output" '^autoflow_token_report_count=[1-9][0-9]*$'
if grep -Fq '1999999998' "$telemetry_metrics_output"; then
  echo "Metrics must not read stale .autoflow/metrics/telemetry-runs.jsonl" >&2
  cat "$telemetry_metrics_output" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
