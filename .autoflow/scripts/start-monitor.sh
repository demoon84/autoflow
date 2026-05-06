#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

project_root_input="${1:-${AUTOFLOW_PROJECT_ROOT:-$PROJECT_ROOT}}"
board_dir_name="${2:-$(basename "$BOARD_ROOT")}"
project_root="$(cd "$project_root_input" && pwd)"
board_root="${project_root}/${board_dir_name}"
cli_path="${project_root}/bin/autoflow"

printf 'status=ok\n'
printf 'role=monitor\n'
printf 'runtime_role=monitor\n'
printf 'source=start-monitor\n'
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"

if [ ! -x "$cli_path" ]; then
  printf 'monitor_status=blocked\n'
  printf 'reason=autoflow_cli_missing\n'
  printf 'cli_path=%s\n' "$cli_path"
  exit 0
fi

"$cli_path" monitor scan "$project_root" "$board_dir_name"
