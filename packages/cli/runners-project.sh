#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  runners-project.sh list [project-root] [board-dir-name]
  runners-project.sh add <runner-id> <role> [project-root] [board-dir-name] key=value...
  runners-project.sh remove <runner-id> [project-root] [board-dir-name]
  runners-project.sh start <runner-id> [project-root] [board-dir-name]
  runners-project.sh stop <runner-id> [project-root] [board-dir-name]
  runners-project.sh restart <runner-id> [project-root] [board-dir-name]
  runners-project.sh artifacts <runner-id> [project-root] [board-dir-name]
  runners-project.sh set <runner-id> [project-root] [board-dir-name] key=value...
EOF
}

action="${1:-list}"
shift || true

case "$action" in
  list)
    project_root_input="${1:-.}"
    board_dir_name="${2:-$(default_board_dir_name)}"
    ;;
  add)
    runner_id="${1:-}"
    runner_role="${2:-}"
    if [ -z "$runner_id" ] || [ -z "$runner_role" ]; then
      usage
      exit 1
    fi
    shift 2 || true
    project_root_input="."
    board_dir_name="$(default_board_dir_name)"
    if [ "${1:-}" != "" ] && [[ "${1:-}" != *=* ]]; then
      project_root_input="$1"
      shift || true
    fi
    if [ "${1:-}" != "" ] && [[ "${1:-}" != *=* ]]; then
      board_dir_name="$1"
      shift || true
    fi
    updates=("$@")
    ;;
  remove)
    runner_id="${1:-}"
    if [ -z "$runner_id" ]; then
      usage
      exit 1
    fi
    shift || true
    project_root_input="${1:-.}"
    board_dir_name="${2:-$(default_board_dir_name)}"
    ;;
  start|stop|restart|artifacts)
    runner_id="${1:-}"
    if [ -z "$runner_id" ]; then
      usage
      exit 1
    fi
    shift || true
    project_root_input="${1:-.}"
    board_dir_name="${2:-$(default_board_dir_name)}"
    ;;
  loop-worker)
    runner_id="${1:-}"
    if [ -z "$runner_id" ]; then
      usage
      exit 1
    fi
    shift || true
    project_root_input="${1:-.}"
    board_dir_name="${2:-$(default_board_dir_name)}"
    ;;
  set)
    runner_id="${1:-}"
    if [ -z "$runner_id" ]; then
      usage
      exit 1
    fi
    shift || true
    project_root_input="."
    board_dir_name="$(default_board_dir_name)"
    if [ "${1:-}" != "" ] && [[ "${1:-}" != *=* ]]; then
      project_root_input="$1"
      shift || true
    fi
    if [ "${1:-}" != "" ] && [[ "${1:-}" != *=* ]]; then
      board_dir_name="$1"
      shift || true
    fi
    updates=("$@")
    if [ "${#updates[@]}" -eq 0 ]; then
      usage
      exit 1
    fi
    ;;
  *)
    echo "Unknown runners action: ${action}" >&2
    usage
    exit 1
    ;;
esac

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
export AUTOFLOW_BOARD_ROOT="$board_root"

config_path="$(runner_config_path)"

print_runner_common_header() {
  local status="$1"
  printf 'status=%s\n' "$status"
  printf 'action=%s\n' "$action"
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'board_dir_name=%s\n' "$board_dir_name"
  printf 'config_path=%s\n' "$config_path"
}

runner_active_state_value() {
  local target_runner_id="$1"
  local field="$2"
  local clear_mode="${3:-preserve}"

  if [ "$clear_mode" = "clear" ]; then
    printf ''
    return 0
  fi

  runner_state_value_or_empty "$target_runner_id" "$field"
}

runner_state_value_or_empty() {
  local target_runner_id="$1"
  local field="$2"
  runner_state_field "$target_runner_id" "$field" 2>/dev/null || true
}

runner_log_tail_line() {
  local target_runner_id="$1"
  local target_log_path

  target_log_path="$(runner_log_path "$target_runner_id")"
  [ -f "$target_log_path" ] || return 0
  tail -n 1 "$target_log_path" | tr -d '\r' | awk '
    length($0) > 220 {
      print substr($0, 1, 217) "..."
      next
    }
    {
      print
    }
  '
}

runner_pid_is_running() {
  local pid="${1:-}"

  case "$pid" in
    ""|*[!0-9]*)
      return 1
      ;;
  esac

  kill -0 "$pid" 2>/dev/null
}

runner_kill_process_tree() {
  local pid="${1:-}"
  local child wait_index

  case "$pid" in
    ""|*[!0-9]*)
      return 0
      ;;
  esac

  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r child; do
      [ -n "$child" ] || continue
      runner_kill_process_tree "$child"
    done < <(pgrep -P "$pid" 2>/dev/null || true)
  fi

  kill "$pid" 2>/dev/null || true
  for wait_index in 1 2 3 4 5; do
    runner_pid_is_running "$pid" || return 0
    sleep 0.2
  done

  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r child; do
      [ -n "$child" ] || continue
      runner_kill_process_tree "$child"
    done < <(pgrep -P "$pid" 2>/dev/null || true)
  fi
  kill -9 "$pid" 2>/dev/null || true
}

runner_loop_stdout_path() {
  local target_runner_id="$1"

  runner_ensure_dirs
  printf '%s/%s.loop.stdout.log' "$(runner_log_dir)" "$target_runner_id"
}

runner_loop_stderr_path() {
  local target_runner_id="$1"

  runner_ensure_dirs
  printf '%s/%s.loop.stderr.log' "$(runner_log_dir)" "$target_runner_id"
}

start_loop_worker_process() {
  local target_runner_id="$1"
  local stdout_file="$2"
  local stderr_file="$3"
  local previous_pid="$4"

  loop_pid=""

  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$SCRIPT_DIR/runners-project.sh" loop-worker "$target_runner_id" "$project_root" "$board_dir_name" >"$stdout_file" 2>"$stderr_file" &
    loop_pid="$!"
  elif command -v python3 >/dev/null 2>&1; then
    loop_pid="$(python3 - "$SCRIPT_DIR/runners-project.sh" "$target_runner_id" "$project_root" "$board_dir_name" "$stdout_file" "$stderr_file" <<'PY'
import subprocess
import sys

script, runner_id, project_root, board_dir_name, stdout_file, stderr_file = sys.argv[1:]
stdout = open(stdout_file, "ab", buffering=0)
stderr = open(stderr_file, "ab", buffering=0)
process = subprocess.Popen(
    [script, "loop-worker", runner_id, project_root, board_dir_name],
    stdin=subprocess.DEVNULL,
    stdout=stdout,
    stderr=stderr,
    start_new_session=True,
    close_fds=True,
)
print(process.pid)
PY
)"
  else
    nohup "$SCRIPT_DIR/runners-project.sh" loop-worker "$target_runner_id" "$project_root" "$board_dir_name" >"$stdout_file" 2>"$stderr_file" &
    loop_pid="$!"
  fi
}

