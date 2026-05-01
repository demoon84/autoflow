#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
project_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "${REPO_ROOT}/runtime/board-scripts/runner-common.sh"

kill() {
  if [ "${1:-}" = "-0" ] && [ "${2:-}" = "12345" ]; then
    echo "bash: kill: (12345) - Operation not permitted" >&2
    return 1
  fi
  if [ "${1:-}" = "-0" ] && [ "${2:-}" = "67890" ]; then
    echo "bash: kill: (67890) - No such process" >&2
    return 1
  fi
  command kill "$@"
}

runner_pid_is_running 12345 || {
  echo "Expected operation-not-permitted pid check to count as running." >&2
  exit 1
}

if runner_pid_is_running 67890; then
  echo "Expected no-such-process pid check to count as stopped." >&2
  exit 1
fi

for file in \
  "${REPO_ROOT}/packages/cli/runners-project.sh" \
  "${REPO_ROOT}/runtime/board-scripts/runners-project.sh" \
  "${REPO_ROOT}/runtime/board-scripts/runner-common.sh" \
  "${REPO_ROOT}/.autoflow/scripts/runner-common.sh" \
  "${REPO_ROOT}/dogfood-board/scripts/runner-common.sh" \
  "${REPO_ROOT}/packages/cli/watch-project.sh"; do
  if ! grep -Fq '[Oo]peration\ not\ permitted' "$file"; then
    echo "Expected runner project script to preserve operation-not-permitted handling: $file" >&2
    exit 1
  fi
done

if grep -Fq 'kill -0 "$pid" >/dev/null 2>&1' "${REPO_ROOT}/packages/cli/doctor-project.sh"; then
  echo "Expected doctor process check to use runner_pid_is_running." >&2
  exit 1
fi

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
mkdir -p "${project_dir}/.autoflow/logs/hooks"
printf '1' > "${project_dir}/.autoflow/logs/hooks/watch-board.pid"
watch_status_output="${project_dir}/watch-status.out"
"${REPO_ROOT}/bin/autoflow" watch --status "$project_dir" > "$watch_status_output"
if ! grep -Fqx 'status=running' "$watch_status_output"; then
  echo "Expected watcher status to treat inaccessible existing PID as running." >&2
  echo "--- $watch_status_output ---" >&2
  cat "$watch_status_output" >&2
  exit 1
fi

echo "status=ok"
