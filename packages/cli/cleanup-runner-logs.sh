#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF2' >&2
Usage:
  cleanup-runner-logs.sh <project-root> <board-dir-name>

Outputs:
  deleted_count=<n>
  freed_bytes=<bytes>
EOF2
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
log_root="${board_root}/runners/logs"
state_root="${board_root}/runners/state"

deleted_count=0
freed_bytes=0

cleanup_patterns=(
  "${log_root}/*_stdout.log"
  "${log_root}/*_stderr.log"
  "${log_root}/*_prompt.log"
  "${log_root}/*_runtime.log"
  "${log_root}/*_dry-run.log"
  "${log_root}/*_live_*.log"
  "${log_root}/*_last_message.txt"
)
loop_patterns=(
  "${log_root}/*.loop.stdout.log"
  "${log_root}/*.loop.stderr.log"
)

file_for_cleanup() {
  local path="$1"
  local base

  base="${path##*/}"
  case "$base" in
    *.loop.stdout.log|*.loop.stdout.log.[0-9]|*.loop.stdout.log.[0-9][0-9]|*.loop.stderr.log|*.loop.stderr.log.[0-9]|*.loop.stderr.log.[0-9][0-9])
      return 1
      ;;
  esac

  return 0
}

size_of() {
  local path="$1"
  local bytes

  if [ ! -f "$path" ]; then
    printf '0'
    return 0
  fi

  bytes="$(wc -c < "$path" 2>/dev/null | tr -dc '0-9')"
  bytes="${bytes// /}"
  [ -n "$bytes" ] || bytes=0
  printf '%s' "$bytes"
}

size_of_tree() {
  local path="$1"
  local bytes=0
  local child child_bytes

  if [ -f "$path" ]; then
    size_of "$path"
    return 0
  fi

  if [ ! -d "$path" ]; then
    printf '0'
    return 0
  fi

  while IFS= read -r child; do
    child_bytes="$(size_of "$child")"
    child_bytes="${child_bytes// /}"
    [ -n "$child_bytes" ] || child_bytes=0
    bytes=$((bytes + child_bytes))
  done < <(find "$path" -type f -print 2>/dev/null)

  printf '%s' "$bytes"
}

cleanup_path() {
  local path="$1"
  local size

  [ -e "$path" ] || return 0
  size="$(size_of_tree "$path")"
  size="${size// /}"
  [ -n "$size" ] || size=0
  rm -rf "$path"
  freed_bytes=$((freed_bytes + size))
  deleted_count=$((deleted_count + 1))
}

cleanup_loop_log() {
  local path="$1"
  local max_size
  local before_size previous_size after_size
  local loop_previous_file
  local tmp_current tmp_previous tmp_prior
  local before_total after_total

  [ -f "$path" ] || return 0
  [ -f "${path}.1" ] || touch "${path}.1"
  [ -f "${path}.2" ] || touch "${path}.2"

  max_size="$(runner_loop_max_size_bytes)"
  before_size="$(size_of "$path")"
  before_total=$((before_size + $(size_of "${path}.1") + $(size_of "${path}.2")))

  if [ "$before_size" -le "$max_size" ] && [ "$before_total" -le $((3 * max_size)) ]; then
    return 0
  fi

  if [ "$before_size" -gt "$max_size" ] || [ "$before_total" -gt $((3 * max_size)) ]; then
    tmp_current="$(mktemp)"
    tmp_previous="$(mktemp)"
    tmp_prior="$(mktemp)"

    # Retain latest ring: current -> .1 -> .2, each capped by max size.
    tail -c "$max_size" "$path" > "$tmp_current"
    tail -c "$max_size" "${path}.1" > "$tmp_previous"
    tail -c "$max_size" "${path}.2" > "$tmp_prior"

    mv "$tmp_current" "$path"
    mv "$tmp_previous" "${path}.1"
    mv "$tmp_prior" "${path}.2"
  fi

  [ -f "${path}" ] || return 0
  previous_size="$(size_of "${path}.1")"
  loop_previous_file="$(size_of "${path}.2")"
  after_size="$(size_of "$path")"
  after_total=$((after_size + previous_size + loop_previous_file))

  if [ "$after_total" -lt "$before_total" ]; then
    freed_bytes=$((freed_bytes + before_total - after_total))
  fi
}

runner_loop_max_size_bytes() {
  local value="${AUTOFLOW_LOOP_LOG_MAX_SIZE_BYTES:-1048576}"
  case "$value" in
    ''|*[!0-9]*) printf '1048576' ;;
    *) printf '%s' "$value" ;;
  esac
}

cleanup_loop_logs() {
  local pattern path total_before total_after path_total_before path_total_after

  for pattern in "${loop_patterns[@]}"; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      file_for_cleanup "$path" || true
      path_total_before=$(( $(size_of "$path") + $(size_of "${path}.1") + $(size_of "${path}.2") ))
      if [ "$path_total_before" -gt 0 ]; then
        cleanup_loop_log "$path"
      fi
    done
  done
}

cleanup_logs() {
  local pattern path

  [ -d "$log_root" ] || return 0

  for pattern in "${cleanup_patterns[@]}"; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      file_for_cleanup "$path" || continue
      cleanup_path "$path"
    done
  done

  cleanup_loop_logs
}

runner_id_is_enabled() {
  local runner_id="$1"
  local config_output

  config_output="$(AUTOFLOW_BOARD_ROOT="$board_root" runner_list_config 2>/dev/null)" || return 1
  awk -v wanted_id="$runner_id" '
    /^runner_begin$/ {
      id = ""
      enabled = "true"
      next
    }
    /^id=/ {
      id = substr($0, 4)
      next
    }
    /^enabled=/ {
      enabled = substr($0, 9)
      next
    }
    /^runner_end$/ {
      if (id == wanted_id && enabled == "true") {
        found = 1
        exit
      }
    }
    END {
      exit(found ? 0 : 1)
    }
  ' <<< "$config_output"
}

cleanup_state_files() {
  local pattern path base runner_id

  [ -d "$state_root" ] || return 0

  # Legacy per-runner suffixes from pre-refactor ids. These are no longer
  # active runner state bodies in the default suffixless topology.
  for pattern in "${state_root}"/*-1.state "${state_root}"/*-1.*; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      base="${path##*/}"
      runner_id="${base%%.*}"
      if runner_id_is_enabled "$runner_id"; then
        continue
      fi
      cleanup_path "$path"
    done
  done

  # Atomic write remnants from runner_write_state(), e.g. wiki.state.CWxbDK.
  # Preserve the suffixless *.state bodies; only files with an extra suffix are
  # considered stale temporary files.
  for path in "${state_root}"/*.state.??????; do
    [ -f "$path" ] || continue
    cleanup_path "$path"
  done
}

cleanup_logs
cleanup_state_files

printf 'deleted_count=%s\n' "$deleted_count"
printf 'freed_bytes=%s\n' "$freed_bytes"
