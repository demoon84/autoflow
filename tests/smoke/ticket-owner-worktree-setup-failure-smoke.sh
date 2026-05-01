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

require_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq -- "$expected" "$file"; then
    echo "Expected text not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Worktree setup failure smoke
- Status: populated

## Goal

Confirm ticket-owner records a recoverable blocked state when its worktree root cannot be created.

## Core Scope

### In Scope

- Touch `target.txt`.

### Out of Scope

- No other files.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] Ticket owner does not fall back to project root after a failed worktree setup.
- [ ] Recovery State records the setup failure.

## Verification

- Command: test -f target.txt

## Notes

- Worktree setup failure smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec >/dev/null

AUTOFLOW_ROLE=plan \
  AUTOFLOW_WORKER_ID=planner-smoke \
  AUTOFLOW_BOARD_ROOT="${project_dir}/.autoflow" \
  AUTOFLOW_PROJECT_ROOT="$project_dir" \
  "${project_dir}/.autoflow/scripts/start-plan.sh" >/dev/null

blocked_root="${project_dir}/not-a-directory"
start_output="${project_dir}/start.out"
printf 'not a directory\n' > "$blocked_root"

AUTOFLOW_WORKTREE_ROOT="$blocked_root" \
  AUTOFLOW_ROLE=ticket-owner \
  AUTOFLOW_WORKER_ID=owner-1 \
  AUTOFLOW_BOARD_ROOT="${project_dir}/.autoflow" \
  AUTOFLOW_PROJECT_ROOT="$project_dir" \
  "${project_dir}/.autoflow/scripts/start-ticket-owner.sh" >"$start_output"

require_line "$start_output" "status=blocked"
require_line "$start_output" "reason=worktree_setup_failed"

ticket_file="${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
if [ ! -f "$ticket_file" ]; then
  echo "Expected blocked ticket in inprogress." >&2
  cat "$start_output" >&2
  exit 1
fi

require_line "$ticket_file" "- Stage: blocked"
require_line "$ticket_file" "- Integration Status: blocked_worktree_setup_failed"
require_line "$ticket_file" "- Status: blocked"
require_line "$ticket_file" "- Detected By: runtime"
require_line "$ticket_file" "- Failure Class: tooling_failure"
require_line "$ticket_file" "- Owner Resume Instruction: Fix the worktree setup failure, then rerun ticket-owner."
require_line "$ticket_file" "- Last Event: worktree_setup_failed"
require_line "$ticket_file" "- Continuation Suppressed: true"
require_contains "${project_dir}/.autoflow/protocols/recovery.md" 'blocked_worktree_setup_failed'
require_contains "${project_dir}/.autoflow/protocols/recovery.md" 'Do not continue in `PROJECT_ROOT` silently.'

echo "status=ok"
echo "project_root=$project_dir"
