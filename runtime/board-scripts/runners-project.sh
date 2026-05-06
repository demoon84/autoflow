#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/cli-common.sh" ]; then
  source "${SCRIPT_DIR}/cli-common.sh"
else
  source "${SCRIPT_DIR}/../../packages/cli/cli-common.sh"
fi
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

ensure_runner_config_write_path_or_block() {
  local target_runner_id="$1"
  local write_config_path

  if ! write_config_path="$(runner_config_write_path)"; then
    print_runner_common_header "blocked"
    printf 'runner_id=%s\n' "$target_runner_id"
    printf 'reason=runner_config_missing\n'
    return 1
  fi

  config_path="$write_config_path"
  return 0
}

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

runner_log_meaningful_last_result() {
  local target_runner_id="$1"
  local target_log_path

  target_log_path="$(runner_log_path "$target_runner_id")"
  [ -f "$target_log_path" ] || return 0

  tail -n 40 "$target_log_path" | awk '
    function value(line, key,   pattern, item) {
      pattern = "(^| )" key "=[^ ]*"
      if (match(line, pattern)) {
        item = substr(line, RSTART, RLENGTH)
        sub("^.*" key "=", "", item)
        return item
      }
      return ""
    }
    {
      lines[NR] = $0
    }
    END {
      for (i = NR; i >= 1; i -= 1) {
        event = value(lines[i], "event")
        if (event == "adapter_skip") {
          reason = value(lines[i], "reason")
          if (reason != "") {
            print reason
            exit
          }
        }
        if (event == "runtime_preflight_finish" || event == "runtime_finish") {
          reason = value(lines[i], "reason")
          if (reason != "") {
            print reason
            exit
          }
          status = value(lines[i], "runtime_status")
          if (status != "") {
            print status
            exit
          }
        }
        if (event == "adapter_finish") {
          reason = value(lines[i], "reason")
          if (reason != "") {
            print reason
            exit
          }
          exit_code = value(lines[i], "exit_code")
          if (exit_code != "") {
            print "adapter_exit_" exit_code
            exit
          }
        }
      }
    }
  '
}

runner_display_last_result() {
  local target_runner_id="$1"
  local raw_result="${2:-}"
  local meaningful_result

  case "$raw_result" in
    loop_waiting_exit_0)
      meaningful_result="$(runner_log_meaningful_last_result "$target_runner_id")"
      if [ -n "$meaningful_result" ]; then
        printf '%s' "$meaningful_result"
        return 0
      fi
      ;;
  esac

  printf '%s' "$raw_result"
}

runner_pid_is_running() {
  local pid="${1:-}"
  local kill_output kill_status

  case "$pid" in
    ""|*[!0-9]*)
      return 1
      ;;
  esac

  kill_output="$(kill -0 "$pid" 2>&1)"
  kill_status=$?
  [ "$kill_status" -eq 0 ] && return 0

  case "$kill_output" in
    *[Oo]peration\ not\ permitted*|*[Nn]ot\ permitted*)
      return 0
      ;;
  esac

  return 1
}

runner_process_children() {
  local pid="${1:-}"

  case "$pid" in
    ""|*[!0-9]*)
      return 0
      ;;
  esac

  if command -v pgrep >/dev/null 2>&1; then
    pgrep -P "$pid" 2>/dev/null || true
  else
    ps -axo ppid=,pid= 2>/dev/null | awk -v ppid="$pid" '$1 == ppid { print $2 }' || true
  fi
}

runner_count_process_tree() {
  local pid="${1:-}"
  local child total child_total

  case "$pid" in
    ""|*[!0-9]*)
      printf '0'
      return 0
      ;;
  esac

  total=0
  while IFS= read -r child; do
    [ -n "$child" ] || continue
    child_total="$(runner_count_process_tree "$child")"
    total=$((total + 1 + child_total))
  done < <(runner_process_children "$pid")
  printf '%s' "$total"
}

runner_user_process_count() {
  local user_name count

  user_name="$(id -un 2>/dev/null || printf '')"
  if [ -n "$user_name" ]; then
    count="$(ps -u "$user_name" -o pid= 2>/dev/null | wc -l | tr -d '[:space:]' || true)"
    case "$count" in
      ''|*[!0-9]*) ;;
      *) printf '%s' "$count"; return 0 ;;
    esac
  fi

  ps -axo pid= 2>/dev/null | wc -l | tr -d '[:space:]' || printf '0'
}

runner_process_pressure_snapshot() {
  local loop_pid="${1:-}"
  local user_limit runner_child_limit user_count runner_child_count result

  user_limit="$(runner_resolve_int_env "AUTOFLOW_PROCESS_PRESSURE_USER_LIMIT" 1000)"
  runner_child_limit="$(runner_resolve_int_env "AUTOFLOW_PROCESS_PRESSURE_RUNNER_CHILD_LIMIT" 200)"
  user_count="$(runner_user_process_count)"
  runner_child_count="$(runner_count_process_tree "$loop_pid")"
  result="ok"

  if [ "$user_limit" -gt 0 ] && [ "$user_count" -ge "$user_limit" ]; then
    result="user_limit"
  elif [ "$runner_child_limit" -gt 0 ] && [ "$runner_child_count" -ge "$runner_child_limit" ]; then
    result="runner_child_limit"
  fi

  printf 'result=%s\n' "$result"
  printf 'user_process_count=%s\n' "$user_count"
  printf 'user_process_limit=%s\n' "$user_limit"
  printf 'runner_child_count=%s\n' "$runner_child_count"
  printf 'runner_child_limit=%s\n' "$runner_child_limit"
}

runner_process_pressure_reason() {
  awk -F= '$1 == "result" { print $2; exit }'
}

runner_kill_process_tree() {
  local pid="${1:-}"
  local child wait_index

  case "$pid" in
    ""|*[!0-9]*)
      return 0
      ;;
  esac

  while IFS= read -r child; do
    [ -n "$child" ] || continue
    runner_kill_process_tree "$child"
  done < <(runner_process_children "$pid")

  kill "$pid" 2>/dev/null || true
  for wait_index in 1 2 3 4 5; do
    runner_pid_is_running "$pid" || return 0
    sleep 0.2
  done

  while IFS= read -r child; do
    [ -n "$child" ] || continue
    runner_kill_process_tree "$child"
  done < <(runner_process_children "$pid")
  kill -9 "$pid" 2>/dev/null || true
}

runner_orphan_loop_worker_pids() {
  local target_runner_id="$1"
  local skip_pid="${2:-}"
  local pid command

  ps -axo pid=,command= 2>/dev/null | while read -r pid command; do
    [ -n "${pid:-}" ] || continue
    [ -n "${command:-}" ] || continue
    case "$pid" in
      ""|*[!0-9]*) continue ;;
    esac
    [ "$pid" != "$$" ] || continue
    [ -z "$skip_pid" ] || [ "$pid" != "$skip_pid" ] || continue
    case "$command" in
      *"runners-project.sh loop-worker ${target_runner_id} ${project_root} ${board_dir_name}"*)
        ;;
      *)
        continue
        ;;
    esac
    printf '%s\n' "$pid"
  done
}

runner_existing_loop_worker_pid() {
  local target_runner_id="$1"
  local skip_pid="${2:-}"

  runner_orphan_loop_worker_pids "$target_runner_id" "$skip_pid" | sort -n | tail -n 1 || true
}

runner_stop_orphan_loop_workers() {
  local target_runner_id="$1"
  local skip_pid="${2:-}"
  local pid stopped_count=0

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    runner_pid_is_running "$pid" || continue
    runner_kill_process_tree "$pid"
    stopped_count=$((stopped_count + 1))
    runner_append_log "$target_runner_id" "orphan_loop_worker_stop" \
      "pid=${pid}" \
      "reason=worktree_local_loop_worker"
  done < <(runner_orphan_loop_worker_pids "$target_runner_id" "$skip_pid")

  printf '%s' "$stopped_count"
}

runner_loop_lock_dir() {
  local target_runner_id="$1"

  runner_ensure_dirs
  printf '%s/%s.loop.lock' "$(runner_state_dir)" "$target_runner_id"
}

