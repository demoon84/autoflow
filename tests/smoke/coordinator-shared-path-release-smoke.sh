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

ticket_stage() {
  local file="$1"

  awk '
    /^## Ticket/ { in_ticket=1; next }
    /^## / && in_ticket { in_ticket=0 }
    in_ticket && /^- Stage:[[:space:]]*/ {
      sub(/^- Stage:[[:space:]]*/, "", $0)
      print
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

write_spec() {
  local project_key="$1"
  local title="$2"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Touch shared.txt.

## Core Scope

### In Scope

- Update \`shared.txt\`.

### Out of Scope

- No other files.

## Main Screens / Modules

- \`shared.txt\`

## Allowed Paths

- shared.txt

## Global Acceptance Criteria

- [ ] \`shared.txt\` exists.

## Verification

- Command: test -f shared.txt

## Notes

- Coordinator shared-path release smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add coordinator-shell-1 coordinator "$project_dir" agent=shell >/dev/null

printf 'base\n' >"${project_dir}/shared.txt"
git -C "$project_dir" add shared.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec "project_001" "Shared path first ticket" >/dev/null
write_spec "project_002" "Shared path second ticket" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
doctor_output="${project_dir}/doctor.out"
coordinator_output="${project_dir}/coordinator.out"
ticket_two="${project_dir}/.autoflow/tickets/inprogress/tickets_002.md"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"
require_line "$start_one_output" "worktree_status=ready"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=ok"
require_line "$start_two_output" "ticket_id=002"
require_line "$start_two_output" "worktree_status=ready"

perl -0pi -e 's/- Stage: [^\n]+/- Stage: blocked/' "$ticket_two"
cat >>"$ticket_two" <<'EOF'
- Runtime auto-blocked: shared_allowed_path_conflict at 2026-04-26T00:00:00Z; blockers=tickets_001:shared.txt
EOF

"${REPO_ROOT}/bin/autoflow" doctor "$project_dir" >"$doctor_output"
require_line "$doctor_output" "doctor.shared_path_blocked_ticket_count=1"

"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-shell-1 >"$coordinator_output"
require_line "$coordinator_output" "status=ok"
require_line "$coordinator_output" "reason=blocked_released"
require_line "$coordinator_output" "coordinator.shared_path_release_attempted=true"
require_line "$coordinator_output" "coordinator.shared_path_released_count=1"
require_line "$coordinator_output" "coordinator.shared_path_released_tickets=tickets_002"
require_pattern "$ticket_two" 'Coordinator released shared_allowed_path_conflict'
if [ "$(ticket_stage "$ticket_two")" != "executing" ]; then
  echo "Coordinator should move released shared-path ticket back to executing." >&2
  cat "$ticket_two" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
