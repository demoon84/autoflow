#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

watch_pid_is_running() {
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

usage() {
  echo "Usage: $(basename "$0") [--background|--stop|--status] [project-root] [board-dir-name] [config-path]" >&2
}

background_mode="false"
stop_mode="false"
status_mode="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --background)
      background_mode="true"
      shift
      ;;
    --stop)
      stop_mode="true"
      shift
      ;;
    --status)
      status_mode="true"
      shift
      ;;
    *)
      break
      ;;
  esac
done

mode_count=0
[ "$background_mode" = "true" ] && mode_count=$((mode_count + 1))
[ "$stop_mode" = "true" ] && mode_count=$((mode_count + 1))
[ "$status_mode" = "true" ] && mode_count=$((mode_count + 1))
if [ "$mode_count" -gt 1 ]; then
  usage
  exit 1
fi

if [ $# -gt 3 ]; then
  usage
  exit 1
fi

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"
config_path_input="${3:-}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

if [ ! -d "$board_root" ] || ! board_is_initialized "$board_root"; then
  echo "Autoflow board is not initialized at: ${board_root}" >&2
  exit 1
fi

watch_script="${board_root}/scripts/watch-board.sh"
if [ ! -x "$watch_script" ]; then
  echo "Board watcher script is missing or not executable: ${watch_script}" >&2
  exit 1
fi

hooks_log_dir="${board_root}/logs/hooks"
mkdir -p "$hooks_log_dir"
pid_file="${hooks_log_dir}/watch-board.pid"

if [ -n "$config_path_input" ]; then
  config_path="$(normalize_input_path "$config_path_input")"
  if [ ! -f "$config_path" ]; then
    echo "Hook config not found: ${config_path_input}" >&2
    exit 1
  fi
  config_path="$(cd "$(dirname "$config_path")" && pwd)/$(basename "$config_path")"
else
  config_path=""
fi

if [ "$status_mode" = "true" ]; then
  printf 'board_root=%s\n' "$board_root"
  printf 'pid_file=%s\n' "$pid_file"
  if [ ! -f "$pid_file" ]; then
    printf 'status=not_running\n'
    exit 0
  fi

  watch_pid="$(tr -d '\r\n' < "$pid_file")"
  printf 'pid=%s\n' "$watch_pid"
  if watch_pid_is_running "$watch_pid"; then
    printf 'status=running\n'
    printf 'stdout=%s\n' "${hooks_log_dir}/watch-board.stdout.log"
    printf 'stderr=%s\n' "${hooks_log_dir}/watch-board.stderr.log"
  else
    printf 'status=stale_pid\n'
  fi
  exit 0
fi

if [ "$stop_mode" = "true" ]; then
  if [ ! -f "$pid_file" ]; then
    printf 'status=not_running\n'
    printf 'pid_file=%s\n' "$pid_file"
    exit 0
  fi

  watch_pid="$(tr -d '\r\n' < "$pid_file")"
  if watch_pid_is_running "$watch_pid"; then
    if ! kill "$watch_pid" 2>/dev/null; then
      printf 'status=stop_failed\n'
      printf 'reason=process_signal_failed\n'
      printf 'pid=%s\n' "$watch_pid"
      printf 'pid_file=%s\n' "$pid_file"
      exit 0
    fi
    rm -f "$pid_file"
    printf 'status=stopped\n'
    printf 'pid=%s\n' "$watch_pid"
    printf 'pid_file=%s\n' "$pid_file"
    exit 0
  fi

  rm -f "$pid_file"
  printf 'status=stale_pid_removed\n'
  printf 'pid=%s\n' "$watch_pid"
  printf 'pid_file=%s\n' "$pid_file"
  exit 0
fi

watch_args=(--board-root "$board_root")
if [ -n "$config_path" ]; then
  watch_args+=(--config-path "$config_path")
fi

if [ "$background_mode" = "true" ]; then
  if [ -f "$pid_file" ]; then
    existing_pid="$(tr -d '\r\n' < "$pid_file")"
    if watch_pid_is_running "$existing_pid"; then
      printf 'status=already_running\n'
      printf 'pid=%s\n' "$existing_pid"
      printf 'pid_file=%s\n' "$pid_file"
      exit 0
    fi
  fi

  stdout_file="${hooks_log_dir}/watch-board.stdout.log"
  stderr_file="${hooks_log_dir}/watch-board.stderr.log"
  nohup "$watch_script" "${watch_args[@]}" >"$stdout_file" 2>"$stderr_file" &
  watch_pid="$!"
  printf '%s' "$watch_pid" >"$pid_file"
  printf 'status=started\n'
  printf 'pid=%s\n' "$watch_pid"
  printf 'pid_file=%s\n' "$pid_file"
  printf 'stdout=%s\n' "$stdout_file"
  printf 'stderr=%s\n' "$stderr_file"
  exit 0
fi

exec "$watch_script" "${watch_args[@]}"