runner_loop_lock_pid_path() {
  local target_runner_id="$1"

  printf '%s/pid' "$(runner_loop_lock_dir "$target_runner_id")"
}

runner_acquire_loop_lock() {
  local target_runner_id="$1"
  local loop_pid="$2"
  local lock_dir pid_file existing_pid attempt

  lock_dir="$(runner_loop_lock_dir "$target_runner_id")"
  pid_file="${lock_dir}/pid"

  for attempt in 1 2; do
    if mkdir "$lock_dir" 2>/dev/null; then
      printf '%s\n' "$loop_pid" > "$pid_file"
      return 0
    fi

    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if ! runner_pid_is_running "$existing_pid"; then
      rm -rf "$lock_dir"
      continue
    fi
    return 1
  done

  return 1
}

runner_release_loop_lock() {
  local target_runner_id="$1"
  local loop_pid="$2"
  local lock_dir pid_file existing_pid

  lock_dir="$(runner_loop_lock_dir "$target_runner_id")"
  pid_file="${lock_dir}/pid"
  existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
  [ "$existing_pid" = "$loop_pid" ] || return 0
  rm -rf "$lock_dir"
}

runner_loop_state_owned_by_pid() {
  local target_runner_id="$1"
  local loop_pid="$2"
  local state_pid

  state_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
  [ -n "$state_pid" ] && [ "$state_pid" = "$loop_pid" ]
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

runner_loop_max_size_bytes() {
  local value="${AUTOFLOW_LOOP_LOG_MAX_SIZE_BYTES:-1048576}"
  case "$value" in
    ''|*[!0-9]*)
      printf '1048576'
      ;;
    *)
      printf '%s' "$value"
      ;;
  esac
}

rotate_loop_log_if_needed() {
  local target="$1"
  local max_size current_size backup_one backup_two

  [ -n "$target" ] || return 0
  [ -f "$target" ] || return 0

  max_size="$(runner_loop_max_size_bytes)"
  current_size="$(wc -c < "$target" 2>/dev/null || printf '0')"
  current_size="${current_size// /}"
  [ -n "$current_size" ] || current_size=0

  [ "$current_size" -le "$max_size" ] && return 0

  backup_one="${target}.1"
  backup_two="${target}.2"
  [ -f "$backup_two" ] && rm -f "$backup_two"
  [ -f "$backup_one" ] && mv "$backup_one" "$backup_two"
  mv "$target" "$backup_one"
  : > "$target"
}

start_loop_worker_process() {
  local target_runner_id="$1"
  local stdout_file="$2"
  local stderr_file="$3"
  local previous_pid="$4"

  loop_pid=""

  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$SCRIPT_DIR/runners-project.sh" loop-worker "$target_runner_id" "$project_root" "$board_dir_name" >/dev/null 2>&1 &
    loop_pid="$!"
  elif command -v python3 >/dev/null 2>&1; then
    loop_pid="$(python3 - "$SCRIPT_DIR/runners-project.sh" "$target_runner_id" "$project_root" "$board_dir_name" <<'PY'
import subprocess
import sys

script, runner_id, project_root, board_dir_name = sys.argv[1:]
process = subprocess.Popen(
    [script, "loop-worker", runner_id, project_root, board_dir_name],
    stdin=subprocess.DEVNULL,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    start_new_session=True,
    close_fds=True,
)
print(process.pid)
PY
)"
  else
    nohup "$SCRIPT_DIR/runners-project.sh" loop-worker "$target_runner_id" "$project_root" "$board_dir_name" >/dev/null 2>&1 &
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
    if [ "$agent" = "codex" ] && [ -n "$reasoning" ]; then
      printf ' with runner codex flag: -c model_reasoning_effort="%s"' "$reasoning"
    fi
    return 0
  fi

  if [ "$mode" = "watch" ]; then
    # DEPRECATED: mode=watch wraps the legacy script-driven file-watcher
    # `autoflow watch-bg` (watch-board.sh). The supported topology is
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
      cmd=(gemini --skip-trust --approval-mode auto_edit --prompt)
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
    agent|model|reasoning|mode|interval_seconds|enabled|realtime_enabled|command)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

runner_allowed_role() {
  # Active roles (4-runner topology): planner / ticket-owner / verifier / wiki-maintainer.
  # Legacy/back-compat roles (kept reachable so users on older configs can
  # still `autoflow runners add ...`): owner|ticket alias for ticket-owner,
  # plan alias for planner, wiki alias for wiki-maintainer, plus
  # todo|verifier|merge|merge-bot|coordinator|coord|doctor|diagnose|watcher.
  # Trial role (disabled by default): self-improve.
  case "${1:-}" in
    ticket-owner|owner|ticket|planner|plan|todo|verifier|wiki-maintainer|wiki|merge|merge-bot|coordinator|coord|doctor|diagnose|watcher|self-improve|self_improve|selfimprove)
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
    enabled|realtime_enabled)
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
    agent|model|reasoning|mode|interval_seconds|enabled|realtime_enabled|command)
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

  if [ "$key" = "enabled" ] || [ "$key" = "realtime_enabled" ] || [ "$key" = "interval_seconds" ]; then
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

runner_public_role() {
  case "${1:-}" in
    ticket-owner|owner|ticket)
      printf 'ticket'
      ;;
    planner|plan)
      printf 'planner'
      ;;
    verifier|veri)
      printf 'verifier'
      ;;
    wiki|wiki-maintainer)
      printf 'wiki'
      ;;
    *)
      printf '%s' "${1:-}"
      ;;
  esac
}

runner_positive_integer_or_default() {
  local value="${1:-}"
  local fallback="${2:-0}"

  case "$value" in
    ''|*[!0-9]*)
      printf '%s' "$fallback"
      return 0
      ;;
  esac

  printf '%s' "$value"
}

runner_tick_backoff_enabled() {
  local public_role="$1"
  local mode="$2"

  [ "$mode" = "loop" ] || return 1
  [ "${AUTOFLOW_TICK_BACKOFF_ENABLED:-1}" != "0" ] || return 1

  case "$public_role" in
    planner|ticket|verifier)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

runner_tick_backoff_threshold_idle_ticks() {
  runner_positive_integer_or_default "${AUTOFLOW_TICK_BACKOFF_THRESHOLD_IDLE_TICKS:-5}" "5"
}

runner_tick_backoff_max_interval_seconds() {
  runner_normalize_interval_seconds "${AUTOFLOW_TICK_BACKOFF_MAX_INTERVAL_SECONDS:-300}"
}

runner_idle_preflight_fingerprint_path() {
  local runner_id="$1"
  local public_role="$2"

  runner_ensure_dirs
  printf '%s/%s.%s-idle-inputs.fingerprint' "$(runner_state_dir)" "$runner_id" "$public_role"
}

runner_idle_preflight_inputs_hash_stream() {
  local public_role="$1"
  local rel_dir dir file rel checksum

  case "$public_role" in
    planner)
      set -- tickets/inbox tickets/backlog tickets/reject tickets/todo tickets/inprogress tickets/done tickets/plan plan
      ;;
    ticket)
      set -- tickets/todo tickets/inprogress tickets/verifier
      ;;
    verifier)
      set -- tickets/verifier
      ;;
    *)
      return 0
      ;;
  esac

  for rel_dir in "$@"; do
    dir="${board_root}/${rel_dir}"
    [ -d "$dir" ] || continue
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      case "$(basename "$file")" in
        README.md)
          continue
          ;;
      esac
      rel="${file#"$board_root"/}"
      if command -v shasum >/dev/null 2>&1; then
        checksum="$(shasum -a 256 "$file" | awk '{ print $1 }')"
      elif command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$file" | awk '{ print $1 }')"
      else
        checksum="$(cksum "$file" | awk '{ print $1 ":" $2 }')"
      fi
      printf '%s  %s\n' "$checksum" "$rel"
    done < <(find "$dir" -type f \( -name '*.md' -o -name '*.log' -o -name '*.txt' -o -name '*.json' -o -name '*.jsonl' \) | LC_ALL=C sort)
  done
}

