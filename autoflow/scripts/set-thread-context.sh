#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") <plan|todo|verifier> [worker-id] [active-ticket-id] [active-stage] [active-ticket-path]" >&2
}

if [ $# -lt 1 ] || [ $# -gt 5 ]; then
  usage
  exit 1
fi

role="$1"
case "$role" in
  plan|todo|verifier) ;;
  *)
    usage
    exit 1
    ;;
esac

worker_id="${2:-$(owner_id)}"
active_ticket_id="${3:-}"
active_stage="${4:-}"
active_ticket_path="${5:-}"

set_thread_context_record "$role" "$worker_id" "$active_ticket_id" "$active_stage" "$active_ticket_path"

thread_key="$(current_thread_key || true)"
thread_file=""
if [ -n "$thread_key" ]; then
  thread_file="$(thread_context_path "$thread_key")"
fi
current_file="$(current_context_path)"

printf 'status=ok\n'
printf 'role=%s\n' "$role"
printf 'worker_id=%s\n' "$worker_id"
printf 'thread_key=%s\n' "$thread_key"
if [ -n "$thread_file" ]; then
  printf 'thread_context=%s\n' "$thread_file"
fi
printf 'current_context=%s\n' "$current_file"
printf 'active_ticket_id=%s\n' "$active_ticket_id"
printf 'active_stage=%s\n' "$active_stage"
printf 'active_ticket_path=%s\n' "$active_ticket_path"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
