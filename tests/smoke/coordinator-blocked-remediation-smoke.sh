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
  local target="$3"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Touch ${target}.

## Core Scope

### In Scope

- Update \`${target}\`.

### Out of Scope

- No other files.

## Main Screens / Modules

- \`${target}\`

## Allowed Paths

- ${target}

## Global Acceptance Criteria

- [ ] \`${target}\` exists.

## Verification

- Command: test -f ${target}

## Notes

- Coordinator blocked remediation smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add coordinator-shell-1 coordinator "$project_dir" agent=shell >/dev/null

printf 'a\n' >"${project_dir}/a.txt"
printf 'b\n' >"${project_dir}/b.txt"
git -C "$project_dir" add a.txt b.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec "project_001" "Coordinator remediation first ticket" "a.txt" >/dev/null
write_spec "project_002" "Coordinator remediation second ticket" "b.txt" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
block_two_output="${project_dir}/block-two.out"
coordinator_output="${project_dir}/coordinator.out"
resume_two_output="${project_dir}/resume-two.out"
ticket_two="${project_dir}/.autoflow/tickets/inprogress/tickets_002.md"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=ok"
require_line "$start_two_output" "ticket_id=002"

wt_one="${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_001"
wt_two="${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_002"
printf 'first change\n' >"${wt_one}/a.txt"
git -C "$wt_one" add a.txt
git -C "$wt_one" commit -m "first ticket change" >/dev/null
shared_head="$(git -C "$wt_one" rev-parse --verify HEAD)"
git -C "$wt_two" reset --hard "$shared_head" >/dev/null

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$block_two_output"
require_line "$block_two_output" "status=blocked"
require_line "$block_two_output" "reason=shared_nonbase_head_conflict"
require_pattern "$ticket_two" 'Runtime auto-blocked: shared_nonbase_head_conflict'

"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-shell-1 >"$coordinator_output"
require_line "$coordinator_output" "status=ok"
require_line "$coordinator_output" "reason=blocked_processed"
require_line "$coordinator_output" "runtime_status=ok"
require_line "$coordinator_output" "coordinator.blocked_processing_attempted=true"
require_line "$coordinator_output" "coordinator.blocked_processed_count=1"
require_line "$coordinator_output" "coordinator.blocked_processed_tickets=tickets_002"
require_line "$coordinator_output" "coordinator.blocked_processing_failed_count=0"

if [ "$(ticket_stage "$ticket_two")" != "executing" ]; then
  echo "Coordinator should move remediated blocked ticket back to executing." >&2
  cat "$ticket_two" >&2
  exit 1
fi
require_pattern "$ticket_two" 'tickets_002-remediate-[0-9]{8}T[0-9]{6}Z'
require_pattern "$ticket_two" 'Coordinator remediated shared_nonbase_head_conflict'
if ! awk '
  /^## Worktree/ { in_worktree=1; next }
  /^## / && in_worktree { in_worktree=0 }
  in_worktree && /^- Path: / {
    sub(/^- Path:[[:space:]]*/, "", $0)
    gsub(/`/, "", $0)
    print
    found=1
    exit
  }
  END { exit(found ? 0 : 1) }
' "$ticket_two" | xargs test -d; then
  echo "Coordinator should create the replacement worktree path recorded in the ticket." >&2
  cat "$ticket_two" >&2
  exit 1
fi

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$resume_two_output"
require_line "$resume_two_output" "status=resume"
require_line "$resume_two_output" "ticket_id=002"
recorded_branch="$(
  awk '
    /^## Worktree/ { in_worktree=1; next }
    /^## / && in_worktree { in_worktree=0 }
    in_worktree && /^- Branch: / {
      sub(/^- Branch:[[:space:]]*/, "", $0)
      print
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$ticket_two"
)"
recorded_path="$(
  awk '
    /^## Worktree/ { in_worktree=1; next }
    /^## / && in_worktree { in_worktree=0 }
    in_worktree && /^- Path: / {
      sub(/^- Path:[[:space:]]*/, "", $0)
      gsub(/`/, "", $0)
      print
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$ticket_two"
)"
actual_branch="$(git -C "$recorded_path" symbolic-ref --short HEAD)"
if [ "$recorded_branch" != "$actual_branch" ]; then
  echo "Ticket owner should preserve the existing replacement worktree branch." >&2
  echo "recorded_branch=$recorded_branch" >&2
  echo "actual_branch=$actual_branch" >&2
  cat "$ticket_two" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