runner_idle_preflight_inputs_fingerprint() {
  local public_role="$1"

  if command -v shasum >/dev/null 2>&1; then
    runner_idle_preflight_inputs_hash_stream "$public_role" | shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    runner_idle_preflight_inputs_hash_stream "$public_role" | sha256sum | awk '{ print $1 }'
  else
    runner_idle_preflight_inputs_hash_stream "$public_role" | cksum | awk '{ print $1 ":" $2 }'
  fi
}

runner_realtime_enabled() {
  local public_role="$1"
  local mode="$2"
  local role_var role_value

  [ "$mode" = "loop" ] || return 1

  case "$public_role" in
    planner|ticket|verifier|wiki) ;;
    *) return 1 ;;
  esac

  # Per-role env var: AUTOFLOW_<ROLE>_REALTIME_ENABLED=1
  role_var="AUTOFLOW_$(printf '%s' "$public_role" | tr '[:lower:]' '[:upper:]')_REALTIME_ENABLED"
  role_value="${!role_var:-}"
  if [ "$role_value" = "1" ]; then
    return 0
  fi

  # Umbrella env var: AUTOFLOW_RUNNER_REALTIME_ENABLED=1 enables all 4 roles
  if [ "${AUTOFLOW_RUNNER_REALTIME_ENABLED:-0}" = "1" ]; then
    return 0
  fi

  # Runner config field: realtime_enabled = true
  if [ "${realtime_enabled:-false}" = "true" ]; then
    return 0
  fi

  return 1
}

# Backward compatibility wrapper
runner_planner_realtime_enabled() {
  runner_realtime_enabled "$@"
}

runner_realtime_fingerprint_path() {
  local runner_id="$1"
  local public_role="${2:-planner}"

  runner_ensure_dirs
  printf '%s/%s.%s-realtime-inputs.fingerprint' "$(runner_state_dir)" "$runner_id" "$public_role"
}

runner_planner_realtime_fingerprint_path() {
  runner_realtime_fingerprint_path "$1" "planner"
}

runner_realtime_marker_path() {
  local runner_id="$1"
  local public_role="${2:-planner}"

  runner_ensure_dirs
  printf '%s/%s.%s-realtime-wakeup.pending' "$(runner_state_dir)" "$runner_id" "$public_role"
}

runner_planner_realtime_marker_path() {
  runner_realtime_marker_path "$1" "planner"
}

runner_realtime_inputs_specs() {
  # Per-role watch paths (relative to board_root)
  # Format: "<dir>:<glob>" entries, one per line
  case "${1:-planner}" in
    planner)
      printf 'tickets/inbox:order_*.md\n'
      printf 'tickets/backlog:prd_*.md\n'
      printf 'tickets/reject:reject_*.md\n'
      ;;
    ticket)
      # Worker watches todo/ for new ticket arrival
      printf 'tickets/todo:tickets_*.md\n'
      ;;
    verifier)
      # Verifier watches verifier/ for queue entries
      printf 'tickets/verifier:*.md\n'
      ;;
    wiki)
      # Wiki AI watches done/ (new completions) and wiki/ (source changes)
      # Note: wiki has its own debounce policy (AUTOFLOW_WIKI_DEBOUNCE_*)
      printf 'tickets/done:*.md\n'
      printf 'wiki:*.md\n'
      ;;
    *)
      ;;
  esac
}

runner_realtime_inputs_hash_stream() {
  local public_role="${1:-planner}"
  local spec dir glob file rel checksum

  while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    dir="${board_root}/${spec%%:*}"
    glob="${spec#*:}"
    [ -d "$dir" ] || continue
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      case "$(basename "$file")" in
        README.md) continue ;;
      esac
      rel="${file#"$board_root"/}"
      if command -v shasum >/dev/null 2>&1; then
        checksum="$(shasum -a 256 "$file" | awk '{ print $1 }')"
      elif command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$file" | awk '{ print $1 }')"
      else
        checksum="$(cksum "$file" | awk '{ print $1 ":" $2 }')"
      fi
      printf '%s  %s\n' "$checksum" "$rel"
    done < <(find "$dir" -maxdepth 1 -type f -name "$glob" | LC_ALL=C sort)
  done < <(runner_realtime_inputs_specs "$public_role")
}

runner_planner_realtime_inputs_hash_stream() {
  runner_realtime_inputs_hash_stream "planner"
}

runner_realtime_inputs_fingerprint() {
  local public_role="${1:-planner}"
  if command -v shasum >/dev/null 2>&1; then
    runner_realtime_inputs_hash_stream "$public_role" | shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    runner_realtime_inputs_hash_stream "$public_role" | sha256sum | awk '{ print $1 }'
  else
    runner_realtime_inputs_hash_stream "$public_role" | cksum | awk '{ print $1 ":" $2 }'
  fi
}

runner_planner_realtime_inputs_fingerprint() {
  runner_realtime_inputs_fingerprint "planner"
}

runner_realtime_watch_dirs() {
  local public_role="${1:-planner}"
  local spec dir

  while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    dir="${board_root}/${spec%%:*}"
    [ -d "$dir" ] || continue
    printf '%s\n' "$dir"
  done < <(runner_realtime_inputs_specs "$public_role") | LC_ALL=C sort -u
}

runner_realtime_watch_backend() {
  if command -v node >/dev/null 2>&1 && [ -d "${project_root}/node_modules/chokidar" ]; then
    printf 'chokidar'
    return 0
  fi
  if command -v fswatch >/dev/null 2>&1; then
    printf 'fswatch'
    return 0
  fi
  if command -v inotifywait >/dev/null 2>&1; then
    printf 'inotifywait'
    return 0
  fi
  printf ''
}

runner_realtime_mark_pending() {
  local runner_id="$1"
  local public_role="$2"
  local marker_path="$3"
  local fingerprint="$4"

  if [ -f "$marker_path" ]; then
    runner_append_log "$runner_id" "realtime_wakeup" \
      "role=${public_role}" \
      "reason=inputs_changed" \
      "pending=merged" \
      "fingerprint=${fingerprint}"
    return 0
  fi

  {
    printf 'created_at=%s\n' "$(runner_now_iso)"
    printf 'role=%s\n' "$public_role"
    printf 'reason=inputs_changed\n'
    printf 'fingerprint=%s\n' "$fingerprint"
  } > "$marker_path"
  runner_append_log "$runner_id" "realtime_wakeup" \
    "role=${public_role}" \
    "reason=inputs_changed" \
    "pending=created" \
    "fingerprint=${fingerprint}"
}

runner_planner_realtime_mark_pending() {
  runner_realtime_mark_pending "$1" "planner" "$2" "$3"
}

runner_realtime_consume_pending() {
  local runner_id="$1"
  local public_role="${2:-planner}"
  local marker_path

  marker_path="$(runner_realtime_marker_path "$runner_id" "$public_role")"
  [ -f "$marker_path" ] || return 0
  rm -f "$marker_path"
  runner_append_log "$runner_id" "realtime_wakeup" \
    "role=${public_role}" \
    "reason=consumed" \
    "pending=cleared"
}

runner_planner_realtime_consume_pending() {
  runner_realtime_consume_pending "$1" "planner"
}

runner_realtime_wait_for_event() {
  local runner_id="$1"
  local public_role="$2"
  local sleep_interval="$3"
  local marker_path="$4"
  local fingerprint_path="$5"
  local previous_fingerprint="$6"
  local backend dirs_file watch_pid sleep_pid current_fingerprint dir
  local dirs=()
  local event_seen wait_status sleep_status

  backend="$(runner_realtime_watch_backend)"
  [ -n "$backend" ] || return 1

  dirs_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-realtime-dirs.XXXXXX")"
  runner_realtime_watch_dirs "$public_role" > "$dirs_file"
  if [ ! -s "$dirs_file" ]; then
    rm -f "$dirs_file"
    return 1
  fi
  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    dirs+=("$dir")
  done < "$dirs_file"
  if [ "${#dirs[@]}" -eq 0 ]; then
    rm -f "$dirs_file"
    return 1
  fi

  case "$backend" in
    chokidar)
      node --input-type=module - "$project_root" "$dirs_file" <<'NODE' >/dev/null 2>&1 &
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projectRoot, dirsFile] = process.argv.slice(2);
const requireFromProject = createRequire(pathToFileURL(join(projectRoot, 'package.json')).href);
const chokidarPath = requireFromProject.resolve('chokidar');
const { watch } = await import(pathToFileURL(chokidarPath).href);
const dirs = readFileSync(dirsFile, 'utf8').split(/\r?\n/).filter(Boolean);
let finished = false;

