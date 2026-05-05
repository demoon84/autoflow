#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
run_output="${project_dir}/run.out"

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

reject_live_logs_for_runner() {
  local runner_id="$1"
  local live_count

  live_count="$(find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f \
    \( -name "${runner_id}_*_live_stdout.log" -o -name "${runner_id}_*_live_stderr.log" \) \
    -print 2>/dev/null | wc -l | tr -dc '0-9')"
  [ -n "$live_count" ] || live_count=0
  if [ "$live_count" -ne 0 ]; then
    echo "Expected no completed live logs for ${runner_id}, found ${live_count}." >&2
    find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f -name "${runner_id}_*_live_*.log" -print >&2
    exit 1
  fi
}

reject_stdout_persist_for_runner() {
  local runner_id="$1"
  local stdout_count

  stdout_count="$(find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f \
    -name "${runner_id}_*_stdout.log" ! -name '*_live_stdout.log' -print 2>/dev/null | wc -l | tr -dc '0-9')"
  [ -n "$stdout_count" ] || stdout_count=0
  if [ "$stdout_count" -ne 0 ]; then
    echo "Expected no completed stdout persist logs for ${runner_id}, found ${stdout_count}." >&2
    find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f -name "${runner_id}_*_stdout.log" -print >&2
    exit 1
  fi
}

state_field() {
  local runner_id="$1"
  local field="$2"

  awk -F= -v field="$field" '$1 == field { sub(/^[^=]*=/, "", $0); print; exit }' \
    "${project_dir}/.autoflow/runners/state/${runner_id}.state" 2>/dev/null || true
}

