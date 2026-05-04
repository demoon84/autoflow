#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${AUTOFLOW_PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
BOARD_DIR_NAME="$(basename "${AUTOFLOW_BOARD_ROOT:-${SCRIPT_DIR}/..}")"
CLI_PATH="${PROJECT_ROOT}/bin/autoflow"

if [ ! -x "$CLI_PATH" ]; then
  echo "status=fail"
  echo "reason=autoflow_cli_missing"
  echo "cli_path=$CLI_PATH"
  exit 1
fi

exec "$CLI_PATH" skill curator-run "$PROJECT_ROOT" "$BOARD_DIR_NAME" "$@"
