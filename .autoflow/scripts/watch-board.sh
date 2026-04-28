#!/usr/bin/env bash
#
# DEPRECATED: legacy script-driven file-watch loop.
#
# This script polls .autoflow/tickets/* fingerprints and dispatches one-shot
# hooks via run-hook.sh. It runs autonomously (script-driven), which is the
# pattern Autoflow has moved away from. The supported execution model is the
# 3-runner topology (planner-1, owner-1, wiki-1) where an AI runner decides
# when to call scripts as tools, not the reverse.
#
# This loop is kept for backwards compatibility with users still on
# `autoflow watch-bg`. New deployments should rely on the heartbeat-driven
# AI runners declared in `.autoflow/runners/config.toml`.

set -euo pipefail

requested_board_root=""
config_path=""

usage() {
  echo "Usage: watch-board.sh [--board-root <path>] [--config-path <path>]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --board-root)
      requested_board_root="${2:-}"
      shift 2
      ;;
    --config-path)
      config_path="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ -n "$requested_board_root" ]; then
  export AUTOFLOW_BOARD_ROOT="$requested_board_root"
fi

source "$(cd "$(dirname "$0")" && pwd)/common.sh"
source "$(cd "$(dirname "$0")" && pwd)/file-watch-common.sh"

if [ -z "$config_path" ]; then
  config_path="$(file_watch_default_config_path)"
else
  config_path="$(normalize_runtime_path "$config_path")"
fi

if [ ! -f "$config_path" ]; then
  echo "Hook config not found: $config_path" >&2
  exit 1
fi

route_trigger_root() {
  case "$1" in
    ticket)
      printf '%s/tickets/backlog' "$BOARD_ROOT"
      ;;
    plan)
      printf '%s/tickets/backlog' "$BOARD_ROOT"
      ;;
    todo)
      printf '%s/tickets/todo' "$BOARD_ROOT"
      ;;
    verifier)
      printf '%s/tickets/verifier' "$BOARD_ROOT"
      ;;
  esac
}

route_file_stream() {
  case "$1" in
    ticket)
      {
        find "${BOARD_ROOT}/tickets/backlog" -maxdepth 1 -type f -name 'project_*.md' 2>/dev/null
        find "${BOARD_ROOT}/tickets/todo" -maxdepth 1 -type f -name 'tickets_*.md' 2>/dev/null
        find "${BOARD_ROOT}/tickets/verifier" -maxdepth 1 -type f -name 'tickets_*.md' 2>/dev/null
      } | sort
      ;;
    plan)
      {
        find "${BOARD_ROOT}/tickets/backlog" -maxdepth 1 -type f -name 'project_*.md' 2>/dev/null
        find "${BOARD_ROOT}/tickets/reject" -maxdepth 1 -type f -name 'reject_*.md' 2>/dev/null
        find "${BOARD_ROOT}/tickets/done" -type f -name 'tickets_*.md' 2>/dev/null
      } | sort
      ;;
    todo)
      find "${BOARD_ROOT}/tickets/todo" -maxdepth 1 -type f -name 'tickets_*.md' 2>/dev/null | sort
      ;;
    verifier)
      find "${BOARD_ROOT}/tickets/verifier" -maxdepth 1 -type f -name 'tickets_*.md' 2>/dev/null | sort
      ;;
  esac
}

route_fingerprint() {
  local route_name="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    printf '%s|%s\n' "$file_path" "$(portable_stat_signature "$file_path")" >>"$tmp_file"
  done < <(route_file_stream "$route_name")

  cksum <"$tmp_file" | awk '{print $1 ":" $2}'
  rm -f "$tmp_file"
}

write_hook_log() {
  local route_name="$1"
  local trigger_path="$2"
  local change_type="$3"
  local exit_code="$4"
  local output_file="$5"
  local timestamp event_time log_file

  mkdir -p "${BOARD_ROOT}/logs/hooks"
  event_time="$(now_iso)"
  timestamp="$(printf '%s' "$event_time" | tr -d ':-' | sed 's/T/_/' | sed 's/Z$//')Z"
  log_file="${BOARD_ROOT}/logs/hooks/hook_${route_name}_${timestamp}.md"

  {
    printf '# Hook Run\n\n'
    printf '## Meta\n\n'
    printf -- '- Route: %s\n' "$route_name"
    printf -- '- Trigger Path: `%s`\n' "${trigger_path:-"(none)"}"
    printf -- '- Change Type: %s\n' "${change_type:-unknown}"
    printf -- '- Logged At: %s\n' "$event_time"
    printf -- '- Exit Code: %s\n' "$exit_code"
    printf '\n## Output\n\n```text\n'
    cat "$output_file"
    printf '\n```\n'
  } >"$log_file"

  printf '%s' "$log_file"
}

ticket_enabled="false"
plan_enabled="false"
todo_enabled="false"
verifier_enabled="false"

ticket_pending="false"
plan_pending="false"
todo_pending="false"
verifier_pending="false"

ticket_last_event_ms="0"
plan_last_event_ms="0"
todo_last_event_ms="0"
verifier_last_event_ms="0"

ticket_last_path="$(route_trigger_root ticket)"
plan_last_path="$(route_trigger_root plan)"
todo_last_path="$(route_trigger_root todo)"
verifier_last_path="$(route_trigger_root verifier)"

ticket_last_change_type="poll"
plan_last_change_type="poll"
todo_last_change_type="poll"
verifier_last_change_type="poll"

ticket_fingerprint_cache=""
plan_fingerprint_cache=""
todo_fingerprint_cache=""
verifier_fingerprint_cache=""

if file_watch_route_enabled "$config_path" "ticket"; then
  ticket_enabled="true"
  ticket_fingerprint_cache="$(route_fingerprint ticket)"
