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

require_marker_count() {
  local expected="$1"
  local actual

  actual="$(grep -c '^invoked$' "${project_dir}/adapter.marker" 2>/dev/null || true)"
  [ -n "$actual" ] || actual=0
  if [ "$actual" != "$expected" ]; then
    echo "Expected adapter marker count ${expected}, got ${actual}" >&2
    cat "${project_dir}/adapter.marker" 2>/dev/null >&2 || true
    exit 1
  fi
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_999.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_999
- PRD Key: prd_999
- Plan Candidate: recovery smoke
- Title: Recovery wake smoke
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner should wake for blocked recovery state even when plan preflight is idle.

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

- Status: blocked
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: true
- Last Event: adapter_no_progress
- Last Progress Fingerprint:

## Recovery State

- Status: blocked
- Detected By: smoke
- Failure Class: adapter_no_progress
- Evidence: owner made no durable progress
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Planner adapter receives this ticket as active recovery item.

## Next Action

- Planner should diagnose recovery.

## Resume Context

- Current state: blocked smoke fixture.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET

fake_bin="${project_dir}/fake-bin"
fake_args="${project_dir}/codex-args.txt"
run_output="${project_dir}/run.out"
second_run_output="${project_dir}/run-second.out"
third_run_output="${project_dir}/run-third.out"
runner_list_output="${project_dir}/runners.out"
runner_start_output="${project_dir}/runner-start.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
printf 'invoked\n' >> "${project_dir}/adapter.marker"
printf '%s\n' "\$@" > "${fake_args}"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$run_output"

require_line "$run_output" "status=ok"
require_line "$run_output" "adapter=codex"
require_line "$run_output" "adapter_exit_code=0"
require_marker_count 1

prompt_log="$(awk -F= '$1 == "prompt_log_path" { print $2; exit }' "$run_output")"
if [ -z "$prompt_log" ] || [ ! -f "$prompt_log" ]; then
  echo "Expected persisted adapter prompt." >&2
  cat "$run_output" >&2
  exit 1
fi
require_contains "$prompt_log" "Active item: tickets/inprogress/tickets_999.md"
require_contains "$prompt_log" "Active recovery reason: recovery_state_blocked"
require_contains "$prompt_log" "Active recovery status: blocked"
require_contains "$prompt_log" "Active recovery failure class: adapter_no_progress"
require_contains "$prompt_log" "After AI-authored recovery edits, run 'autoflow guard'"
require_contains "$prompt_log" "Treat guard warnings as orchestration evidence"
require_contains "$prompt_log" "Do not manage runner or OS processes"
require_contains "$prompt_log" "If recovery evidence and decision are unchanged, do not append duplicate Notes"
require_contains "${project_dir}/.autoflow/agents/plan-to-ticket-agent.md" 'run `autoflow guard`'
require_contains "${project_dir}/.autoflow/agents/plan-to-ticket-agent.md" 'Treat guard warnings as orchestration evidence'
require_contains "${project_dir}/.autoflow/agents/plan-to-ticket-agent.md" 'Do not manage runner or OS processes'
require_contains "${project_dir}/.autoflow/agents/plan-to-ticket-agent.md" 'Recovery edits are idempotent'
require_contains "${project_dir}/.autoflow/agents/plan-to-ticket-agent.md" 'autoflow tool list'

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
require_line "$state_path" "active_item=tickets/inprogress/tickets_999.md"
require_line "$state_path" "active_ticket_id=tickets_999"
require_line "$state_path" "active_ticket_title=Recovery wake smoke"
require_line "$state_path" "active_stage=blocked"
require_line "$state_path" "active_spec_ref=prd_999"
require_line "$state_path" "active_recovery_reason=recovery_state_blocked"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=adapter_no_progress"
require_contains "$log_path" "event=orchestrator_recovery_signal"
require_contains "$log_path" "recovery_status=blocked"
require_contains "$log_path" "failure_class=adapter_no_progress"

mkdir -p "${project_dir}/.autoflow/tickets/done/prd_noise"
cat >"${project_dir}/.autoflow/tickets/done/prd_noise/noise.md" <<'NOISE'
# Done Noise

This completed-board change must not cause the same blocked recovery item to wake the planner adapter again.
NOISE

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "runner.1.id=planner"
require_line "$runner_list_output" "runner.1.active_item=tickets/inprogress/tickets_999.md"
require_line "$runner_list_output" "runner.1.active_ticket_id=tickets_999"
require_line "$runner_list_output" "runner.1.active_ticket_title=Recovery wake smoke"
require_line "$runner_list_output" "runner.1.active_stage=blocked"
require_line "$runner_list_output" "runner.1.active_spec_ref=prd_999"
require_line "$runner_list_output" "runner.1.active_recovery_reason=recovery_state_blocked"
require_line "$runner_list_output" "runner.1.active_recovery_status=blocked"
require_line "$runner_list_output" "runner.1.active_recovery_failure_class=adapter_no_progress"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$second_run_output"
require_line "$second_run_output" "status=ok"
require_line "$second_run_output" "runner_status=idle"
require_line "$second_run_output" "reason=planner_recovery_inputs_unchanged"
require_line "$second_run_output" "runtime_reason=no_actionable_plan_input"
require_line "$second_run_output" "recovery_reason=recovery_state_blocked"
require_line "$second_run_output" "active_item=tickets/inprogress/tickets_999.md"
require_line "$second_run_output" "active_ticket_id=tickets_999"
require_line "$second_run_output" "active_recovery_status=blocked"
require_line "$second_run_output" "active_recovery_failure_class=adapter_no_progress"
grep -Eq '^recovery_inputs_fingerprint=.+' "$second_run_output"
require_marker_count 1
require_line "$state_path" "active_item=tickets/inprogress/tickets_999.md"
require_line "$state_path" "active_ticket_id=tickets_999"
require_line "$state_path" "active_ticket_title=Recovery wake smoke"
require_line "$state_path" "active_stage=blocked"
require_line "$state_path" "active_spec_ref=prd_999"
require_line "$state_path" "active_recovery_reason=recovery_state_blocked"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=adapter_no_progress"
require_contains "$log_path" "reason=planner_recovery_inputs_unchanged"

perl -0pi -e 's/^last_result=.*$/last_result=loop_waiting_exit_0/m' "$state_path"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "runner.1.last_result=planner_recovery_inputs_unchanged"

perl -0pi -e 's/- Evidence: owner made no durable progress/- Evidence: owner made no durable progress after a new runtime log sample/' "${project_dir}/.autoflow/tickets/inprogress/tickets_999.md"
AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$third_run_output"
require_line "$third_run_output" "status=ok"
require_line "$third_run_output" "adapter=codex"
require_line "$third_run_output" "adapter_exit_code=0"
require_marker_count 2

"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" mode=one-shot >/dev/null
"${REPO_ROOT}/bin/autoflow" runners start planner "$project_dir" >"$runner_start_output"
require_line "$runner_start_output" "status=ok"
require_line "$runner_start_output" "result=started"
require_line "$state_path" "active_item=tickets/inprogress/tickets_999.md"
require_line "$state_path" "active_ticket_id=tickets_999"
require_line "$state_path" "active_ticket_title=Recovery wake smoke"
require_line "$state_path" "active_stage=blocked"
require_line "$state_path" "active_spec_ref=prd_999"
require_line "$state_path" "active_recovery_reason=recovery_state_blocked"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=adapter_no_progress"

echo "status=ok"
echo "project_root=$project_dir"
