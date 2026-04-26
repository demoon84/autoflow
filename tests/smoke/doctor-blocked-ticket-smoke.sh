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

- Doctor blocked-ticket smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add coordinator-shell-1 coordinator "$project_dir" agent=shell >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add coordinator-codex-direct coordinator "$project_dir" agent=codex command=false >/dev/null

printf 'base\n' >"${project_dir}/shared.txt"
git -C "$project_dir" add shared.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null
printf 'dirty\n' >"${project_dir}/shared.txt"

write_spec "project_001" "Doctor first shared ticket" >/dev/null
write_spec "project_002" "Doctor second shared ticket" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
doctor_output="${project_dir}/doctor.out"
coordinator_runner_output="${project_dir}/coordinator-runner.out"
coordinator_runner_repeat_output="${project_dir}/coordinator-runner-repeat.out"
coordinator_codex_direct_output="${project_dir}/coordinator-codex-direct.out"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"
require_line "$start_one_output" "worktree_status=project_root_fallback"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=blocked"
require_line "$start_two_output" "reason=shared_allowed_path_conflict"
require_line "$start_two_output" "ticket_id=002"
require_line "$start_two_output" "blockers=tickets_001:shared.txt"

"${REPO_ROOT}/bin/autoflow" doctor "$project_dir" >"$doctor_output"
require_line "$doctor_output" "status=ok"
require_line "$doctor_output" "check.ticket_002_shared_path_blockers=warning"
require_line "$doctor_output" "doctor.ticket.002.blockers=tickets_001:shared.txt"
require_line "$doctor_output" "doctor.ticket.002.worktree_status=project_root_workspace"
require_line "$doctor_output" "doctor.shared_path_blocked_ticket_count=1"
require_line "$doctor_output" "check.operational_blockers=warning"
require_pattern "$doctor_output" '^warning\.[0-9]+=ticket 002 is blocked by lower-number active ticket Allowed Paths: tickets_001:shared.txt$'

"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-shell-1 >"$coordinator_runner_output"
require_line "$coordinator_runner_output" "status=blocked"
require_line "$coordinator_runner_output" "role=coordinator"
require_line "$coordinator_runner_output" "runner_id=coordinator-shell-1"
require_line "$coordinator_runner_output" "runner_status=blocked"
require_line "$coordinator_runner_output" "runtime_status=blocked"
require_line "$coordinator_runner_output" "reason=operational_blockers"
require_line "$coordinator_runner_output" "coordinator.merge_attempted=false"
require_line "$coordinator_runner_output" "coordinator.operational_blockers=warning"
require_line "$coordinator_runner_output" "coordinator.diagnosis_attempted=true"
require_line "$coordinator_runner_output" "doctor.shared_path_blocked_ticket_count=1"

"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-shell-1 >"$coordinator_runner_repeat_output"
require_line "$coordinator_runner_repeat_output" "status=blocked"
require_line "$coordinator_runner_repeat_output" "runner_status=blocked"
require_line "$coordinator_runner_repeat_output" "runtime_status=blocked"
require_line "$coordinator_runner_repeat_output" "reason=operational_blockers"
require_line "$coordinator_runner_repeat_output" "coordinator.problem_detected=true"
require_line "$coordinator_runner_repeat_output" "coordinator.diagnosis_attempted=true"
require_line "$coordinator_runner_repeat_output" "coordinator.diagnosis_cached=false"
require_line "$coordinator_runner_repeat_output" "coordinator.operational_blockers=warning"
require_line "$coordinator_runner_repeat_output" "coordinator.shared_path_blocked_ticket_count=1"
require_line "$coordinator_runner_repeat_output" "coordinator.shared_path_release_attempted=true"
require_line "$coordinator_runner_repeat_output" "coordinator.shared_path_released_count=0"
require_line "$coordinator_runner_repeat_output" "doctor.shared_path_blocked_ticket_count=1"

"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-codex-direct >"$coordinator_codex_direct_output"
require_line "$coordinator_codex_direct_output" "status=blocked"
require_line "$coordinator_codex_direct_output" "role=coordinator"
require_line "$coordinator_codex_direct_output" "runner_id=coordinator-codex-direct"
require_line "$coordinator_codex_direct_output" "runner_status=blocked"
require_line "$coordinator_codex_direct_output" "runtime_status=blocked"
require_line "$coordinator_codex_direct_output" "reason=operational_blockers"
require_line "$coordinator_codex_direct_output" "coordinator.diagnosis_attempted=true"
require_line "$coordinator_codex_direct_output" "coordinator.problem_reason=active_blocked_tickets"
require_line "$coordinator_codex_direct_output" "coordinator.merge_attempted=false"
require_line "$coordinator_codex_direct_output" "doctor.shared_path_blocked_ticket_count=1"

echo "status=ok"
echo "project_root=$project_dir"
