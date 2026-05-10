#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dirs=()
worktree_roots=()

cleanup() {
  local dir
  for dir in "${project_dirs[@]}"; do
    "${REPO_ROOT}/bin/autoflow" runners stop planner "$dir" >/dev/null 2>&1 || true
  done
  for dir in "${project_dirs[@]}" "${worktree_roots[@]}"; do
    rm -rf "$dir"
  done
}
trap cleanup EXIT

fail_with_file() {
  local message="$1"
  local file="${2:-}"

  echo "$message" >&2
  if [ -n "$file" ] && [ -f "$file" ]; then
    echo "--- $file ---" >&2
    cat "$file" >&2
  fi
  exit 1
}

wait_for_line_matching() {
  local file="$1"
  local pattern="$2"
  local attempts="${3:-20}"

  for _ in $(seq 1 "$attempts"); do
    if grep -Eq -- "$pattern" "$file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  fail_with_file "Timed out waiting for pattern: $pattern" "$file"
}

wait_for_marker_count() {
  local file="$1"
  local expected="$2"
  local attempts="${3:-10}"
  local count

  for _ in $(seq 1 "$attempts"); do
    count="$(grep -c '^invoked$' "$file" 2>/dev/null || true)"
    [ -n "$count" ] || count=0
    if [ "$count" = "$expected" ]; then
      return 0
    fi
    sleep 1
  done

  fail_with_file "Timed out waiting for adapter marker count $expected" "$file"
}

assert_no_marker_count_change() {
  local file="$1"
  local expected="$2"
  local seconds="$3"
  local count

  sleep "$seconds"
  count="$(grep -c '^invoked$' "$file" 2>/dev/null || true)"
  [ -n "$count" ] || count=0
  if [ "$count" != "$expected" ]; then
    fail_with_file "Expected adapter marker count to remain $expected for ${seconds}s, got $count" "$file"
  fi
}

prepare_repo() {
  local target_project="$1"
  local fake_sleep="${2:-0}"

  project_dirs+=("$target_project")
  worktree_roots+=("${target_project}-worktrees")

  git -C "$target_project" init -q
  git -C "$target_project" config user.email autoflow-smoke@example.test
  git -C "$target_project" config user.name "Autoflow Smoke"

  "${REPO_ROOT}/bin/autoflow" init "$target_project" >/dev/null
  "${REPO_ROOT}/bin/autoflow" runners set planner "$target_project" agent=codex model=gpt-5.4 reasoning=medium mode=loop interval_seconds=5 >/dev/null

  mkdir -p "${target_project}/fake-bin"
  cat >"${target_project}/fake-bin/codex" <<FAKE_CODEX
#!/usr/bin/env bash
lock_dir="\${AUTOFLOW_PROJECT_ROOT}/adapter.lock"
if ! mkdir "\$lock_dir" 2>/dev/null; then
  printf 'overlap\n' >> "\${AUTOFLOW_PROJECT_ROOT}/adapter.overlap"
fi
printf 'invoked\n' >> "\${AUTOFLOW_PROJECT_ROOT}/adapter.marker"
sleep "$fake_sleep"
rmdir "\$lock_dir" 2>/dev/null || true
cat >/dev/null
exit 0
FAKE_CODEX
  chmod +x "${target_project}/fake-bin/codex"

  printf 'base\n' >"${target_project}/target.txt"
  git -C "$target_project" add target.txt .autoflow .claude .codex
  git -C "$target_project" commit -m "baseline" >/dev/null
}

start_planner() {
  local target_project="$1"
  local realtime_enabled="$2"

  AUTOFLOW_CODEX_DISABLE_PTY=1 \
  AUTOFLOW_WORKTREE_ROOT="${target_project}-worktrees" \
  AUTOFLOW_TICK_BACKOFF_THRESHOLD_IDLE_TICKS=1 \
  AUTOFLOW_TICK_BACKOFF_MAX_INTERVAL_SECONDS=5 \
  AUTOFLOW_PLANNER_REALTIME_ENABLED="$realtime_enabled" \
  PATH="${target_project}/fake-bin:$PATH" \
    "${REPO_ROOT}/bin/autoflow" runners start planner "$target_project" >/dev/null
}

write_order() {
  local target_project="$1"
  local id="$2"

  mkdir -p "${target_project}/.autoflow/tickets/inbox"
  cat >"${target_project}/.autoflow/tickets/inbox/order_${id}.md" <<ORDER
# Order

## Request

- Smoke order ${id}

## Notes

- Created by planner realtime smoke.
ORDER
}

