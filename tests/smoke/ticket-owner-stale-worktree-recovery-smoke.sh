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
- Title: Stale worktree recovery
- Status: populated

## Goal

Recover a blocked ticket whose recorded worktree path is stale.

## Core Scope

### In Scope

- Update `target.txt`.

### Out of Scope

- No other files.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] `target.txt` exists.

## Verification

- Command: test -f target.txt

## Notes

- Stale worktree recovery smoke spec.
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

plan_output="${project_dir}/plan.out"
start_output="${project_dir}/start.out"
blocked_output="${project_dir}/blocked.out"
manual_block_output="${project_dir}/manual-block.out"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$plan_output"
require_line "$plan_output" "status=ok"
require_line "$plan_output" "source=backlog-to-todo"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"
require_line "$start_output" "worktree_status=ready"

ticket_file="${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
stale_path="${cache_dir}/missing-stale-worktree"

perl -0pi -e 's/- Stage: executing/- Stage: blocked/' "$ticket_file"
perl -0pi -e "s#- Path: \`[^\n]+\`#- Path: \`${stale_path}\`#" "$ticket_file"
perl -0pi -e 's/- Integration Status: pending/- Integration Status: worktree_missing/' "$ticket_file"
cat >>"$ticket_file" <<NOTE

- Worktree path was missing during integration at 2026-05-01T00:00:00Z: ${stale_path}
NOTE

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/start-ticket-owner.sh >"$blocked_output"
require_line "$blocked_output" "status=resume"
require_line "$blocked_output" "ticket_id=001"
require_line "$blocked_output" "worktree_status=ready"
require_pattern "$blocked_output" '^worktree_path=.*/autoflow/worktrees/.*/tickets_001$'

if grep -Fqx 'reason=ticket_stage_blocked' "$blocked_output"; then
  echo "Recoverable stale worktree blocker was left blocked." >&2
  cat "$blocked_output" >&2
  exit 1
fi

require_line "$ticket_file" "- Stage: executing"
require_line "$ticket_file" "- Integration Status: pending"
require_pattern "$ticket_file" 'Auto-recovery .*cleared blocked worktree fields'

perl -0pi -e 's/- Stage: executing/- Stage: blocked/' "$ticket_file"
perl -0pi -e 's/- Integration Status: pending/- Integration Status: blocked_missing_allowed_paths/' "$ticket_file"
run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker ./scripts/start-ticket-owner.sh >"$manual_block_output"
require_line "$manual_block_output" "status=blocked"
require_line "$manual_block_output" "reason=ticket_stage_blocked"
require_line "$ticket_file" "- Integration Status: blocked_missing_allowed_paths"

echo "status=ok"
echo "project_root=$project_dir"
