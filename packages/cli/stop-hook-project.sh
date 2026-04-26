#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  echo "Usage: $(basename "$0") <install|remove|status> [project-root] [board-dir-name]" >&2
}

if [ $# -lt 1 ] || [ $# -gt 3 ]; then
  usage
  exit 1
fi

action="$1"
project_root_input="${2:-.}"
board_dir_name="${3:-$(default_board_dir_name)}"

case "$action" in
  install|remove|status)
    ;;
  *)
    usage
    exit 1
    ;;
esac

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

if [ ! -d "$board_root" ] || ! board_is_initialized "$board_root"; then
  echo "Autoflow board is not initialized at: ${board_root}" >&2
  exit 1
fi

runtime_script="${board_root}/scripts/install-stop-hook.sh"
if [ ! -x "$runtime_script" ]; then
  echo "Stop-hook runtime script is missing or not executable: ${runtime_script}" >&2
  exit 1
fi

AUTOFLOW_BOARD_ROOT="$board_root" "$runtime_script" "$action"
