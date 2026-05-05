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

write_ticket() {
  local id="$1"
  local title="$2"
  local recovery_status="$3"
  local failure_class="$4"
  local marker="$5"

  cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_${id}.md" <<TICKET
# Ticket

## Ticket

- ID: tickets_${id}
- PRD Key: prd_${id}
- Plan Candidate: smoke
- Title: ${title}
- Stage: blocked
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Smoke fixture.

## References

- PRD:

## Allowed Paths

- target-${id}.txt

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
- Last Event: smoke
- Last Progress Fingerprint:

## Recovery State

- Status: ${recovery_status}
- Detected By: planner
- Failure Class: ${failure_class}
- Evidence: ${marker}
- Planner Decision: ${marker}
- Owner Resume Instruction: ${marker}
- Last Recovery At:

## Done When

- [ ] Smoke.

## Next Action

- ${marker}

## Resume Context

- Current state: ${marker}

## Notes

- ${marker}

## Verification

- Result: pending

## Result

- Summary:
TICKET
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inprogress"
write_ticket "996" "Parked needs user smoke" "needs_user" "iteration_no_progress" "Planner parking: source=inprogress-needs-user-parked; ticket is outside the normal worker claim queue until Recovery State changes."
write_ticket "997" "Real recovery smoke" "blocked" "adapter_no_progress" "owner made no durable progress"

fake_bin="${project_dir}/fake-bin"
run_output="${project_dir}/run.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
printf 'invoked\n' >> "${project_dir}/adapter.marker"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$run_output"
require_line "$run_output" "status=ok"
require_line "$run_output" "adapter=codex"
require_line "$run_output" "adapter_exit_code=0"
require_marker_count 1

state_path="$(awk -F= '$1 == "state_path" { print $2; exit }' "$run_output")"
require_line "$state_path" "active_item=tickets/inprogress/tickets_997.md"
require_line "$state_path" "active_ticket_id=tickets_997"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=adapter_no_progress"

echo "status=ok"
echo "project_root=$project_dir"
