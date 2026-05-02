#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cache_dir="${project_dir}-cache"
cleanup() {
  rm -rf "$project_dir" "$cache_dir"
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
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT XDG_CACHE_HOME="$cache_dir" "$@"
  )
}

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Dirty unrelated root integration
- Status: populated

## Goal

Update target.txt from a ticket worktree while PROJECT_ROOT has unrelated dirty files.

## Core Scope

### In Scope

- Update `target.txt`.

### Out of Scope

- Do not modify `unrelated.txt`.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] `target.txt` contains the worktree update.

## Verification

- Command: grep -Fqx 'ticket update' target.txt

## Notes

- Dirty unrelated integration smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
printf 'base\n' >"${project_dir}/unrelated.txt"
git -C "$project_dir" add target.txt unrelated.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec >/dev/null

start_output="${project_dir}/start.out"
plan_output="${project_dir}/plan.out"
finish_output="${project_dir}/finish.out"
merge_output="${project_dir}/merge.out"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$plan_output"
require_line "$plan_output" "status=ok"
require_line "$plan_output" "source=backlog-to-todo"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"
require_line "$start_output" "worktree_status=ready"
require_pattern "$start_output" '^worktree_path=.*/autoflow/worktrees/.*/tickets_001$'

worktree_path="$(awk -F= '$1 == "worktree_path" { print $2; exit }' "$start_output")"
printf 'local root edit\n' >"${project_dir}/unrelated.txt"
printf 'ticket update\n' >"${worktree_path}/target.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/finish-ticket-owner.sh 001 pass "integrate dirty-unrelated root worktree" >"$finish_output"
require_line "$finish_output" "status=needs_ai_merge"
require_line "$finish_output" "outcome=pass"
require_line "$finish_output" "commit_status=ai_merge_required"

cp "${worktree_path}/target.txt" "${project_dir}/target.txt"
run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/finish-ticket-owner.sh 001 pass "integrate dirty-unrelated root worktree" >"$merge_output"
require_line "$merge_output" "status=done"
require_line "$merge_output" "outcome=pass"
require_line "$merge_output" "commit_status=committed_via_inline_merge"

grep -Fqx 'ticket update' "${project_dir}/target.txt"
grep -Fqx 'local root edit' "${project_dir}/unrelated.txt"

if ! git -C "$project_dir" status --porcelain -- unrelated.txt | grep -Fq ' M unrelated.txt'; then
  echo "Expected unrelated dirty root file to remain uncommitted." >&2
  git -C "$project_dir" status --porcelain -- unrelated.txt >&2
  exit 1
fi

if git -C "$project_dir" show --name-only --format= HEAD | grep -Fqx 'unrelated.txt'; then
  echo "Unrelated dirty file was included in the ticket completion commit." >&2
  git -C "$project_dir" show --name-only --format= HEAD >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
