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

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_996.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_996
- PRD Key: prd_996
- Plan Candidate: owner blocked state metadata smoke
- Title: Owner blocked state metadata smoke
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated:

## Goal

- Owner blocked preflight should still publish user-facing ticket metadata.

## References

- PRD: prd_996

## Allowed Paths

- target.txt

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

- Status: blocked
- Detected By: smoke
- Failure Class: smoke_blocker
- Evidence: blocked preflight smoke fixture
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Runner state keeps active ticket title and PRD key.

## Next Action

- Wait for planner recovery.

## Resume Context

- Current state: blocked smoke fixture.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET

run_output="${project_dir}/run.out"
state_path="${project_dir}/.autoflow/runners/state/worker.state"
runners_output="${project_dir}/runners.out"
display_fallback_output="${project_dir}/display-fallback.out"
runner_start_output="${project_dir}/runner-start.out"
loop_runners_output="${project_dir}/loop-runners.out"

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner worker >"$run_output"

require_line "$run_output" "status=blocked"
require_line "$run_output" "runner_status=blocked"
require_line "$run_output" "runtime_status=blocked"
require_line "$run_output" "active_item=${project_dir}/.autoflow/tickets/inprogress/tickets_996.md"

require_line "$state_path" "active_ticket_id=tickets_996"
require_line "$state_path" "active_ticket_title=Owner blocked state metadata smoke"
require_line "$state_path" "active_stage=blocked"
require_line "$state_path" "active_spec_ref=prd_996"
require_line "$state_path" "active_recovery_reason=recovery_state_blocked"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=smoke_blocker"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runners_output"
require_line "$runners_output" "runner.2.id=worker"
require_line "$runners_output" "runner.2.active_ticket_id=tickets_996"
require_line "$runners_output" "runner.2.active_ticket_title=Owner blocked state metadata smoke"
require_line "$runners_output" "runner.2.active_stage=blocked"
require_line "$runners_output" "runner.2.active_spec_ref=prd_996"
require_line "$runners_output" "runner.2.active_recovery_reason=recovery_state_blocked"
require_line "$runners_output" "runner.2.active_recovery_status=blocked"
require_line "$runners_output" "runner.2.active_recovery_failure_class=smoke_blocker"

perl -0pi -e 's/^last_result=.*$/last_result=loop_waiting_exit_0/m' "$state_path"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$display_fallback_output"
require_line "$display_fallback_output" "runner.2.last_result=ticket_stage_blocked"

perl -0pi -e 's/^last_result=.*$/last_result=loop_waiting_exit_7/m' "$state_path"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$display_fallback_output"
require_line "$display_fallback_output" "runner.2.last_result=loop_waiting_exit_7"

perl -0pi -e 's/^status=.*$/status=running/m; s/^pid=.*$/pid=999999/m; s/^last_result=.*$/last_result=loop_waiting_exit_0/m' "$state_path"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$display_fallback_output"
require_line "$display_fallback_output" "runner.2.state_status=stopped"
require_line "$display_fallback_output" "runner.2.last_result=stale_pid"

perl -0pi -e 's/^status=.*$/status=blocked/m; s/^pid=.*$/pid=/m' "$state_path"
perl -0pi -e 's/^last_result=.*$/last_result=/m' "$state_path"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$display_fallback_output"
require_line "$display_fallback_output" "runner.2.last_result="

"${REPO_ROOT}/bin/autoflow" runners start worker "$project_dir" >"$runner_start_output"
require_line "$runner_start_output" "status=ok"
require_line "$runner_start_output" "result=started"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  "${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$loop_runners_output"
  if grep -Fqx "runner.2.last_result=ticket_stage_blocked" "$loop_runners_output"; then
    break
  fi
  sleep 1
done

require_line "$loop_runners_output" "runner.2.state_status=running"
require_line "$loop_runners_output" "runner.2.last_result=ticket_stage_blocked"
require_line "$loop_runners_output" "runner.2.active_ticket_id=tickets_996"
require_line "$loop_runners_output" "runner.2.active_stage=blocked"
require_line "$loop_runners_output" "runner.2.active_recovery_reason=recovery_state_blocked"

echo "status=ok"
echo "project_root=$project_dir"
