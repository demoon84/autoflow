#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

json_get() {
  local file="$1"
  local expr="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const value=(${expr}); if (value == null) process.exit(1); process.stdout.write(String(value));" "$file"
}

require_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Expected file not found: $file" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"
printf 'baseline\n' >"${project_dir}/baseline.txt"
git -C "$project_dir" add baseline.txt
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

require_file "${project_dir}/.autoflow/scripts/runner-tool.js"
require_file "${project_dir}/.autoflow/scripts/runner-tool.ts"

ticket_file="${project_dir}/.autoflow/tickets/todo/Todo-001.md"
snapshot_output="${project_dir}/todo-snapshot.json"
claim_output="${project_dir}/claim.json"
active_output="${project_dir}/active.json"
ensure_output="${project_dir}/ensure.json"
status_output="${project_dir}/worktree-status.json"
diff_output="${project_dir}/diff.json"
done_output="${project_dir}/done-when.json"
verification_output="${project_dir}/verification.json"
stage_output="${project_dir}/stage.json"
context_output="${project_dir}/context.json"

cat >"$ticket_file" <<'TICKET'
# Ticket

## Ticket

- ID: Todo-001
- PRD Key: worker_tool_smoke
- Plan Candidate: Worker runner tool smoke candidate
- Title: Worker runner tool smoke ticket
- Priority: normal
- Change Type: docs
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Worker runner-tool smoke 검증을 위해 baseline fixture 를 수정한다.

## References

- PRD: (worker-runner-tool smoke)

## Reference Notes

- Project Note: [[worker_tool_smoke]]
- Plan Note:
- Ticket Note: [[Todo-001]]

## Allowed Paths

- `baseline.txt`

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
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
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `baseline.txt` 에 smoke 변경이 생긴다.

## Next Action

- worker runner-tool claim 을 실행한다.

## Resume Context

- Current state: worker runner-tool smoke ticket is ready.
- Last completed action: ticket fixture created.
- First thing to inspect on resume: `baseline.txt`.

## Notes

- Created by worker runner-tool smoke.

## Verification

- Command: true
- Exit Code:
- Last Run:
- Result:
- Summary:

## Result

- Summary:
TICKET

export AUTOFLOW_WORKTREE_ROOT="${project_dir}/worktrees"
export AUTOFLOW_WORKER_ID="worker-smoke"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker todo-snapshot --runner worker-smoke) >"$snapshot_output"
test "$(json_get "$snapshot_output" "data.tool")" = "worker.todo-snapshot"
test "$(json_get "$snapshot_output" "data.todos[0].path")" = "tickets/todo/Todo-001.md"
test "$(json_get "$snapshot_output" "data.todos[0].claimable")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker claim --ticket Todo-001 --runner worker-smoke) >"$claim_output"
test "$(json_get "$claim_output" "data.path")" = "tickets/inprogress/Todo-001.md"
require_file "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"
test ! -f "$ticket_file"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker active-get --runner worker-smoke) >"$active_output"
test "$(json_get "$active_output" "data.owned_count")" = "1"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker worktree-ensure --ticket Todo-001 --runner worker-smoke) >"$ensure_output"
worktree_path="$(json_get "$ensure_output" "data.worktree_path")"
test -d "$worktree_path"
test "$(json_get "$ensure_output" "data.worktree_status")" = "ready"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker worktree-status --ticket Todo-001) >"$status_output"
test "$(json_get "$status_output" "data.is_git_worktree")" = "true"

printf 'baseline\nworker change\n' >"${worktree_path}/baseline.txt"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker diff-check --ticket Todo-001) >"$diff_output"
test "$(json_get "$diff_output" "data.changed_files.includes('baseline.txt')")" = "true"
test "$(json_get "$diff_output" "data.in_scope")" = "true"

perl -0pi -e 's/- \[ \] `baseline\.txt`/- [x] `baseline.txt`/' "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"
(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker done-when-check --ticket Todo-001) >"$done_output"
test "$(json_get "$done_output" "data.passed")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker verification-record --ticket Todo-001 --result passed --command true --exit-code 0 --summary "smoke ok") >"$verification_output"
test "$(json_get "$verification_output" "data.result")" = "passed"
grep -Fq -- "- Result: passed" "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"
grep -Fq -- "- Summary: smoke ok" "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker context-update --ticket Todo-001 --next-action "finish smoke" --resume-current "verification recorded" --resume-last "diff checked" --resume-first "finish command") >"$context_output"
test "$(json_get "$context_output" "data.updated_next_action")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js worker stage-set --ticket Todo-001 --stage verifying --runner worker-smoke) >"$stage_output"
test "$(json_get "$stage_output" "data.stage")" = "verifying"
grep -Fq -- "- Stage: verifying" "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"

echo "status=ok"
echo "project_root=$project_dir"
