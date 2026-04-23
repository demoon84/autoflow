#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "verifier"

worker_id="$(owner_id)"
worker_role_value="$(worker_role)"

verifier_dir="${BOARD_ROOT}/tickets/verifier"
mkdir -p "$verifier_dir"

select_verification_target() {
  local requested_id="${1:-}"
  local candidate_file candidate_verifier_owner candidate_owner id

  if [ -n "$requested_id" ]; then
    id="$(normalize_id "$requested_id")"
    printf '%s' "${verifier_dir}/tickets_${id}.md"
    return 0
  fi

  while IFS= read -r candidate_file; do
    [ -n "$candidate_file" ] || continue

    if [ "$worker_role_value" = "verifier" ]; then
      candidate_verifier_owner="$(ticket_scalar_field "$candidate_file" "Verifier Owner")"
      candidate_owner="$(ticket_scalar_field "$candidate_file" "Owner")"
      if [ "$candidate_verifier_owner" = "$worker_id" ] || \
         { field_is_unassigned "$candidate_verifier_owner" && [ "$candidate_owner" = "$worker_id" ]; } || \
         field_is_unassigned "$candidate_verifier_owner"; then
        printf '%s' "$candidate_file"
        return 0
      fi
      continue
    fi

    printf '%s' "$candidate_file"
    return 0
  done < <(list_matching_files "$verifier_dir" 'tickets_*.md')

  return 1
}

target_file="$(select_verification_target "${1:-}" || true)"

if [ -z "$target_file" ] || [ ! -f "$target_file" ]; then
  fail_or_idle "No ticket in tickets/verifier/ awaiting verification." "no_verification_ticket"
fi

current_verifier_owner="$(ticket_scalar_field "$target_file" "Verifier Owner")"
if [ "$worker_role_value" = "verifier" ] && \
   ! field_is_unassigned "$current_verifier_owner" && \
   [ "$current_verifier_owner" != "$worker_id" ]; then
  fail_or_idle "Ticket is assigned to a different verifier owner: ${current_verifier_owner}" "verifier_owner_mismatch"
fi

ticket_id="$(extract_numeric_id "$target_file")"
ticket_title="$(ticket_scalar_field "$target_file" "Title")"
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

printf 'status=ok\n'
printf 'verify=%s\n' "$target_file"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'ticket_title=%s\n' "$ticket_title"
printf 'run=%s\n' "$run_file"
printf 'worker_id=%s\n' "$worker_id"
printf 'stage=verifying\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
cat <<EOF
routing_pass=Move the ticket file to tickets/done/tickets_${ticket_id}.md, then from PROJECT_ROOT run: git add . && git commit -m "[tickets_${ticket_id}] ${ticket_title}". Never run git push.
routing_fail=Move the ticket file to tickets/reject/tickets_${ticket_id}.md and append a ## Reject Reason section describing what failed and what the planner should re-address.
EOF
