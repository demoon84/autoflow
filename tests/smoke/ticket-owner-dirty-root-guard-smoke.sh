#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_a="$(mktemp -d)"
project_b="$(mktemp -d)"
cleanup() {
  rm -rf "$project_a" "$project_b"
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

init_project() {
  local project_dir="$1"

  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"
  printf 'baseline\n' >"${project_dir}/app.txt"
  git -C "$project_dir" add app.txt
  git -C "$project_dir" commit -m "baseline" >/dev/null
  "${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
}

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@"
  )
}

create_ticket() {
  local project_dir="$1"
  local spec_output="$2"
  local plan_output="$3"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC' >"$spec_output"
# Project Spec

## Meta

- Project Key: project_001
- Title: Dirty root guard project
- Status: populated

## Goal

Update the smoke app artifact.

## Core Scope

### In Scope

- Update `app.txt`.

### Out of Scope

- No unrelated files.

## Main Screens / Modules

- `app.txt`

## Allowed Paths

- app.txt

## Global Acceptance Criteria

- `app.txt` exists.

## Verification

- Command: test -f app.txt
SPEC

  require_line "$spec_output" "status=created"
  run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$plan_output"
  require_line "$plan_output" "status=ok"
  require_line "$plan_output" "source=backlog-to-todo"
}

init_project "$project_a"
create_ticket "$project_a" "${project_a}/spec.out" "${project_a}/plan.out"
printf 'user local edit\n' >"${project_a}/app.txt"
run_temp_runtime "${project_a}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/start-ticket-owner.sh >"${project_a}/start.out"
require_line "${project_a}/start.out" "status=blocked"
require_line "${project_a}/start.out" "reason=dirty_project_root_conflict"
require_line "${project_a}/start.out" "dirty_path=app.txt"
require_line "${project_a}/.autoflow/tickets/inprogress/tickets_001.md" "- Integration Status: blocked_dirty_project_root"
require_line "${project_a}/.autoflow/tickets/inprogress/tickets_001.md" "- Failure Class: dirty_project_root_conflict"
require_line "${project_a}/app.txt" "user local edit"

init_project "$project_b"
create_ticket "$project_b" "${project_b}/spec.out" "${project_b}/plan.out"
run_temp_runtime "${project_b}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/start-ticket-owner.sh >"${project_b}/start.out"
require_line "${project_b}/start.out" "status=ok"
require_line "${project_b}/start.out" "ticket_id=001"
implementation_root="$(awk -F= '$1 == "implementation_root" { print $2; exit }' "${project_b}/start.out")"
if [ -z "$implementation_root" ]; then
  echo "Expected implementation_root in start-ticket-owner output" >&2
  cat "${project_b}/start.out" >&2
  exit 1
fi
printf 'worker edit\n' >"${implementation_root}/app.txt"
run_temp_runtime "${project_b}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/verify-ticket-owner.sh 001 >"${project_b}/verify.out"
require_line "${project_b}/verify.out" "status=pass"
run_temp_runtime "${project_b}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/finish-ticket-owner.sh 001 pass "dirty guard fixture" >"${project_b}/finish.out"
require_line "${project_b}/finish.out" "status=needs_ai_merge"
require_line "${project_b}/finish.out" "commit_status=ai_merge_required"
printf 'user conflicting edit\n' >"${project_b}/app.txt"
run_temp_runtime "${project_b}/.autoflow" AUTOFLOW_ROLE=merge AUTOFLOW_WORKER_ID=owner-smoke ./scripts/merge-ready-ticket.sh 001 >"${project_b}/merge.out"
require_line "${project_b}/merge.out" "status=blocked"
require_line "${project_b}/merge.out" "reason=dirty_project_root_conflict"
require_line "${project_b}/merge.out" "dirty_path=app.txt"
require_line "${project_b}/.autoflow/tickets/inprogress/tickets_001.md" "- Integration Status: blocked_dirty_project_root"
require_line "${project_b}/app.txt" "user conflicting edit"

echo "status=ok"