runner_role_to_run_role() {
  case "${1:-}" in
    ticket-owner|owner|ticket)
      printf 'ticket'
      ;;
    planner|plan)
      printf 'planner'
      ;;
    todo)
      printf 'todo'
      ;;
    verifier)
      printf 'verifier'
      ;;
    wiki|wiki-maintainer)
      printf 'wiki'
      ;;
    coordinator|coord|doctor|diagnose)
      printf 'coordinator'
      ;;
    *)
      return 1
      ;;
  esac
}

runner_command_summary_from_array() {
  local arg first

  first=1
  for arg in "$@"; do
    if [ "$first" -eq 0 ]; then
      printf ' '
    fi
    printf '%q' "$arg"
    first=0
  done
}

runner_command_preview() {
  local target_runner_id="$1"
  local role="$2"
  local agent="$3"
  local mode="$4"
  local model="$5"
  local reasoning="$6"
  local interval_seconds="$7"
  local command_value="$8"
  local run_role effective_interval cmd

  if [ -n "$command_value" ]; then
    printf 'custom: %s < $AUTOFLOW_PROMPT_FILE' "$command_value"
    return 0
  fi

  effective_interval="$(runner_normalize_interval_seconds "$interval_seconds")"

  if [ "$mode" = "loop" ]; then
    cmd=(autoflow runners start "$target_runner_id" "$project_root" "$board_dir_name")
    printf 'loop every %ss: ' "$effective_interval"
    runner_command_summary_from_array "${cmd[@]}"
    return 0
  fi

  if [ "$mode" = "watch" ]; then
    # DEPRECATED: mode=watch wraps the legacy script-driven file-watcher
    # `autoflow watch-bg` (watch-board.sh/.ps1). The supported topology is
    # heartbeat-driven AI runners; mode=watch is gated by run-role.sh and
    # only retained for backwards compatibility.
    cmd=(autoflow watch-bg "$project_root" "$board_dir_name")
    printf 'watch (legacy): '
    runner_command_summary_from_array "${cmd[@]}"
    return 0
  fi

  case "$agent" in
    codex)
      cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$project_root")
      [ -z "$model" ] || cmd+=(-m "$model")
      [ -z "$reasoning" ] || cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
      cmd+=(-)
      runner_command_summary_from_array "${cmd[@]}"
      ;;
    claude)
      cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--effort "$reasoning")
      runner_command_summary_from_array "${cmd[@]}"
      printf ' prompt'
      ;;
    opencode)
      cmd=(opencode run)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--variant "$reasoning")
      runner_command_summary_from_array "${cmd[@]}"
      printf ' prompt'
      ;;
    gemini)
      cmd=(gemini --approval-mode auto_edit --prompt)
      [ -z "$model" ] || cmd+=(--model "$model")
      runner_command_summary_from_array "${cmd[@]}"
      printf ' prompt'
      ;;
    *)
      if run_role="$(runner_role_to_run_role "$role" 2>/dev/null)"; then
        cmd=(autoflow run "$run_role" "$project_root" "$board_dir_name" --runner "$target_runner_id")
        runner_command_summary_from_array "${cmd[@]}"
      else
        printf 'unsupported role: %s' "${role:-empty}"
      fi
      ;;
  esac
}

