#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  if [ -d "$project_dir" ] && git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$project_dir" worktree remove --force "${project_dir}/tickets_222_wt" >/dev/null 2>&1 || true
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

git -C "$project_dir" init -q
git -C "$project_dir" config user.email "smoke@example.com"
git -C "$project_dir" config user.name "Smoke Test"
printf 'base\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt
git -C "$project_dir" commit -q -m "base"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner-1 "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/reject"
cat >"${project_dir}/.autoflow/tickets/reject/reject_222.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_222
- PRD Key: prd_222
- Plan Candidate: leftover worktree recovery smoke
- Title: Leftover worktree recovery smoke
- Stage: rejected
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Planner should wake for a resolved ticket that still has a dirty ticket worktree.

## References

- PRD:

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch: autoflow/tickets_222
- Base Commit:
- Worktree Commit:
- Integration Status: rejected

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
- Last Event: rejected
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

- [ ] Planner adapter receives this leftover worktree as an active recovery item.

## Next Action

- Planner should record a cleanup or salvage decision.

## Resume Context

- Current state: rejected ticket has a dirty leftover worktree.

## Notes

- Smoke fixture.

## Verification

- Result: rejected

## Result

- Summary:
TICKET

git -C "$project_dir" worktree add -q -b autoflow/tickets_222 "${project_dir}/tickets_222_wt" HEAD
printf 'dirty\n' >>"${project_dir}/tickets_222_wt/target.txt"

fake_bin="${project_dir}/fake-bin"
run_output="${project_dir}/run.out"
runners_output="${project_dir}/runners.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_REJECT_AUTO_REPLAN=off AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner-1 >"$run_output"
require_line "$run_output" "status=ok"
require_line "$run_output" "adapter=codex"
require_line "$run_output" "adapter_exit_code=0"

prompt_log="$(awk -F= '$1 == "prompt_log_path" { print $2; exit }' "$run_output")"
state_path="$(awk -F= '$1 == "state_path" { print $2; exit }' "$run_output")"
log_path="$(awk -F= '$1 == "log_path" { print $2; exit }' "$run_output")"
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
[ -n "$log_path" ] && [ -f "$log_path" ] || {
  echo "Expected runner log path." >&2
  cat "$run_output" >&2
  exit 1
}

require_contains "$prompt_log" "Active item: tickets/reject/reject_222.md"
require_contains "$prompt_log" "Active recovery reason: resolved_ticket_worktree_dirty"
require_contains "$prompt_log" "Active recovery status: needs_user"
require_contains "$prompt_log" "Active recovery failure class: leftover_worktree"
require_contains "$prompt_log" "Active recovery worktree path: "
require_contains "$prompt_log" "tickets_222_wt"
require_contains "$prompt_log" "Active recovery worktree status: dirty"
require_contains "$prompt_log" "Active recovery board state: rejected"
require_line "$state_path" "active_item=tickets/reject/reject_222.md"
require_line "$state_path" "active_ticket_id=tickets_222"
require_line "$state_path" "active_ticket_title=Leftover worktree recovery smoke"
require_line "$state_path" "active_stage=rejected"
require_line "$state_path" "active_spec_ref=prd_222"
require_line "$state_path" "active_recovery_reason=resolved_ticket_worktree_dirty"
require_line "$state_path" "active_recovery_status=needs_user"
require_line "$state_path" "active_recovery_failure_class=leftover_worktree"
require_contains "$state_path" "active_recovery_worktree_path="
require_contains "$state_path" "tickets_222_wt"
require_line "$state_path" "active_recovery_worktree_status=dirty"
require_line "$state_path" "active_recovery_board_state=rejected"
require_contains "$log_path" "event=orchestrator_recovery_signal"
require_contains "$log_path" "reason=resolved_ticket_worktree_dirty"
require_contains "$log_path" "worktree_status=dirty"
require_contains "$log_path" "board_state=rejected"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runners_output"
require_line "$runners_output" "runner.1.active_item=tickets/reject/reject_222.md"
require_line "$runners_output" "runner.1.active_ticket_id=tickets_222"
require_line "$runners_output" "runner.1.active_recovery_reason=resolved_ticket_worktree_dirty"
require_line "$runners_output" "runner.1.active_recovery_status=needs_user"
require_line "$runners_output" "runner.1.active_recovery_failure_class=leftover_worktree"
require_contains "$runners_output" "runner.1.active_recovery_worktree_path="
require_contains "$runners_output" "tickets_222_wt"
require_line "$runners_output" "runner.1.active_recovery_worktree_status=dirty"
require_line "$runners_output" "runner.1.active_recovery_board_state=rejected"

echo "status=ok"
echo "project_root=$project_dir"
