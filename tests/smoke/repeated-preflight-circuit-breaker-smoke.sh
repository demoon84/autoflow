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

reject_adapter_invocation() {
  if [ -f "${project_dir}/adapter.marker" ]; then
    echo "Adapter command should not have been invoked" >&2
    cat "${project_dir}/adapter.marker" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add worker ticket-owner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/todo" "${project_dir}/.autoflow/policies" "${project_dir}/.autoflow/telemetry"
cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: repeated preflight fixture
- Stage: todo

## Goal

- Exercise repeated preflight breaker.

## Allowed Paths

- target.txt

## Done When

- [ ] Adapter command is not invoked while token budget preflight skips.
TICKET

cat >"${project_dir}/.autoflow/policies/budget.toml" <<'POLICY'
[default]
daily_token_quota = 1
token_quota_window_seconds = 86400
minimum_interval_seconds = 0
prompt_byte_cap = 1048576
timeout_circuit_breaker_threshold = 3
timeout_circuit_breaker_cooldown_seconds = 300
preflight_skip_circuit_breaker_threshold = 3
preflight_skip_circuit_breaker_cooldown_seconds = 300
POLICY

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
printf '{"event_version":1,"runner_id":"worker","started_at":"%s","ended_at":"%s","duration_ms":1,"result":"success","token_input":1,"token_output":0}\n' "$now" "$now" >"${project_dir}/.autoflow/telemetry/runs.jsonl"

git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

first="${project_dir}/first.out"
second="${project_dir}/second.out"
third="${project_dir}/third.out"
fourth="${project_dir}/fourth.out"
list_out="${project_dir}/list.out"
state_file="${project_dir}/.autoflow/runners/state/worker.state"

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$first"
require_line "$first" "reason=token_budget_exceeded"
require_line "$state_file" "last_result=token_budget_exceeded"
require_line "$state_file" "consecutive_preflight_skip_result=token_budget_exceeded"
require_line "$state_file" "consecutive_preflight_skip_count=1"
grep -Eq '^last_preflight_skip_at=.+Z$' "$state_file"
reject_adapter_invocation

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$second"
require_line "$second" "reason=token_budget_exceeded"
require_line "$state_file" "consecutive_preflight_skip_count=2"
reject_adapter_invocation

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$third"
require_line "$third" "reason=circuit_breaker_tripped"
require_line "$third" "circuit_breaker_reason=token_budget_exceeded"
require_line "$third" "circuit_breaker_count=3"
require_line "$third" "circuit_breaker_threshold=3"
grep -Eq '^circuit_breaker_until=.+Z$' "$third"
require_line "$third" "active_recovery_status=blocked"
require_line "$third" "active_recovery_failure_class=tooling_failure"
require_line "$third" "active_recovery_reason=repeated_preflight_skip"
require_line "$state_file" "last_result=circuit_breaker_tripped"
require_line "$state_file" "active_recovery_status=blocked"
require_line "$state_file" "active_recovery_failure_class=tooling_failure"
require_line "$state_file" "active_recovery_reason=repeated_preflight_skip"
reject_adapter_invocation

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$fourth"
require_line "$fourth" "reason=circuit_breaker_tripped"
reject_adapter_invocation

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" .autoflow >"$list_out"
require_line "$list_out" "runner.2.last_result=circuit_breaker_tripped"
require_line "$list_out" "runner.2.active_recovery_status=blocked"
require_line "$list_out" "runner.2.active_recovery_failure_class=tooling_failure"
require_line "$list_out" "runner.2.active_recovery_reason=repeated_preflight_skip"
require_line "$list_out" "runner.2.consecutive_preflight_skip_count=3"
require_line "$list_out" "runner.2.consecutive_preflight_skip_result=token_budget_exceeded"

echo "status=ok"
echo "project_root=$project_dir"