runner_artifact_status() {
  local artifact_path artifact_count artifact_issue_count

  artifact_count=0
  artifact_issue_count=0

  for artifact_path in "$@"; do
    [ -n "$artifact_path" ] || continue
    artifact_count=$((artifact_count + 1))

    case "$artifact_path" in
      "${board_root}"/*)
        [ -f "$artifact_path" ] || artifact_issue_count=$((artifact_issue_count + 1))
        ;;
      *)
        artifact_issue_count=$((artifact_issue_count + 1))
        ;;
    esac
  done

  if [ "$artifact_count" -eq 0 ]; then
    printf 'not_applicable'
  elif [ "$artifact_issue_count" -eq 0 ]; then
    printf 'ok'
  else
    printf 'warning'
  fi
}

runner_artifact_path_status() {
  local artifact_path="${1:-}"

  if [ -z "$artifact_path" ]; then
    printf 'absent'
    return 0
  fi

  case "$artifact_path" in
    "${board_root}"/*)
      if [ -f "$artifact_path" ]; then
        printf 'ok'
      else
        printf 'missing'
      fi
      ;;
    *)
      printf 'outside_board'
      ;;
  esac
}

runner_field_from_block() {
  local block="$1"
  local field="$2"

  printf '%s\n' "$block" | awk -F= -v field="$field" '
    $1 == field {
      sub(/^[^=]*=/, "", $0)
      print
      found = 1
      exit
    }
    END {
      exit(found ? 0 : 1)
    }
  ' || true
}

runner_allowed_config_key() {
  case "${1:-}" in
    agent|model|reasoning|mode|interval_seconds|enabled|command)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

runner_allowed_role() {
  case "${1:-}" in
    ticket-owner|owner|ticket|planner|todo|verifier|wiki-maintainer|coordinator|coord|doctor|diagnose|watcher)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

runner_validate_config_value() {
  local key="$1"
  local value="$2"

  case "$value" in
    *$'\n'*|*$'\r'*|*$'\t'*)
      return 1
      ;;
  esac

  case "$key" in
    enabled)
      [ "$value" = "true" ] || [ "$value" = "false" ]
      ;;
    mode)
      case "$value" in
        one-shot|loop|watch) return 0 ;;
        *) return 1 ;;
      esac
      ;;
    interval_seconds)
      case "$value" in
        ""|*[!0-9]*)
          return 1
          ;;
      esac
      [ "$value" -ge 1 ] && [ "$value" -le 86400 ]
      ;;
    agent)
      case "$value" in
        manual|shell|codex|claude|opencode|gemini) return 0 ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 0
      ;;
  esac
}

runner_validate_add_update_key() {
  case "${1:-}" in
    agent|model|reasoning|mode|interval_seconds|enabled|command)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

runner_toml_value() {
  local key="$1"
  local value="$2"

  if [ "$key" = "enabled" ] || [ "$key" = "interval_seconds" ]; then
    printf '%s' "$value"
    return 0
  fi

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

runner_normalize_interval_seconds() {
  local value="${1:-}"

  case "$value" in
    ""|*[!0-9]*)
      printf '60'
      return 0
      ;;
  esac

  if [ "$value" -lt 1 ] || [ "$value" -gt 86400 ]; then
    printf '60'
    return 0
  fi

  printf '%s' "$value"
}

load_runner_config_or_block() {
  local target_runner_id="$1"

  if [ ! -f "$config_path" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_config_missing\n'
    return 1
  fi

  if ! runner_validate_id "$target_runner_id"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=invalid_runner_id\n'
    return 1
  fi

  runner_block="$(runner_config_block "$target_runner_id" "$config_path" 2>/dev/null || true)"
  if [ -z "$runner_block" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_not_found\n'
    return 1
  fi

  role="$(runner_field_from_block "$runner_block" "role")"
  agent="$(runner_field_from_block "$runner_block" "agent")"
  model="$(runner_field_from_block "$runner_block" "model")"
  reasoning="$(runner_field_from_block "$runner_block" "reasoning")"
  mode="$(runner_field_from_block "$runner_block" "mode")"
  interval_seconds="$(runner_field_from_block "$runner_block" "interval_seconds")"
  enabled="$(runner_field_from_block "$runner_block" "enabled")"
  command_value="$(runner_field_from_block "$runner_block" "command")"

  [ -n "$enabled" ] || enabled="true"
  [ -n "$mode" ] || mode="one-shot"
  [ -n "$agent" ] || agent="manual"
  interval_seconds="$(runner_normalize_interval_seconds "$interval_seconds")"

  return 0
}

load_runner_or_block() {
  local target_runner_id="$1"

  load_runner_config_or_block "$target_runner_id" || return 1

  if [ "$enabled" != "true" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_disabled\n'
    printf 'role=%s\n' "$role"
    printf 'agent=%s\n' "$agent"
    printf 'mode=%s\n' "$mode"
    return 1
  fi

  case "$mode" in
    one-shot|loop|watch) ;;
    *)
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=unsupported_runner_mode\n'
      printf 'mode=%s\n' "$mode"
      return 1
      ;;
  esac

  return 0
}

print_runner_action_result() {
  local command_status="$1"
  local result="$2"
  local target_runner_id="$3"
  local runner_status="$4"
  local timestamp="$5"
  local pid_value="${6:-}"

  print_runner_common_header "$command_status"
  printf 'result=%s\n' "$result"
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'role=%s\n' "$role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  printf 'interval_seconds=%s\n' "$interval_seconds"
  printf 'model=%s\n' "$model"
  printf 'reasoning=%s\n' "$reasoning"
  printf 'runner_status=%s\n' "$runner_status"
  printf 'active_item=\n'
  printf 'active_ticket_id=\n'
  printf 'active_ticket_title=\n'
  printf 'active_stage=\n'
  printf 'active_spec_ref=\n'
  printf 'pid=%s\n' "$pid_value"
  printf 'state_path=%s\n' "$(runner_state_path "$target_runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$target_runner_id")"
  printf 'last_event_at=%s\n' "$timestamp"
}

start_runner() {
  local target_runner_id="$1"
  local timestamp previous_pid loop_pid stdout_file stderr_file run_role

  load_runner_or_block "$target_runner_id" || return 0

  if [ "$mode" = "loop" ]; then
    previous_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
    if runner_pid_is_running "$previous_pid"; then
      timestamp="$(runner_now_iso)"
      print_runner_action_result "ok" "already_running" "$target_runner_id" "running" "$timestamp" "$previous_pid"
      printf 'stdout=%s\n' "$(runner_loop_stdout_path "$target_runner_id")"
      printf 'stderr=%s\n' "$(runner_loop_stderr_path "$target_runner_id")"
      return 0
    fi

    run_role="$(runner_role_to_run_role "$role" || true)"
    if [ -z "$run_role" ]; then
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=unsupported_runner_role_for_loop\n'
      printf 'role=%s\n' "$role"
      return 0
    fi

    stdout_file="$(runner_loop_stdout_path "$target_runner_id")"
    stderr_file="$(runner_loop_stderr_path "$target_runner_id")"
    start_loop_worker_process "$target_runner_id" "$stdout_file" "$stderr_file" "$previous_pid"
    if ! runner_pid_is_running "$loop_pid"; then
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=loop_worker_start_failed\n'
      printf 'stdout=%s\n' "$stdout_file"
      printf 'stderr=%s\n' "$stderr_file"
      return 0
    fi
    timestamp="$(runner_now_iso)"
    runner_write_state "$target_runner_id" \
      "status=running" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval_seconds}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
      "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
      "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
      "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
      "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
      "pid=${loop_pid}" \
      "started_at=${timestamp}" \
      "last_event_at=${timestamp}" \
      "last_result=loop_started"
    runner_append_log "$target_runner_id" "loop_start" \
      "status=running" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval_seconds}" \
      "pid=${loop_pid}" \
      "stdout=${stdout_file}" \
      "stderr=${stderr_file}"
    print_runner_action_result "ok" "started" "$target_runner_id" "running" "$timestamp" "$loop_pid"
    printf 'stdout=%s\n' "$stdout_file"
    printf 'stderr=%s\n' "$stderr_file"
    return 0
  fi

  timestamp="$(runner_now_iso)"
  runner_write_state "$target_runner_id" \
    "status=running" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
    "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
    "pid=" \
    "started_at=${timestamp}" \
    "last_event_at=${timestamp}"
  runner_append_log "$target_runner_id" "start" \
    "status=running" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}"
  print_runner_action_result "ok" "started" "$target_runner_id" "running" "$timestamp"
}

stop_runner() {
  local target_runner_id="$1"
  local timestamp previous_status previous_pid started_at result

  load_runner_config_or_block "$target_runner_id" || return 0

  timestamp="$(runner_now_iso)"
  previous_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
  previous_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
  started_at="$(runner_state_value_or_empty "$target_runner_id" "started_at")"
  result="stopped"
  if [ "$previous_status" = "stopped" ]; then
    result="already_stopped"
  elif runner_pid_is_running "$previous_pid"; then
    runner_kill_process_tree "$previous_pid"
  elif [ -n "$previous_pid" ]; then
    result="stopped_stale_pid"
  fi

  runner_write_state "$target_runner_id" \
    "status=stopped" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=" \
    "active_ticket_id=" \
    "active_ticket_title=" \
    "active_stage=" \
    "active_spec_ref=" \
    "pid=" \
    "started_at=${started_at}" \
    "last_event_at=${timestamp}"
  runner_append_log "$target_runner_id" "stop" \
    "status=stopped" \
    "previous_status=${previous_status:-unknown}" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}"
  print_runner_action_result "ok" "$result" "$target_runner_id" "stopped" "$timestamp"
}

restart_runner() {
  local target_runner_id="$1"
  local timestamp previous_status

  load_runner_or_block "$target_runner_id" || return 0

  if [ "$mode" = "loop" ]; then
    stop_runner "$target_runner_id" >/dev/null
    start_runner "$target_runner_id"
    return 0
  fi

  timestamp="$(runner_now_iso)"
  previous_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
  runner_append_log "$target_runner_id" "restart" \
    "previous_status=${previous_status:-unknown}" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}"
  runner_write_state "$target_runner_id" \
    "status=running" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
    "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
    "pid=" \
    "started_at=${timestamp}" \
    "last_event_at=${timestamp}"
  runner_append_log "$target_runner_id" "start" \
    "status=running" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}"
  print_runner_action_result "ok" "restarted" "$target_runner_id" "running" "$timestamp"
}

loop_runner_worker() {
  local target_runner_id="$1"
  local run_role interval started_at loop_pid child_pid run_exit current_status current_mode current_enabled current_interval timestamp stopping_loop

  load_runner_or_block "$target_runner_id" || return 0
  if [ "$mode" != "loop" ]; then
    echo "runner ${target_runner_id} is not in loop mode" >&2
    return 0
  fi

  run_role="$(runner_role_to_run_role "$role" || true)"
  if [ -z "$run_role" ]; then
    echo "runner ${target_runner_id} role cannot be looped: ${role}" >&2
    return 0
  fi

  interval="$(runner_normalize_interval_seconds "${AUTOFLOW_RUNNER_LOOP_INTERVAL_SECONDS:-$interval_seconds}")"

  started_at="$(runner_now_iso)"
  loop_pid="${BASHPID:-$$}"
  child_pid=""
  stopping_loop="false"

  stop_loop() {
    stopping_loop="true"
    if [ -n "${child_pid:-}" ] && runner_pid_is_running "$child_pid"; then
      kill "$child_pid" 2>/dev/null || true
    fi
    timestamp="$(runner_now_iso)"
    runner_write_state "$target_runner_id" \
      "status=stopped" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=" \
      "active_ticket_id=" \
      "active_ticket_title=" \
      "active_stage=" \
      "active_spec_ref=" \
      "pid=" \
      "started_at=${started_at}" \
      "last_event_at=${timestamp}" \
      "last_result=loop_stopped"
    runner_append_log "$target_runner_id" "loop_stop" \
      "status=stopped" \
      "role=${role}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "pid=${loop_pid}"
    exit 0
  }

  unexpected_loop_exit() {
    if [ "${stopping_loop:-false}" = "true" ]; then
      return 0
    fi
    timestamp="$(runner_now_iso)"
    runner_write_state "$target_runner_id" \
      "status=stopped" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=" \
      "active_ticket_id=" \
      "active_ticket_title=" \
      "active_stage=" \
      "active_spec_ref=" \
      "pid=" \
      "started_at=${started_at}" \
      "last_event_at=${timestamp}" \
      "last_result=loop_exited_unexpectedly"
    runner_append_log "$target_runner_id" "loop_exit" \
      "status=stopped" \
      "role=${role}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "pid=${loop_pid}"
  }

  trap '' HUP
  trap stop_loop TERM INT
  trap unexpected_loop_exit EXIT

  runner_write_state "$target_runner_id" \
    "status=running" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
    "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
    "pid=${loop_pid}" \
    "started_at=${started_at}" \
    "last_event_at=${started_at}" \
    "last_result=loop_running"
  runner_append_log "$target_runner_id" "loop_worker_start" \
    "status=running" \
    "role=${role}" \
    "mode=${mode}" \
    "pid=${loop_pid}" \
    "interval_seconds=${interval}"

  while :; do
    current_enabled="$(runner_config_field "$target_runner_id" "enabled" "$config_path" 2>/dev/null || true)"
    current_mode="$(runner_config_field "$target_runner_id" "mode" "$config_path" 2>/dev/null || true)"
    current_interval="$(runner_config_field "$target_runner_id" "interval_seconds" "$config_path" 2>/dev/null || true)"
    [ -n "$current_enabled" ] || current_enabled="true"
    [ -n "$current_mode" ] || current_mode="one-shot"
    interval="$(runner_normalize_interval_seconds "${AUTOFLOW_RUNNER_LOOP_INTERVAL_SECONDS:-$current_interval}")"
    if [ "$current_enabled" != "true" ] || [ "$current_mode" != "loop" ]; then
      break
    fi

    current_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
    if [ "$current_status" = "stopped" ]; then
      break
    fi

    AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT=1 "$SCRIPT_DIR/run-role.sh" "$run_role" "$project_root" "$board_dir_name" --runner "$target_runner_id" &
    child_pid="$!"
    set +e
    wait "$child_pid"
    run_exit="$?"
    set -e
    child_pid=""

    current_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
    if [ "$current_status" = "stopped" ]; then
      break
    fi

    timestamp="$(runner_now_iso)"
    runner_write_state "$target_runner_id" \
      "status=running" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
      "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
      "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
      "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
      "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
      "pid=${loop_pid}" \
      "started_at=${started_at}" \
      "last_event_at=${timestamp}" \
      "last_result=loop_waiting_exit_${run_exit}"
    runner_append_log "$target_runner_id" "loop_tick" \
      "role=${role}" \
      "mode=${mode}" \
      "exit_code=${run_exit}" \
      "interval_seconds=${interval}"

    sleep "$interval" &
    child_pid="$!"
    wait "$child_pid" || true
    child_pid=""
  done

  stop_loop
}

set_runner_config() {
  local target_runner_id="$1"
  local pair key value updates_file temp_file timestamp updated_count

  if [ ! -f "$config_path" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_config_missing\n'
    return 0
  fi

  if ! runner_validate_id "$target_runner_id"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=invalid_runner_id\n'
    return 0
  fi

  runner_block="$(runner_config_block "$target_runner_id" "$config_path" 2>/dev/null || true)"
  if [ -z "$runner_block" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_not_found\n'
    return 0
  fi

  updates_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-runner-updates.XXXXXX")"
  temp_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-runner-config.XXXXXX")"
  updated_count=0

  for pair in "${updates[@]}"; do
    if [[ "$pair" != *=* ]]; then
      rm -f "$updates_file" "$temp_file"
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=invalid_update_pair\n'
      printf 'pair=%s\n' "$pair"
      return 0
    fi

    key="${pair%%=*}"
    value="${pair#*=}"
    if ! runner_allowed_config_key "$key"; then
      rm -f "$updates_file" "$temp_file"
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=unsupported_config_key\n'
      printf 'key=%s\n' "$key"
      return 0
    fi

    if ! runner_validate_config_value "$key" "$value"; then
      rm -f "$updates_file" "$temp_file"
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=invalid_config_value\n'
      printf 'key=%s\n' "$key"
      return 0
    fi

    printf '%s\t%s\n' "$key" "$(runner_toml_value "$key" "$value")" >> "$updates_file"
    updated_count=$((updated_count + 1))
  done

  if ! awk -v wanted_id="$target_runner_id" -v updates_file="$updates_file" '
    function trim(value) {
      gsub(/^[[:space:]]+/, "", value)
      gsub(/[[:space:]]+$/, "", value)
      return value
    }

    function line_key(line, key) {
      if (line !~ /=/) {
        return 0
      }
      key = trim(substr(line, 1, index(line, "=") - 1))
      if (key in updates) {
        return key
      }
      return 0
    }

    function flush_block(  i, key, printed) {
      if (block_count == 0) {
        return
      }

      if (block_id != wanted_id) {
        for (i = 1; i <= block_count; i += 1) {
          print block[i]
        }
      } else {
        delete seen
        for (i = 1; i <= block_count; i += 1) {
          key = line_key(block[i])
          if (key) {
            print key " = " updates[key]
            seen[key] = 1
          } else {
            print block[i]
          }
        }
        for (i = 1; i <= update_order_count; i += 1) {
          key = update_order[i]
          if (!(key in seen)) {
            print key " = " updates[key]
          }
        }
        found = 1
      }

      delete block
      block_count = 0
      block_id = ""
    }

    BEGIN {
      while ((getline update_line < updates_file) > 0) {
        split(update_line, parts, "\t")
        key = parts[1]
        value = substr(update_line, length(key) + 2)
        if (!(key in updates)) {
          update_order_count += 1
          update_order[update_order_count] = key
        }
        updates[key] = value
      }
      close(updates_file)
      block_count = 0
      block_id = ""
    }

    /^[[:space:]]*\[\[runners\]\][[:space:]]*$/ {
      flush_block()
      block_count = 1
      block[block_count] = $0
      next
    }

    block_count > 0 {
      block_count += 1
      block[block_count] = $0
      if (index($0, "=") > 0) {
        current_key = trim(substr($0, 1, index($0, "=") - 1))
        if (current_key == "id") {
          current_value = trim(substr($0, index($0, "=") + 1))
          if (current_value ~ /^".*"$/) {
            current_value = substr(current_value, 2, length(current_value) - 2)
          }
          block_id = current_value
        }
      }
      next
    }

    {
      print
    }

    END {
      flush_block()
      exit(found ? 0 : 1)
    }
  ' "$config_path" > "$temp_file"; then
    rm -f "$updates_file" "$temp_file"
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_not_found\n'
    return 0
  fi

  mv "$temp_file" "$config_path"
  rm -f "$updates_file"

  runner_block="$(runner_config_block "$target_runner_id" "$config_path" 2>/dev/null || true)"
  role="$(runner_field_from_block "$runner_block" "role")"
  agent="$(runner_field_from_block "$runner_block" "agent")"
  model="$(runner_field_from_block "$runner_block" "model")"
  reasoning="$(runner_field_from_block "$runner_block" "reasoning")"
  mode="$(runner_field_from_block "$runner_block" "mode")"
  interval_seconds="$(runner_field_from_block "$runner_block" "interval_seconds")"
  enabled="$(runner_field_from_block "$runner_block" "enabled")"
  command_value="$(runner_field_from_block "$runner_block" "command")"
  interval_seconds="$(runner_normalize_interval_seconds "$interval_seconds")"
  timestamp="$(runner_now_iso)"

  runner_append_log "$target_runner_id" "config_set" \
    "status=ok" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "interval_seconds=${interval_seconds}" \
    "updated_count=${updated_count}"

  print_runner_common_header "ok"
  printf 'result=config_updated\n'
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'updated_count=%s\n' "$updated_count"
  printf 'role=%s\n' "$role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  printf 'interval_seconds=%s\n' "$interval_seconds"
  printf 'model=%s\n' "$model"
  printf 'reasoning=%s\n' "$reasoning"
  printf 'enabled=%s\n' "$enabled"
  printf 'command=%s\n' "$command_value"
  printf 'log_path=%s\n' "$(runner_log_path "$target_runner_id")"
  printf 'last_event_at=%s\n' "$timestamp"
}

runner_heartbeat_set_path() {
  printf '%s/automations/heartbeat-set.toml' "$board_root"
}

runner_ids_for_role() {
  local target_role="$1"
  awk -v want="$target_role" '
    function trim(value) { gsub(/^[[:space:]]+/, "", value); gsub(/[[:space:]]+$/, "", value); return value }
    function flush() { if (in_block && id != "" && role == want) print id; id=""; role=""; in_block=0 }
    /^[[:space:]]*\[\[runners\]\][[:space:]]*$/ { flush(); in_block=1; next }
    /^[[:space:]]*\[[^[]/ { flush(); next }
    in_block && /^[[:space:]]*id[[:space:]]*=/ {
      v=trim(substr($0, index($0, "=") + 1)); gsub(/^"|"$/, "", v); id=v; next
    }
    in_block && /^[[:space:]]*role[[:space:]]*=/ {
      v=trim(substr($0, index($0, "=") + 1)); gsub(/^"|"$/, "", v); role=v; next
    }
    END { flush() }
  ' "$config_path" 2>/dev/null
}

sync_heartbeat_set_workers() {
  local set_file role array_key tmp updated_array thread_block ids id
  set_file="$(runner_heartbeat_set_path)"
  [ -f "$set_file" ] || return 0

  for role in ticket-owner planner todo verifier; do
    case "$role" in
      ticket-owner) array_key="owner_workers" ;;
      planner) array_key="planner_workers" ;;
      todo) array_key="todo_workers" ;;
      verifier) array_key="verifier_workers" ;;
    esac
    ids="$(runner_ids_for_role "$role")"
    updated_array=""
    if [ -n "$ids" ]; then
      while IFS= read -r id; do
        [ -n "$id" ] || continue
        [ -z "$updated_array" ] && updated_array="\"${id}\"" || updated_array="${updated_array}, \"${id}\""
      done <<< "$ids"
    fi
    tmp="$(mktemp "${TMPDIR:-/tmp}/autoflow-heartbeat.XXXXXX")"
    awk -v key="$array_key" -v value="[${updated_array}]" '
      BEGIN { replaced = 0 }
      $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
        print key " = " value
        replaced = 1
        next
      }
      { print }
    ' "$set_file" > "$tmp" && mv "$tmp" "$set_file"
  done

  # Refresh [thread_ids] block: keep existing values for current ticket-owner workers,
  # add placeholder for new, drop entries for removed.
  ids="$(runner_ids_for_role "ticket-owner")"
  thread_block="$(autoflow_mktemp 2>/dev/null || mktemp "${TMPDIR:-/tmp}/autoflow-thread-ids.XXXXXX")"
  {
    if [ -n "$ids" ]; then
      while IFS= read -r id; do
        [ -n "$id" ] || continue
        local existing
        existing="$(awk -v id="$id" '
          /^\[thread_ids\]/ { in_section=1; next }
          /^\[/ && in_section { in_section=0 }
          in_section && $0 ~ "^[[:space:]]*" id "[[:space:]]*=" {
            v = $0; sub(/^[^=]*=[[:space:]]*/, "", v); gsub(/^"|"$/, "", v); print v; exit
          }
        ' "$set_file" 2>/dev/null)"
        if [ -n "$existing" ]; then
          printf '%s = "%s"\n' "$id" "$existing"
        else
          printf '%s = "REPLACE_WITH_%s_THREAD_ID"\n' "$id" "$(printf '%s' "$id" | tr '[:lower:]-' '[:upper:]_')"
        fi
      done <<< "$ids"
    fi
  } > "$thread_block"

  tmp="$(mktemp "${TMPDIR:-/tmp}/autoflow-heartbeat.XXXXXX")"
  awk -v block_file="$thread_block" '
    BEGIN { while ((getline line < block_file) > 0) body = body line "\n"; close(block_file) }
    /^\[thread_ids\]/ {
      print
      printf "%s", body
      in_section = 1
      replaced = 1
      next
    }
    /^\[/ && in_section { in_section = 0 }
    !in_section { print }
    END {
      if (!replaced) {
        print ""
        print "[thread_ids]"
        printf "%s", body
      }
    }
  ' "$set_file" > "$tmp" && mv "$tmp" "$set_file"
}

