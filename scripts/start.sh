#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "execution"

worker_id="$(owner_id)"
worker_role_value="$(worker_role)"

select_execution_target() {
  local requested_id="${1:-}"
  local candidate_file candidate_stage candidate_owner candidate_execution_owner

  if [ -n "$requested_id" ]; then
    printf '%s' "$(ticket_path "inprogress" "$(normalize_id "$requested_id")")"
    return 0
  fi

  while IFS= read -r candidate_file; do
    [ -n "$candidate_file" ] || continue
    candidate_stage="$(ticket_stage "$candidate_file")"
    if ! stage_is_execution_candidate "$candidate_stage"; then
      continue
    fi

    if [ "$worker_role_value" = "execution" ]; then
      candidate_execution_owner="$(ticket_scalar_field "$candidate_file" "Execution Owner")"
      candidate_owner="$(ticket_scalar_field "$candidate_file" "Owner")"
      if [ "$candidate_execution_owner" = "$worker_id" ] || \
         { field_is_unassigned "$candidate_execution_owner" && [ "$candidate_owner" = "$worker_id" ]; }; then
        printf '%s' "$candidate_file"
        return 0
      fi
      continue
    fi

    printf '%s' "$candidate_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  return 1
}

target_file="$(select_execution_target "${1:-}" || true)"

if [ -z "$target_file" ] || [ ! -f "$target_file" ]; then
  fail_or_idle "No inprogress ticket found." "no_execution_ticket"
fi

current_execution_owner="$(ticket_scalar_field "$target_file" "Execution Owner")"
if [ "$worker_role_value" = "execution" ] && \
   ! field_is_unassigned "$current_execution_owner" && \
   [ "$current_execution_owner" != "$worker_id" ]; then
  echo "Ticket is assigned to a different execution owner: ${current_execution_owner}" >&2
  exit 1
fi

timestamp="$(now_iso)"
replace_scalar_field_in_section "$target_file" "## Ticket" "Stage" "executing"
replace_scalar_field_in_section "$target_file" "## Ticket" "Owner" "$worker_id"
if field_is_unassigned "$current_execution_owner"; then
  replace_scalar_field_in_section "$target_file" "## Ticket" "Execution Owner" "$worker_id"
fi
replace_scalar_field_in_section "$target_file" "## Ticket" "Last Updated" "$timestamp"
append_note "$target_file" "Execution resumed by ${worker_id} via scripts/start.sh at ${timestamp}"

ticket_id="$(extract_numeric_id "$target_file")"
printf 'resume=%s\n' "$target_file"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'worker_id=%s\n' "$worker_id"
printf 'stage=executing\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'hint=Read Resume Context and Next Action first.\n'
