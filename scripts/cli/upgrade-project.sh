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
BOARD_DIR_NAME="${2:-autoflow}"

if [ ! -d "$TARGET_PROJECT_ROOT" ]; then
  echo "Project root not found: $TARGET_PROJECT_ROOT" >&2
  exit 1
fi

TARGET_PROJECT_ROOT="$(cd "$TARGET_PROJECT_ROOT" && pwd)"
TARGET_BOARD_ROOT="${TARGET_PROJECT_ROOT}/${BOARD_DIR_NAME}"
HOST_AGENTS_PATH="${TARGET_PROJECT_ROOT}/AGENTS.md"

ensure_package_templates_present

if ! board_already_initialized "$TARGET_BOARD_ROOT"; then
  echo "Board is not initialized: $TARGET_BOARD_ROOT" >&2
  exit 1
fi

ensure_board_directories "$TARGET_BOARD_ROOT"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_root="${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups/${timestamp}"
previous_board_version="$(board_version_value "$TARGET_BOARD_ROOT" || true)"
if [ -z "$previous_board_version" ]; then
  previous_board_version="unknown"
fi

managed_created_count=0
managed_updated_count=0
managed_unchanged_count=0
backup_count=0

record_sync_action() {
  local action="$1"

  case "$action" in
    created) managed_created_count=$((managed_created_count + 1)) ;;
    updated) managed_updated_count=$((managed_updated_count + 1)) ;;
    unchanged) managed_unchanged_count=$((managed_unchanged_count + 1)) ;;
    *)
      echo "Unknown sync action: $action" >&2
      exit 1
      ;;
  esac

  if [ "${SYNC_BACKUP_CREATED:-0}" = "1" ]; then
    backup_count=$((backup_count + 1))
  fi
}

if [ -f "$HOST_AGENTS_PATH" ]; then
  host_agents_action="preserved"
  SYNC_ACTION_RESULT="unchanged"
else
  sync_host_agents_file "$HOST_AGENTS_PATH" "$BOARD_DIR_NAME" "$backup_root"
  host_agents_action="$SYNC_ACTION_RESULT"
fi
record_sync_action "$SYNC_ACTION_RESULT"

while IFS='|' read -r asset_kind source_rel target_rel; do
  [ -n "$asset_kind" ] || continue
  sync_board_asset "$TARGET_BOARD_ROOT" "$BOARD_DIR_NAME" "$asset_kind" "$source_rel" "$target_rel" "$backup_root"
  record_sync_action "$SYNC_ACTION_RESULT"
done < <(managed_board_asset_entries)

write_project_root_marker "$TARGET_BOARD_ROOT" "$backup_root"
record_sync_action "$SYNC_ACTION_RESULT"

write_board_version_marker "$TARGET_BOARD_ROOT" "$backup_root"
record_sync_action "$SYNC_ACTION_RESULT"

status="already_current"
if [ "$managed_created_count" -gt 0 ] || [ "$managed_updated_count" -gt 0 ]; then
  status="upgraded"
fi

if [ "$backup_count" -eq 0 ] && [ -d "$backup_root" ]; then
  rmdir "$backup_root" 2>/dev/null || true
  rmdir "$(dirname "$backup_root")" 2>/dev/null || true
fi

current_board_version="$(board_version_value "$TARGET_BOARD_ROOT" || package_version)"

printf 'project_root=%s\n' "$TARGET_PROJECT_ROOT"
printf 'board_root=%s\n' "$TARGET_BOARD_ROOT"
printf 'board_dir_name=%s\n' "$BOARD_DIR_NAME"
printf 'status=%s\n' "$status"
printf 'previous_board_version=%s\n' "$previous_board_version"
printf 'current_board_version=%s\n' "$current_board_version"
printf 'package_version=%s\n' "$(package_version)"
printf 'host_agents_action=%s\n' "$host_agents_action"
printf 'managed_files_created=%s\n' "$managed_created_count"
printf 'managed_files_updated=%s\n' "$managed_updated_count"
printf 'managed_files_unchanged=%s\n' "$managed_unchanged_count"
printf 'backups_created=%s\n' "$backup_count"
if [ "$backup_count" -gt 0 ]; then
  printf 'backup_root=%s\n' "$backup_root"
else
  printf 'backup_root=\n'
fi