add_runner_config() {
  local target_runner_id="$1"
  local target_role="$2"
  local pair key value timestamp updated_count
  local agent_value model_value reasoning_value mode_value interval_seconds_value enabled_value command_value

  if [ ! -f "$config_path" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_config_missing\n'
    return 0
  fi

  if ! runner_validate_id "$target_runner_id"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=invalid_runner_id\n'
    return 0
  fi

  if ! runner_allowed_role "$target_role"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=unsupported_runner_role\n'
    printf 'role=%s\n' "$target_role"
    return 0
  fi

  runner_block="$(runner_config_block "$target_runner_id" "$config_path" 2>/dev/null || true)"
  if [ -n "$runner_block" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_already_exists\n'
    return 0
  fi

  agent_value="shell"
  model_value=""
  reasoning_value=""
  mode_value="one-shot"
  interval_seconds_value="60"
  enabled_value="true"
  command_value=""
  updated_count=0

  for pair in "${updates[@]}"; do
    if [[ "$pair" != *=* ]]; then
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=invalid_update_pair\n'
      printf 'pair=%s\n' "$pair"
      return 0
    fi

    key="${pair%%=*}"
    value="${pair#*=}"
    if ! runner_validate_add_update_key "$key"; then
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=unsupported_config_key\n'
      printf 'key=%s\n' "$key"
      return 0
    fi

    if ! runner_validate_config_value "$key" "$value"; then
      print_runner_common_header "blocked"
      printf 'runner_id=%s\n' "$target_runner_id"
      printf 'reason=invalid_config_value\n'
      printf 'key=%s\n' "$key"
      return 0
    fi

    case "$key" in
      agent) agent_value="$value" ;;
      model) model_value="$value" ;;
      reasoning) reasoning_value="$value" ;;
      mode) mode_value="$value" ;;
      interval_seconds) interval_seconds_value="$value" ;;
      enabled) enabled_value="$value" ;;
      command) command_value="$value" ;;
    esac
    updated_count=$((updated_count + 1))
  done

  {
    printf '\n[[runners]]\n'
    printf 'id = %s\n' "$(runner_toml_value "id" "$target_runner_id")"
    printf 'role = %s\n' "$(runner_toml_value "role" "$target_role")"
    printf 'agent = %s\n' "$(runner_toml_value "agent" "$agent_value")"
    printf 'model = %s\n' "$(runner_toml_value "model" "$model_value")"
    printf 'reasoning = %s\n' "$(runner_toml_value "reasoning" "$reasoning_value")"
    printf 'mode = %s\n' "$(runner_toml_value "mode" "$mode_value")"
    printf 'interval_seconds = %s\n' "$(runner_toml_value "interval_seconds" "$interval_seconds_value")"
    printf 'enabled = %s\n' "$(runner_toml_value "enabled" "$enabled_value")"
    printf 'command = %s\n' "$(runner_toml_value "command" "$command_value")"
  } >> "$config_path"

  sync_heartbeat_set_workers || true

  timestamp="$(runner_now_iso)"
  runner_append_log "$target_runner_id" "config_add" \
    "status=ok" \
    "role=${target_role}" \
    "agent=${agent_value}" \
    "mode=${mode_value}" \
    "interval_seconds=${interval_seconds_value}" \
    "updated_count=${updated_count}"

  print_runner_common_header "ok"
  printf 'result=runner_added\n'
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'role=%s\n' "$target_role"
  printf 'agent=%s\n' "$agent_value"
  printf 'mode=%s\n' "$mode_value"
  printf 'interval_seconds=%s\n' "$interval_seconds_value"
  printf 'model=%s\n' "$model_value"
  printf 'reasoning=%s\n' "$reasoning_value"
  printf 'enabled=%s\n' "$enabled_value"
  printf 'command=%s\n' "$command_value"
  printf 'log_path=%s\n' "$(runner_log_path "$target_runner_id")"
  printf 'last_event_at=%s\n' "$timestamp"
}