const watcher = watch(dirs, {
  ignoreInitial: true,
  depth: 0,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50,
  },
});

const finish = async (code = 0) => {
  if (finished) return;
  finished = true;
  try {
    await watcher.close();
  } catch {
    // Best effort cleanup; the shell parent handles timeout fallback.
  }
  process.exit(code);
};

watcher.on('all', () => {
  void finish(0);
});
watcher.on('error', () => {
  void finish(2);
});
process.on('SIGTERM', () => {
  void finish(143);
});
process.on('SIGINT', () => {
  void finish(130);
});
NODE
      ;;
    fswatch)
      fswatch -1 "${dirs[@]}" >/dev/null 2>&1 &
      ;;
    inotifywait)
      inotifywait -q -e create,modify,delete,move,attrib "${dirs[@]}" >/dev/null 2>&1 &
      ;;
    *)
      rm -f "$dirs_file"
      return 1
      ;;
  esac
  watch_pid="$!"
  sleep "$sleep_interval" &
  sleep_pid="$!"
  child_pid="$sleep_pid"
  event_seen="false"

  while kill -0 "$sleep_pid" 2>/dev/null; do
    if ! kill -0 "$watch_pid" 2>/dev/null; then
      event_seen="true"
      break
    fi
    sleep 1
  done

  if [ "$event_seen" = "true" ]; then
    kill "$sleep_pid" 2>/dev/null || true
    wait "$sleep_pid" 2>/dev/null || true
  else
    kill "$watch_pid" 2>/dev/null || true
    wait "$watch_pid" 2>/dev/null || true
    wait "$sleep_pid" 2>/dev/null || true
    rm -f "$dirs_file"
    child_pid=""
    return 0
  fi

  set +e
  wait "$watch_pid" 2>/dev/null
  wait_status="$?"
  set -e
  sleep_status=0
  child_pid=""
  rm -f "$dirs_file"

  current_fingerprint="$(runner_realtime_inputs_fingerprint "$public_role")"
  if [ -n "$current_fingerprint" ] && [ "$current_fingerprint" != "$previous_fingerprint" ]; then
    printf '%s\n' "$current_fingerprint" > "$fingerprint_path"
    runner_realtime_mark_pending "$runner_id" "$public_role" "$marker_path" "$current_fingerprint"
    runner_append_log "$runner_id" "backoff_wake" \
      "role=${public_role}" \
      "reason=realtime_watch_event" \
      "backend=${backend}" \
      "interval_seconds=${sleep_interval}" \
      "watch_exit=${wait_status}"
  elif [ "$wait_status" -ne 0 ]; then
    runner_append_log "$runner_id" "realtime_wakeup" \
      "role=${public_role}" \
      "reason=watch_backend_failed" \
      "backend=${backend}" \
      "watch_exit=${wait_status}" \
      "fallback=polling"
    return 1
  else
    runner_append_log "$runner_id" "realtime_wakeup" \
      "role=${public_role}" \
      "reason=watch_event_ignored" \
      "backend=${backend}" \
      "fingerprint=${current_fingerprint}" \
      "previous_fingerprint=${previous_fingerprint}"
  fi

  return "$sleep_status"
}

runner_tick_backoff_skip_reason() {
  local public_role="$1"

  case "$public_role" in
    planner)
      printf 'planner_inputs_unchanged'
      ;;
    ticket)
      printf 'ticket_inputs_unchanged'
      ;;
    verifier)
      printf 'verifier_inputs_unchanged'
      ;;
    *)
      printf ''
      ;;
  esac
}

runner_tick_backoff_interval_for_streak() {
  local base_interval="$1"
  local idle_streak="$2"
  local threshold max_interval multiplier effective

  threshold="$(runner_tick_backoff_threshold_idle_ticks)"
  max_interval="$(runner_tick_backoff_max_interval_seconds)"
  effective="$base_interval"

  if [ "$threshold" -le 0 ] || [ "$idle_streak" -le 0 ]; then
    printf '%s' "$effective"
    return 0
  fi

  multiplier=$((idle_streak / threshold))
  while [ "$multiplier" -gt 0 ] && [ "$effective" -lt "$max_interval" ]; do
    effective=$((effective * 2))
    if [ "$effective" -gt "$max_interval" ]; then
      effective="$max_interval"
    fi
    multiplier=$((multiplier - 1))
  done

  printf '%s' "$effective"
}

runner_tick_backoff_current_interval() {
  local runner_id="$1"
  local public_role="$2"
  local mode="$3"
  local base_interval="$4"
  local current

  if ! runner_tick_backoff_enabled "$public_role" "$mode"; then
    printf '%s' "$base_interval"
    return 0
  fi

  current="$(runner_state_value_or_empty "$runner_id" "current_interval_seconds")"
  current="$(runner_positive_integer_or_default "$current" "$base_interval")"
  if [ "$current" -lt "$base_interval" ]; then
    current="$base_interval"
  fi

  printf '%s' "$current"
}

runner_tick_backoff_idle_streak() {
  local runner_id="$1"
  local public_role="$2"
  local mode="$3"
  local base_interval="$4"
  local previous_streak current_last_result skip_reason next_streak

  if ! runner_tick_backoff_enabled "$public_role" "$mode"; then
    printf '0'
    return 0
  fi

  previous_streak="$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$runner_id" "idle_streak_count")" "0")"
  current_last_result="$(runner_state_value_or_empty "$runner_id" "last_result")"
  skip_reason="$(runner_tick_backoff_skip_reason "$public_role")"
  next_streak=0

  if [ -n "$skip_reason" ] && [ "$current_last_result" = "$skip_reason" ]; then
    next_streak=$((previous_streak + 1))
  fi

  printf '%s' "$next_streak"
}

runner_tick_backoff_next_interval() {
  local runner_id="$1"
  local public_role="$2"
  local mode="$3"
  local base_interval="$4"
  local next_streak

  if ! runner_tick_backoff_enabled "$public_role" "$mode"; then
    printf '%s' "$base_interval"
    return 0
  fi

  next_streak="$(runner_tick_backoff_idle_streak "$runner_id" "$public_role" "$mode" "$base_interval")"
  runner_tick_backoff_interval_for_streak "$base_interval" "$next_streak"
}

runner_role_queue_has_entries() {
  local public_role="$1"
  local candidate

  case "$public_role" in
    planner)
      for candidate in \
        "${board_root}/tickets/inbox" \
        "${board_root}/tickets/backlog" \
        "${board_root}/tickets/reject"
      do
        find "$candidate" -maxdepth 1 -type f -name '*.md' -print -quit 2>/dev/null | grep -q . && return 0
      done
      ;;
    ticket)
      find "${board_root}/tickets/todo" -maxdepth 1 -type f -name 'tickets_*.md' -print -quit 2>/dev/null | grep -q . && return 0
      ;;
    verifier)
      find "${board_root}/tickets/verifier" -maxdepth 1 -type f -name 'tickets_*.md' -print -quit 2>/dev/null | grep -q . && return 0
      ;;
  esac

  return 1
}

runner_should_drain_queue_now() {
  local public_role="$1"
  local last_result="$2"
  local run_exit="$3"

  [ "$run_exit" = "0" ] || return 1
  case "$last_result" in
    adapter_exit_0|success) ;;
    *) return 1 ;;
  esac
  runner_role_queue_has_entries "$public_role"
}

