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

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add coordinator-self coordinator "$project_dir" agent=shell >/dev/null
mkdir -p "${project_dir}/bin"
ln -s "${REPO_ROOT}/bin/autoflow" "${project_dir}/bin/autoflow"

cat >"${project_dir}/.autoflow/tickets/backlog/prd_001.md" <<'SPEC'
# Project Spec

## Meta

- Project Key: prd_001
- Title: Coordinator wiki self-runner skip
- Status: populated

## Goal

Create owner-done.txt.

## Core Scope

### In Scope

- Create `owner-done.txt`.

### Out of Scope

- No other files.

## Main Screens / Modules

- `owner-done.txt`

## Allowed Paths

- owner-done.txt

## Global Acceptance Criteria

- [ ] `owner-done.txt` exists.

## Verification

- Command: test -f owner-done.txt
SPEC

git -C "$project_dir" add .autoflow .claude .codex bin
git -C "$project_dir" commit -m "baseline" >/dev/null

start_output="${project_dir}/start.out"
verify_output="${project_dir}/verify.out"
finish_output="${project_dir}/finish.out"
merge_output="${project_dir}/merge.out"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"

worktree_path="$(awk -F= '$1 == "worktree_path" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$start_output")"
touch "${worktree_path}/owner-done.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/verify-ticket-owner.sh 001 >"$verify_output"
require_line "$verify_output" "status=pass"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/finish-ticket-owner.sh 001 pass "owner done file verified" >"$finish_output"
require_line "$finish_output" "status=ready_to_merge"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=merge AUTOFLOW_WORKER_ID=coordinator-self ./scripts/merge-ready-ticket.sh 001 >"$merge_output"
require_line "$merge_output" "status=done"
# auto_run_wiki_maintainer was removed in cce1ea5 (3-runner topology); AI
# synthesis is wiki-1's exclusive responsibility and the inline call no
# longer fires from merge-ready-ticket.sh, so wiki_maintainer.* keys are
# intentionally absent from this output.
require_line "$merge_output" "commit_status=committed"

echo "status=ok"
echo "project_root=$project_dir"
