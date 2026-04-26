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

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@"
  )
}

create_spec() {
  local project_key="$1"
  local title="$2"
  local target_file="$3"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC >"$target_file"
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Exercise ticket-owner reject auto replan flow.

## Core Scope

### In Scope

- Create \`owner-replan.txt\` in the project root.

### Out of Scope

- No app code changes.

## Main Screens / Modules

- \`owner-replan.txt\`

## Global Acceptance Criteria

- \`owner-replan.txt\` exists.

## Verification

- Command: test -f owner-replan.txt

## Notes

- Temporary replan smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

spec1_output="${project_dir}/spec-1.out"
start1_output="${project_dir}/start-1.out"
fail1_output="${project_dir}/fail-1.out"
replan_output="${project_dir}/replan.out"
claim_output="${project_dir}/claim.out"
verify_output="${project_dir}/verify.out"
pass_output="${project_dir}/pass.out"
merge_output="${project_dir}/merge.out"
status_output="${project_dir}/status.out"
spec2_output="${project_dir}/spec-2.out"
start2_output="${project_dir}/start-2.out"
fail2_output="${project_dir}/fail-2.out"
max_output="${project_dir}/max.out"
spec3_output="${project_dir}/spec-3.out"
start3_output="${project_dir}/start-3.out"
fail3_output="${project_dir}/fail-3.out"
off_output="${project_dir}/off.out"

create_spec "project_001" "Owner replan smoke project" "$spec1_output"
require_line "$spec1_output" "status=created"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$start1_output"
require_line "$start1_output" "status=ok"
require_line "$start1_output" "ticket_id=001"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/finish-ticket-owner.sh 001 fail "seed reject reason" >"$fail1_output"
require_line "$fail1_output" "status=rejected"
require_line "$fail1_output" "outcome=fail"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$replan_output"
require_line "$replan_output" "status=ok"
require_line "$replan_output" "source=replan"
require_line "$replan_output" "ticket_id=001"
require_line "$replan_output" "stage=todo"
require_line "$replan_output" "retry_count=1"
require_line "$replan_output" "reject_origin=tickets/reject/reject_001.md"

todo_ticket="${project_dir}/.autoflow/tickets/todo/tickets_001.md"
if [ ! -f "$todo_ticket" ]; then
  echo "Expected replanned todo ticket at $todo_ticket" >&2
  exit 1
fi

if [ -f "${project_dir}/.autoflow/tickets/reject/reject_001.md" ]; then
  echo "Expected reject_001.md to move out of reject after replan" >&2
  exit 1
fi

require_line "$todo_ticket" "- Stage: todo"
require_line "$todo_ticket" "- AI: "
require_line "$todo_ticket" "- Claimed By: "
require_line "$todo_ticket" "- Execution AI: "
require_line "$todo_ticket" "- Verifier AI: "
require_line "$todo_ticket" "- Integration Status: pending_claim"
require_pattern "$todo_ticket" '^## Reject History$'
require_pattern "$todo_ticket" 'seed reject reason'

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$claim_output"
require_line "$claim_output" "status=ok"
require_line "$claim_output" "ticket_id=001"
require_line "$claim_output" "source=todo"

: >"${project_dir}/owner-replan.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/verify-ticket-owner.sh 001 >"$verify_output"
require_line "$verify_output" "status=pass"
require_line "$verify_output" "ticket_id=001"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/finish-ticket-owner.sh 001 pass "replanned owner ticket verified" >"$pass_output"
require_line "$pass_output" "status=ready_to_merge"
require_line "$pass_output" "outcome=pass"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=merge AUTOFLOW_WORKER_ID=merge-replan ./scripts/merge-ready-ticket.sh 001 >"$merge_output"
require_line "$merge_output" "status=done"
require_line "$merge_output" "outcome=pass"

"${REPO_ROOT}/bin/autoflow" status "$project_dir" >"$status_output"
require_line "$status_output" "ticket_done_count=1"
require_line "$status_output" "ticket_inprogress_count=0"

create_spec "project_002" "Owner replan max retry smoke" "$spec2_output"
require_line "$spec2_output" "status=created"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$start2_output"
require_line "$start2_output" "ticket_id=002"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/finish-ticket-owner.sh 002 fail "max retry reject" >"$fail2_output"
require_line "$fail2_output" "status=rejected"

cat >>"${project_dir}/.autoflow/tickets/reject/reject_002.md" <<'EOF'

## Retry
- Retry Count: 2
- Max Retries: 2
EOF

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$max_output"
require_line "$max_output" "status=idle"
require_line "$max_output" "replan_skipped.1=tickets/reject/reject_002.md"
require_line "$max_output" "replan_skipped.1.reason=max_retries_reached"
require_line "$max_output" "replan_skipped.1.retry_count=2"

if [ ! -f "${project_dir}/.autoflow/tickets/reject/reject_002.md" ]; then
  echo "Expected max retry reject to remain in reject/" >&2
  exit 1
fi

rm -f "${project_dir}/.autoflow/tickets/reject/reject_002.md"

create_spec "project_003" "Owner replan disabled smoke" "$spec3_output"
require_line "$spec3_output" "status=created"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/start-ticket-owner.sh >"$start3_output"
ticket3_id="$(sed -n 's/^ticket_id=//p' "$start3_output" | head -n 1)"
if [ -z "$ticket3_id" ]; then
  echo "Expected ticket_id in $start3_output" >&2
  cat "$start3_output" >&2
  exit 1
fi

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan ./scripts/finish-ticket-owner.sh "$ticket3_id" fail "disabled replan reject" >"$fail3_output"
require_line "$fail3_output" "status=rejected"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-replan AUTOFLOW_REJECT_AUTO_REPLAN=off ./scripts/start-ticket-owner.sh >"$off_output"
require_line "$off_output" "status=idle"
require_line "$off_output" "reason=no_actionable_ticket_or_spec"

if [ ! -f "${project_dir}/.autoflow/tickets/reject/reject_${ticket3_id}.md" ]; then
  echo "Expected reject_${ticket3_id}.md to remain in reject when auto replan is off" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
echo "commit_hash=$(git -C "$project_dir" rev-parse --verify HEAD)"
