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
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/todo"
cat >"${project_dir}/.autoflow/tickets/todo/tickets_777.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_777
- PRD Key: prd_777
- Plan Candidate: stale todo recovery smoke
- Title: Stale todo worktree metadata smoke
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner should wake for a todo ticket that incorrectly retains worktree metadata.

## References

- PRD:

## Allowed Paths

- target.txt

## Worktree

- Path: /tmp/autoflow-stale-todo-worktree
- Branch: autoflow/tickets_777
- Base Commit: abcdef0
- Worktree Commit:
- Integration Status: ready

## Goal Runtime

- Status: idle
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

- [ ] Planner adapter receives this stale todo ticket as active recovery item.

## Next Action

- Planner should diagnose stale todo worktree metadata.

## Resume Context

- Current state: stale todo smoke fixture.

## Notes

- Smoke fixture.

## Verification

- Result: pending

## Result

- Summary:
TICKET

fake_bin="${project_dir}/fake-bin"
run_output="${project_dir}/run.out"
runners_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$run_output"
require_line "$run_output" "status=ok"
require_line "$run_output" "adapter=codex"
require_line "$run_output" "adapter_exit_code=0"

prompt_log="$(awk -F= '$1 == "prompt_log_path" { print $2; exit }' "$run_output")"
state_path="$(awk -F= '$1 == "state_path" { print $2; exit }' "$run_output")"
[ -n "$prompt_log" ] && [ -f "$prompt_log" ] || {
  echo "Expected persisted adapter prompt." >&2
  cat "$run_output" >&2
  exit 1
}
[ -n "$state_path" ] && [ -f "$state_path" ] || {
  echo "Expected runner state path." >&2
  cat "$run_output" >&2
  exit 1
}

require_contains "$prompt_log" "Active item: tickets/todo/tickets_777.md"
require_contains "$prompt_log" "Active recovery reason: stale_todo_worktree_metadata"
require_contains "$prompt_log" "Active recovery status: blocked"
require_contains "$prompt_log" "Active recovery failure class: stale_todo_worktree"
require_line "$state_path" "active_item=tickets/todo/tickets_777.md"
require_line "$state_path" "active_ticket_id=tickets_777"
require_line "$state_path" "active_ticket_title=Stale todo worktree metadata smoke"
require_line "$state_path" "active_stage=todo"
require_line "$state_path" "active_spec_ref=prd_777"
require_line "$state_path" "active_recovery_reason=stale_todo_worktree_metadata"
require_line "$state_path" "active_recovery_status=blocked"
require_line "$state_path" "active_recovery_failure_class=stale_todo_worktree"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runners_output"
require_line "$runners_output" "runner.1.active_item=tickets/todo/tickets_777.md"
require_line "$runners_output" "runner.1.active_ticket_id=tickets_777"
require_line "$runners_output" "runner.1.active_ticket_title=Stale todo worktree metadata smoke"
require_line "$runners_output" "runner.1.active_stage=todo"
require_line "$runners_output" "runner.1.active_spec_ref=prd_777"
require_line "$runners_output" "runner.1.active_recovery_reason=stale_todo_worktree_metadata"
require_line "$runners_output" "runner.1.active_recovery_status=blocked"
require_line "$runners_output" "runner.1.active_recovery_failure_class=stale_todo_worktree"

echo "status=ok"
echo "project_root=$project_dir"
