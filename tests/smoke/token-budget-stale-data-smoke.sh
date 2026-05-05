#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

stale_project_dir="$(mktemp -d)"
fresh_project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$stale_project_dir"
  rm -rf "$fresh_project_dir"
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
  local command="$2"

  SMOKE_WORKER_COMMAND="$command" perl -0pi -e '
    my $command = $ENV{SMOKE_WORKER_COMMAND};
    $command =~ s/\\/\\\\/g;
    $command =~ s/"/\\"/g;
    s/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "loop"\ninterval_seconds = 60\nenabled = true\ncommand = ""/id = "worker"\nrole = "ticket-owner"\nagent = "codex"\nmodel = ""\nreasoning = "low"\nmode = "one-shot"\ninterval_seconds = 60\nenabled = true\ncommand = "$command"/
      or die "failed to patch worker runner command\n";
  ' "${target_project_dir}/.autoflow/runners/config.toml"
}

write_fixture_ticket() {
  local target_project_dir="$1"

  mkdir -p "${target_project_dir}/.autoflow/tickets/todo"
  cat >"${target_project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: token budget stale data fixture
- Stage: todo

## Goal

- Exercise token budget source freshness.

## Allowed Paths

- target.txt

## Done When

- [ ] Adapter command exits 0 when only stale cache exists.
TICKET
}

write_budget_policy() {
  local target_project_dir="$1"
  local quota="$2"

  mkdir -p "${target_project_dir}/.autoflow/policies"
  cat >"${target_project_dir}/.autoflow/policies/budget.toml" <<POLICY
[default]
daily_token_quota = ${quota}
token_quota_window_seconds = 86400
minimum_interval_seconds = 0
prompt_byte_cap = 1048576
preflight_skip_circuit_breaker_threshold = 3
preflight_skip_circuit_breaker_cooldown_seconds = 300
POLICY
}

epoch_to_iso() {
  local epoch="$1"

  if date -u -r "$epoch" +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
    date -u -r "$epoch" +"%Y-%m-%dT%H:%M:%SZ"
    return 0
  fi
  date -u -d "@$epoch" +"%Y-%m-%dT%H:%M:%SZ"
}

init_fixture_project() {
  local target_project_dir="$1"
  local command="$2"
  local quota="$3"

  git -C "$target_project_dir" init -q
  git -C "$target_project_dir" config user.email autoflow-smoke@example.test
  git -C "$target_project_dir" config user.name "Autoflow Smoke"
  "${REPO_ROOT}/bin/autoflow" init "$target_project_dir" >/dev/null
  set_worker_command "$target_project_dir" "$command"
  write_fixture_ticket "$target_project_dir"
  write_budget_policy "$target_project_dir" "$quota"
  mkdir -p "${target_project_dir}/.autoflow/metrics" "${target_project_dir}/.autoflow/telemetry"
}

init_fixture_project "$stale_project_dir" 'printf "adapter invoked\n"' 10
stale_cache_at="$(epoch_to_iso "$(($(date -u +%s) - 5))")"
printf '/tmp/stale/worker_%s_stdout.log\tworker\t%s\t999999\n' "$stale_cache_at" "$stale_cache_at" >"${stale_project_dir}/.autoflow/metrics/token-cache.tsv"
git -C "$stale_project_dir" add .autoflow .claude .codex
git -C "$stale_project_dir" commit -m "stale cache fixture" >/dev/null

stale_usage_out="${stale_project_dir}/usage.out"
stale_run_out="${stale_project_dir}/run.out"
stale_state_file="${stale_project_dir}/.autoflow/runners/state/worker.state"
AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1 \
  "${REPO_ROOT}/packages/cli/telemetry-project.sh" token-usage --project-root "$stale_project_dir" --runner worker >"$stale_usage_out"
require_line "$stale_usage_out" "token_usage=0"
require_line "$stale_usage_out" "token_usage_source=token-cache"
require_line "$stale_usage_out" "token_usage_fresh=false"
require_line "$stale_usage_out" "token_cache_status=stale_skipped"
require_pattern "$stale_usage_out" '^token_cache_age_seconds=[1-9][0-9]*$'

AUTOFLOW_WORKTREE_ROOT="${stale_project_dir}/.autoflow/worktrees" \
AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1 \
  "${REPO_ROOT}/packages/cli/run-role.sh" ticket "$stale_project_dir" .autoflow --runner worker >"$stale_run_out"
require_line "$stale_run_out" "adapter_exit_code=0"
reject_pattern "$stale_run_out" '^reason=token_budget_exceeded$'
if [ -f "$stale_state_file" ]; then
  reject_pattern "$stale_state_file" '^last_result=token_budget_exceeded$'
fi
require_pattern "${stale_project_dir}/.autoflow/runners/logs/worker.log" 'event=budget_preflight_warning .*reason=stale_token_usage_source .*action=continue_adapter .*token_usage_source=token-cache .*token_cache_status=stale_skipped .*token_cache_age_seconds=[1-9][0-9]*'

init_fixture_project "$fresh_project_dir" 'printf "adapter should not run\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' 10
printf '/tmp/stale/worker_%s_stdout.log\tworker\t%s\t999999\n' "$stale_cache_at" "$stale_cache_at" >"${fresh_project_dir}/.autoflow/metrics/token-cache.tsv"
now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat >"${fresh_project_dir}/.autoflow/telemetry/runs.jsonl" <<JSONL
{"event_version":1,"runner_id":"worker","started_at":"${now}","ended_at":"${now}","duration_ms":1,"result":"success","token_input":7,"token_output":8}
JSONL
git -C "$fresh_project_dir" add .autoflow .claude .codex
git -C "$fresh_project_dir" commit -m "fresh telemetry fixture" >/dev/null

fresh_usage_out="${fresh_project_dir}/usage.out"
fresh_run_out="${fresh_project_dir}/run.out"
AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1 \
  "${REPO_ROOT}/packages/cli/telemetry-project.sh" token-usage --project-root "$fresh_project_dir" --runner worker >"$fresh_usage_out"
require_line "$fresh_usage_out" "token_usage=15"
require_line "$fresh_usage_out" "token_usage_source=telemetry"
require_line "$fresh_usage_out" "token_usage_fresh=true"
require_line "$fresh_usage_out" "token_usage_telemetry_rows=1"
require_line "$fresh_usage_out" "token_cache_status=not_used"

AUTOFLOW_WORKTREE_ROOT="${fresh_project_dir}/.autoflow/worktrees" \
AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1 \
  "${REPO_ROOT}/packages/cli/run-role.sh" ticket "$fresh_project_dir" .autoflow --runner worker >"$fresh_run_out"
require_line "$fresh_run_out" "reason=token_budget_exceeded"
require_line "$fresh_run_out" "token_usage_source=telemetry"
require_line "$fresh_run_out" "token_usage_fresh=true"
require_line "${fresh_project_dir}/.autoflow/runners/state/worker.state" "last_result=token_budget_exceeded"
if [ -f "${fresh_project_dir}/adapter.marker" ]; then
  echo "Fresh telemetry budget skip should not invoke adapter" >&2
  cat "${fresh_project_dir}/adapter.marker" >&2
  exit 1
fi

echo "status=ok"
echo "stale_project_root=$stale_project_dir"
echo "fresh_project_root=$fresh_project_dir"
