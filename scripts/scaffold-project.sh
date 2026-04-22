#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/package-board-common.sh"

usage() {
  echo "Usage: $(basename "$0") /path/to/project [board-dir-name]" >&2
}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 1
fi

TARGET_PROJECT_ROOT="$1"
BOARD_DIR_NAME="${2:-autopilot}"

mkdir -p "$TARGET_PROJECT_ROOT"
TARGET_PROJECT_ROOT="$(cd "$TARGET_PROJECT_ROOT" && pwd)"
TARGET_BOARD_ROOT="${TARGET_PROJECT_ROOT}/${BOARD_DIR_NAME}"

ensure_package_templates_present

status="initialized"
if [ -d "$TARGET_BOARD_ROOT" ] && board_dir_has_entries "$TARGET_BOARD_ROOT"; then
  if board_already_initialized "$TARGET_BOARD_ROOT"; then
    status="already_initialized"
  else
    echo "Target board directory exists and is not empty: $TARGET_BOARD_ROOT" >&2
    exit 1
  fi
fi

if [ "$status" = "initialized" ]; then
  mkdir -p "$TARGET_BOARD_ROOT"
  ensure_board_directories "$TARGET_BOARD_ROOT"

  while IFS='|' read -r asset_kind source_rel target_rel; do
    [ -n "$asset_kind" ] || continue
    sync_board_asset "$TARGET_BOARD_ROOT" "$BOARD_DIR_NAME" "$asset_kind" "$source_rel" "$target_rel"
  done < <(managed_board_asset_entries)

  while IFS='|' read -r asset_kind source_rel target_rel; do
    [ -n "$asset_kind" ] || continue
    sync_board_asset "$TARGET_BOARD_ROOT" "$BOARD_DIR_NAME" "$asset_kind" "$source_rel" "$target_rel"
  done < <(starter_board_state_asset_entries)

  write_project_root_marker "$TARGET_BOARD_ROOT"
  write_board_version_marker "$TARGET_BOARD_ROOT"
fi

HOST_AGENTS_PATH="${TARGET_PROJECT_ROOT}/AGENTS.md"
host_agents_action="unchanged"
if [ ! -f "$HOST_AGENTS_PATH" ]; then
  sync_host_agents_file "$HOST_AGENTS_PATH" "$BOARD_DIR_NAME"
  host_agents_action="$SYNC_ACTION_RESULT"
fi

printf 'project_root=%s\n' "$TARGET_PROJECT_ROOT"
printf 'board_root=%s\n' "$TARGET_BOARD_ROOT"
printf 'host_agents=%s\n' "$HOST_AGENTS_PATH"
printf 'host_agents_action=%s\n' "$host_agents_action"
printf 'board_version=%s\n' "$(package_version)"
printf 'status=%s\n' "$status"
