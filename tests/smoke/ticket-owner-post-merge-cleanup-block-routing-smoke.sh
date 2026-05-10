#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  if [ -d "$project_dir" ]; then
    "${REPO_ROOT}/bin/autoflow" runners stop worker "$project_dir" >/dev/null 2>&1 || true
  fi
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

require_grep() {
  local file="$1"
  local pattern="$2"
  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

ticket_file="${project_dir}/.autoflow/tickets/inprogress/tickets_995.md"
mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"$ticket_file" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_995
- PRD Key: prd_995
- Plan Candidate: cleanup-only blocked routing smoke
- Title: Cleanup-only blocked routing smoke
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated:

## Goal

- Cleanup-only blocked tickets must not auto-fail into a retry order.

## References

- PRD: prd_995

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: blocked_post_merge_cleanup

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
- Last Event: post_merge_cleanup_failed
- Last Progress Fingerprint:

## Recovery State

- Status: blocked
- Detected By: finalizer
- Failure Class: post_merge_cleanup_failed
- Evidence: cleanup-only blocked routing smoke
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Cleanup-only blocked ticket is preserved.

## Next Action

- Wait for cleanup recovery review.

## Resume Context

- Current state: cleanup-only blocked smoke fixture.

## Notes

- Smoke fixture for post_merge_cleanup_failed routing.

## Verification

- Result: pending

## Result

- Summary:
TICKET

run_output="${project_dir}/run.out"
"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$run_output"

require_line "$run_output" "status=idle"
require_line "$run_output" "reason=post_merge_cleanup_blocked_preserved"

inbox_dir="${project_dir}/.autoflow/tickets/inbox"
if ls "${inbox_dir}"/order_*_retry_*.md >/dev/null 2>&1; then
  echo "Unexpected retry order created in inbox:" >&2
  ls -la "${inbox_dir}" >&2
  exit 1
fi

require_grep "$ticket_file" '^- Stage: blocked$'
require_grep "$ticket_file" '^- Integration Status: blocked_post_merge_cleanup$'
require_grep "$ticket_file" '^- Last Event: post_merge_cleanup_failed$'

if [ ! -f "$ticket_file" ]; then
  echo "Ticket file should remain in inprogress: $ticket_file" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
