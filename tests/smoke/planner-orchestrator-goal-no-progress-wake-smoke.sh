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

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner-1 "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_998.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_998
- PRD Key: prd_998
- Plan Candidate: goal no-progress smoke
- Title: Goal no-progress wake smoke
- Stage: in_progress
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner should wake when Goal Runtime shows no durable owner progress.

## References

- PRD:

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Goal Runtime

- Status: running
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 1
- Time Used Seconds: 60
- Token Budget:
- Tokens Used:
- Continuation Suppressed: true
- Last Event: loop_waiting_exit_0
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

- [ ] Planner adapter receives this ticket as active recovery item.

## Next Action

- Planner should classify the suppressed continuation as stalled recovery.

## Resume Context

- Current state: owner loop exited without durable progress.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET

fake_bin="${project_dir}/fake-bin"
run_output="${project_dir}/run.out"
runner_list_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner-1 >"$run_output"

require_line "$run_output" "status=ok"
require_line "$run_output" "adapter=codex"
require_line "$run_output" "adapter_exit_code=0"

prompt_log="$(awk -F= '$1 == "prompt_log_path" { print $2; exit }' "$run_output")"
if [ -z "$prompt_log" ] || [ ! -f "$prompt_log" ]; then
  echo "Expected persisted adapter prompt." >&2
  cat "$run_output" >&2
  exit 1
fi
require_contains "$prompt_log" "Active item: tickets/inprogress/tickets_998.md"
require_contains "$prompt_log" "Active recovery reason: goal_runtime_no_progress"
require_contains "$prompt_log" "Active recovery status: stalled"
require_contains "$prompt_log" "Active recovery failure class: adapter_no_progress"
require_contains "$prompt_log" "Planner recovery action contract:"
require_contains "$prompt_log" "Update the ticket markdown first: Recovery State, Next Action, Resume Context, and Notes"
require_contains "$prompt_log" "Do not call start-ticket-owner, verify-ticket-owner, finish-ticket-owner, merge-ready-ticket"

state_path="$(awk -F= '$1 == "state_path" { print $2; exit }' "$run_output")"
log_path="$(awk -F= '$1 == "log_path" { print $2; exit }' "$run_output")"
if [ -z "$state_path" ] || [ ! -f "$state_path" ]; then
  echo "Expected runner state path." >&2
  cat "$run_output" >&2
  exit 1
fi
if [ -z "$log_path" ] || [ ! -f "$log_path" ]; then
  echo "Expected runner log path." >&2
  cat "$run_output" >&2
  exit 1
fi
require_line "$state_path" "active_item=tickets/inprogress/tickets_998.md"
require_line "$state_path" "active_ticket_id=tickets_998"
require_line "$state_path" "active_ticket_title=Goal no-progress wake smoke"
require_line "$state_path" "active_stage=in_progress"
require_line "$state_path" "active_spec_ref=prd_998"
require_line "$state_path" "active_recovery_reason=goal_runtime_no_progress"
require_line "$state_path" "active_recovery_status=stalled"
require_line "$state_path" "active_recovery_failure_class=adapter_no_progress"
require_contains "$log_path" "event=orchestrator_recovery_signal"
require_contains "$log_path" "reason=goal_runtime_no_progress"
require_contains "$log_path" "recovery_status=stalled"
require_contains "$log_path" "failure_class=adapter_no_progress"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "runner.1.id=planner-1"
require_line "$runner_list_output" "runner.1.active_item=tickets/inprogress/tickets_998.md"
require_line "$runner_list_output" "runner.1.active_ticket_id=tickets_998"
require_line "$runner_list_output" "runner.1.active_ticket_title=Goal no-progress wake smoke"
require_line "$runner_list_output" "runner.1.active_stage=in_progress"
require_line "$runner_list_output" "runner.1.active_spec_ref=prd_998"
require_line "$runner_list_output" "runner.1.active_recovery_reason=goal_runtime_no_progress"
require_line "$runner_list_output" "runner.1.active_recovery_status=stalled"
require_line "$runner_list_output" "runner.1.active_recovery_failure_class=adapter_no_progress"

echo "status=ok"
echo "project_root=$project_dir"
