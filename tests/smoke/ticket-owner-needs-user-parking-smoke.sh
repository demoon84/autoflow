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

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress" "${project_dir}/.autoflow/tickets/todo"

cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: needs user parked blocker smoke
- Title: Needs user parked blocker smoke
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated:

## Goal

- Preserve a blocked ticket that needs a human decision without stopping the owner queue.

## References

- PRD: prd_001

## Allowed Paths

- blocked.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: blocked_by_smoke

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
- Last Event: smoke_blocked
- Last Progress Fingerprint:

## Recovery State

- Status: needs_user
- Detected By: smoke
- Failure Class: needs_user_decision
- Evidence: parked blocked smoke fixture
- Planner Decision: leave this ticket parked until a human chooses the integration boundary.
- Owner Resume Instruction: do not claim automatically.
- Last Recovery At:

## Done When

- [ ] Owner can claim the next todo ticket.

## Next Action

- Wait for a human integration decision.

## Resume Context

- Current state: parked blocked fixture.

## Notes

- Smoke fixture.

## Verification

- Result: blocked

## Result

- Summary:
TICKET

cat >"${project_dir}/.autoflow/tickets/todo/tickets_002.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_002
- PRD Key: prd_002
- Plan Candidate: next todo after parked blocker
- Title: Next todo after parked blocker
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- This ticket should be claimed even though tickets_001 is parked and shares the same Allowed Path.

## References

- PRD: prd_002

## Allowed Paths

- blocked.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed:
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

- [ ] Runtime claims this ticket.

## Next Action

- Claim this ticket.

## Resume Context

- Current state: todo fixture.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET

requested_output="${project_dir}/requested.out"
AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker \
  "${project_dir}/.autoflow/scripts/start-ticket-owner.sh" 001 >"$requested_output"

require_line "$requested_output" "status=blocked"
require_line "$requested_output" "reason=ticket_stage_blocked"
require_line "$requested_output" "ticket_id=001"

run_output="${project_dir}/run.out"
AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=worker \
  "${project_dir}/.autoflow/scripts/start-ticket-owner.sh" >"$run_output"

require_line "$run_output" "status=ok"
require_line "$run_output" "ticket_id=002"
require_line "$run_output" "source=todo"
require_line "$run_output" "stage=executing"
require_line "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" "- Stage: blocked"
require_line "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" "- Status: needs_user"
require_line "${project_dir}/.autoflow/tickets/inprogress/tickets_002.md" "- Stage: executing"

echo "status=ok"
echo "project_root=$project_dir"
