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

write_ticket() {
  local path="$1"
  local id="$2"

  cat >"$path" <<TICKET
# Ticket

## Ticket

- ID: tickets_${id}
- PRD Key: prd_${id}
- Plan Candidate: guard smoke
- Title: Guard smoke ${id}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Guard smoke goal.

## References

- PRD:

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Guard passes.

## Next Action

- Continue.

## Resume Context

- Current state: guard smoke.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/todo" "${project_dir}/.autoflow/tickets/inprogress"
write_ticket "${project_dir}/.autoflow/tickets/todo/tickets_001.md" "001"

ok_output="${project_dir}/guard-ok.out"
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" >"$ok_output"
require_line "$ok_output" "status=ok"
require_line "$ok_output" "check.duplicate_ticket_ids=ok"
require_line "$ok_output" "check.todo_worktree_metadata=ok"
require_line "$ok_output" "check.recovery_state_values=ok"

cp "${project_dir}/.autoflow/tickets/todo/tickets_001.md" "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
duplicate_output="${project_dir}/guard-duplicate.out"
set +e
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" >"$duplicate_output"
duplicate_exit=$?
set -e
if [ "$duplicate_exit" -eq 0 ]; then
  echo "Expected duplicate guard failure." >&2
  cat "$duplicate_output" >&2
  exit 1
fi
require_line "$duplicate_output" "status=error"
require_line "$duplicate_output" "check.duplicate_ticket_ids=error"
require_contains "$duplicate_output" "tickets_001 exists in multiple board states"

rm -f "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
perl -0pi -e 's/- Path:\n/- Path: `\/tmp\/stale-worktree`\n/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
stale_output="${project_dir}/guard-stale.out"
set +e
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" >"$stale_output"
stale_exit=$?
set -e
if [ "$stale_exit" -eq 0 ]; then
  echo "Expected stale todo worktree guard failure." >&2
  cat "$stale_output" >&2
  exit 1
fi
require_line "$stale_output" "status=error"
require_line "$stale_output" "check.todo_worktree_metadata=error"
require_contains "$stale_output" "is in todo but still has worktree metadata"

perl -0pi -e 's/- Path: `\/tmp\/stale-worktree`\n/- Path:\n/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
perl -0pi -e 's/- Status: healthy/- Status: confused/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
perl -0pi -e 's/- Failure Class:\n/- Failure Class: mystery_failure\n/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
invalid_recovery_output="${project_dir}/guard-invalid-recovery.out"
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" >"$invalid_recovery_output"
require_line "$invalid_recovery_output" "status=warning"
require_line "$invalid_recovery_output" "check.recovery_state_values=warning"
require_contains "$invalid_recovery_output" "Recovery State has invalid Status=confused"
require_contains "$invalid_recovery_output" "Recovery State has invalid Failure Class=mystery_failure"

perl -0pi -e 's/- Status: confused/- Status: healthy/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
perl -0pi -e 's/- Failure Class: mystery_failure\n/- Failure Class:\n/' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
perl -0pi -e 's/\n## Recovery State\n\n- Status: healthy\n- Detected By:\n- Failure Class:\n- Evidence:\n- Planner Decision:\n- Owner Resume Instruction:\n- Last Recovery At:\n//' "${project_dir}/.autoflow/tickets/todo/tickets_001.md"
warning_output="${project_dir}/guard-warning.out"
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" >"$warning_output"
require_line "$warning_output" "status=warning"
require_line "$warning_output" "check.active_ticket_sections=warning"

strict_output="${project_dir}/guard-strict.out"
set +e
"${REPO_ROOT}/bin/autoflow" guard "$project_dir" --strict >"$strict_output"
strict_exit=$?
set -e
if [ "$strict_exit" -eq 0 ]; then
  echo "Expected strict warning guard failure." >&2
  cat "$strict_output" >&2
  exit 1
fi
require_line "$strict_output" "status=error"
require_contains "$strict_output" "strict mode:"

git_project_dir="${project_dir}/git-worktree-smoke"
mkdir -p "$git_project_dir"
git -C "$git_project_dir" init -q
git -C "$git_project_dir" config user.email "smoke@example.com"
git -C "$git_project_dir" config user.name "Smoke Test"
printf 'base\n' >"${git_project_dir}/target.txt"
git -C "$git_project_dir" add target.txt
git -C "$git_project_dir" commit -q -m "base"
"${REPO_ROOT}/bin/autoflow" init "$git_project_dir" >/dev/null

mkdir -p "${git_project_dir}/.autoflow/tickets/reject" "${git_project_dir}/.autoflow/tickets/inprogress"
write_ticket "${git_project_dir}/.autoflow/tickets/reject/reject_002.md" "002"
git -C "$git_project_dir" worktree add -q -b autoflow/tickets_002 "${project_dir}/tickets_002_wt" HEAD

write_ticket "${git_project_dir}/.autoflow/tickets/reject/reject_003.md" "003"
git -C "$git_project_dir" worktree add -q -b autoflow/tickets_003 "${project_dir}/tickets_003_wt" HEAD
printf 'dirty\n' >>"${project_dir}/tickets_003_wt/target.txt"

write_ticket "${git_project_dir}/.autoflow/tickets/inprogress/tickets_004.md" "004"
git -C "$git_project_dir" worktree add -q -b autoflow/tickets_004 "${project_dir}/tickets_004_wt" HEAD

resolved_worktree_output="${project_dir}/guard-resolved-worktrees.out"
"${REPO_ROOT}/bin/autoflow" guard "$git_project_dir" >"$resolved_worktree_output"
require_line "$resolved_worktree_output" "status=warning"
require_line "$resolved_worktree_output" "check.resolved_ticket_worktrees=warning"
require_contains "$resolved_worktree_output" "autoflow/tickets_002 has leftover clean worktree for rejected ticket tickets/reject/reject_002.md"
require_contains "$resolved_worktree_output" "autoflow/tickets_003 has dirty worktree for rejected ticket tickets/reject/reject_003.md"
if grep -Fq "autoflow/tickets_004" "$resolved_worktree_output"; then
  echo "Active ticket worktree should not be reported as resolved/stale." >&2
  cat "$resolved_worktree_output" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
