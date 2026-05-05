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

i=0
while [ "$i" -lt 150 ]; do
  printf '2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters\n'
  printf '2026-05-04T22:21:36.739742Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path must not contain '"'"'..'"'"'\n'
  i=$((i + 1))
done
printf 'meaningful adapter output\n'
printf 'total_tokens=40\n'
FAKE_CODEX
chmod +x "${fake_bin}/codex"

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

- [ ] Adapter command exits 0.
TICKET

git -C "$project_dir" add .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

run_out="${project_dir}/run.out"
PATH="${fake_bin}:$PATH" AUTOFLOW_CODEX_DISABLE_PTY=1 AUTOFLOW_WORKTREE_ROOT="${project_dir}/.autoflow-worktrees" \
  "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$run_out"

require_line "$run_out" "adapter_exit_code=0"
reject_pattern "$run_out" 'WARN codex_core_plugins::manifest:'
reject_pattern "$run_out" 'WARN codex_core_skills::loader:'
require_line "$run_out" "meaningful adapter output"
require_line "$run_out" "total_tokens=40"
require_pattern "${project_dir}/.autoflow/runners/logs/worker.log" 'event=codex_stdout_filter_applied .*removed_lines=300'

token_total="$(
  jq -rs '
    map(select(.runner_id == "worker" and .result == "success" and .ticket_id == "tickets_001")) | last
    | ((.token_input | tonumber) + (.token_output | tonumber))
  ' "${project_dir}/.autoflow/telemetry/runs.jsonl"
)"
if [ "$token_total" != "40" ]; then
  echo "Expected telemetry token total to stay at 40, got ${token_total}" >&2
  cat "${project_dir}/.autoflow/telemetry/runs.jsonl" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
