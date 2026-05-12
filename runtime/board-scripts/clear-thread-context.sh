#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") [--active-only]" >&2
}

active_only=0
if [ $# -gt 1 ]; then
  usage
  exit 1
fi

if [ $# -eq 1 ]; then
  case "$1" in
    --active-only)
      active_only=1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
fi

thread_key="$(current_thread_key || true)"
thread_file=""
if [ -n "$thread_key" ]; then
  thread_file="$(thread_context_path "$thread_key")"
fi
current_file="$(current_context_path)"

if [ "$active_only" = "1" ]; then
  if clear_active_ticket_context_record 2>/dev/null; then
    printf 'status=active_cleared\n'
  else
    printf 'status=no_context\n'
  fi
  printf 'thread_key=%s\n' "$thread_key"
  if [ -n "$thread_file" ]; then
    printf 'thread_context=%s\n' "$thread_file"
  fi
  printf 'current_context=%s\n' "$current_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
fi

if [ -n "$thread_file" ] && [ -f "$thread_file" ]; then
  rm -f "$thread_file"
fi

if [ -f "$current_file" ]; then
  current_thread_key_value="$(context_file_read_value "$current_file" "thread_key" || true)"
  if [ -z "$thread_key" ] || [ -z "$current_thread_key_value" ] || [ "$thread_key" = "$current_thread_key_value" ]; then
    rm -f "$current_file"
  fi
fi

printf 'status=cleared\n'
printf 'thread_key=%s\n' "$thread_key"
if [ -n "$thread_file" ]; then
  printf 'thread_context=%s\n' "$thread_file"
fi
printf 'current_context=%s\n' "$current_file"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
