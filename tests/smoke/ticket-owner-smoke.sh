#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  if [ -d "${project_dir}/.autoflow" ]; then
    "${REPO_ROOT}/bin/autoflow" runners stop coordinator-shell-loop "$project_dir" >/dev/null 2>&1 || true
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

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

if [ ! -d "${project_dir}/.autoflow" ]; then
  echo "Expected default board directory at ${project_dir}/.autoflow" >&2
  exit 1
fi

if [ -e "${project_dir}/autoflow" ]; then
  echo "Unexpected legacy default board directory at ${project_dir}/autoflow" >&2
  exit 1
fi

require_line "${project_dir}/.claude/skills/autoflow/SKILL.md" "2. If the current project has \`CLAUDE.md\`, \`AGENTS.md\`, \`.autoflow/AGENTS.md\`, or \`.autoflow/agents/spec-author-agent.md\`, read the relevant files before drafting."
require_line "${project_dir}/.claude/skills/af/SKILL.md" "1. Treat \`#af\` and \`/af\` as Autoflow PRD handoff triggers."
require_line "${project_dir}/.codex/skills/autoflow/SKILL.md" "2. If the current project has \`AGENTS.md\`, \`CLAUDE.md\`, \`.autoflow/AGENTS.md\`, or \`.autoflow/agents/spec-author-agent.md\`, read the relevant files before drafting."
require_line "${project_dir}/.codex/skills/af/SKILL.md" "1. Treat \`\$af\`, \`#af\`, and \`/af\` as Autoflow PRD handoff triggers."
require_line "${project_dir}/.codex/skills/autoflow/agents/openai.yaml" "  display_name: \"Autoflow\""

spec_output="${project_dir}/spec.out"
start_output="${project_dir}/start.out"
verify_output="${project_dir}/verify.out"
finish_output="${project_dir}/finish.out"
merge_output="${project_dir}/merge.out"
status_output="${project_dir}/status.out"
runner_list_output="${project_dir}/runner-list.out"
runner_set_output="${project_dir}/runner-set.out"
runner_dry_run_output="${project_dir}/runner-dry-run.out"
wiki_runner_dry_run_output="${project_dir}/wiki-runner-dry-run.out"
runner_loop_start_output="${project_dir}/runner-loop-start.out"
runner_loop_list_output="${project_dir}/runner-loop-list.out"
runner_loop_stop_output="${project_dir}/runner-loop-stop.out"
coordinator_idle_output="${project_dir}/coordinator-idle.out"

"${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC' >"$spec_output"
# Project Spec

## Meta

- Project Key: project_001
- Title: Owner smoke project
- Status: populated

## Goal

Create a tiny owner-mode smoke artifact.

## Core Scope

### In Scope

- Create `owner-done.txt` in the project root.

### Out of Scope

- No app code changes.

## Main Screens / Modules

- `owner-done.txt`

## Global Acceptance Criteria

- `owner-done.txt` exists.

## Verification

- Command: test -f owner-done.txt

## Notes

- Temporary runtime smoke spec.
SPEC

require_line "$spec_output" "status=created"

"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_list_output"
require_line "$runner_list_output" "status=ok"
require_line "$runner_list_output" "runner_count=4"
require_line "$runner_list_output" "runner.1.id=owner-1"
require_line "$runner_list_output" "runner.4.id=coordinator-1"
require_line "$runner_list_output" "runner.4.mode=loop"

"${REPO_ROOT}/bin/autoflow" runners add owner-shell-1 ticket-owner "$project_dir" agent=shell model=smoke-model >"$runner_set_output"
require_line "$runner_set_output" "status=ok"
require_line "$runner_set_output" "result=runner_added"
require_line "$runner_set_output" "runner_id=owner-shell-1"
require_line "$runner_set_output" "mode=one-shot"
require_line "$runner_set_output" "model=smoke-model"

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" --runner owner-shell-1 --dry-run >"$runner_dry_run_output"
require_line "$runner_dry_run_output" "status=dry_run"
require_line "$runner_dry_run_output" "runner_status=idle"

