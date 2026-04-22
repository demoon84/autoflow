#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "verifier"

worker_id="$(owner_id)"
worker_role_value="$(worker_role)"

select_verification_target() {
  local requested_id="${1:-}"
  local candidate_file candidate_stage candidate_owner candidate_verifier_owner

  if [ -n "$requested_id" ]; then
    printf '%s' "$(ticket_path "inprogress" "$(normalize_id "$requested_id")")"
    return 0
  fi

  while IFS= read -r candidate_file; do
    [ -n "$candidate_file" ] || continue
    candidate_stage="$(ticket_stage "$candidate_file")"
    if ! stage_is_verification_candidate "$candidate_stage"; then
      continue
    fi

    if [ "$worker_role_value" = "verifier" ]; then
      candidate_verifier_owner="$(ticket_scalar_field "$candidate_file" "Verifier Owner")"
      candidate_owner="$(ticket_scalar_field "$candidate_file" "Owner")"
      if [ "$candidate_verifier_owner" = "$worker_id" ] || \
         { field_is_unassigned "$candidate_verifier_owner" && [ "$candidate_owner" = "$worker_id" ]; }; then
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

target_file="$(select_verification_target "${1:-}" || true)"

if [ -z "$target_file" ] || [ ! -f "$target_file" ]; then
  fail_or_idle "No inprogress ticket found for verification." "no_verification_ticket"
fi

current_verifier_owner="$(ticket_scalar_field "$target_file" "Verifier Owner")"
if [ "$worker_role_value" = "verifier" ] && \
   ! field_is_unassigned "$current_verifier_owner" && \
   [ "$current_verifier_owner" != "$worker_id" ]; then
  echo "Ticket is assigned to a different verifier owner: ${current_verifier_owner}" >&2
  exit 1
fi

ticket_id="$(extract_numeric_id "$target_file")"
run_file="$(ensure_runs_file "$ticket_id")"
timestamp="$(now_iso)"

replace_scalar_field_in_section "$run_file" "## Meta" "Status" "pending"
replace_scalar_field_in_section "$run_file" "## Meta" "Working Root" "$PROJECT_ROOT"
replace_scalar_field_in_section "$target_file" "## Ticket" "Stage" "verifying"
replace_scalar_field_in_section "$target_file" "## Ticket" "Owner" "$worker_id"
if field_is_unassigned "$current_verifier_owner"; then
  replace_scalar_field_in_section "$target_file" "## Ticket" "Verifier Owner" "$worker_id"
fi
replace_scalar_field_in_section "$target_file" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$target_file" "Verification" "- Run file: \`tickets/runs/$(basename "$run_file")\`
- Result: pending verifier by ${worker_id}"
append_note "$target_file" "Verifier prepared by ${worker_id} via scripts/start-verifier.sh at ${timestamp}"

printf 'verify=%s\n' "$target_file"
printf 'run=%s\n' "$run_file"
printf 'worker_id=%s\n' "$worker_id"
printf 'stage=verifying\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'hint=Run verification from PROJECT_ROOT, then record the result in the run file.\n'
