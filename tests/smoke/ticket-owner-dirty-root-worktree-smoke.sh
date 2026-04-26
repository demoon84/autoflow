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

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@"
  )
}

write_spec() {
  local project_key="$1"
  local title="$2"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Touch the shared file.

## Core Scope

### In Scope

- Update \`shared.txt\`.

### Out of Scope

- No other files.

## Main Screens / Modules

- \`shared.txt\`

## Allowed Paths

- shared.txt

## Global Acceptance Criteria

- [ ] \`shared.txt\` exists.

## Verification

- Command: test -f shared.txt

## Notes

- Dirty root worktree isolation smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

printf 'base\n' >"${project_dir}/shared.txt"
git -C "$project_dir" add shared.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null
printf 'dirty\n' >"${project_dir}/shared.txt"

write_spec "project_001" "Dirty root first ticket" >/dev/null
write_spec "project_002" "Dirty root second ticket" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
status_output="${project_dir}/status.out"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"
require_line "$start_one_output" "worktree_status=ready"
require_pattern "$start_one_output" '^worktree_path=.*/\.autoflow-worktrees/.*/tickets_001$'

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=ok"
require_line "$start_two_output" "ticket_id=002"
require_line "$start_two_output" "worktree_status=ready"
require_pattern "$start_two_output" '^worktree_path=.*/\.autoflow-worktrees/.*/tickets_002$'

"${REPO_ROOT}/bin/autoflow" status "$project_dir" >"$status_output"
require_line "$status_output" "ticket_inprogress_count=2"
require_line "$status_output" "ticket_blocked_count=0"

echo "status=ok"
echo "project_root=$project_dir"
