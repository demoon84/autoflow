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

cat >"${fake_bin}/gemini" <<'FAKE_GEMINI'
#!/usr/bin/env bash
printf '\nOpening authentication page in your browser. Do you want to continue? [Y/n]: '
sleep 60
FAKE_GEMINI
chmod +x "${fake_bin}/gemini"

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" .autoflow \
  agent=gemini \
  model=gemini-2.5-flash-lite \
  reasoning= >/dev/null
"${REPO_ROOT}/bin/autoflow" order create "$project_dir" .autoflow \
  --title "gemini auth prompt smoke" \
  --request "Planner should detect Gemini auth prompts without looping." >/dev/null
git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

run_out="${project_dir}/run.out"
set +e
PATH="${fake_bin}:$PATH" AUTOFLOW_AGENT_TIMEOUT_SECONDS=20 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner >"$run_out" 2>&1
run_exit=$?
set -e

if [ "$run_exit" -ne 125 ]; then
  echo "Expected one-shot run exit 125, got ${run_exit}" >&2
  cat "$run_out" >&2
  exit 1
fi

require_line "$run_out" "status=blocked"
require_line "$run_out" "runner_status=blocked"
require_line "$run_out" "adapter_exit_code=125"
require_line "$run_out" "reason=adapter_auth_required"
require_line "${project_dir}/.autoflow/runners/state/planner.state" "last_result=adapter_auth_required"
require_pattern "${project_dir}/.autoflow/runners/logs/planner.log" 'event=adapter_finish .*exit_code=125 .*finish_class=adapter_auth_required .*reason=adapter_auth_required'

loop_out="${project_dir}/loop.out"
set +e
PATH="${fake_bin}:$PATH" AUTOFLOW_AGENT_TIMEOUT_SECONDS=20 \
  "${REPO_ROOT}/packages/cli/runners-project.sh" loop-worker planner "$project_dir" .autoflow >"$loop_out" 2>&1
loop_exit=$?
set -e

if [ "$loop_exit" -ne 0 ]; then
  echo "Expected loop worker to exit cleanly after blocking, got ${loop_exit}" >&2
  cat "$loop_out" >&2
  exit 1
fi

require_line "${project_dir}/.autoflow/runners/state/planner.state" "status=blocked"
require_line "${project_dir}/.autoflow/runners/state/planner.state" "last_result=adapter_auth_required"
require_pattern "${project_dir}/.autoflow/runners/logs/planner.log" 'event=loop_blocked .*reason=adapter_auth_required .*action=await_user_auth_choice'

echo "status=ok"
echo "project_root=$project_dir"
