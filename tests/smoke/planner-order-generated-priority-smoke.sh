#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cache_dir="${project_dir}-cache"
cleanup() {
  rm -rf "$project_dir" "$cache_dir"
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

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT XDG_CACHE_HOME="$cache_dir" "$@"
  )
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p \
  "${project_dir}/.autoflow/tickets/backlog" \
  "${project_dir}/.autoflow/tickets/inbox" \
  "${project_dir}/.autoflow/tickets/inprogress"

cat >"${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: parked needs user blocker
- Title: Parked needs user blocker
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated:

## Goal

- Keep this ticket parked while planner continues other work.

## Allowed Paths

- blocked.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: blocked_by_smoke

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
- Last Event: smoke_blocked
- Last Progress Fingerprint:

## Recovery State

- Status: needs_user
- Detected By: planner
- Failure Class: needs_user_decision
- Evidence: smoke fixture
- Planner Decision: Park this blocked needs_user ticket outside the worker claim queue until a human or planner edit changes Recovery State.
- Owner Resume Instruction: Do not loop on this parked ticket; claim the next eligible todo unless this ticket is explicitly requested or Recovery State changes.
- Last Recovery At: 2026-05-05T00:00:00Z

## Done When

- [ ] Planner can continue past this parked ticket.

## Next Action

- Parked.
TICKET

cat >"${project_dir}/.autoflow/tickets/backlog/prd_002.md" <<'PRD'
# Project Spec

## Meta

- Project Key: prd_002
- Title: Promote generated order PRD
- Status: populated

## Goal

- Create a todo ticket from this already-generated order PRD before taking another inbox order.

## Project

- ID: prd_002
- Name: Promote generated order PRD
- Title: Promote generated order PRD
- Goal: Create a todo ticket from this already-generated order PRD before taking another inbox order.
- Status: populated

## Allowed Paths

- `target.txt`

## Global Acceptance Criteria

- [ ] `target.txt` contains `done`.
- [ ] `grep -Fqx done target.txt` exits 0.
- [ ] `.autoflow/tickets/todo/tickets_002.md` is created.

## Verification

- Command: grep -Fqx done target.txt

## Conversation Handoff

- Source: `tickets/inbox/order_001.md`
PRD

cat >"${project_dir}/.autoflow/tickets/inbox/order_002.md" <<'ORDER'
# Order

## Request

This later order must remain in the inbox until the generated PRD is promoted.
ORDER

plan_output="${project_dir}/plan.out"
run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner-smoke ./scripts/start-plan.sh >"$plan_output"

require_line "$plan_output" "status=ok"
require_line "$plan_output" "source=backlog-to-todo"
require_line "$plan_output" "spec=${project_dir}/.autoflow/tickets/backlog/prd_002.md"
require_line "${project_dir}/.autoflow/tickets/inprogress/tickets_001.md" "- Last Recovery At: 2026-05-05T00:00:00Z"
test -f "${project_dir}/.autoflow/tickets/inbox/order_002.md"

todo_ticket="$(awk -F= '$1 == "todo_ticket" { print $2; exit }' "$plan_output")"
test -f "$todo_ticket"

echo "status=ok"
echo "project_root=$project_dir"
