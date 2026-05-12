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
: >"${project_dir}/baseline.txt"
git -C "$project_dir" add baseline.txt
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

require_file "${project_dir}/.autoflow/scripts/runner-tool.js"
require_file "${project_dir}/.autoflow/scripts/runner-tool.ts"

order_output="${project_dir}/order.out"
snapshot_output="${project_dir}/snapshot.json"
reserve_output="${project_dir}/reserve.json"
write_output="${project_dir}/write.json"
archive_output="${project_dir}/archive.json"
recovery_output="${project_dir}/recovery.json"
guard_output="${project_dir}/guard.json"
ticket_draft="${project_dir}/ticket.md"

"${REPO_ROOT}/bin/autoflow" order create "$project_dir" \
  --request "Update smoke fixture text" \
  --title "Runner tool smoke order" \
  --allowed-path baseline.txt \
  --verification "true" >"$order_output"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner queue-snapshot) >"$snapshot_output"
test "$(json_get "$snapshot_output" "data.tool")" = "planner.queue-snapshot"
test "$(json_get "$snapshot_output" "data.items.some((item) => item.path === 'tickets/inbox/order_001.md')")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner reserve-id --kind ticket) >"$reserve_output"
ticket_id="$(json_get "$reserve_output" "data.id")"
reservation_abs="$(json_get "$reserve_output" "data.reservation_abs")"
test "$ticket_id" = "001"

cat >"$ticket_draft" <<TICKET
# Ticket

## Ticket

- ID: Todo-${ticket_id}
- PRD Key: runner_tool_smoke
- Plan Candidate: Runner tool smoke candidate
- Title: Runner tool smoke ticket
- Priority: normal
- Change Type: docs
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Runner tool smoke ticket 생성이 안전하게 동작하는지 확인한다.

## References

- PRD: (runner-tool smoke)

## Reference Notes

- Project Note: [[runner_tool_smoke]]
- Plan Note:
- Ticket Note: [[Todo-${ticket_id}]]

## Allowed Paths

- \`baseline.txt\`

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

- [ ] \`baseline.txt\` 파일 범위 안에서 smoke 변경이 가능하다는 점을 확인한다.

## Next Action

- 다음에 바로 이어서 할 일: worker가 이 smoke ticket을 claim할 수 있다.

## Resume Context

- Current state: planner runner tool smoke ticket created.
- Last completed action: ticket draft prepared.
- First thing to inspect on resume: \`baseline.txt\`.

## Notes

- Created by planner runner tool smoke.

## Verification

- Command: true
- Run file:
- Result:

## Result

- Summary:
TICKET

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner write-ticket --id "$ticket_id" --content-file "$ticket_draft" --reservation "$reservation_abs") >"$write_output"
test "$(json_get "$write_output" "data.path")" = "tickets/todo/Todo-001.md"
require_file "${project_dir}/.autoflow/tickets/todo/Todo-001.md"
test ! -e "$reservation_abs"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner recovery-update \
  --ticket tickets/todo/Todo-001.md \
  --status healthy \
  --evidence "smoke evidence" \
  --decision "continue" \
  --instruction "worker may claim") >"$recovery_output"
test "$(json_get "$recovery_output" "data.recovery_status")" = "healthy"
grep -Fq -- "- Evidence: smoke evidence" "${project_dir}/.autoflow/tickets/todo/Todo-001.md"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner item-archive --from tickets/inbox/order_001.md --project-key runner_tool_smoke) >"$archive_output"
test "$(json_get "$archive_output" "data.path")" = "tickets/done/runner_tool_smoke/order_001.md"
require_file "${project_dir}/.autoflow/tickets/done/runner_tool_smoke/order_001.md"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js planner guard) >"$guard_output"
test "$(json_get "$guard_output" "data.tool")" = "planner.guard"
test "$(json_get "$guard_output" "data.status")" = "ok"

echo "status=ok"
echo "project_root=$project_dir"