write_ticket() {
  local title="$1"

  mkdir -p "${project_dir}/.autoflow/tickets/todo"
  cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<TICKET
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: ${title}
- Stage: todo

## Goal

- Exercise live log lifecycle.

## References

- PRD:

## Allowed Paths

- \`target.txt\`

## Worktree
- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Goal Runtime
- Status: active
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

- [ ] Fake adapter runs.

## Next Action
- Run fake adapter.

## Resume Context

- Smoke fixture.

## Notes

- Smoke fixture.

## Verification
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
TICKET
}

wait_for_live_stdout() {
  local runner_id="$1"
  local observed="false"

  for _ in 1 2 3 4 5 6 7 8; do
    sleep 0.5
    if find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f -name "${runner_id}_*_live_stdout.log" -print -quit 2>/dev/null | grep -q .; then
      observed="true"
      break
    fi
  done

  if [ "$observed" != "true" ]; then
    echo "Expected ${runner_id} live stdout while adapter was running." >&2
    find "${project_dir}/.autoflow/runners/logs" -maxdepth 1 -type f -print >&2 2>/dev/null || true
    exit 1
  fi
}

run_adapter_fixture() {
  local runner_id="$1"
  local command_value="$2"
  local expected_exit="$3"
  local timeout_seconds="${4:-1200}"

  rm -f "$run_output"
  rm -f "${project_dir}/.autoflow/tickets/todo/tickets_001.md" \
    "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" \
    "${project_dir}/.autoflow/tickets/inprogress/verify_001.md"
  write_ticket "${runner_id} fixture"
  "${REPO_ROOT}/bin/autoflow" runners add "$runner_id" ticket-owner "$project_dir" .autoflow \
    agent=codex \
    mode=loop \
    interval_seconds=60 \
    command="$command_value" >/dev/null

  set +e
  AUTOFLOW_ADAPTER_HEARTBEAT_INTERVAL_SECONDS=1 \
  AUTOFLOW_AGENT_TIMEOUT_SECONDS="$timeout_seconds" \
  AUTOFLOW_AGENT_KILL_AFTER_SECONDS=1 \
    "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner "$runner_id" >"$run_output" 2>&1 &
  local run_pid=$!
  set -e

  wait_for_live_stdout "$runner_id"

  set +e
  wait "$run_pid"
  local run_exit=$?
  set -e
  if [ "$run_exit" -ne "$expected_exit" ]; then
    echo "Expected ${runner_id} run exit ${expected_exit}, got ${run_exit}." >&2
    cat "$run_output" >&2
    exit 1
  fi

  reject_live_logs_for_runner "$runner_id"
  reject_stdout_persist_for_runner "$runner_id"
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
printf 'fixture\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

run_adapter_fixture live-ok 'printf "ok stdout\n"; printf "ok stderr\n" >&2; sleep 2' 0
require_line "$run_output" "adapter_exit_code=0"
require_line "$run_output" "stdout_log_path="
require_pattern "${project_dir}/.autoflow/runners/logs/live-ok.log" 'event=adapter_live_log_cleanup .*cleaned_count=[1-9][0-9]*'

run_adapter_fixture live-fail 'printf "fail stdout\n"; printf "fail stderr\n" >&2; sleep 2; exit 7' 7
require_line "$run_output" "adapter_exit_code=7"
require_line "$run_output" "stdout_log_path="
require_pattern "${project_dir}/.autoflow/runners/logs/live-fail.log" 'event=adapter_finish .*exit_code=7'
require_pattern "${project_dir}/.autoflow/runners/logs/live-fail.log" 'event=adapter_live_log_cleanup .*cleaned_count=[1-9][0-9]*'

run_adapter_fixture live-timeout 'printf "timeout stdout\n"; printf "timeout stderr\n" >&2; sleep 10' 0 1
require_line "$run_output" "adapter_exit_code=124"
require_line "$run_output" "reason=adapter_timeout"
require_line "$run_output" "stdout_log_path="
require_pattern "${project_dir}/.autoflow/runners/logs/live-timeout.log" 'event=adapter_finish .*exit_code=124 .*timeout_cleanup=true'
require_pattern "${project_dir}/.autoflow/runners/logs/live-timeout.log" 'event=adapter_live_log_cleanup .*cleaned_count=[1-9][0-9]*'

log_root="${project_dir}/.autoflow/runners/logs"
state_root="${project_dir}/.autoflow/runners/state"
mkdir -p "$log_root" "$state_root"
active_stdout="${log_root}/janitor_2000-01-01T00-00-00Z_live_stdout.log"
active_stderr="${log_root}/janitor_2000-01-01T00-00-00Z_live_stderr.log"
stale_stdout="${log_root}/janitor_1999-01-01T00-00-00Z_live_stdout.log"
stale_stderr="${log_root}/janitor_1999-01-01T00-00-00Z_live_stderr.log"
printf 'active stdout\n' >"$active_stdout"
printf 'active stderr\n' >"$active_stderr"
printf 'stale stdout\n' >"$stale_stdout"
printf 'stale stderr\n' >"$stale_stderr"
touch -t 200001010000 "$active_stdout" "$active_stderr" "$stale_stdout" "$stale_stderr"
cat >"${state_root}/janitor.state" <<STATE
status=running
active_stage=adapter_running
pid=$$
last_stdout_log=${active_stdout}
last_stderr_log=${active_stderr}
STATE

AUTOFLOW_LIVE_LOG_STALE_AGE_SECONDS=1 \
  "${REPO_ROOT}/packages/cli/cleanup-runner-logs.sh" "$project_dir" .autoflow >"${project_dir}/cleanup.out"
require_line "${project_dir}/cleanup.out" "cleaned_count=2"
require_line "${project_dir}/cleanup.out" "stale_live_cleaned_count=2"
require_line "${project_dir}/cleanup.out" "stale_live_preserved_count=2"
[ -f "$active_stdout" ] || { echo "Active stdout was cleaned." >&2; exit 1; }
[ -f "$active_stderr" ] || { echo "Active stderr was cleaned." >&2; exit 1; }
[ ! -e "$stale_stdout" ] || { echo "Stale stdout was preserved." >&2; exit 1; }
[ ! -e "$stale_stderr" ] || { echo "Stale stderr was preserved." >&2; exit 1; }

run_with_timeout_lib="${project_dir}/run-with-timeout.sh"
sed -n '/^run_with_timeout()/,/^runner_file_size_bytes()/p' "${REPO_ROOT}/packages/cli/run-role.sh" | sed '$d' >"$run_with_timeout_lib"
stdin_output="$(bash -c "source '$run_with_timeout_lib'; printf 'data\n' | run_with_timeout 5 1 cat -")"
if [ "$stdin_output" != "data" ]; then
  echo "Expected run_with_timeout to preserve caller stdin, got: ${stdin_output}" >&2
  exit 1
fi
set +e
bash -c "source '$run_with_timeout_lib'; run_with_timeout 1 1 bash -c 'sleep 5'" >/dev/null 2>&1
timeout_exit=$?
set -e
if [ "$timeout_exit" -ne 124 ]; then
  echo "Expected run_with_timeout timeout exit 124, got ${timeout_exit}." >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