remove_runner_config() {
  local target_runner_id="$1"
  local temp_file trimmed_file timestamp state_path role agent mode model reasoning

  if [ ! -f "$config_path" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_config_missing\n'
    return 0
  fi

  if ! runner_validate_id "$target_runner_id"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=invalid_runner_id\n'
    return 0
  fi

  runner_block="$(runner_config_block "$target_runner_id" "$config_path" 2>/dev/null || true)"
  if [ -z "$runner_block" ]; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_not_found\n'
    return 0
  fi

  role="$(runner_field_from_block "$runner_block" "role")"
  agent="$(runner_field_from_block "$runner_block" "agent")"
  mode="$(runner_field_from_block "$runner_block" "mode")"
  model="$(runner_field_from_block "$runner_block" "model")"
  reasoning="$(runner_field_from_block "$runner_block" "reasoning")"
  temp_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-runner-config.XXXXXX")"

  if ! awk -v wanted_id="$target_runner_id" '
    function trim(value) {
      gsub(/^[[:space:]]+/, "", value)
      gsub(/[[:space:]]+$/, "", value)
      return value
    }

    function flush_block(  i) {
      if (block_count == 0) {
        return
      }

      if (block_id == wanted_id) {
        found = 1
      } else {
        for (i = 1; i <= block_count; i += 1) {
          print block[i]
        }
      }

      delete block
      block_count = 0
      block_id = ""
    }

    /^[[:space:]]*\[\[runners\]\][[:space:]]*$/ {
      flush_block()
      block_count = 1
      block[block_count] = $0
      next
    }

    block_count > 0 {
      block_count += 1
      block[block_count] = $0
      if (index($0, "=") > 0) {
        current_key = trim(substr($0, 1, index($0, "=") - 1))
        if (current_key == "id") {
          current_value = trim(substr($0, index($0, "=") + 1))
          if (current_value ~ /^".*"$/) {
            current_value = substr(current_value, 2, length(current_value) - 2)
          }
          block_id = current_value
        }
      }
      next
    }

    {
      print
    }

    END {
      flush_block()
      exit(found ? 0 : 1)
    }
  ' "$config_path" > "$temp_file"; then
    rm -f "$temp_file"
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_not_found\n'
    return 0
  fi

  trimmed_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-runner-config.XXXXXX")"
  awk '
    NF > 0 {
      while (blank_count > 0) {
        print ""
        blank_count -= 1
      }
      print
      next
    }
    {
      blank_count += 1
    }
  ' "$temp_file" > "$trimmed_file"
  mv "$trimmed_file" "$temp_file"
  mv "$temp_file" "$config_path"
  sync_heartbeat_set_workers || true
  timestamp="$(runner_now_iso)"
  runner_append_log "$target_runner_id" "config_remove" \
    "status=ok" \
    "role=${role}" \
    "agent=${agent}" \
    "mode=${mode}"
  state_path="$(runner_state_path "$target_runner_id")"
  rm -f "$state_path"

  print_runner_common_header "ok"
  printf 'result=runner_removed\n'
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'role=%s\n' "$role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  printf 'model=%s\n' "$model"
  printf 'reasoning=%s\n' "$reasoning"
  printf 'log_path=%s\n' "$(runner_log_path "$target_runner_id")"
  printf 'last_event_at=%s\n' "$timestamp"
}

list_runner_artifacts() {
  local target_runner_id="$1"
  local last_runtime_log last_prompt_log last_stdout_log last_stderr_log artifact_status
  local artifact_count index label artifact_path path_status

  load_runner_config_or_block "$target_runner_id" || return 0

  last_runtime_log="$(runner_state_value_or_empty "$target_runner_id" "last_runtime_log")"
  last_prompt_log="$(runner_state_value_or_empty "$target_runner_id" "last_prompt_log")"
  last_stdout_log="$(runner_state_value_or_empty "$target_runner_id" "last_stdout_log")"
  last_stderr_log="$(runner_state_value_or_empty "$target_runner_id" "last_stderr_log")"
  artifact_status="$(runner_artifact_status "$last_runtime_log" "$last_prompt_log" "$last_stdout_log" "$last_stderr_log")"

  print_runner_common_header "ok"
  printf 'result=runner_artifacts\n'
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'role=%s\n' "$role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  printf 'artifact_status=%s\n' "$artifact_status"
  printf 'artifact_count=4\n'

  index=0
  for label in runtime prompt stdout stderr; do
    index=$((index + 1))
    case "$label" in
      runtime) artifact_path="$last_runtime_log" ;;
      prompt) artifact_path="$last_prompt_log" ;;
      stdout) artifact_path="$last_stdout_log" ;;
      stderr) artifact_path="$last_stderr_log" ;;
    esac
    path_status="$(runner_artifact_path_status "$artifact_path")"
    printf 'artifact.%s.label=%s\n' "$index" "$label"
    printf 'artifact.%s.status=%s\n' "$index" "$path_status"
    printf 'artifact.%s.path=%s\n' "$index" "$artifact_path"
  done
}