"${REPO_ROOT}/bin/autoflow" runners add coordinator-shell-loop coordinator "$project_dir" agent=shell mode=loop interval_seconds=1 >/dev/null
AUTOFLOW_RUNNER_LOOP_INTERVAL_SECONDS=1 "${REPO_ROOT}/bin/autoflow" runners start coordinator-shell-loop "$project_dir" >"$runner_loop_start_output"
require_line "$runner_loop_start_output" "status=ok"
require_line "$runner_loop_start_output" "result=started"
require_line "$runner_loop_start_output" "runner_id=coordinator-shell-loop"
sleep 2
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$runner_loop_list_output"
require_line "$runner_loop_list_output" "runner.6.id=coordinator-shell-loop"
require_line "$runner_loop_list_output" "runner.6.state_status=running"
"${REPO_ROOT}/bin/autoflow" runners stop coordinator-shell-loop "$project_dir" >"$runner_loop_stop_output"
require_line "$runner_loop_stop_output" "status=ok"
require_line "$runner_loop_stop_output" "runner_status=stopped"

"${REPO_ROOT}/bin/autoflow" runners add coordinator-codex-direct coordinator "$project_dir" agent=codex command=false >/dev/null
"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-codex-direct >"$coordinator_idle_output"
require_line "$coordinator_idle_output" "status=ok"
require_line "$coordinator_idle_output" "role=coordinator"
require_line "$coordinator_idle_output" "runner_id=coordinator-codex-direct"
require_line "$coordinator_idle_output" "runner_status=idle"
require_line "$coordinator_idle_output" "runtime_status=idle"
require_line "$coordinator_idle_output" "reason=no_problem_detected"
require_line "$coordinator_idle_output" "coordinator.problem_detected=false"
require_line "$coordinator_idle_output" "coordinator.diagnosis_attempted=false"
if grep -Fq "doctor_output_begin" "$coordinator_idle_output"; then
  echo "Coordinator should skip full doctor output when cheap precheck sees no problem" >&2
  cat "$coordinator_idle_output" >&2
  exit 1
fi

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"
require_line "$start_output" "stage=planning"

: >"${project_dir}/owner-done.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/verify-ticket-owner.sh 001 >"$verify_output"
require_line "$verify_output" "status=pass"
require_line "$verify_output" "ticket_id=001"
require_line "$verify_output" "exit_code=0"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/finish-ticket-owner.sh 001 pass "owner smoke artifact verified" >"$finish_output"
require_line "$finish_output" "status=ready_to_merge"
require_line "$finish_output" "outcome=pass"
require_line "$finish_output" "commit_status=not_committed_waiting_for_merge_bot"

"${REPO_ROOT}/bin/autoflow" runners add coordinator-shell-1 coordinator "$project_dir" agent=shell >/dev/null
"${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" --runner coordinator-shell-1 --dry-run >"$wiki_runner_dry_run_output"
require_line "$wiki_runner_dry_run_output" "status=dry_run"
require_line "$wiki_runner_dry_run_output" "role=wiki"
require_line "$wiki_runner_dry_run_output" "runner_id=coordinator-shell-1"
"${REPO_ROOT}/bin/autoflow" run coordinator "$project_dir" --runner coordinator-shell-1 >"$merge_output"
require_line "$merge_output" "status=ok"
require_line "$merge_output" "role=coordinator"
require_line "$merge_output" "runtime_status=ok"
require_line "$merge_output" "coordinator.ready_to_merge_count=1"
require_line "$merge_output" "coordinator.merge_attempted=true"
require_line "$merge_output" "coordinator.merge_ticket_id=001"
require_line "$merge_output" "coordinator.merge_status=done"
require_line "$merge_output" "outcome=pass"
require_line "$merge_output" "wiki.status=updated"
require_line "$merge_output" "wiki_maintainer.status=skipped_no_runner"
require_line "$merge_output" "commit_status=committed"
require_pattern "$merge_output" '^commit_hash=[0-9a-f]{40}$'
require_line "${project_dir}/.autoflow/wiki/index.md" "<!-- AUTOFLOW:BEGIN work-map -->"
require_pattern "${project_dir}/.autoflow/wiki/project-overview.md" 'Done tickets: 1'

"${REPO_ROOT}/bin/autoflow" status "$project_dir" >"$status_output"
require_line "$status_output" "status=initialized"
require_line "$status_output" "ticket_inprogress_count=0"
require_line "$status_output" "ticket_ready_to_merge_count=0"
require_line "$status_output" "ticket_done_count=1"
require_line "$status_output" "ticket_owner_active_count=0"

echo "status=ok"
echo "project_root=$project_dir"
echo "commit_hash=$(git -C "$project_dir" rev-parse --verify HEAD)"
