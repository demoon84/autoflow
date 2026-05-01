#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  guard-project.sh [project-root] [board-dir-name] [--strict]
EOF
}

strict_args=()
positionals=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict)
      strict_args+=("--strict")
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      positionals+=("$1")
      ;;
  esac
  shift || true
done

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

if [ ! -d "$board_root" ]; then
  echo "Board root not found: $board_root" >&2
  exit 1
fi

guard_script="${board_root}/scripts/board-guard.sh"
if [ ! -x "$guard_script" ]; then
  guard_script="$(runtime_scripts_root)/board-guard.sh"
fi

AUTOFLOW_BOARD_ROOT="$board_root" \
  AUTOFLOW_PROJECT_ROOT="$project_root" \
  exec "$guard_script" ${strict_args[@]+"${strict_args[@]}"}
