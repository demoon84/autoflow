#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_root="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_root"
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

reject_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    echo "Unexpected text found: $unexpected" >&2
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

init_project() {
  local project_dir="$1"

  mkdir -p "$project_dir"
  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"
  printf 'baseline\n' >"${project_dir}/app.txt"
  "${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
  mkdir -p "${project_dir}/.autoflow/tickets/inprogress" "${project_dir}/.autoflow/tickets/check"
  cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: blocked dirty smoke
- Title: Blocked dirty smoke
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Exercise blocked-dirty orchestration guards.

## References

- PRD:

## Allowed Paths

- app.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: blocked_dirty_project_root

## Goal Runtime

- Status: blocked
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: true
- Last Event: dirty_root
- Last Progress Fingerprint:

## Recovery State

- Status: blocked
- Detected By: smoke
- Failure Class: dirty_project_root_conflict
- Evidence: dirty project root smoke
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] start-plan.sh handles blocked dirty state.

## Next Action

- Planner should recover blocked dirty state.

## Resume Context

- Current state: blocked dirty smoke fixture.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET
  git -C "$project_dir" add .
  git -C "$project_dir" commit -m "baseline board" >/dev/null
}

check_only_project="${tmp_root}/check-only"
init_project "$check_only_project"
cat >"${check_only_project}/.autoflow/tickets/check/check_001.md" <<'CHECK'
# check-only dirty fixture
CHECK
check_only_output="${tmp_root}/check-only.out"
run_temp_runtime "${check_only_project}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$check_only_output"
require_line "$check_only_output" "status=ok"
require_line "$check_only_output" "source=blocked-cleanup-no-op"
require_contains "$check_only_output" "dirty_paths=.autoflow/tickets/check/check_001.md"
reject_contains "$check_only_output" "source=blocked-dirty-orchestration"
if [ "$(find "${check_only_project}/.autoflow/tickets/check" -maxdepth 1 -type f -name 'check_*.md' | wc -l | tr -d '[:space:]')" != "1" ]; then
  echo "Check-only no-op should not create another check ledger file." >&2
  find "${check_only_project}/.autoflow/tickets/check" -maxdepth 1 -type f -name 'check_*.md' -print >&2
  exit 1
fi

fixpoint_project="${tmp_root}/fixpoint"
init_project "$fixpoint_project"
for index in 1 2 3 4 5; do
  git -C "$fixpoint_project" commit --allow-empty -m "[PRD_001][ticket_001] orchestration cleanup: smoke ${index}" >/dev/null
done
cat >"${fixpoint_project}/.autoflow/tickets/check/check_001.md" <<'CHECK'
# fixpoint dirty fixture
CHECK
fixpoint_output="${tmp_root}/fixpoint.out"
run_temp_runtime "${fixpoint_project}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$fixpoint_output"
require_line "$fixpoint_output" "status=ok"
require_line "$fixpoint_output" "source=blocked-cleanup-fixpoint-exceeded"
require_line "$fixpoint_output" "cleanup_commit_count=5"
require_line "${fixpoint_project}/.autoflow/tickets/inprogress/tickets_001.md" "- Status: needs_user"
require_line "${fixpoint_project}/.autoflow/tickets/inprogress/tickets_001.md" "- Failure Class: blocked_cleanup_fixpoint_exceeded"

mixed_project="${tmp_root}/mixed"
init_project "$mixed_project"
cat >"${mixed_project}/.autoflow/tickets/check/check_001.md" <<'CHECK'
# mixed dirty fixture
CHECK
printf 'user dirty\n' >"${mixed_project}/app.txt"
mixed_output="${tmp_root}/mixed.out"
run_temp_runtime "${mixed_project}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$mixed_output"
require_line "$mixed_output" "status=ok"
require_line "$mixed_output" "source=blocked-dirty-orchestration"
require_contains "$mixed_output" "dirty_paths="
require_contains "$mixed_output" "app.txt"
require_contains "$mixed_output" ".autoflow/tickets/check/check_001.md"

echo "status=ok"
