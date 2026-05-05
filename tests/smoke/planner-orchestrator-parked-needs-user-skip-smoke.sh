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

require_absent() {
  local file="$1"
  local unexpected="$2"

  if grep -Fqx -- "$unexpected" "$file"; then
    echo "Unexpected line found: $unexpected" >&2
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
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_996.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_996
- PRD Key: prd_996
- Plan Candidate: parked needs user smoke
- Title: Parked needs user smoke
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- This ticket is already parked and must not remain as the planner card active blocker.

## References

- PRD:

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: no_worktree

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
- Last Event: worktree_removed_needs_user
- Last Progress Fingerprint:

## Recovery State

- Status: needs_user
- Detected By: planner
- Failure Class: iteration_no_progress
- Evidence: no physical worktree remains.
- Planner Decision: Keep this blocked needs_user ticket parked outside the worker claim queue.
- Owner Resume Instruction: Do not loop on this parked ticket; claim the next eligible todo unless this ticket is explicitly re-scoped.
- Last Recovery At:

## Done When

- [ ] Planner treats this as parked state, not an active recovery item.

## Next Action

- Parked needs_user: human/planner decision is required before this ticket should be claimed again; worker may continue with the next eligible todo.

## Resume Context

- Current state: parked blocked fixture.

## Notes

- Planner parking: source=inprogress-needs-user-parked; ticket is outside the normal worker claim queue until Recovery State changes.

## Verification

- Result: pending

## Result

- Summary:
TICKET

fake_bin="${project_dir}/fake-bin"
run_output="${project_dir}/run.out"
second_run_output="${project_dir}/run-second.out"
runner_list_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
printf 'invoked\n' >> "${project_dir}/adapter.marker"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$run_output"
require_line "$run_output" "status=ok"
require_line "$run_output" "runner_status=idle"
require_line "$run_output" "reason=no_actionable_plan_input"
require_line "$run_output" "active_item="
require_marker_count 0

state_path="$(awk -F= '$1 == "state_path" { print $2; exit }' "$run_output")"
if [ -z "$state_path" ] || [ ! -f "$state_path" ]; then
  echo "Expected runner state path." >&2
  cat "$run_output" >&2
  exit 1
fi
require_line "$state_path" "active_item="
require_line "$state_path" "active_ticket_id="
require_line "$state_path" "active_recovery_status="
require_line "$state_path" "active_recovery_failure_class="

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$second_run_output"
require_line "$second_run_output" "status=ok"
require_line "$second_run_output" "runner_status=idle"
require_line "$second_run_output" "reason=planner_inputs_unchanged"
require_line "$second_run_output" "active_item="
require_marker_count 0

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "runner.1.id=planner"
require_line "$runner_list_output" "runner.1.active_item="
require_line "$runner_list_output" "runner.1.active_ticket_id="
require_absent "$runner_list_output" "runner.1.active_ticket_id=tickets_996"

echo "status=ok"
echo "project_root=$project_dir"
