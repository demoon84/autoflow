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

state_field() {
  local field="$1"
  awk -F= -v field="$field" '$1 == field { sub(/^[^=]*=/, "", $0); print; exit }' \
    "${project_dir}/.autoflow/runners/state/heartbeat-runner.state" 2>/dev/null || true
}

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

require_iso8601() {
  local value="$1"
  local label="$2"

  if ! printf '%s\n' "$value" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'; then
    echo "Expected ${label} to be an ISO8601 UTC timestamp, got: ${value}" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add heartbeat-runner ticket-owner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  interval_seconds=60 \
  command='for i in 1 2 3 4 5 6; do printf "stdout-%s\n" "$i"; printf "stderr-%s\n" "$i" >&2; sleep 1; done' >/dev/null

printf 'fixture\n' >"${project_dir}/target.txt"
mkdir -p "${project_dir}/.autoflow/tickets/todo"
cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: Heartbeat smoke fixture
- Stage: todo

## Goal

- Exercise adapter heartbeat state while a fake adapter runs.

## References

- PRD:

## Allowed Paths

- `target.txt`

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

- [ ] Fake adapter runs long enough for heartbeat observation.

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

git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

AUTOFLOW_ADAPTER_HEARTBEAT_INTERVAL_SECONDS=1 \
  "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner heartbeat-runner >"$run_output" &
run_pid=$!

observed_adapter_running="false"
last_event_previous=""
last_event_change_count=0
last_adapter_chunk_at=""
preserved_fields_ok="false"

for _ in 1 2 3 4 5 6 7 8; do
  sleep 1
  if ! kill -0 "$run_pid" 2>/dev/null; then
    break
  fi

  current_stage="$(state_field active_stage)"
  current_event="$(state_field last_event_at)"
  current_chunk="$(state_field last_adapter_chunk_at)"

  if [ "$current_stage" = "adapter_running" ]; then
    observed_adapter_running="true"
  fi
  if [ -n "$last_event_previous" ] && [ -n "$current_event" ] && [ "$current_event" != "$last_event_previous" ]; then
    last_event_change_count=$((last_event_change_count + 1))
  fi
  if [ -n "$current_event" ]; then
    last_event_previous="$current_event"
  fi
  if [ -n "$current_chunk" ]; then
    last_adapter_chunk_at="$current_chunk"
  fi

  if [ -n "$(state_field active_item)" ] &&
     [ -n "$(state_field active_ticket_id)" ] &&
     [ -n "$(state_field active_ticket_title)" ] &&
     [ -n "$(state_field active_spec_ref)" ] &&
     [ -n "$(state_field last_stdout_log)" ] &&
     [ -n "$(state_field last_stderr_log)" ]; then
    preserved_fields_ok="true"
  fi
done

wait "$run_pid"

require_line "$run_output" "adapter_exit_code=0"
if [ "$observed_adapter_running" != "true" ]; then
  echo "Expected active_stage=adapter_running during adapter call." >&2
  cat "${project_dir}/.autoflow/runners/state/heartbeat-runner.state" >&2
  exit 1
fi
if [ "$last_event_change_count" -lt 2 ]; then
  echo "Expected last_event_at to change at least twice during adapter call, got ${last_event_change_count}." >&2
  cat "${project_dir}/.autoflow/runners/state/heartbeat-runner.state" >&2
  exit 1
fi
require_iso8601 "$last_adapter_chunk_at" "last_adapter_chunk_at"
if [ "$preserved_fields_ok" != "true" ]; then
  echo "Expected heartbeat state writes to preserve active/spec/log fields." >&2
  cat "${project_dir}/.autoflow/runners/state/heartbeat-runner.state" >&2
  exit 1
fi

finish_state_status="$(state_field status)"
finish_stage="$(state_field active_stage)"
finish_result="$(state_field last_result)"
if [ "$finish_state_status" != "idle" ] || [ "$finish_stage" = "adapter_running" ] || [ "$finish_result" != "adapter_exit_0" ]; then
  echo "Expected finish state to restore idle/result/stage contract." >&2
  cat "${project_dir}/.autoflow/runners/state/heartbeat-runner.state" >&2
  exit 1
fi

list_output="${project_dir}/list.out"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" .autoflow >"$list_output"
runner_index="$(awk -F= '$2 == "heartbeat-runner" && $1 ~ /^runner\.[0-9]+\.id$/ { split($1, parts, "."); print parts[2]; exit }' "$list_output")"
if [ -z "$runner_index" ]; then
  echo "Expected heartbeat-runner in runners list." >&2
  cat "$list_output" >&2
  exit 1
fi
grep -Eq "^runner\\.${runner_index}\\.last_adapter_chunk_at=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" "$list_output" || {
  echo "Expected runners list to expose last_adapter_chunk_at." >&2
  cat "$list_output" >&2
  exit 1
}

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
fast_started="$(date +%s)"
bash -c "source '$run_with_timeout_lib'; run_with_timeout 5 1 true"
fast_finished="$(date +%s)"
if [ $((fast_finished - fast_started)) -ge 2 ]; then
  echo "Expected fast run_with_timeout command not to wait for watchdog sleep." >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
