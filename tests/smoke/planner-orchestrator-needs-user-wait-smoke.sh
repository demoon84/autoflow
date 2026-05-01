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
"${REPO_ROOT}/bin/autoflow" runners set planner-1 "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_996.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_996
- PRD Key: prd_996
- Plan Candidate: needs user smoke
- Title: Needs user wait smoke
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner loop should not repeatedly wake an adapter for a human decision blocker.

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

- Status: blocked
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: true
- Last Event: needs_user_decision
- Last Progress Fingerprint:

## Recovery State

- Status: needs_user
- Detected By: planner
- Failure Class: needs_user_decision
- Evidence: integration boundary requires human confirmation
- Planner Decision: park until user decides
- Owner Resume Instruction: continue other todo tickets
- Last Recovery At:

## Done When

- [ ] Planner loop records the active blocker without invoking the adapter.

## Next Action

- Wait for the user decision.

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
run_output="${project_dir}/run.out"
one_shot_output="${project_dir}/one-shot.out"
runner_list_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
printf 'invoked\n' >> "${project_dir}/adapter.marker"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner-1 >"$run_output"

require_line "$run_output" "status=ok"
require_line "$run_output" "runner_status=idle"
require_line "$run_output" "reason=planner_needs_user_decision_waiting"
require_line "$run_output" "runtime_reason=no_actionable_plan_input"
require_line "$run_output" "recovery_reason=recovery_state_needs_user"
require_line "$run_output" "active_item=tickets/inprogress/tickets_996.md"
require_line "$run_output" "active_ticket_id=tickets_996"
require_line "$run_output" "active_recovery_status=needs_user"
require_line "$run_output" "active_recovery_failure_class=needs_user_decision"
require_marker_count 0

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
require_line "$state_path" "last_result=planner_needs_user_decision_waiting"
require_line "$state_path" "active_item=tickets/inprogress/tickets_996.md"
require_line "$state_path" "active_ticket_id=tickets_996"
require_line "$state_path" "active_ticket_title=Needs user wait smoke"
require_line "$state_path" "active_stage=blocked"
require_line "$state_path" "active_spec_ref=prd_996"
require_line "$state_path" "active_recovery_reason=recovery_state_needs_user"
require_line "$state_path" "active_recovery_status=needs_user"
require_line "$state_path" "active_recovery_failure_class=needs_user_decision"
require_contains "$log_path" "reason=planner_needs_user_decision_waiting"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "runner.1.last_result=planner_needs_user_decision_waiting"
require_line "$runner_list_output" "runner.1.active_item=tickets/inprogress/tickets_996.md"
require_line "$runner_list_output" "runner.1.active_recovery_status=needs_user"
require_line "$runner_list_output" "runner.1.active_recovery_failure_class=needs_user_decision"

"${REPO_ROOT}/bin/autoflow" runners set planner-1 "$project_dir" mode=one-shot >/dev/null
AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner-1 >"$one_shot_output"
require_line "$one_shot_output" "status=ok"
require_line "$one_shot_output" "adapter=codex"
require_line "$one_shot_output" "adapter_exit_code=0"
require_marker_count 1

echo "status=ok"
echo "project_root=$project_dir"
