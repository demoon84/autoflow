#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
preflight_project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
  rm -rf "$preflight_project_dir"
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

reject_pattern() {
  local file="$1"
  local pattern="$2"

  if grep -Eq -- "$pattern" "$file"; then
    echo "Unexpected pattern found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

set_worker_command() {
  local target_project_dir="$1"

  perl -0pi -e '
    my $command = $ENV{SMOKE_WORKER_COMMAND};
    $command =~ s/\\/\\\\/g;
    $command =~ s/"/\\"/g;
    s/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "loop"\ninterval_seconds = 60\nenabled = true\ncommand = ""/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "one-shot"\ninterval_seconds = 60\nenabled = true\ncommand = "$command"/
      or die "failed to patch worker runner command\n";
  ' "${target_project_dir}/.autoflow/runners/config.toml"
}

write_fixture_ticket() {
  local ticket_path="$1"
  local title="$2"
  local ticket_id="${3:-tickets_001}"

  cat >"$ticket_path" <<TICKET
# Ticket

## Ticket

- ID: ${ticket_id}
- PRD Key: prd_001
- Title: ${title}
- Stage: todo

## Goal

- Exercise telemetry token usage sanity.

## Allowed Paths

- target.txt

## Done When

- [ ] Adapter command exits 0.
TICKET
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
mkdir -p "${project_dir}/.autoflow/telemetry" "${project_dir}/.autoflow/policies" "${project_dir}/.autoflow/tickets/todo"

usage_out="${project_dir}/usage.out"
usage_err="${project_dir}/usage.err"
until_out="${project_dir}/until.out"
since_out="${project_dir}/since.out"
run_out="${project_dir}/run.out"
preflight_out="${project_dir}/preflight.out"
state_file="${project_dir}/.autoflow/runners/state/worker.state"

cat >"${project_dir}/.autoflow/telemetry/runs.jsonl" <<'JSONL'
{"event_version":1,"runner_id":"worker","started_at":"2026-05-04T00:00:00Z","ended_at":"2026-05-04T00:00:01Z","duration_ms":1,"result":"success","token_input":43000004027,"token_output":43000000020}
{"event_version":1,"runner_id":"worker","started_at":"2026-05-04T00:01:00Z","ended_at":"2026-05-04T00:01:01Z","duration_ms":1,"result":"success","token_input":20,"token_output":22}
{"event_version":1,"runner_id":"worker","started_at":"2026-05-04T00:02:00Z","ended_at":"2026-05-04T00:02:01Z","duration_ms":1,"result":"success","token_input":7,"token_output":8}
{"event_version":1,"runner_id":"planner","started_at":"2026-05-04T00:01:00Z","ended_at":"2026-05-04T00:01:01Z","duration_ms":1,"result":"success","token_input":999,"token_output":999}
JSONL

"${REPO_ROOT}/packages/cli/telemetry-project.sh" token-usage --project-root "$project_dir" --runner worker --since "2026-05-04T00:00:00Z" --until "2026-05-04T00:01:30Z" >"$usage_out" 2>"$usage_err"
require_line "$usage_out" "runner_id=worker"
require_line "$usage_out" "since=2026-05-04T00:00:00Z"
require_line "$usage_out" "until=2026-05-04T00:01:30Z"
require_line "$usage_out" "token_usage=42"
require_line "$usage_out" "token_usage_trusted=false"
require_line "$usage_out" "skipped_suspicious_token_rows=1"
require_pattern "$usage_err" 'warning=skip_suspicious_token_row .*token_input=43000004027 .*token_output=43000000020'
reject_pattern "$usage_out" '^token_usage=86004270902$'
reject_pattern "$usage_out" '^token_usage=[1-9][0-9]{8,}$'

"${REPO_ROOT}/packages/cli/telemetry-project.sh" token-usage --project-root "$project_dir" --runner worker --until "2026-05-03T23:59:59Z" >"$until_out"
require_line "$until_out" "token_usage=0"
require_line "$until_out" "skipped_suspicious_token_rows=0"

"${REPO_ROOT}/packages/cli/telemetry-project.sh" token-usage --project-root "$project_dir" --runner worker --since "2026-05-04T00:01:30Z" >"$since_out"
require_line "$since_out" "token_usage=15"
require_line "$since_out" "token_usage_trusted=true"

SMOKE_WORKER_COMMAND='printf "%s\n" "result.7.snippet.1.text=- Tokens Used: - Continuation Suppressed: true - Last Progress Fingerprint: 335739843" "{\"usage\":{\"total_tokens\":1200}}"' set_worker_command "$project_dir"

write_fixture_ticket "${project_dir}/.autoflow/tickets/todo/tickets_001.md" "parser sanity fixture"
git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$run_out"
require_line "$run_out" "adapter_exit_code=0"

parser_total="$(
  jq -rs '
    map(select(.runner_id == "worker" and .result == "success" and .ticket_id == "tickets_001")) | last
    | ((.token_input | tonumber) + (.token_output | tonumber))
  ' "${project_dir}/.autoflow/telemetry/runs.jsonl"
)"
if [ "$parser_total" != "1200" ]; then
  echo "Expected explicit JSON usage total to be 1200, got ${parser_total}" >&2
  cat "${project_dir}/.autoflow/telemetry/runs.jsonl" >&2
  exit 1
fi

git -C "$preflight_project_dir" init -q
git -C "$preflight_project_dir" config user.email autoflow-smoke@example.test
git -C "$preflight_project_dir" config user.name "Autoflow Smoke"
"${REPO_ROOT}/bin/autoflow" init "$preflight_project_dir" >/dev/null
SMOKE_WORKER_COMMAND='printf "%s\n" "preflight adapter invoked" "{\"usage\":{\"total_tokens\":1200}}"' set_worker_command "$preflight_project_dir"

mkdir -p "${preflight_project_dir}/.autoflow/tickets/todo" "${preflight_project_dir}/.autoflow/runners/state" "${preflight_project_dir}/.autoflow/runners/logs" "${preflight_project_dir}/.autoflow/policies" "${preflight_project_dir}/.autoflow/telemetry"
write_fixture_ticket "${preflight_project_dir}/.autoflow/tickets/todo/tickets_002.md" "budget preflight sanity fixture" "tickets_002"

cat >"${preflight_project_dir}/.autoflow/policies/budget.toml" <<'POLICY'
[default]
daily_token_quota = 10
token_quota_window_seconds = 86400
minimum_interval_seconds = 0
prompt_byte_cap = 1048576
preflight_skip_circuit_breaker_threshold = 3
preflight_skip_circuit_breaker_cooldown_seconds = 300
POLICY

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat >"${preflight_project_dir}/.autoflow/telemetry/runs.jsonl" <<JSONL
{"event_version":1,"runner_id":"worker","started_at":"${now}","ended_at":"${now}","duration_ms":1,"result":"success","token_input":43000004027,"token_output":43000000020}
{"event_version":1,"runner_id":"worker","started_at":"${now}","ended_at":"${now}","duration_ms":1,"result":"success","token_input":7,"token_output":8}
JSONL

git -C "$preflight_project_dir" add .autoflow .claude .codex
git -C "$preflight_project_dir" commit -m "preflight fixture" >/dev/null

"${REPO_ROOT}/bin/autoflow" run ticket "$preflight_project_dir" .autoflow --runner worker >"$preflight_out"
require_line "$preflight_out" "adapter_exit_code=0"
if [ -f "${preflight_project_dir}/.autoflow/runners/state/worker.state" ]; then
  reject_pattern "${preflight_project_dir}/.autoflow/runners/state/worker.state" '^last_result=token_budget_exceeded$'
fi
require_pattern "${preflight_project_dir}/.autoflow/runners/logs/worker.log" 'event=budget_preflight_warning .*reason=token_usage_suspicious .*action=continue_adapter'

echo "status=ok"
echo "project_root=$project_dir"
