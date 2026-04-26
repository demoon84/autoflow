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

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@"
  )
}

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Allowed path noise stays out of ticket completion commit
- Status: populated

## Goal

Complete a ticket after worktree integration while another allowed path becomes dirty in PROJECT_ROOT.

## Core Scope

### In Scope

- Update `target.txt`.

### Out of Scope

- Do not commit `other-allowed.txt`.

## Main Screens / Modules

- `target.txt`
- `other-allowed.txt`

## Allowed Paths

- target.txt
- other-allowed.txt

## Global Acceptance Criteria

- [ ] `target.txt` contains the ticket update.
- [ ] `other-allowed.txt` keeps its unrelated root edit and remains uncommitted after pass finish.

## Verification

- Command: grep -Fqx 'ticket update' target.txt
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
printf 'base\n' >"${project_dir}/other-allowed.txt"
git -C "$project_dir" add -A
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec >/dev/null

start_output="$(mktemp)"
integrate_output="$(mktemp)"
finish_output="$(mktemp)"
merge_output="$(mktemp)"
trap 'rm -f "$start_output" "$integrate_output" "$finish_output" "$merge_output"; cleanup' EXIT

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"
require_line "$start_output" "worktree_status=ready"

worktree_path="$(awk -F= '$1 == "worktree_path" { print $2; exit }' "$start_output")"
printf 'ticket update\n' >"${worktree_path}/target.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/integrate-worktree.sh tickets/inprogress/tickets_001.md >"$integrate_output"
require_line "$integrate_output" "status=integrated"

printf 'unrelated root edit\n' >"${project_dir}/other-allowed.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/finish-ticket-owner.sh 001 pass "keep allowed-path root noise out of commit" >"$finish_output"
require_line "$finish_output" "status=ready_to_merge"
require_line "$finish_output" "outcome=pass"
require_line "$finish_output" "status=already_integrated"
require_line "$finish_output" "commit_status=not_committed_waiting_for_merge_bot"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=merge AUTOFLOW_WORKER_ID=merge-1 ./scripts/merge-ready-ticket.sh 001 >"$merge_output"
require_line "$merge_output" "status=done"
require_line "$merge_output" "outcome=pass"
require_line "$merge_output" "commit_status=committed"

grep -Fqx 'ticket update' "${project_dir}/target.txt"
grep -Fqx 'unrelated root edit' "${project_dir}/other-allowed.txt"

if ! git -C "$project_dir" status --porcelain -- other-allowed.txt | grep -Fq ' M other-allowed.txt'; then
  echo "Expected unrelated allowed-path root file to remain uncommitted." >&2
  git -C "$project_dir" status --porcelain -- other-allowed.txt >&2
  exit 1
fi

if git -C "$project_dir" show --name-only --format= HEAD | grep -Fqx 'other-allowed.txt'; then
  echo "Unrelated allowed-path root file was included in the ticket completion commit." >&2
  git -C "$project_dir" show --name-only --format= HEAD >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
