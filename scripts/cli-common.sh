#!/usr/bin/env bash

set -euo pipefail

CLI_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_VERSION_FILE="$(cd "${CLI_COMMON_DIR}/.." && pwd)/VERSION"

resolve_project_root_or_die() {
  local raw_path="$1"

  if [ ! -d "$raw_path" ]; then
    echo "Project root not found: $raw_path" >&2
    exit 1
  fi

  cd "$raw_path" && pwd
}

board_root_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/%s' "$project_root" "$board_dir_name"
}

board_is_initialized() {
  local board_root="$1"
  [ -f "${board_root}/AGENTS.md" ] && [ -d "${board_root}/tickets" ] && [ -d "${board_root}/rules/spec" ]
}

package_version_value() {
  if [ -f "$PACKAGE_VERSION_FILE" ]; then
    tr -d '\r\n' < "$PACKAGE_VERSION_FILE"
    return 0
  fi

  printf '0.0.0-dev'
}

board_version_value() {
  local board_root="$1"

  if [ ! -f "${board_root}/.autopilot-version" ]; then
    return 1
  fi

  tr -d '\r\n' < "${board_root}/.autopilot-version"
}

project_root_marker_value() {
  local board_root="$1"
  local configured

  if [ ! -f "${board_root}/.project-root" ]; then
    return 1
  fi

  configured="$(tr -d '\r\n' < "${board_root}/.project-root")"
  if [ -z "$configured" ]; then
    configured=".."
  fi

  printf '%s' "$configured"
}

resolve_project_root_from_board() {
  local board_root="$1"
  local configured resolved

  configured="$(project_root_marker_value "$board_root")"
  case "$configured" in
    /*) resolved="$configured" ;;
    *) resolved="${board_root}/${configured}" ;;
  esac

  if [ ! -d "$resolved" ]; then
    return 1
  fi

  cd "$resolved" && pwd
}

count_matching_files() {
  local search_root="$1"
  local pattern="$2"

  if [ ! -d "$search_root" ]; then
    printf '0'
    return 0
  fi

  find "$search_root" -maxdepth 1 -type f -name "$pattern" | wc -l | tr -d ' '
}

count_numbered_plan_files() {
  local plan_root="$1"

  if [ ! -d "$plan_root" ]; then
    printf '0'
    return 0
  fi

  find "$plan_root" -maxdepth 1 -type f -name 'plan_[0-9][0-9][0-9].md' | wc -l | tr -d ' '
}

count_active_specs() {
  local spec_root="$1"

  if [ ! -d "$spec_root" ]; then
    printf '0'
    return 0
  fi

  find "$spec_root" -maxdepth 1 -type f -name '*.md' ! -name 'README.md' ! -name '*template*.md' | wc -l | tr -d ' '
}

count_plan_status() {
  local plan_root="$1"
  local wanted_status="$2"
  local count file

  count=0
  if [ ! -d "$plan_root" ]; then
    printf '0'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if awk -v wanted_status="$wanted_status" '
      /^## Plan/ { in_plan=1; next }
      /^## / && in_plan { in_plan=0 }
      in_plan && $0 == "- Status: " wanted_status { found=1 }
      END { exit(found ? 0 : 1) }
    ' "$file"; then
      count=$((count + 1))
    fi
  done < <(find "$plan_root" -maxdepth 1 -type f -name 'plan_[0-9][0-9][0-9].md' | sort)

  printf '%s' "$count"
}

count_ticket_stage() {
  local ticket_root="$1"
  local wanted_stage="$2"
  local count=0
  local file

  if [ ! -d "$ticket_root" ]; then
    printf '0'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if awk -v wanted_stage="$wanted_stage" '
      /^## Ticket/ { in_ticket=1; next }
      /^## / && in_ticket { in_ticket=0 }
      in_ticket && $0 == "- Stage: " wanted_stage { found=1 }
      END { exit(found ? 0 : 1) }
    ' "$file"; then
      count=$((count + 1))
    fi
  done < <(find "$ticket_root" -maxdepth 1 -type f -name 'tickets_*.md' | sort)

  printf '%s' "$count"
}

board_version_status() {
  local board_root="$1"
  local package_version board_version

  if [ ! -d "$board_root" ]; then
    printf 'missing_board'
    return 0
  fi

  package_version="$(package_version_value)"
  board_version="$(board_version_value "$board_root" || true)"

  if [ -z "$board_version" ]; then
    printf 'missing_board_version'
    return 0
  fi

  if [ "$board_version" = "$package_version" ]; then
    printf 'up_to_date'
    return 0
  fi

  printf 'different'
}

print_status_summary() {
  local project_root="$1"
  local board_root="$2"
  local board_dir_name="$3"
  local summary_status="$4"
  local initialized="$5"
  local host_agents_present="$6"
  local board_agents_present="$7"
  local board_readme_present="$8"
  local marker_present="$9"
  local marker_value="${10}"
  local marker_resolved="${11}"
  local spec_count="${12}"
  local plan_count="${13}"
  local plan_draft_count="${14}"
  local plan_ready_count="${15}"
  local plan_ticketed_count="${16}"
  local plan_done_count="${17}"
  local ticket_todo_count="${18}"
  local ticket_inprogress_count="${19}"
  local ticket_done_count="${20}"
  local ticket_claimed_count="${21}"
  local ticket_executing_count="${22}"
  local ticket_ready_for_verification_count="${23}"
  local ticket_verifying_count="${24}"
  local ticket_blocked_count="${25}"
  local verify_run_count="${26}"
  local package_version="${27}"
  local board_version="${28}"
  local version_status="${29}"

  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'board_dir_name=%s\n' "$board_dir_name"
  printf 'status=%s\n' "$summary_status"
  printf 'package_version=%s\n' "$package_version"
  printf 'board_version=%s\n' "$board_version"
  printf 'version_status=%s\n' "$version_status"
  printf 'initialized=%s\n' "$initialized"
  printf 'host_agents_present=%s\n' "$host_agents_present"
  printf 'board_agents_present=%s\n' "$board_agents_present"
  printf 'board_readme_present=%s\n' "$board_readme_present"
  printf 'project_root_marker_present=%s\n' "$marker_present"
  printf 'project_root_marker_value=%s\n' "$marker_value"
  printf 'project_root_marker_resolved=%s\n' "$marker_resolved"
  printf 'spec_count=%s\n' "$spec_count"
  printf 'plan_count=%s\n' "$plan_count"
  printf 'plan_draft_count=%s\n' "$plan_draft_count"
  printf 'plan_ready_count=%s\n' "$plan_ready_count"
  printf 'plan_ticketed_count=%s\n' "$plan_ticketed_count"
  printf 'plan_done_count=%s\n' "$plan_done_count"
  printf 'ticket_todo_count=%s\n' "$ticket_todo_count"
  printf 'ticket_inprogress_count=%s\n' "$ticket_inprogress_count"
  printf 'ticket_done_count=%s\n' "$ticket_done_count"
  printf 'ticket_claimed_count=%s\n' "$ticket_claimed_count"
  printf 'ticket_executing_count=%s\n' "$ticket_executing_count"
  printf 'ticket_ready_for_verification_count=%s\n' "$ticket_ready_for_verification_count"
  printf 'ticket_verifying_count=%s\n' "$ticket_verifying_count"
  printf 'ticket_blocked_count=%s\n' "$ticket_blocked_count"
  printf 'verify_run_count=%s\n' "$verify_run_count"
}
