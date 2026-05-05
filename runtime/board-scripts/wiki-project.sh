#!/usr/bin/env bash
set -euo pipefail

# Runtime wrapper for wiki-project.sh.
# Wiki debounce is enforced by run-role.sh before invoking this tool; telemetry
# summary pages such as runner-timing, runner-health, and prompt-evolution are
# metric-only inputs and should not by themselves force a wiki commit.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOARD_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${BOARD_ROOT}/.." && pwd)"

if [ -x "${PROJECT_ROOT}/bin/autoflow" ]; then
  exec "${PROJECT_ROOT}/bin/autoflow" wiki "$@"
fi

if command -v autoflow >/dev/null 2>&1; then
  exec autoflow wiki "$@"
fi

printf 'wiki_status=blocked\n'
printf 'reason=autoflow_cli_missing\n'
printf 'hint=Install the repo-local autoflow CLI or ensure bin/autoflow exists before running wiki-project.sh.\n'
exit 127
