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
base_commit="$(git -C "$project_dir" rev-parse --verify HEAD)"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

require_file "${project_dir}/.autoflow/scripts/runner-tool.js"
require_file "${project_dir}/.autoflow/scripts/runner-tool.ts"
require_file "${project_dir}/.autoflow/agents/verifier-agent.md"

worktree_path="${project_dir}/worktrees/tickets_001"
mkdir -p "$(dirname "$worktree_path")"
git -C "$project_dir" worktree add -b autoflow/tickets_001 "$worktree_path" "$base_commit" >/dev/null
printf 'baseline\nverified change\n' >"${worktree_path}/baseline.txt"

ticket_body="${project_dir}/ticket.md"
cat >"$ticket_body" <<TICKET
# Ticket

## Ticket

- ID: Todo-001
- PRD Key: verifier_tool_smoke
- Plan Candidate: Verifier runner tool smoke candidate
- Title: Verify baseline fixture change
- Priority: normal
- Change Type: docs
- Stage: verify_pending
- AI: worker-smoke
- Claimed By: worker-smoke:123:2026-05-12T00:00:00Z
- Execution AI: worker-smoke
- Verifier AI: verifier-smoke
- Last Updated: 2026-05-12T00:00:00Z

## Goal

- baseline.txt 에 verifier smoke 변경이 반영됐는지 의미 검증한다.

## References

- PRD: (verifier-runner-tool smoke)

## Reference Notes

- Project Note: [[verifier_tool_smoke]]
- Plan Note:
- Ticket Note: [[Todo-001]]

## Allowed Paths

- \`baseline.txt\`

## Worktree

- Path: \`${worktree_path}\`
- Branch: autoflow/tickets_001
- Base Commit: ${base_commit}
- Worktree Commit:
- Integration Status: pending

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] \`baseline.txt\` 에 verifier smoke 변경이 생긴다.

## Acceptance Probe

- true

## Next Action

- verifier runner-tool evidence 를 확인한다.

## Resume Context

- Current state: verifier smoke ticket waits for semantic review.
- Last completed action: worker changed baseline.txt in the ticket worktree.
- First thing to inspect on resume: diff evidence.

## Notes

- Created by verifier runner-tool smoke.

## Verification

- Command: true
- Exit Code: 0
- Last Run: 2026-05-12T00:00:00Z
- Result: passed
- Summary: smoke verification passed

## Result

- Summary:
TICKET

mkdir -p "${project_dir}/.autoflow/tickets/inprogress" "${project_dir}/.autoflow/tickets/verifier"
cp "$ticket_body" "${project_dir}/.autoflow/tickets/inprogress/Todo-001.md"
cp "$ticket_body" "${project_dir}/.autoflow/tickets/verifier/Todo-001.md"

queue_output="${project_dir}/queue.json"
evidence_output="${project_dir}/evidence.json"
decision_output="${project_dir}/decision.json"
wake_output="${project_dir}/wake.json"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js verifier queue-snapshot --runner verifier-smoke) >"$queue_output"
test "$(json_get "$queue_output" "data.tool")" = "verifier.queue-snapshot"
test "$(json_get "$queue_output" "data.tickets[0].path")" = "tickets/verifier/Todo-001.md"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js verifier evidence --ticket Todo-001 --patch-bytes 8000) >"$evidence_output"
test "$(json_get "$evidence_output" "data.tool")" = "verifier.evidence"
test "$(json_get "$evidence_output" "data.diff.changed_files.includes('baseline.txt')")" = "true"
test "$(json_get "$evidence_output" "data.diff_patch.includes('verified change')")" = "true"
test "$(json_get "$evidence_output" "data.done_when_items.length")" = "1"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js verifier decision-record --ticket Todo-001 --decision pass --reason "semantic smoke ok" --runner verifier-smoke) >"$decision_output"
marker_rel="$(json_get "$decision_output" "data.marker_path")"
log_rel="$(json_get "$decision_output" "data.log_path")"
require_file "${project_dir}/.autoflow/${marker_rel}"
require_file "${project_dir}/.autoflow/${log_rel}"
grep -Fq -- "- Semantic Decision: pass" "${project_dir}/.autoflow/tickets/verifier/Todo-001.md"
grep -Fq -- "verifier_decision=pass" "${project_dir}/.autoflow/${log_rel}"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js verifier wake) >"$wake_output"
test "$(json_get "$wake_output" "data.wakeup")" = "triggered"
require_file "${project_dir}/.autoflow/runners/state/verifier.verifier-realtime-wakeup.pending"

echo "status=ok"
echo "project_root=$project_dir"
