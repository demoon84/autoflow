#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  if [ -d "$project_dir" ]; then
    "${REPO_ROOT}/bin/autoflow" runners stop planner "$project_dir" >/dev/null 2>&1 || true
    rm -rf "$project_dir"
  fi
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
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium interval_seconds=30 >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_997.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_997
- PRD Key: prd_997
- Plan Candidate: loop state smoke
- Title: Loop state recovery smoke
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner loop state should keep active recovery metadata after the adapter turn finishes.

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
- Last Event: adapter_no_progress
- Last Progress Fingerprint:

## Recovery State

- Status: blocked
- Detected By: smoke
- Failure Class: adapter_no_progress
- Evidence: loop state smoke fixture
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Runner list shows active recovery metadata after loop tick.

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
runner_start_output="${project_dir}/runner-start.out"
runner_list_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" runners start planner "$project_dir" >"$runner_start_output"
require_line "$runner_start_output" "status=ok"
require_line "$runner_start_output" "result=started"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  "${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
  if grep -Fqx "runner.1.last_result=adapter_exit_0" "$runner_list_output"; then
    break
  fi
  sleep 1
done

require_line "$runner_list_output" "runner.1.id=planner"
require_line "$runner_list_output" "runner.1.last_result=adapter_exit_0"
require_line "$runner_list_output" "runner.1.active_item=tickets/inprogress/tickets_997.md"
require_line "$runner_list_output" "runner.1.active_ticket_id=tickets_997"
require_line "$runner_list_output" "runner.1.active_ticket_title=Loop state recovery smoke"
require_line "$runner_list_output" "runner.1.active_stage=blocked"
require_line "$runner_list_output" "runner.1.active_spec_ref=prd_997"
require_line "$runner_list_output" "runner.1.active_recovery_reason=recovery_state_blocked"
require_line "$runner_list_output" "runner.1.active_recovery_status=blocked"
require_line "$runner_list_output" "runner.1.active_recovery_failure_class=adapter_no_progress"

echo "status=ok"
echo "project_root=$project_dir"