runner_tick_backoff_sleep() {
  local runner_id="$1"
  local public_role="$2"
  local mode="$3"
  local base_interval="$4"
  local sleep_interval="$5"
  local fingerprint_path previous_fingerprint current_fingerprint remaining chunk
  local realtime_enabled realtime_fingerprint_path realtime_marker_path previous_realtime_fingerprint current_realtime_fingerprint

  if ! runner_tick_backoff_enabled "$public_role" "$mode"; then
    if ! runner_realtime_enabled "$public_role" "$mode"; then
      sleep "$sleep_interval" &
      child_pid="$!"
      wait "$child_pid" || true
      child_pid=""
      return 0
    fi
  fi

  realtime_enabled="false"
  previous_realtime_fingerprint=""
  if runner_realtime_enabled "$public_role" "$mode"; then
    realtime_enabled="true"
    realtime_fingerprint_path="$(runner_realtime_fingerprint_path "$runner_id" "$public_role")"
    realtime_marker_path="$(runner_realtime_marker_path "$runner_id" "$public_role")"
    current_realtime_fingerprint="$(runner_realtime_inputs_fingerprint "$public_role")"
    previous_realtime_fingerprint="$current_realtime_fingerprint"
    printf '%s\n' "$current_realtime_fingerprint" > "$realtime_fingerprint_path"
    if runner_realtime_wait_for_event "$runner_id" "$public_role" "$sleep_interval" "$realtime_marker_path" "$realtime_fingerprint_path" "$previous_realtime_fingerprint"; then
      return 0
    fi
  fi

  if [ "$sleep_interval" -le "$base_interval" ] && [ "$realtime_enabled" != "true" ]; then
    sleep "$sleep_interval" &
    child_pid="$!"
    wait "$child_pid" || true
    child_pid=""
    return 0
  fi

  fingerprint_path="$(runner_idle_preflight_fingerprint_path "$runner_id" "$public_role")"
  if [ ! -f "$fingerprint_path" ] && [ "$realtime_enabled" != "true" ]; then
    sleep "$sleep_interval" &
    child_pid="$!"
    wait "$child_pid" || true
    child_pid=""
    return 0
  fi
  previous_fingerprint="$(cat "$fingerprint_path" 2>/dev/null || true)"
  if [ -z "$previous_fingerprint" ] && [ "$realtime_enabled" != "true" ]; then
    sleep "$sleep_interval" &
    child_pid="$!"
    wait "$child_pid" || true
    child_pid=""
    return 0
  fi

  remaining="$sleep_interval"
  while [ "$remaining" -gt 0 ]; do
    if [ "$realtime_enabled" = "true" ]; then
      current_realtime_fingerprint="$(runner_realtime_inputs_fingerprint "$public_role")"
      if [ -n "$current_realtime_fingerprint" ] && [ "$current_realtime_fingerprint" != "$previous_realtime_fingerprint" ]; then
        printf '%s\n' "$current_realtime_fingerprint" > "$realtime_fingerprint_path"
        runner_realtime_mark_pending "$runner_id" "$public_role" "$realtime_marker_path" "$current_realtime_fingerprint"
        runner_append_log "$runner_id" "backoff_wake" \
          "role=${public_role}" \
          "reason=realtime_inputs_changed" \
          "interval_seconds=${sleep_interval}" \
          "remaining_seconds=${remaining}"
        return 0
      fi
    fi

    if [ "$sleep_interval" -gt "$base_interval" ] && [ -n "$previous_fingerprint" ]; then
      current_fingerprint="$(runner_idle_preflight_inputs_fingerprint "$public_role")"
    else
      current_fingerprint=""
    fi
    if [ -n "$current_fingerprint" ] && [ "$current_fingerprint" != "$previous_fingerprint" ]; then
      runner_append_log "$runner_id" "backoff_wake" \
        "role=${public_role}" \
        "reason=inputs_changed" \
        "interval_seconds=${sleep_interval}" \
        "remaining_seconds=${remaining}"
      return 0
    fi

    chunk=1
    if [ "$remaining" -lt "$chunk" ]; then
      chunk="$remaining"
    fi
    sleep "$chunk" &
    child_pid="$!"
    wait "$child_pid" || true
    child_pid=""
    remaining=$((remaining - chunk))
  done

  return 0
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
  realtime_enabled="$(runner_field_from_block "$runner_block" "realtime_enabled")"
  command_value="$(runner_field_from_block "$runner_block" "command")"

  [ -n "$enabled" ] || enabled="true"
  [ -n "$realtime_enabled" ] || realtime_enabled="false"
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
  local timestamp previous_pid existing_pid loop_pid stdout_file stderr_file run_role orphan_stopped_count

  load_runner_or_block "$target_runner_id" || return 0

  if [ "$mode" = "loop" ]; then
    previous_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
    if runner_pid_is_running "$previous_pid"; then
      orphan_stopped_count="$(runner_stop_orphan_loop_workers "$target_runner_id" "$previous_pid")"
      timestamp="$(runner_now_iso)"
      print_runner_action_result "ok" "already_running" "$target_runner_id" "running" "$timestamp" "$previous_pid"
      printf 'stdout=%s\n' "$(runner_loop_stdout_path "$target_runner_id")"
      printf 'stderr=%s\n' "$(runner_loop_stderr_path "$target_runner_id")"
      printf 'orphan_loop_workers_stopped=%s\n' "$orphan_stopped_count"
      return 0
    fi

    existing_pid="$(runner_existing_loop_worker_pid "$target_runner_id" "$previous_pid")"
    if runner_pid_is_running "$existing_pid"; then
      orphan_stopped_count="$(runner_stop_orphan_loop_workers "$target_runner_id" "$existing_pid")"
      timestamp="$(runner_now_iso)"
      runner_write_state "$target_runner_id" \
        "status=running" \
        "role=${role}" \
        "agent=${agent}" \
        "mode=${mode}" \
        "interval_seconds=${interval_seconds}" \
        "model=${model}" \
        "reasoning=${reasoning}" \
        $(runner_applied_config_state_fields "$target_runner_id") \
        "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
        "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
        "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
        "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
        "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
        "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
        "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
        "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
        "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
        "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
        "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
        "pid=${existing_pid}" \
        "started_at=${timestamp}" \
        "last_event_at=${timestamp}" \
        "stopped_by=" \
        "last_stop_reason=" \
        "last_result=loop_adopted"
      runner_append_log "$target_runner_id" "loop_adopt" \
        "status=running" \
        "role=${role}" \
        "mode=${mode}" \
        "pid=${existing_pid}" \
        "orphan_loop_workers_stopped=${orphan_stopped_count}"
      print_runner_action_result "ok" "already_running_adopted" "$target_runner_id" "running" "$timestamp" "$existing_pid"
      printf 'stdout=%s\n' "$(runner_loop_stdout_path "$target_runner_id")"
      printf 'stderr=%s\n' "$(runner_loop_stderr_path "$target_runner_id")"
      printf 'orphan_loop_workers_stopped=%s\n' "$orphan_stopped_count"
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
      "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
      "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
      "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
      "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
      "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
      "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
      "pid=${loop_pid}" \
      "started_at=${timestamp}" \
      "last_event_at=${timestamp}" \
      "stopped_by=" \
      "last_stop_reason=" \
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
    "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
    "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
    "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
    "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
    "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
    "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
    "pid=" \
    "started_at=${timestamp}" \
    "last_event_at=${timestamp}" \
    "stopped_by=" \
    "last_stop_reason="
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
  local timestamp previous_status previous_pid started_at result orphan_stopped_count

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
  orphan_stopped_count="$(runner_stop_orphan_loop_workers "$target_runner_id" "")"
  if [ "$orphan_stopped_count" != "0" ]; then
    result="${result}_orphan_loop_workers_${orphan_stopped_count}"
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
    "last_event_at=${timestamp}" \
    "stopped_by=user" \
    "last_stop_reason=user_requested" \
    "last_result=user_stopped"
  runner_append_log "$target_runner_id" "stop" \
    "status=stopped" \
    "previous_status=${previous_status:-unknown}" \
    "orphan_loop_workers_stopped=${orphan_stopped_count}" \
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
    "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
    "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
    "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
    "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
    "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
    "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
    "pid=" \
    "started_at=${timestamp}" \
    "last_event_at=${timestamp}" \
    "stopped_by=" \
    "last_stop_reason="
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
  local run_role public_role interval started_at loop_pid child_pid run_exit current_status current_mode current_enabled current_interval timestamp stopping_loop last_result existing_stopped_by stop_reason
  local pressure_snapshot pressure_reason pressure_user_count pressure_user_limit pressure_runner_child_count pressure_runner_child_limit
  local backoff_interval backoff_idle_streak state_pid lock_owner_pid

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
  public_role="$(runner_public_role "$role")"

  interval="$(runner_normalize_interval_seconds "${AUTOFLOW_RUNNER_LOOP_INTERVAL_SECONDS:-$interval_seconds}")"

  started_at="$(runner_now_iso)"
  loop_pid="${BASHPID:-$$}"
  child_pid=""
  stopping_loop="false"

  if ! runner_acquire_loop_lock "$target_runner_id" "$loop_pid"; then
    lock_owner_pid="$(cat "$(runner_loop_lock_pid_path "$target_runner_id")" 2>/dev/null || true)"
    runner_append_log "$target_runner_id" "loop_worker_duplicate_exit" \
      "status=stopped" \
      "role=${role}" \
      "mode=${mode}" \
      "pid=${loop_pid}" \
      "owner_pid=${lock_owner_pid}" \
      "reason=loop_lock_held"
    return 0
  fi

  stop_loop() {
    stopping_loop="true"
    if [ -n "${child_pid:-}" ] && runner_pid_is_running "$child_pid"; then
      runner_kill_process_tree "$child_pid"
    fi
    timestamp="$(runner_now_iso)"
    if ! runner_loop_state_owned_by_pid "$target_runner_id" "$loop_pid"; then
      state_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
      runner_release_loop_lock "$target_runner_id" "$loop_pid"
      runner_append_log "$target_runner_id" "loop_stop_state_write_skipped" \
        "status=stale_loop" \
        "role=${role}" \
        "mode=${mode}" \
        "pid=${loop_pid}" \
        "state_pid=${state_pid}" \
        "reason=state_pid_changed"
      exit 0
    fi
    existing_stopped_by="$(runner_state_value_or_empty "$target_runner_id" "stopped_by")"
    if [ "$existing_stopped_by" = "user" ]; then
      stop_reason="user_requested"
    else
      existing_stopped_by=""
      stop_reason="parent_terminated"
    fi
    runner_write_state "$target_runner_id" \
      "status=stopped" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "current_interval_seconds=$(runner_tick_backoff_current_interval "$target_runner_id" "$public_role" "$mode" "$interval")" \
      "idle_streak_count=$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$target_runner_id" "idle_streak_count")" "0")" \
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
      "stopped_by=${existing_stopped_by}" \
      "last_stop_reason=${stop_reason}" \
      "last_result=loop_stopped"
    runner_release_loop_lock "$target_runner_id" "$loop_pid"
    runner_append_log "$target_runner_id" "loop_stop" \
      "status=stopped" \
      "role=${role}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "pid=${loop_pid}" \
      "child_cleanup=process_tree"
    exit 0
  }

  unexpected_loop_exit() {
    if [ "${stopping_loop:-false}" = "true" ]; then
      return 0
    fi
    timestamp="$(runner_now_iso)"
    if ! runner_loop_state_owned_by_pid "$target_runner_id" "$loop_pid"; then
      state_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
      runner_release_loop_lock "$target_runner_id" "$loop_pid"
      runner_append_log "$target_runner_id" "loop_exit_state_write_skipped" \
        "status=stale_loop" \
        "role=${role}" \
        "mode=${mode}" \
        "pid=${loop_pid}" \
        "state_pid=${state_pid}" \
        "reason=state_pid_changed"
      return 0
    fi
    runner_write_state "$target_runner_id" \
      "status=stopped" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "current_interval_seconds=$(runner_tick_backoff_current_interval "$target_runner_id" "$public_role" "$mode" "$interval")" \
      "idle_streak_count=$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$target_runner_id" "idle_streak_count")" "0")" \
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
      "stopped_by=" \
      "last_stop_reason=unexpected_exit" \
      "last_result=loop_exited_unexpectedly"
    runner_release_loop_lock "$target_runner_id" "$loop_pid"
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
    "current_interval_seconds=${interval}" \
    "idle_streak_count=0" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
    "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
    "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
    "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
    "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
    "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
    "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
    "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
    "pid=${loop_pid}" \
    "started_at=${started_at}" \
    "last_event_at=${started_at}" \
    "stopped_by=" \
    "last_stop_reason=" \
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
    backoff_interval="$(runner_tick_backoff_current_interval "$target_runner_id" "$public_role" "$mode" "$interval")"
    if [ "$current_enabled" != "true" ] || [ "$current_mode" != "loop" ]; then
      break
    fi

    current_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
    state_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
    if [ -n "$state_pid" ] && [ "$state_pid" != "$loop_pid" ]; then
      runner_append_log "$target_runner_id" "stale_loop_worker_exit" \
        "role=${role}" \
        "mode=${mode}" \
        "pid=${loop_pid}" \
        "state_pid=${state_pid}" \
        "reason=state_pid_changed_before_tick"
      stopping_loop="true"
      runner_release_loop_lock "$target_runner_id" "$loop_pid"
      exit 0
    fi
    if [ "$current_status" = "stopped" ]; then
      break
    fi

    loop_stdout_file="$(runner_loop_stdout_path "$target_runner_id")"
    loop_stderr_file="$(runner_loop_stderr_path "$target_runner_id")"
    rotate_loop_log_if_needed "$loop_stdout_file"
    rotate_loop_log_if_needed "$loop_stderr_file"

    pressure_snapshot="$(runner_process_pressure_snapshot "$loop_pid")"
    pressure_reason="$(printf '%s\n' "$pressure_snapshot" | runner_process_pressure_reason)"
    if [ "$pressure_reason" != "ok" ]; then
      pressure_user_count="$(printf '%s\n' "$pressure_snapshot" | awk -F= '$1 == "user_process_count" { print $2; exit }')"
      pressure_user_limit="$(printf '%s\n' "$pressure_snapshot" | awk -F= '$1 == "user_process_limit" { print $2; exit }')"
      pressure_runner_child_count="$(printf '%s\n' "$pressure_snapshot" | awk -F= '$1 == "runner_child_count" { print $2; exit }')"
      pressure_runner_child_limit="$(printf '%s\n' "$pressure_snapshot" | awk -F= '$1 == "runner_child_limit" { print $2; exit }')"
      timestamp="$(runner_now_iso)"
      runner_write_state "$target_runner_id" \
        "status=running" \
        "role=${role}" \
        "agent=${agent}" \
        "mode=${mode}" \
        "interval_seconds=${interval}" \
        "current_interval_seconds=${backoff_interval}" \
        "idle_streak_count=$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$target_runner_id" "idle_streak_count")" "0")" \
        "model=${model}" \
        "reasoning=${reasoning}" \
        "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
        "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
        "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
        "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
        "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
        "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
        "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
        "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
        "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
        "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
        "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
        "pid=${loop_pid}" \
        "started_at=${started_at}" \
        "last_event_at=${timestamp}" \
        "stopped_by=" \
        "last_stop_reason=" \
        "last_result=process_pressure_guard" \
        "process_pressure_reason=${pressure_reason}" \
        "process_pressure_user_count=${pressure_user_count}" \
        "process_pressure_user_limit=${pressure_user_limit}" \
        "process_pressure_runner_child_count=${pressure_runner_child_count}" \
        "process_pressure_runner_child_limit=${pressure_runner_child_limit}"
      runner_append_log "$target_runner_id" "process_pressure_guard" \
        "role=${role}" \
        "mode=${mode}" \
        "reason=${pressure_reason}" \
        "user_process_count=${pressure_user_count}" \
        "user_process_limit=${pressure_user_limit}" \
        "runner_child_count=${pressure_runner_child_count}" \
        "runner_child_limit=${pressure_runner_child_limit}" \
        "action=skip_tick"
      runner_tick_backoff_sleep "$target_runner_id" "$public_role" "$mode" "$interval" "$backoff_interval"
      continue
    fi

    if runner_realtime_enabled "$public_role" "$mode"; then
      runner_realtime_consume_pending "$target_runner_id" "$public_role"
    fi

    AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT=1 "$SCRIPT_DIR/run-role.sh" "$run_role" "$project_root" "$board_dir_name" --runner "$target_runner_id" >>"$loop_stdout_file" 2>>"$loop_stderr_file" &
    child_pid="$!"
    set +e
    wait "$child_pid"
    run_exit="$?"
    set -e
    child_pid=""

    current_status="$(runner_state_value_or_empty "$target_runner_id" "status")"
    state_pid="$(runner_state_value_or_empty "$target_runner_id" "pid")"
    if [ -n "$state_pid" ] && [ "$state_pid" != "$loop_pid" ]; then
      runner_append_log "$target_runner_id" "stale_loop_worker_exit" \
        "role=${role}" \
        "mode=${mode}" \
        "pid=${loop_pid}" \
        "state_pid=${state_pid}" \
        "reason=state_pid_changed_after_tick"
      stopping_loop="true"
      runner_release_loop_lock "$target_runner_id" "$loop_pid"
      exit 0
    fi
    if [ "$current_status" = "stopped" ]; then
      break
    fi

    last_result="$(runner_state_value_or_empty "$target_runner_id" "last_result")"
    if [ "$run_exit" = "125" ] && [ "$last_result" = "adapter_auth_required" ]; then
      timestamp="$(runner_now_iso)"
      runner_write_state "$target_runner_id" \
        "status=blocked" \
        "role=${role}" \
        "agent=${agent}" \
        "mode=${mode}" \
        "interval_seconds=${interval}" \
        "current_interval_seconds=$(runner_tick_backoff_current_interval "$target_runner_id" "$public_role" "$mode" "$interval")" \
        "idle_streak_count=$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$target_runner_id" "idle_streak_count")" "0")" \
        "model=${model}" \
        "reasoning=${reasoning}" \
        $(runner_applied_config_state_fields "$target_runner_id") \
        "active_item=" \
        "active_ticket_id=" \
        "active_ticket_title=" \
        "active_stage=blocked" \
        "active_spec_ref=" \
        "pid=" \
        "started_at=${started_at}" \
        "last_event_at=${timestamp}" \
        "last_runtime_log=$(runner_state_value_or_empty "$target_runner_id" "last_runtime_log")" \
        "last_prompt_log=$(runner_state_value_or_empty "$target_runner_id" "last_prompt_log")" \
        "last_stdout_log=$(runner_state_value_or_empty "$target_runner_id" "last_stdout_log")" \
        "last_stderr_log=$(runner_state_value_or_empty "$target_runner_id" "last_stderr_log")" \
        "stopped_by=" \
        "last_stop_reason=adapter_auth_required" \
        "last_result=adapter_auth_required"
      runner_append_log "$target_runner_id" "loop_blocked" \
        "role=${role}" \
        "mode=${mode}" \
        "reason=adapter_auth_required" \
        "action=await_user_auth_choice" \
        "exit_code=${run_exit}"
      stopping_loop="true"
      exit 0
    fi

    timestamp="$(runner_now_iso)"
    if [ "$run_exit" != "0" ]; then
      last_result="loop_waiting_exit_${run_exit}"
    else
      case "$last_result" in
        ""|loop_started|loop_running|loop_waiting_exit_*)
          last_result="loop_waiting_exit_${run_exit}"
          ;;
      esac
    fi
    backoff_idle_streak="$(runner_tick_backoff_idle_streak "$target_runner_id" "$public_role" "$mode" "$interval")"
    backoff_interval="$(runner_tick_backoff_next_interval "$target_runner_id" "$public_role" "$mode" "$interval")"
    runner_write_state "$target_runner_id" \
      "status=running" \
      "role=${role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "interval_seconds=${interval}" \
      "current_interval_seconds=${backoff_interval}" \
      "idle_streak_count=${backoff_idle_streak}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=$(runner_active_state_value "$target_runner_id" "active_item")" \
      "active_ticket_id=$(runner_active_state_value "$target_runner_id" "active_ticket_id")" \
      "active_ticket_title=$(runner_active_state_value "$target_runner_id" "active_ticket_title")" \
      "active_stage=$(runner_active_state_value "$target_runner_id" "active_stage")" \
      "active_spec_ref=$(runner_active_state_value "$target_runner_id" "active_spec_ref")" \
      "active_recovery_reason=$(runner_active_state_value "$target_runner_id" "active_recovery_reason")" \
      "active_recovery_status=$(runner_active_state_value "$target_runner_id" "active_recovery_status")" \
      "active_recovery_failure_class=$(runner_active_state_value "$target_runner_id" "active_recovery_failure_class")" \
      "active_recovery_worktree_path=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_path")" \
      "active_recovery_worktree_status=$(runner_active_state_value "$target_runner_id" "active_recovery_worktree_status")" \
      "active_recovery_board_state=$(runner_active_state_value "$target_runner_id" "active_recovery_board_state")" \
      "pid=${loop_pid}" \
      "started_at=${started_at}" \
      "last_event_at=${timestamp}" \
      "stopped_by=" \
      "last_stop_reason=" \
      "last_result=${last_result}"
    runner_append_log "$target_runner_id" "loop_tick" \
      "role=${role}" \
      "mode=${mode}" \
      "exit_code=${run_exit}" \
      "interval_seconds=${interval}" \
      "interval_effective_seconds=${backoff_interval}" \
      "idle_streak_count=${backoff_idle_streak}"

    if runner_should_drain_queue_now "$public_role" "$last_result" "$run_exit"; then
      runner_append_log "$target_runner_id" "queue_drain_continue" \
        "role=${role}" \
        "mode=${mode}" \
        "reason=queue_entries_remain" \
        "interval_seconds=${interval}"
      continue
    fi

    runner_tick_backoff_sleep "$target_runner_id" "$public_role" "$mode" "$interval" "$backoff_interval"
  done

  stop_loop
}

