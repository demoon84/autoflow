#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

initialized="false"
host_agents_present="false"
board_agents_present="false"
board_readme_present="false"
marker_present="false"
marker_value=""
marker_resolved=""
spec_count="0"
plan_count="0"
plan_draft_count="0"
plan_ready_count="0"
plan_ticketed_count="0"
plan_done_count="0"
ticket_todo_count="0"
ticket_inprogress_count="0"
ticket_done_count="0"
ticket_planning_count="0"
ticket_claimed_count="0"
ticket_executing_count="0"
ticket_ready_for_verification_count="0"
ticket_verifying_count="0"
ticket_blocked_count="0"
verify_run_count="0"
runner_scaffold_present="false"
wiki_scaffold_present="false"
metrics_scaffold_present="false"
conversation_scaffold_present="false"
adapter_scaffold_present="false"
summary_status="missing_board"
package_version="$(package_version_value)"
board_version=""
version_status="missing_board"

if [ -f "${project_root}/AGENTS.md" ]; then
  host_agents_present="true"
fi

if [ -f "${board_root}/AGENTS.md" ]; then
  board_agents_present="true"
fi

if [ -f "${board_root}/README.md" ]; then
  board_readme_present="true"
fi

if [ -f "${board_root}/.project-root" ]; then
  marker_present="true"
  marker_value="$(project_root_marker_value "$board_root")"
  marker_resolved="$(resolve_project_root_from_board "$board_root" || true)"
fi

if [ -d "$board_root" ]; then
  if board_is_initialized "$board_root"; then
    initialized="true"
    summary_status="initialized"
  else
    summary_status="partial_board"
  fi

  spec_count="$(count_active_specs "$(spec_root_path "$board_root")")"
  plan_count="$(count_numbered_plan_files "$(plan_root_path "$board_root")")"
  plan_draft_count="$(count_plan_status "$(plan_root_path "$board_root")" "draft")"
  plan_ready_count="$(count_plan_status "$(plan_root_path "$board_root")" "ready")"
  plan_ticketed_count="$(count_plan_status "$(plan_root_path "$board_root")" "ticketed")"
  plan_done_count="$(( $(count_plan_status "$(plan_root_path "$board_root")" "done") + $(count_plan_status_recursive "${board_root}/tickets/done" "done") ))"
  ticket_todo_count="$(count_matching_files "${board_root}/tickets/todo" 'tickets_*.md')"
  ticket_inprogress_count="$(count_matching_files "${board_root}/tickets/inprogress" 'tickets_*.md')"
  ticket_done_count="$(count_matching_files "${board_root}/tickets/done" 'tickets_*.md')"
  ticket_planning_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "planning")"
  ticket_claimed_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "claimed")"
  ticket_executing_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "executing")"
  ticket_ready_for_verification_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "ready_for_verification")"
  ticket_verifying_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "verifying")"
  ticket_blocked_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "blocked")"
  verify_run_count="$(( \
    $(count_matching_files "${board_root}/tickets/inprogress" 'verify_*.md') + \
    $(count_matching_files "${board_root}/tickets/reject" 'verify_*.md') + \
    $(count_matching_files "${board_root}/tickets/done" 'verify_*.md') + \
    $(count_matching_files "${board_root}/tickets/runs" 'verify_*.md') \
  ))"
  if [ -d "${board_root}/runners" ] && \
     [ -d "${board_root}/runners/state" ] && \
     [ -d "${board_root}/runners/logs" ] && \
     [ -f "${board_root}/runners/config.toml" ]; then
    runner_scaffold_present="true"
  fi
  if [ -d "${board_root}/wiki" ] && \
     [ -f "${board_root}/wiki/index.md" ] && \
     [ -f "${board_root}/wiki/log.md" ] && \
     [ -f "${board_root}/wiki/project-overview.md" ] && \
     [ -d "${board_root}/rules/wiki" ]; then
    wiki_scaffold_present="true"
  fi
  if [ -d "${board_root}/metrics" ] && \
     [ -f "${board_root}/metrics/README.md" ] && \
     [ -f "${board_root}/metrics/.gitignore" ]; then
    metrics_scaffold_present="true"
  fi
  if [ -d "${board_root}/conversations" ] && \
     [ -f "${board_root}/conversations/README.md" ]; then
    conversation_scaffold_present="true"
  fi
  if [ -d "${board_root}/agents/adapters" ] && \
     [ -f "${board_root}/agents/adapters/README.md" ] && \
     [ -f "${board_root}/agents/adapters/shell.md" ] && \
     [ -f "${board_root}/agents/adapters/codex-cli.md" ] && \
     [ -f "${board_root}/agents/adapters/claude-cli.md" ] && \
     [ -f "${board_root}/agents/adapters/opencode.md" ] && \
     [ -f "${board_root}/agents/adapters/gemini-cli.md" ]; then
    adapter_scaffold_present="true"
  fi
  board_version="$(board_version_value "$board_root" || true)"
  version_status="$(board_version_status "$board_root")"
fi

print_status_summary \
  "$project_root" \
  "$board_root" \
  "$board_dir_name" \
  "$summary_status" \
  "$initialized" \
  "$host_agents_present" \
  "$board_agents_present" \
  "$board_readme_present" \
  "$marker_present" \
  "$marker_value" \
  "$marker_resolved" \
  "$spec_count" \
  "$plan_count" \
  "$plan_draft_count" \
  "$plan_ready_count" \
  "$plan_ticketed_count" \
  "$plan_done_count" \
  "$ticket_todo_count" \
  "$ticket_inprogress_count" \
  "$ticket_done_count" \
  "$ticket_claimed_count" \
  "$ticket_executing_count" \
  "$ticket_ready_for_verification_count" \
  "$ticket_verifying_count" \
  "$ticket_blocked_count" \
  "$verify_run_count" \
  "$package_version" \
  "$board_version" \
  "$version_status"

printf 'runner_scaffold_present=%s\n' "$runner_scaffold_present"
printf 'wiki_scaffold_present=%s\n' "$wiki_scaffold_present"
printf 'metrics_scaffold_present=%s\n' "$metrics_scaffold_present"
printf 'conversation_scaffold_present=%s\n' "$conversation_scaffold_present"
printf 'adapter_scaffold_present=%s\n' "$adapter_scaffold_present"
printf 'ticket_planning_count=%s\n' "$ticket_planning_count"
printf 'ticket_owner_active_count=%s\n' "$ticket_inprogress_count"
