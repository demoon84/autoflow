#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
fake_bin="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir" "$fake_bin"
}
trap cleanup EXIT

require_line() {
  local file="$1"
  local expected="$2"

  if ! grep -Fqx -- "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
if [ "${1:-}" = "login" ]; then
  printf 'logged in\n'
  exit 0
fi

while [ "$#" -gt 0 ]; do
  if [ "$1" = "-" ]; then
    cat >/dev/null
    break
  fi
  shift
done

printf 'Error: thread/start: thread/start failed: error creating thread: Fatal error: Codex cannot access session files at /Users/example/.codex/sessions (permission denied)\n' >&2
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" order create "$project_dir" .autoflow \
  --title "adapter start failure smoke" \
  --request "Planner should classify adapter startup failure as blocked." >/dev/null
git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

run_out="${project_dir}/run.out"
set +e
PATH="${fake_bin}:$PATH" AUTOFLOW_CODEX_DISABLE_PTY=1 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner >"$run_out" 2>&1
run_exit=$?
set -e

if [ "$run_exit" -ne 126 ]; then
  echo "Expected run exit 126, got ${run_exit}" >&2
  cat "$run_out" >&2
  exit 1
fi

require_line "$run_out" "status=blocked"
require_line "$run_out" "runner_status=blocked"
require_line "$run_out" "adapter_exit_code=126"
require_line "$run_out" "reason=adapter_start_failed"
require_line "${project_dir}/.autoflow/runners/state/planner.state" "last_result=adapter_start_failed"
require_pattern "${project_dir}/.autoflow/runners/logs/planner.log" 'event=adapter_finish .*exit_code=126 .*finish_class=adapter_start_failed .*reason=adapter_start_failed'

echo "status=ok"
echo "project_root=$project_dir"
