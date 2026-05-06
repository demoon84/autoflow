#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_root="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_root"
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

new_project() {
  local name="$1"
  local project_dir="${tmp_root}/${name}"
  mkdir -p \
    "${project_dir}/.autoflow/runners/state" \
    "${project_dir}/.autoflow/runners/logs" \
    "${project_dir}/.autoflow/tickets/inbox" \
    "${project_dir}/.autoflow/tickets/check" \
    "${project_dir}/.autoflow/tickets/inprogress" \
    "${project_dir}/.autoflow/tickets/reject" \
    "${project_dir}/.autoflow/tickets/todo" \
    "${project_dir}/.autoflow/tickets/backlog" \
    "${project_dir}/.autoflow/tickets/done" \
    "${project_dir}/.autoflow/metrics" \
    "${project_dir}/.autoflow/telemetry"
  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"
  git -C "$project_dir" add .autoflow
  git -C "$project_dir" commit -m "baseline" >/dev/null
  printf '%s\n' "$project_dir"
}

dry_run_out="${tmp_root}/dry-run.out"
"${REPO_ROOT}/bin/autoflow" run monitor "$REPO_ROOT" .autoflow --runner monitor --dry-run > "$dry_run_out"
require_line "$dry_run_out" "status=ok"
require_line "$dry_run_out" "dry_run=true"
require_line "$dry_run_out" "role=monitor"
require_line "$dry_run_out" "runtime_role=monitor"
require_pattern "$dry_run_out" 'runtime_script=.*/start-monitor\.sh$'

repeat_project="$(new_project repeat)"
repeat_out="${tmp_root}/repeat.out"
cat >"${repeat_project}/.autoflow/runners/state/worker.state" <<'STATE'
status=idle
last_result=token_budget_exceeded
last_event_at=2026-05-05T00:00:00Z
STATE
"${REPO_ROOT}/bin/autoflow" monitor scan "$repeat_project" .autoflow >/dev/null
"${REPO_ROOT}/bin/autoflow" monitor scan "$repeat_project" .autoflow >/dev/null
"${REPO_ROOT}/bin/autoflow" monitor scan "$repeat_project" .autoflow > "$repeat_out"
require_line "$repeat_out" "status=ok"
require_line "$repeat_out" "role=monitor"
require_line "$repeat_out" "runtime_role=monitor"
require_pattern "$repeat_out" '^signal_count=[1-9][0-9]*$'
require_line "$repeat_out" "signal.1.type=runner_repeated_last_result"
require_line "$repeat_out" "signal.1.severity=high"
require_line "$repeat_out" "signal.1.confidence=confirmed"
require_line "$repeat_out" "order_created=true"
repeat_order="$(find "${repeat_project}/.autoflow/tickets/inbox" -maxdepth 1 -type f -name 'order_*.md' | sort | head -n 1)"
[ -n "$repeat_order" ] || { echo "Expected monitor order to be created." >&2; exit 1; }
require_pattern "$repeat_order" '^source: autoflow-monitor-agent$'
require_pattern "$repeat_order" '^- Priority: high$'
require_pattern "$repeat_order" 'Fingerprint: [0-9a-f]+'
require_pattern "$repeat_order" 'Suggested next action:'

duplicate_out="${tmp_root}/duplicate.out"
"${REPO_ROOT}/bin/autoflow" monitor scan "$repeat_project" .autoflow > "$duplicate_out"
require_line "$duplicate_out" "order_created=false"
require_line "$duplicate_out" "duplicate_suppressed=true"
order_count="$(find "${repeat_project}/.autoflow/tickets/inbox" -maxdepth 1 -type f -name 'order_*.md' | wc -l | tr -d '[:space:]')"
[ "$order_count" = "1" ] || { echo "Expected one order after duplicate scan, got $order_count" >&2; exit 1; }

token_project="$(new_project token)"
token_out="${tmp_root}/token.out"
printf '/tmp/worker_2026-05-05T00-00-00Z_stdout.log\tworker\t2026-05-05T00:00:00Z\t860000\n' >"${token_project}/.autoflow/metrics/token-cache.tsv"
cat >"${token_project}/.autoflow/telemetry/runs.jsonl" <<'JSONL'
{"runner_id":"worker","token_input":5,"token_output":5}
JSONL
"${REPO_ROOT}/bin/autoflow" monitor scan "$token_project" .autoflow > "$token_out"
require_line "$token_out" "signal.1.type=telemetry_token_cache_mismatch"
require_line "$token_out" "signal.1.severity=critical"
require_line "$token_out" "signal.1.confidence=confirmed"
token_order="$(find "${token_project}/.autoflow/tickets/inbox" -maxdepth 1 -type f -name 'order_*.md' | sort | head -n 1)"
require_pattern "$token_order" 'source_a=metrics/token-cache.tsv; source_a_total=860000; source_b=telemetry/runs.jsonl; source_b_total=10; ratio=86000'

needs_project="$(new_project needs)"
needs_false_out="${tmp_root}/needs-false.out"
cat >"${needs_project}/.autoflow/tickets/inprogress/tickets_001.md" <<'TICKET'
# Ticket

## Recovery State

- Status: healthy
- Evidence: notes mention needs_user but this is not the field value.
TICKET
"${REPO_ROOT}/bin/autoflow" monitor scan "$needs_project" .autoflow > "$needs_false_out"
if grep -Fq "needs_user_ticket" "$needs_false_out"; then
  echo "Body text mention of needs_user should not create a needs_user signal." >&2
  cat "$needs_false_out" >&2
  exit 1
fi
cat >"${needs_project}/.autoflow/tickets/inprogress/tickets_002.md" <<'TICKET'
# Ticket

## Recovery State

- Status: needs_user
- Evidence: explicit field value.
TICKET
needs_true_out="${tmp_root}/needs-true.out"
"${REPO_ROOT}/bin/autoflow" monitor scan "$needs_project" .autoflow > "$needs_true_out"
require_pattern "$needs_true_out" 'signal\.[0-9]+\.type=needs_user_ticket'
require_pattern "$needs_true_out" 'signal\.[0-9]+\.confidence=confirmed'

disabled_project="$(new_project disabled)"
disabled_out="${tmp_root}/disabled.out"
AUTOFLOW_MONITOR_ENABLED=0 "${REPO_ROOT}/bin/autoflow" monitor scan "$disabled_project" .autoflow > "$disabled_out"
require_line "$disabled_out" "status=idle"
require_line "$disabled_out" "monitor_disabled=true"
require_line "$disabled_out" "order_created=false"
if find "${disabled_project}/.autoflow/tickets/inbox" -maxdepth 1 -type f -name 'order_*.md' | grep -q .; then
  echo "Disabled monitor should not create orders." >&2
  exit 1
fi

echo "status=ok"
echo "tmp_root=$tmp_root"