write_prd() {
  local target_project="$1"
  local id="$2"

  mkdir -p "${target_project}/.autoflow/tickets/backlog"
  cat >"${target_project}/.autoflow/tickets/backlog/prd_${id}.md" <<PRD
# Project PRD

## Project

- ID: prd_${id}
- Name: Smoke PRD ${id}
- Title: Smoke PRD ${id}
- Priority: normal
- AI:
- Status: approved
- Goal: Smoke planner realtime backlog wakeup.

## Core Scope

- Goal: Smoke only.

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] Smoke planner sees backlog input.

## Verification

- Command: test -f target.txt
PRD
}

write_reject() {
  local target_project="$1"
  local id="$2"

  mkdir -p "${target_project}/.autoflow/tickets/reject"
  cat >"${target_project}/.autoflow/tickets/reject/reject_${id}.md" <<REJECT
# Ticket

## Ticket

- ID: tickets_${id}
- PRD Key: prd_${id}
- Title: Smoke reject ${id}
- Stage: reject

## Reject Reason

- Smoke reject input.
REJECT
}

run_event_case() {
  local kind="$1"
  local writer="$2"
  local target_project
  local state_file log_file marker_file started_epoch elapsed_seconds

  target_project="$(mktemp -d)"
  prepare_repo "$target_project" 0
  start_planner "$target_project" 1

  state_file="${target_project}/.autoflow/runners/state/planner.state"
  log_file="${target_project}/.autoflow/runners/logs/planner.log"
  marker_file="${target_project}/adapter.marker"

wait_for_line_matching "$state_file" '^last_result=(planner_inputs_unchanged|planner_no_actionable_input)$' 20
  sleep 1
  rm -f "$marker_file"

  started_epoch="$(date +%s)"
  "$writer" "$target_project" "101"
  wait_for_line_matching "$log_file" 'event=(planner_realtime_wakeup|realtime_wakeup) .*pending=created' 4
  wait_for_marker_count "$marker_file" 1 10
  elapsed_seconds=$(($(date +%s) - started_epoch))
  if [ "$elapsed_seconds" -ge 5 ]; then
    fail_with_file "Expected ${kind} realtime wake before 5 seconds, got ${elapsed_seconds}s" "$log_file"
  fi
}

run_event_case "inbox order" write_order
run_event_case "backlog PRD" write_prd
run_event_case "reject" write_reject

burst_project="$(mktemp -d)"
prepare_repo "$burst_project" 2
start_planner "$burst_project" 1
burst_state="${burst_project}/.autoflow/runners/state/planner.state"
burst_log="${burst_project}/.autoflow/runners/logs/planner.log"
burst_marker="${burst_project}/adapter.marker"
wait_for_line_matching "$burst_state" '^last_result=(planner_inputs_unchanged|planner_no_actionable_input)$' 20
sleep 1
rm -f "$burst_marker"

for id in 201 202 203 204 205; do
  write_order "$burst_project" "$id"
done

wait_for_line_matching "$burst_log" 'event=(planner_realtime_wakeup|realtime_wakeup) .*pending=created' 4
wait_for_marker_count "$burst_marker" 1 10
assert_no_marker_count_change "$burst_marker" 1 2
if [ -f "${burst_project}/adapter.overlap" ]; then
  fail_with_file "Planner adapter ran concurrently during burst." "${burst_project}/adapter.overlap"
fi

disabled_project="$(mktemp -d)"
prepare_repo "$disabled_project" 0
start_planner "$disabled_project" 0
disabled_state="${disabled_project}/.autoflow/runners/state/planner.state"
disabled_log="${disabled_project}/.autoflow/runners/logs/planner.log"
disabled_marker="${disabled_project}/adapter.marker"
wait_for_line_matching "$disabled_state" '^last_result=(planner_inputs_unchanged|planner_no_actionable_input)$' 20
sleep 1
rm -f "$disabled_marker"
write_order "$disabled_project" "301"
assert_no_marker_count_change "$disabled_marker" 0 3
if grep -Eq 'event=(planner_realtime_wakeup|realtime_wakeup)' "$disabled_log" 2>/dev/null; then
  fail_with_file "Realtime wakeup log should not be emitted when disabled." "$disabled_log"
fi