fi

if file_watch_route_enabled "$config_path" "plan"; then
  plan_enabled="true"
  plan_fingerprint_cache="$(route_fingerprint plan)"
fi

if file_watch_route_enabled "$config_path" "todo"; then
  todo_enabled="true"
  todo_fingerprint_cache="$(route_fingerprint todo)"
fi

if file_watch_route_enabled "$config_path" "verifier"; then
  verifier_enabled="true"
  verifier_fingerprint_cache="$(route_fingerprint verifier)"
fi

debounce_ms="$(file_watch_global_setting "$config_path" "DebounceMs" "1500")"
stable_write_delay_ms="$(file_watch_global_setting "$config_path" "StableWriteDelayMs" "750")"
debounce_sleep="$(ms_to_sleep_seconds "$debounce_ms")"
stable_sleep="$(ms_to_sleep_seconds "$stable_write_delay_ms")"

printf 'Autoflow file-watch hook is running (DEPRECATED legacy script-driven loop).\n'
printf 'Recommended: use the heartbeat-driven AI runners in `.autoflow/runners/config.toml` (planner-1 + owner-1 + wiki-1).\n'
printf 'Board Root: %s\n' "$BOARD_ROOT"
printf 'Config: %s\n' "$config_path"
printf 'Watched routes: ticket, plan, todo, verifier\n'
printf 'Press Ctrl+C to stop.\n'

while true; do
  if [ "$ticket_enabled" = "true" ]; then
    current_fingerprint="$(route_fingerprint ticket)"
    if [ "$current_fingerprint" != "$ticket_fingerprint_cache" ]; then
      ticket_fingerprint_cache="$current_fingerprint"
      ticket_pending="true"
      ticket_last_event_ms="$(now_epoch_ms)"
      ticket_last_path="$(route_trigger_root ticket)"
      ticket_last_change_type="polled-change"
    fi
  fi

  if [ "$plan_enabled" = "true" ]; then
    current_fingerprint="$(route_fingerprint plan)"
    if [ "$current_fingerprint" != "$plan_fingerprint_cache" ]; then
      plan_fingerprint_cache="$current_fingerprint"
      plan_pending="true"
      plan_last_event_ms="$(now_epoch_ms)"
      plan_last_path="$(route_trigger_root plan)"
      plan_last_change_type="polled-change"
    fi
  fi

  if [ "$todo_enabled" = "true" ]; then
    current_fingerprint="$(route_fingerprint todo)"
    if [ "$current_fingerprint" != "$todo_fingerprint_cache" ]; then
      todo_fingerprint_cache="$current_fingerprint"
      todo_pending="true"
      todo_last_event_ms="$(now_epoch_ms)"
      todo_last_path="$(route_trigger_root todo)"
      todo_last_change_type="polled-change"
    fi
  fi

  if [ "$verifier_enabled" = "true" ]; then
    current_fingerprint="$(route_fingerprint verifier)"
    if [ "$current_fingerprint" != "$verifier_fingerprint_cache" ]; then
      verifier_fingerprint_cache="$current_fingerprint"
      verifier_pending="true"
      verifier_last_event_ms="$(now_epoch_ms)"
      verifier_last_path="$(route_trigger_root verifier)"
      verifier_last_change_type="polled-change"
    fi
  fi

  now_ms="$(now_epoch_ms)"
  for route_name in ticket plan todo verifier; do
    case "$route_name" in
      ticket)
        route_pending_value="$ticket_pending"
        route_last_event_value="$ticket_last_event_ms"
        route_last_path_value="$ticket_last_path"
        route_last_change_value="$ticket_last_change_type"
        ;;
      plan)
        route_pending_value="$plan_pending"
        route_last_event_value="$plan_last_event_ms"
        route_last_path_value="$plan_last_path"
        route_last_change_value="$plan_last_change_type"
        ;;
      todo)
        route_pending_value="$todo_pending"
        route_last_event_value="$todo_last_event_ms"
        route_last_path_value="$todo_last_path"
        route_last_change_value="$todo_last_change_type"
        ;;
      verifier)
        route_pending_value="$verifier_pending"
        route_last_event_value="$verifier_last_event_ms"
        route_last_path_value="$verifier_last_path"
        route_last_change_value="$verifier_last_change_type"
        ;;
    esac

    if [ "$route_pending_value" != "true" ]; then
      continue
    fi

    elapsed_ms=$((now_ms - route_last_event_value))
    if [ "$elapsed_ms" -lt "$debounce_ms" ]; then
      continue
    fi

    sleep "$stable_sleep"
    case "$route_name" in
      ticket) ticket_pending="false" ;;
      plan) plan_pending="false" ;;
      todo) todo_pending="false" ;;
      verifier) verifier_pending="false" ;;
    esac

    output_file="$(mktemp)"
    if "${BOARD_ROOT}/scripts/run-hook.sh" \
      --role "$route_name" \
      --board-root "$BOARD_ROOT" \
      --config-path "$config_path" \
      --trigger-path "$route_last_path_value" \
      --change-type "$route_last_change_value" >"$output_file" 2>&1; then
      hook_exit_code=0
    else
      hook_exit_code=$?
    fi

    log_file="$(write_hook_log "$route_name" "$route_last_path_value" "$route_last_change_value" "$hook_exit_code" "$output_file")"
    printf '[hook:%s] exit=%s trigger=%s log=%s\n' "$route_name" "$hook_exit_code" "$route_last_path_value" "$log_file"
    rm -f "$output_file"
    break
  done

  sleep "${WATCH_LOOP_SLEEP_SECONDS:-0.25}"
done
