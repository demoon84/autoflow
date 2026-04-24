#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

project_root_input="${1:-.}"
board_dir_name="${2:-autoflow}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
package_version="$(package_version_value)"

error_count=0
warning_count=0
check_output="$(mktemp)"
detail_output="$(mktemp)"

cleanup() {
  rm -f "$check_output" "$detail_output"
}
trap cleanup EXIT

record_check() {
  local check_id="$1"
  local result="$2"
  printf 'check.%s=%s\n' "$check_id" "$result" >> "$check_output"
}

record_error() {
  local message="$1"
  error_count=$((error_count + 1))
  printf 'error.%s=%s\n' "$error_count" "$message" >> "$detail_output"
}

record_warning() {
  local message="$1"
  warning_count=$((warning_count + 1))
  printf 'warning.%s=%s\n' "$warning_count" "$message" >> "$detail_output"
}

ticket_field_present() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    /^## Ticket/ { in_ticket=1; next }
    /^## / && in_ticket { in_ticket=0 }
    in_ticket && $0 ~ "^- " field ":" { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

if [ -d "$board_root" ]; then
  record_check "board_root_exists" "ok"
else
  record_check "board_root_exists" "error"
  record_error "board root does not exist: ${board_root}"
fi

if [ -f "${project_root}/AGENTS.md" ]; then
  record_check "host_agents" "ok"
else
  record_check "host_agents" "error"
  record_error "host AGENTS.md is missing: ${project_root}/AGENTS.md"
fi

if [ -d "$board_root" ]; then
  if [ -f "${board_root}/AGENTS.md" ]; then
    record_check "board_agents" "ok"
  else
    record_check "board_agents" "error"
    record_error "board AGENTS.md is missing: ${board_root}/AGENTS.md"
  fi

  if [ -f "${board_root}/README.md" ]; then
    record_check "board_readme" "ok"
  else
    record_check "board_readme" "error"
    record_error "board README.md is missing: ${board_root}/README.md"
  fi

  for required_dir in agents automations reference rules scripts tickets logs; do
    if [ -d "${board_root}/${required_dir}" ]; then
      record_check "dir_${required_dir}" "ok"
    else
      record_check "dir_${required_dir}" "error"
      record_error "required board directory is missing: ${board_root}/${required_dir}"
    fi
  done

  for ticket_dir in todo inprogress verifier done reject; do
    if [ -d "${board_root}/tickets/${ticket_dir}" ]; then
      record_check "tickets_${ticket_dir}" "ok"
    else
      record_check "tickets_${ticket_dir}" "error"
      record_error "ticket state directory is missing: ${board_root}/tickets/${ticket_dir}"
    fi
  done

  for required_nested_dir in \
    "tickets/backlog" \
    "rules/verifier" \
    "logs/hooks" \
    "tickets/plan" \
    "automations/state" \
    "automations/state/threads"
  do
    if [ -d "${board_root}/${required_nested_dir}" ]; then
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "ok"
    else
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "error"
      record_error "required nested board directory is missing: ${board_root}/${required_nested_dir}"
    fi
  done

  runner_scaffold_ok="true"
  for runner_scaffold_path in \
    "runners" \
    "runners/state" \
    "runners/logs" \
    "runners/config.toml"
  do
    if [ ! -e "${board_root}/${runner_scaffold_path}" ]; then
      runner_scaffold_ok="false"
    fi
  done
  if [ "$runner_scaffold_ok" = "true" ]; then
    record_check "runner_scaffold" "ok"
  else
    record_check "runner_scaffold" "warning"
    record_warning "runner scaffold is missing or incomplete; run autoflow upgrade to add runners/config.toml, runners/state, and runners/logs"
  fi

  wiki_scaffold_ok="true"
  for wiki_scaffold_path in \
    "wiki" \
    "wiki/index.md" \
    "wiki/log.md" \
    "wiki/project-overview.md" \
    "rules/wiki"
  do
    if [ ! -e "${board_root}/${wiki_scaffold_path}" ]; then
      wiki_scaffold_ok="false"
    fi
  done
  if [ "$wiki_scaffold_ok" = "true" ]; then
    record_check "wiki_scaffold" "ok"
  else
    record_check "wiki_scaffold" "warning"
    record_warning "wiki scaffold is missing or incomplete; run autoflow upgrade to add wiki pages and rules/wiki"
  fi

  for runtime_file in common.sh check-stop.sh file-watch-common.sh install-stop-hook.sh run-hook.sh watch-board.sh set-thread-context.sh clear-thread-context.sh start-plan.sh start-todo.sh handoff-todo.sh start-verifier.sh start-spec.sh integrate-worktree.sh write-verifier-log.sh; do
    if [ -f "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}" "ok"
    else
      record_check "script_${runtime_file}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_file}"
      continue
    fi

    if [ -x "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}_executable" "ok"
    else
      record_check "script_${runtime_file}_executable" "error"
      record_error "runtime script is not executable: ${board_root}/scripts/${runtime_file}"
    fi
  done

  for runtime_ps1 in invoke-runtime-sh.ps1 check-stop.ps1 install-stop-hook.ps1 set-thread-context.ps1 clear-thread-context.ps1 start-spec.ps1 start-plan.ps1 start-todo.ps1 handoff-todo.ps1 start-verifier.ps1 integrate-worktree.ps1 write-verifier-log.ps1 run-hook.ps1 watch-board.ps1; do
    if [ -f "${board_root}/scripts/${runtime_ps1}" ]; then
      record_check "script_${runtime_ps1}" "ok"
    else
      record_check "script_${runtime_ps1}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_ps1}"
    fi
  done

  if [ -f "${board_root}/.project-root" ]; then
    marker_value="$(project_root_marker_value "$board_root")"
    record_check "project_root_marker" "ok"
    printf 'project_root_marker_value=%s\n' "$marker_value" >> "$check_output"

    if resolved_project_root="$(resolve_project_root_from_board "$board_root" 2>/dev/null)"; then
      record_check "project_root_marker_resolves" "ok"
      printf 'project_root_marker_resolved=%s\n' "$resolved_project_root" >> "$check_output"
      if [ "$resolved_project_root" = "$project_root" ]; then
        record_check "project_root_marker_matches_host" "ok"
      else
        record_check "project_root_marker_matches_host" "error"
        record_error "project-root marker resolves to ${resolved_project_root}, expected ${project_root}"
      fi
    else
      record_check "project_root_marker_resolves" "error"
      record_error "project-root marker could not be resolved from ${board_root}/.project-root"
    fi
  else
    record_check "project_root_marker" "error"
    record_error "board project-root marker is missing: ${board_root}/.project-root"
  fi

  if board_version="$(board_version_value "$board_root" 2>/dev/null)"; then
    record_check "board_version_marker" "ok"
    printf 'board_version=%s\n' "$board_version" >> "$check_output"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"

    if [ "$board_version" = "$package_version" ]; then
      record_check "board_version_matches_package" "ok"
    else
      record_check "board_version_matches_package" "warning"
      record_warning "board version ${board_version} differs from package version ${package_version}; run autoflow upgrade"
    fi
  else
    record_check "board_version_marker" "warning"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"
    record_warning "board version marker is missing: ${board_root}/.autoflow-version"
  fi

  for starter_file in \
    "automations/heartbeat-set.toml" \
    "automations/file-watch.psd1" \
    "automations/state/README.md" \
    "automations/state/.gitignore" \
    "reference/README.md" \
    "reference/backlog.md" \
    "reference/backlog-processed.md" \
    "reference/project-spec-template.md" \
    "reference/feature-spec-template.md" \
    "reference/plan.md" \
    "reference/plan-template.md" \
    "reference/roadmap.md" \
    "reference/tickets-board.md" \
    "reference/ticket-template.md" \
    "reference/logs.md" \
    "reference/hook-logs.md" \
    "automations/templates/heartbeat-set.template.toml" \
    "automations/templates/plan-heartbeat.template.toml" \
    "automations/templates/todo-heartbeat.template.toml" \
    "automations/templates/verifier-heartbeat.template.toml" \
    "rules/verifier/checklist-template.md" \
    "rules/verifier/verification-template.md"
  do
    if [ -f "${board_root}/${starter_file}" ]; then
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "ok"
    else
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "error"
      record_error "starter file is missing: ${board_root}/${starter_file}"
    fi
  done

  for forbidden_state_file in \
    "tickets/backlog/README.md" \
    "tickets/backlog/project-spec-template.md" \
    "tickets/backlog/feature-spec-template.md" \
    "tickets/backlog/processed/README.md" \
    "tickets/plan/README.md" \
    "tickets/plan/plan_template.md" \
    "tickets/plan/roadmap.md" \
    "tickets/README.md" \
    "tickets/tickets_template.md" \
    "logs/README.md" \
    "logs/hooks/README.md"
  do
    if [ -f "${board_root}/${forbidden_state_file}" ]; then
      record_check "state_doc_$(printf '%s' "$forbidden_state_file" | tr '/.-' '___')" "error"
      record_error "state folder contains reference/template file; move it under reference/: ${board_root}/${forbidden_state_file}"
    fi
  done

  if [ -d "${board_root}/tickets/plan/inprogress" ] && find "${board_root}/tickets/plan/inprogress" -maxdepth 1 -type f -name 'plan_*.md' -print -quit | grep -q .; then
    record_check "legacy_plan_inprogress_empty" "error"
    record_error "legacy plan inprogress folder still contains plan files; use tickets/inprogress instead: ${board_root}/tickets/plan/inprogress"
  fi

  if [ -d "${board_root}/tickets/reject" ] && find "${board_root}/tickets/reject" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' -print -quit | grep -q .; then
    record_check "legacy_reject_ticket_names" "error"
    record_error "reject folder still contains tickets_NNN.md files; run autoflow upgrade so failed tickets use reject_NNN.md: ${board_root}/tickets/reject"
  else
    record_check "legacy_reject_ticket_names" "ok"
  fi

  if [ -f "${board_root}/reference/ticket-template.md" ]; then
    for required_ticket_field in "Plan Candidate" "Stage" "Claimed By" "Execution Owner" "Verifier Owner"; do
      check_field_id="$(printf '%s' "$required_ticket_field" | tr ' ' '_')"
      if ticket_field_present "${board_root}/reference/ticket-template.md" "$required_ticket_field"; then
        record_check "ticket_template_${check_field_id}" "ok"
      else
        record_check "ticket_template_${check_field_id}" "error"
        record_error "ticket template is missing field ${required_ticket_field}: ${board_root}/reference/ticket-template.md"
      fi
    done
  fi

  if [ -d "${board_root}/tickets/inprogress" ]; then
    while IFS= read -r live_ticket; do
      [ -n "$live_ticket" ] || continue
      for required_live_field in "Stage" "Execution Owner" "Verifier Owner"; do
        if ticket_field_present "$live_ticket" "$required_live_field"; then
          continue
        fi
        record_warning "live inprogress ticket is missing field ${required_live_field}: ${live_ticket}"
      done
    done < <(find "${board_root}/tickets/inprogress" -maxdepth 1 -type f -name 'tickets_*.md' | sort)
  fi

  if board_is_initialized "$board_root"; then
    record_check "board_initialized" "ok"
  else
    record_check "board_initialized" "warning"
    record_warning "board root exists but does not look fully initialized"
  fi
fi

status="ok"
if [ "$error_count" -gt 0 ]; then
  status="fail"
fi

printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'status=%s\n' "$status"
printf 'package_version=%s\n' "$package_version"
printf 'error_count=%s\n' "$error_count"
printf 'warning_count=%s\n' "$warning_count"
cat "$check_output"
cat "$detail_output"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi
