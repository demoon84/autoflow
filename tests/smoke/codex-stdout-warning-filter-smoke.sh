#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_root="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_root"
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

reject_pattern() {
  local file="$1"
  local pattern="$2"

  if grep -Eq -- "$pattern" "$file"; then
    echo "Unexpected pattern found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

reject_line() {
  local file="$1"
  local unexpected="$2"

  if grep -Fqx -- "$unexpected" "$file"; then
    echo "Unexpected line found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

make_fake_codex() {
  local fake_bin="$1"

  mkdir -p "$fake_bin"
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

case "${CODEX_FAKE_MODE:-success}" in
  timeout)
    sleep 5
    exit 0
    ;;
  fail)
    printf '2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters\n'
    printf 'meaningful failure output\n'
    printf 'diff --git a/target.txt b/target.txt\n'
    printf 'total_tokens=40\n'
    exit 42
    ;;
esac

i=0
while [ "$i" -lt 150 ]; do
  printf '2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters\n'
  printf '2026-05-04T22:21:36.739742Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path must not contain '"'"'..'"'"'\n'
  i=$((i + 1))
done
printf 'meaningful adapter output\n'
printf 'diff --git a/target.txt b/target.txt\n'
printf 'fatal: simulated but meaningful error text\n'
printf 'input_tokens=17\n'
printf 'output_tokens=23\n'
printf 'total_tokens=40\n'
printf '2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manager: failed to load plugin: plugin is not installed\n'
printf 'prefix 2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: this is not a timestamp-start guard line\n'
FAKE_CODEX
  chmod +x "${fake_bin}/codex"
}

make_project() {
  local project_dir="$1"

  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"

  "${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
  mkdir -p "${project_dir}/.autoflow/tickets/todo"
  cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: Codex stdout warning filter fixture
- Stage: todo

## Goal

- Exercise Codex stdout warning filtering.

## Allowed Paths

- target.txt

## Done When

- [ ] Adapter command exits with the expected code.
TICKET

  git -C "$project_dir" add .autoflow .claude .codex
  git -C "$project_dir" commit -m "baseline" >/dev/null
}

extract_adapter_stdout() {
  local run_out="$1"
  local filtered_stdout="$2"

  awk '
    /^adapter_stdout_begin$/ { capture = 1; next }
    /^adapter_stdout_end$/ { capture = 0 }
    capture { print }
  ' "$run_out" > "$filtered_stdout"
}

run_fixture() {
  local mode="$1"
  local expected_adapter_exit="$2"
  local project_dir="${tmp_root}/project-${mode}"
  local fake_bin="${tmp_root}/fake-bin-${mode}"
  local run_out="${tmp_root}/run-${mode}.out"

  mkdir -p "$project_dir"
  make_fake_codex "$fake_bin"
  make_project "$project_dir"

  set +e
  PATH="${fake_bin}:$PATH" \
    CODEX_FAKE_MODE="$mode" \
    AUTOFLOW_CODEX_DISABLE_PTY=1 \
    AUTOFLOW_AGENT_TIMEOUT_SECONDS=1 \
    AUTOFLOW_AGENT_KILL_AFTER_SECONDS=0 \
    AUTOFLOW_WORKTREE_ROOT="${project_dir}/.autoflow-worktrees" \
    "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$run_out"
  local runner_exit=$?
  set -e

  require_line "$run_out" "adapter_exit_code=${expected_adapter_exit}"
  printf '%s\n' "$run_out"
  return "$runner_exit"
}

success_out="$(run_fixture success 0)"
success_stdout="${tmp_root}/success-filtered-stdout.txt"
extract_adapter_stdout "$success_out" "$success_stdout"

reject_line "$success_out" "2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters"
reject_line "$success_out" "2026-05-04T22:21:36.739742Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path must not contain '..'"
require_line "$success_stdout" "meaningful adapter output"
require_line "$success_stdout" "diff --git a/target.txt b/target.txt"
require_line "$success_stdout" "fatal: simulated but meaningful error text"
require_line "$success_stdout" "input_tokens=17"
require_line "$success_stdout" "output_tokens=23"
require_line "$success_stdout" "total_tokens=40"
require_line "$success_stdout" "2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manager: failed to load plugin: plugin is not installed"
require_line "$success_stdout" "prefix 2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: this is not a timestamp-start guard line"
require_pattern "${tmp_root}/project-success/.autoflow/runners/logs/worker.log" 'event=codex_stdout_filter_applied .*removed_lines=300'

raw_fixture="${tmp_root}/raw-fixture.txt"
CODEX_FAKE_MODE=success "${tmp_root}/fake-bin-success/codex" - > "$raw_fixture" < /dev/null
raw_lines="$(wc -l < "$raw_fixture" | tr -d '[:space:]')"
filtered_lines="$(wc -l < "$success_stdout" | tr -d '[:space:]')"
raw_bytes="$(wc -c < "$raw_fixture" | tr -d '[:space:]')"
filtered_bytes="$(wc -c < "$success_stdout" | tr -d '[:space:]')"
if [ "$filtered_lines" -ge "$raw_lines" ] || [ "$filtered_bytes" -ge "$raw_bytes" ]; then
  echo "Expected filtered stdout to reduce line and byte counts." >&2
  echo "raw_lines=$raw_lines filtered_lines=$filtered_lines raw_bytes=$raw_bytes filtered_bytes=$filtered_bytes" >&2
  exit 1
fi

token_total="$(
  jq -rs '
    map(select(.runner_id == "worker" and .result == "success" and .ticket_id == "tickets_001")) | last
    | ((.token_input | tonumber) + (.token_output | tonumber))
  ' "${tmp_root}/project-success/.autoflow/telemetry/runs.jsonl"
)"
if [ "$token_total" != "40" ]; then
  echo "Expected telemetry token total to stay at 40, got ${token_total}" >&2
  cat "${tmp_root}/project-success/.autoflow/telemetry/runs.jsonl" >&2
  exit 1
fi

set +e
fail_out="$(run_fixture fail 42)"
fail_runner_exit=$?
set -e
if [ "$fail_runner_exit" -eq 0 ]; then
  echo "Expected failing Codex adapter run to propagate a non-zero runner exit." >&2
  cat "$fail_out" >&2
  exit 1
fi
reject_line "$fail_out" "2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters"
require_line "$fail_out" "meaningful failure output"
require_line "$fail_out" "total_tokens=40"

set +e
timeout_out="$(run_fixture timeout 124)"
timeout_runner_exit=$?
set -e
[ "$timeout_runner_exit" -eq 0 ] || true
require_line "$timeout_out" "reason=adapter_timeout"

echo "status=ok"
echo "raw_lines=$raw_lines"
echo "filtered_lines=$filtered_lines"
echo "raw_bytes=$raw_bytes"
echo "filtered_bytes=$filtered_bytes"
