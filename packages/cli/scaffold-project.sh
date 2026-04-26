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
BOARD_DIR_NAME="${2:-$(default_board_dir_name)}"

TARGET_PROJECT_ROOT="$(normalize_input_path "$TARGET_PROJECT_ROOT")"
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
HOST_CLAUDE_PATH="${TARGET_PROJECT_ROOT}/CLAUDE.md"
host_agents_action="unchanged"
if [ ! -f "$HOST_AGENTS_PATH" ]; then
  sync_host_agents_file "$HOST_AGENTS_PATH" "$BOARD_DIR_NAME"
  host_agents_action="$SYNC_ACTION_RESULT"
fi
host_claude_action="unchanged"
if [ ! -f "$HOST_CLAUDE_PATH" ]; then
  sync_host_claude_file "$HOST_CLAUDE_PATH" "$BOARD_DIR_NAME"
  host_claude_action="$SYNC_ACTION_RESULT"
fi

host_skills_created_count=0
host_skills_updated_count=0
host_skills_unchanged_count=0
host_skills_preserved_count=0

record_host_skill_action() {
  local action="$1"

  case "$action" in
    created) host_skills_created_count=$((host_skills_created_count + 1)) ;;
    updated) host_skills_updated_count=$((host_skills_updated_count + 1)) ;;
    unchanged) host_skills_unchanged_count=$((host_skills_unchanged_count + 1)) ;;
    preserved) host_skills_preserved_count=$((host_skills_preserved_count + 1)) ;;
    *)
      echo "Unknown host skill sync action: $action" >&2
      exit 1
      ;;
  esac
}

while IFS='|' read -r asset_kind source_rel target_rel; do
  [ -n "$asset_kind" ] || continue
  sync_host_skill_asset_if_missing "$TARGET_PROJECT_ROOT" "$BOARD_DIR_NAME" "$asset_kind" "$source_rel" "$target_rel"
  record_host_skill_action "$SYNC_ACTION_RESULT"
done < <(managed_host_skill_asset_entries)

printf 'project_root=%s\n' "$TARGET_PROJECT_ROOT"
printf 'board_root=%s\n' "$TARGET_BOARD_ROOT"
printf 'host_agents=%s\n' "$HOST_AGENTS_PATH"
printf 'host_agents_action=%s\n' "$host_agents_action"
printf 'host_claude=%s\n' "$HOST_CLAUDE_PATH"
printf 'host_claude_action=%s\n' "$host_claude_action"
printf 'host_skills_created=%s\n' "$host_skills_created_count"
printf 'host_skills_updated=%s\n' "$host_skills_updated_count"
printf 'host_skills_unchanged=%s\n' "$host_skills_unchanged_count"
printf 'host_skills_preserved=%s\n' "$host_skills_preserved_count"
printf 'board_version=%s\n' "$(package_version)"
printf 'status=%s\n' "$status"