list_runners() {
  local config_stream runner_count index in_runner line key value
  local id role agent model reasoning mode interval_seconds enabled command
  local state_path log_path state_status effective_state_status active_item active_ticket_id active_ticket_title active_stage active_spec_ref pid started_at last_event_at last_result last_log_line
  local last_runtime_log last_prompt_log last_stdout_log last_stderr_log artifact_status
  local artifact_runtime_status artifact_prompt_status artifact_stdout_status artifact_stderr_status

  if [ ! -f "$config_path" ]; then
    print_runner_common_header "blocked"
    printf 'reason=runner_config_missing\n'
    printf 'runner_count=0\n'
    return 0
  fi

  config_stream="$(runner_list_config "$config_path" || true)"
  runner_count="$(printf '%s\n' "$config_stream" | awk '$0 == "runner_begin" { count += 1 } END { print count + 0 }')"

  print_runner_common_header "ok"
  printf 'runner_count=%s\n' "$runner_count"

  index=0
  in_runner=0
  id=""
  role=""
  agent=""
  model=""
  reasoning=""
  mode=""
  interval_seconds=""
  enabled=""
  command=""

  while IFS= read -r line; do
    case "$line" in
      runner_begin)
        in_runner=1
        id=""
        role=""
        agent=""
        model=""
        reasoning=""
        mode=""
        interval_seconds=""
        enabled=""
        command=""
        ;;
      runner_end)
        if [ "$in_runner" -eq 1 ] && [ -n "$id" ]; then
          index=$((index + 1))
          state_path="$(runner_state_path "$id")"
          log_path="$(runner_log_path "$id")"
          state_status="$(runner_state_value_or_empty "$id" "status")"
          active_item="$(runner_state_value_or_empty "$id" "active_item")"
          active_ticket_id="$(runner_state_value_or_empty "$id" "active_ticket_id")"
          active_ticket_title="$(runner_state_value_or_empty "$id" "active_ticket_title")"
          active_stage="$(runner_state_value_or_empty "$id" "active_stage")"
          active_spec_ref="$(runner_state_value_or_empty "$id" "active_spec_ref")"
          pid="$(runner_state_value_or_empty "$id" "pid")"
          started_at="$(runner_state_value_or_empty "$id" "started_at")"
          last_event_at="$(runner_state_value_or_empty "$id" "last_event_at")"
          last_result="$(runner_state_value_or_empty "$id" "last_result")"
          last_runtime_log="$(runner_state_value_or_empty "$id" "last_runtime_log")"
          last_prompt_log="$(runner_state_value_or_empty "$id" "last_prompt_log")"
          last_stdout_log="$(runner_state_value_or_empty "$id" "last_stdout_log")"
          last_stderr_log="$(runner_state_value_or_empty "$id" "last_stderr_log")"
          artifact_status="$(runner_artifact_status "$last_runtime_log" "$last_prompt_log" "$last_stdout_log" "$last_stderr_log")"
          artifact_runtime_status="$(runner_artifact_path_status "$last_runtime_log")"
          artifact_prompt_status="$(runner_artifact_path_status "$last_prompt_log")"
          artifact_stdout_status="$(runner_artifact_path_status "$last_stdout_log")"
          artifact_stderr_status="$(runner_artifact_path_status "$last_stderr_log")"
          last_log_line="$(runner_log_tail_line "$id")"
          [ -n "$state_status" ] || state_status="idle"
          effective_state_status="$(runner_effective_state_status "$state_status" "$mode" "$pid")"
          if [ "$effective_state_status" != "$state_status" ]; then
            last_result="${last_result:-stale_pid}"
          fi
          pid="$(runner_effective_state_pid "$state_status" "$mode" "$pid")"
          state_status="$effective_state_status"

          printf 'runner.%s.id=%s\n' "$index" "$id"
          printf 'runner.%s.role=%s\n' "$index" "$role"
          printf 'runner.%s.agent=%s\n' "$index" "$agent"
          printf 'runner.%s.model=%s\n' "$index" "$model"
          printf 'runner.%s.reasoning=%s\n' "$index" "$reasoning"
          printf 'runner.%s.mode=%s\n' "$index" "$mode"
          printf 'runner.%s.interval_seconds=%s\n' "$index" "${interval_seconds:-60}"
          printf 'runner.%s.interval_effective_seconds=%s\n' "$index" "$(runner_normalize_interval_seconds "$interval_seconds")"
          printf 'runner.%s.enabled=%s\n' "$index" "$enabled"
          printf 'runner.%s.command=%s\n' "$index" "$command"
          printf 'runner.%s.command_preview=%s\n' "$index" "$(runner_command_preview "$id" "$role" "$agent" "$mode" "$model" "$reasoning" "$interval_seconds" "$command")"
          printf 'runner.%s.state_status=%s\n' "$index" "$state_status"
          printf 'runner.%s.active_item=%s\n' "$index" "$active_item"
          printf 'runner.%s.active_ticket_id=%s\n' "$index" "$active_ticket_id"
          printf 'runner.%s.active_ticket_title=%s\n' "$index" "$active_ticket_title"
          printf 'runner.%s.active_stage=%s\n' "$index" "$active_stage"
          printf 'runner.%s.active_spec_ref=%s\n' "$index" "$active_spec_ref"
          printf 'runner.%s.pid=%s\n' "$index" "$pid"
          printf 'runner.%s.started_at=%s\n' "$index" "$started_at"
          printf 'runner.%s.last_event_at=%s\n' "$index" "$last_event_at"
          printf 'runner.%s.last_result=%s\n' "$index" "$last_result"
          printf 'runner.%s.last_runtime_log=%s\n' "$index" "$last_runtime_log"
          printf 'runner.%s.last_prompt_log=%s\n' "$index" "$last_prompt_log"
          printf 'runner.%s.last_stdout_log=%s\n' "$index" "$last_stdout_log"
          printf 'runner.%s.last_stderr_log=%s\n' "$index" "$last_stderr_log"
          printf 'runner.%s.artifact_status=%s\n' "$index" "$artifact_status"
          printf 'runner.%s.artifact_runtime_status=%s\n' "$index" "$artifact_runtime_status"
          printf 'runner.%s.artifact_prompt_status=%s\n' "$index" "$artifact_prompt_status"
          printf 'runner.%s.artifact_stdout_status=%s\n' "$index" "$artifact_stdout_status"
          printf 'runner.%s.artifact_stderr_status=%s\n' "$index" "$artifact_stderr_status"
          printf 'runner.%s.last_log_line=%s\n' "$index" "$last_log_line"
          printf 'runner.%s.state_path=%s\n' "$index" "$state_path"
          printf 'runner.%s.log_path=%s\n' "$index" "$log_path"
        fi
        in_runner=0
        ;;
      *=*)
        if [ "$in_runner" -eq 1 ]; then
          key="${line%%=*}"
          value="${line#*=}"
          case "$key" in
            id) id="$value" ;;
            role) role="$value" ;;
            agent) agent="$value" ;;
            model) model="$value" ;;
            reasoning) reasoning="$value" ;;
            mode) mode="$value" ;;
            interval_seconds) interval_seconds="$value" ;;
            enabled) enabled="$value" ;;
            command) command="$value" ;;
          esac
        fi
        ;;
    esac
  done <<EOF
$config_stream
EOF
}

case "$action" in
  list)
    list_runners
    ;;
  add)
    add_runner_config "$runner_id" "$runner_role"
    ;;
  remove)
    remove_runner_config "$runner_id"
    ;;
  start)
    start_runner "$runner_id"
    ;;
  stop)
    stop_runner "$runner_id"
    ;;
  restart)
    restart_runner "$runner_id"
    ;;
  artifacts)
    list_runner_artifacts "$runner_id"
    ;;
  loop-worker)
    loop_runner_worker "$runner_id"
    ;;
  set)
    set_runner_config "$runner_id"
    ;;
esac