set_runner_config() {
  local target_runner_id="$1"
  local pair key value updates_file temp_file timestamp updated_count

  ensure_runner_config_write_path_or_block "$target_runner_id" || return 0

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

maybe_sync_heartbeat_set_workers() {
  # Heartbeat TOML is a legacy/rendered automation source. Runner config
  # changes should not dirty it unless an operator explicitly opts in.
  case "${AUTOFLOW_RUNNERS_SYNC_HEARTBEAT_SET:-0}" in
    1|true|TRUE|yes|YES|on|ON)
      sync_heartbeat_set_workers || true
      ;;
  esac
}

add_runner_config() {
  local target_runner_id="$1"
  local target_role="$2"
  local pair key value timestamp updated_count
  local agent_value model_value reasoning_value mode_value interval_seconds_value enabled_value realtime_enabled_value command_value

  ensure_runner_config_write_path_or_block "$target_runner_id" || return 0

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
  realtime_enabled_value="false"
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
      realtime_enabled) realtime_enabled_value="$value" ;;
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
    printf 'realtime_enabled = %s\n' "$(runner_toml_value "realtime_enabled" "$realtime_enabled_value")"
    printf 'command = %s\n' "$(runner_toml_value "command" "$command_value")"
  } >> "$config_path"

  maybe_sync_heartbeat_set_workers

  timestamp="$(runner_now_iso)"
  runner_append_log "$target_runner_id" "config_add" \
    "status=ok" \
    "role=${target_role}" \
    "agent=${agent_value}" \
    "mode=${mode_value}" \
    "interval_seconds=${interval_seconds_value}" \
    "realtime_enabled=${realtime_enabled_value}" \
    "updated_count=${updated_count}"

  print_runner_common_header "ok"
  printf 'result=runner_added\n'
  printf 'runner_id=%s\n' "$target_runner_id"
  printf 'role=%s\n' "$target_role"
  printf 'agent=%s\n' "$agent_value"
  printf 'mode=%s\n' "$mode_value"
  printf 'interval_seconds=%s\n' "$interval_seconds_value"
  printf 'realtime_enabled=%s\n' "$realtime_enabled_value"
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

  ensure_runner_config_write_path_or_block "$target_runner_id" || return 0

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
  maybe_sync_heartbeat_set_workers
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
  local id role agent model reasoning mode interval_seconds enabled realtime_enabled command
  local state_path log_path state_status effective_state_status active_item active_ticket_id active_ticket_title active_stage active_spec_ref
  local active_recovery_reason active_recovery_status active_recovery_failure_class
  local active_recovery_worktree_path active_recovery_worktree_status active_recovery_board_state
  local pid started_at last_event_at last_adapter_chunk_at last_result last_log_line
  local last_runtime_log last_prompt_log last_stdout_log last_stderr_log artifact_status
  local artifact_runtime_status artifact_prompt_status artifact_stdout_status artifact_stderr_status
  local current_interval_seconds effective_interval_seconds idle_streak_count
  local consecutive_preflight_skip_count consecutive_preflight_skip_result last_preflight_skip_at
  local preflight_skip_circuit_breaker_until preflight_skip_circuit_breaker_threshold

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
  realtime_enabled=""
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
        realtime_enabled=""
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
          active_recovery_reason="$(runner_state_value_or_empty "$id" "active_recovery_reason")"
          active_recovery_status="$(runner_state_value_or_empty "$id" "active_recovery_status")"
          active_recovery_failure_class="$(runner_state_value_or_empty "$id" "active_recovery_failure_class")"
          active_recovery_worktree_path="$(runner_state_value_or_empty "$id" "active_recovery_worktree_path")"
          active_recovery_worktree_status="$(runner_state_value_or_empty "$id" "active_recovery_worktree_status")"
          active_recovery_board_state="$(runner_state_value_or_empty "$id" "active_recovery_board_state")"
          pid="$(runner_state_value_or_empty "$id" "pid")"
          started_at="$(runner_state_value_or_empty "$id" "started_at")"
          last_event_at="$(runner_state_value_or_empty "$id" "last_event_at")"
          last_adapter_chunk_at="$(runner_state_value_or_empty "$id" "last_adapter_chunk_at")"
          last_result="$(runner_state_value_or_empty "$id" "last_result")"
          last_runtime_log="$(runner_state_value_or_empty "$id" "last_runtime_log")"
          last_prompt_log="$(runner_state_value_or_empty "$id" "last_prompt_log")"
          last_stdout_log="$(runner_state_value_or_empty "$id" "last_stdout_log")"
          last_stderr_log="$(runner_state_value_or_empty "$id" "last_stderr_log")"
          current_interval_seconds="$(runner_state_value_or_empty "$id" "current_interval_seconds")"
          consecutive_preflight_skip_count="$(runner_state_value_or_empty "$id" "consecutive_preflight_skip_count")"
          consecutive_preflight_skip_result="$(runner_state_value_or_empty "$id" "consecutive_preflight_skip_result")"
          last_preflight_skip_at="$(runner_state_value_or_empty "$id" "last_preflight_skip_at")"
          preflight_skip_circuit_breaker_until="$(runner_state_value_or_empty "$id" "preflight_skip_circuit_breaker_until")"
          preflight_skip_circuit_breaker_threshold="$(runner_state_value_or_empty "$id" "preflight_skip_circuit_breaker_threshold")"
          idle_streak_count="$(runner_positive_integer_or_default "$(runner_state_value_or_empty "$id" "idle_streak_count")" "0")"
          artifact_status="$(runner_artifact_status "$last_runtime_log" "$last_prompt_log" "$last_stdout_log" "$last_stderr_log")"
          artifact_runtime_status="$(runner_artifact_path_status "$last_runtime_log")"
          artifact_prompt_status="$(runner_artifact_path_status "$last_prompt_log")"
          artifact_stdout_status="$(runner_artifact_path_status "$last_stdout_log")"
          artifact_stderr_status="$(runner_artifact_path_status "$last_stderr_log")"
          last_log_line="$(runner_log_tail_line "$id")"
          [ -n "$state_status" ] || state_status="idle"
          effective_state_status="$(runner_effective_state_status "$state_status" "$mode" "$pid")"
          if [ "$effective_state_status" != "$state_status" ]; then
            last_result="stale_pid"
          else
            last_result="$(runner_display_last_result "$id" "$last_result")"
          fi
          pid="$(runner_effective_state_pid "$state_status" "$mode" "$pid")"
          state_status="$effective_state_status"
          if [ "$state_status" != "running" ]; then
            active_item=""
            active_ticket_id=""
            active_ticket_title=""
            active_stage=""
            active_spec_ref=""
            active_recovery_reason=""
            active_recovery_status=""
            active_recovery_failure_class=""
            active_recovery_worktree_path=""
            active_recovery_worktree_status=""
            active_recovery_board_state=""
            last_adapter_chunk_at=""
          fi
          effective_interval_seconds="$(runner_normalize_interval_seconds "$interval_seconds")"
          if [ -n "$current_interval_seconds" ]; then
            effective_interval_seconds="$(runner_normalize_interval_seconds "$current_interval_seconds")"
          fi

          printf 'runner.%s.id=%s\n' "$index" "$id"
          printf 'runner.%s.role=%s\n' "$index" "$role"
          printf 'runner.%s.agent=%s\n' "$index" "$agent"
          printf 'runner.%s.model=%s\n' "$index" "$model"
          printf 'runner.%s.reasoning=%s\n' "$index" "$reasoning"
          printf 'runner.%s.mode=%s\n' "$index" "$mode"
          printf 'runner.%s.interval_seconds=%s\n' "$index" "${interval_seconds:-60}"
          printf 'runner.%s.realtime_enabled=%s\n' "$index" "${realtime_enabled:-false}"
          printf 'runner.%s.interval_effective_seconds=%s\n' "$index" "$effective_interval_seconds"
          printf 'runner.%s.current_interval_seconds=%s\n' "$index" "$effective_interval_seconds"
          printf 'runner.%s.idle_streak_count=%s\n' "$index" "$idle_streak_count"
          printf 'runner.%s.consecutive_preflight_skip_count=%s\n' "$index" "$consecutive_preflight_skip_count"
          printf 'runner.%s.consecutive_preflight_skip_result=%s\n' "$index" "$consecutive_preflight_skip_result"
          printf 'runner.%s.last_preflight_skip_at=%s\n' "$index" "$last_preflight_skip_at"
          printf 'runner.%s.preflight_skip_circuit_breaker_until=%s\n' "$index" "$preflight_skip_circuit_breaker_until"
          printf 'runner.%s.preflight_skip_circuit_breaker_threshold=%s\n' "$index" "$preflight_skip_circuit_breaker_threshold"
          printf 'runner.%s.enabled=%s\n' "$index" "$enabled"
          printf 'runner.%s.command=%s\n' "$index" "$command"
          printf 'runner.%s.command_preview=%s\n' "$index" "$(runner_command_preview "$id" "$role" "$agent" "$mode" "$model" "$reasoning" "$interval_seconds" "$command")"
          printf 'runner.%s.state_status=%s\n' "$index" "$state_status"
          printf 'runner.%s.active_item=%s\n' "$index" "$active_item"
          printf 'runner.%s.active_ticket_id=%s\n' "$index" "$active_ticket_id"
          printf 'runner.%s.active_ticket_title=%s\n' "$index" "$active_ticket_title"
          printf 'runner.%s.active_stage=%s\n' "$index" "$active_stage"
          printf 'runner.%s.active_spec_ref=%s\n' "$index" "$active_spec_ref"
          printf 'runner.%s.active_recovery_reason=%s\n' "$index" "$active_recovery_reason"
          printf 'runner.%s.active_recovery_status=%s\n' "$index" "$active_recovery_status"
          printf 'runner.%s.active_recovery_failure_class=%s\n' "$index" "$active_recovery_failure_class"
          printf 'runner.%s.active_recovery_worktree_path=%s\n' "$index" "$active_recovery_worktree_path"
          printf 'runner.%s.active_recovery_worktree_status=%s\n' "$index" "$active_recovery_worktree_status"
          printf 'runner.%s.active_recovery_board_state=%s\n' "$index" "$active_recovery_board_state"
          printf 'runner.%s.pid=%s\n' "$index" "$pid"
          printf 'runner.%s.started_at=%s\n' "$index" "$started_at"
          printf 'runner.%s.last_event_at=%s\n' "$index" "$last_event_at"
          printf 'runner.%s.last_adapter_chunk_at=%s\n' "$index" "$last_adapter_chunk_at"
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
            realtime_enabled) realtime_enabled="$value" ;;
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
