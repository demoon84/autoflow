#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
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

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"
: >"${project_dir}/baseline.txt"
git -C "$project_dir" add baseline.txt
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

test -f "${project_dir}/.autoflow/scripts/start-ticket-owner.js"
test -f "${project_dir}/.autoflow/scripts/start-ticket-owner.legacy.sh"
test -f "${project_dir}/.autoflow/scripts/finish-ticket-owner.js"
test -f "${project_dir}/.autoflow/scripts/finish-ticket-owner.legacy.sh"
test -f "${project_dir}/.autoflow/scripts/handoff-todo.js"
test -f "${project_dir}/.autoflow/scripts/handoff-todo.legacy.sh"
test -f "${project_dir}/.autoflow/scripts/merge-ready-ticket.ts"
test -f "${project_dir}/.autoflow/scripts/runner-stage.ts"
test -f "${project_dir}/.autoflow/scripts/runner-wake.ts"
test -f "${project_dir}/.autoflow/scripts/runner-tokens.ts"
test -f "${project_dir}/.autoflow/scripts/runner-tool.js"
test -f "${project_dir}/.autoflow/scripts/runner-tool.ts"
test -f "${project_dir}/.autoflow/scripts/state-db.ts"

doctor_ok_output="${project_dir}/doctor-ok.out"
doctor_missing_output="${project_dir}/doctor-missing.out"

"${REPO_ROOT}/bin/autoflow" doctor "$project_dir" >"$doctor_ok_output" || true
require_line "$doctor_ok_output" "check.runtime_script_companions=ok"
require_line "$doctor_ok_output" "doctor.typescript_migration.1.label=small_support"
require_line "$doctor_ok_output" "doctor.typescript_migration.2.label=planner"
require_line "$doctor_ok_output" "doctor.typescript_migration.3.label=ticket_owner_finalizer"
require_line "$doctor_ok_output" "doctor.typescript_migration.4.label=packages_cli_large_shell"

rm -f "${project_dir}/.autoflow/scripts/start-ticket-owner.js"
"${REPO_ROOT}/bin/autoflow" doctor "$project_dir" >"$doctor_missing_output" || true
require_line "$doctor_missing_output" "check.runtime_script_companions=error"
require_pattern "$doctor_missing_output" '^error\.[0-9]+=runtime script companion is missing: .*/\.autoflow/scripts/start-ticket-owner\.js \(required by start-ticket-owner\.sh\)$'

if grep -Fq "Delegates all logic to handoff-todo.legacy.sh" "${project_dir}/.autoflow/scripts/handoff-todo.js"; then
  echo "handoff-todo.js should be the primary implementation, not a legacy-only delegate." >&2
  exit 1
fi
require_pattern "${project_dir}/.autoflow/scripts/handoff-todo.js" "AUTOFLOW_HANDOFF_TODO_LEGACY"

echo "status=ok"
echo "project_root=$project_dir"
