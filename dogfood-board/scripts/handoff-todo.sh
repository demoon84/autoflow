#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "todo"

resolve_ticket_path() {
  local requested="${1:-}"
  local normalized requested_path active_path active_id candidate owner execution_owner claimed_by worker_id

  if [ -n "$requested" ]; then
    if normalized="$(normalize_id "$requested" 2>/dev/null)"; then
      requested_path="$(ticket_path "inprogress" "$normalized")"
      if [ -f "$requested_path" ]; then
        printf '%s' "$requested_path"
        return 0
      fi
    fi

    requested_path="$(normalize_runtime_path "$requested")"
    case "$requested_path" in
      /*) ;;
      tickets/*|./tickets/*)
        requested_path="${BOARD_ROOT}/${requested_path#./}"
        ;;
      *)
        requested_path="${BOARD_ROOT}/tickets/inprogress/${requested_path}"
        ;;
    esac

    if [ -f "$requested_path" ]; then
      printf '%s' "$requested_path"
      return 0
    fi
  fi

  active_path="$(context_effective_value "active_ticket_path" || true)"
  if [ -n "$active_path" ]; then
    requested_path="$(normalize_runtime_path "$active_path")"
    case "$requested_path" in
      /*) ;;
      *) requested_path="${BOARD_ROOT}/${requested_path}" ;;
    esac
    if [ -f "$requested_path" ]; then
      printf '%s' "$requested_path"
      return 0
    fi
  fi

  active_id="$(context_effective_value "active_ticket_id" || true)"
  if [ -n "$active_id" ] && normalized="$(normalize_id "$active_id" 2>/dev/null)"; then
    requested_path="$(ticket_path "inprogress" "$normalized")"
    if [ -f "$requested_path" ]; then
      printf '%s' "$requested_path"
      return 0
    fi
  fi

  worker_id="$(owner_id)"
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    execution_owner="$(ticket_scalar_field "$candidate" "Execution Owner")"
    owner="$(ticket_scalar_field "$candidate" "Owner")"
    claimed_by="$(ticket_scalar_field "$candidate" "Claimed By")"
    if [ "$execution_owner" = "$worker_id" ] || [ "$owner" = "$worker_id" ] || [ "$claimed_by" = "$worker_id" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  return 1
}

ticket_file="$(resolve_ticket_path "${1:-}" || true)"
if [ -z "$ticket_file" ] || [ ! -f "$ticket_file" ]; then
  fail_or_idle "No inprogress todo ticket found for handoff." "no_inprogress_ticket"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
target_file="$(ticket_path "verifier" "$ticket_id")"
timestamp="$(now_iso)"
result_summary="$(extract_scalar_field_in_section "$ticket_file" "Result" "Summary" || true)"

if [ -e "$target_file" ]; then
  echo "Verifier ticket already exists: $target_file" >&2
  exit 1
fi

mkdir -p "$(dirname "$target_file")"

replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "verifier"
replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$ticket_file" "Verification" "- Run file:
- Log file:
- Result: pending"
replace_section_block "$ticket_file" "Next Action" "- Next: verifier heartbeat should run the ticket checks from \`tickets/verifier/\`."
replace_section_block "$ticket_file" "Resume Context" "- Current state: implementation work is complete and the ticket has been handed off for verification.
- Last runtime action: scripts/handoff-todo.* moved the ticket from \`tickets/inprogress/\` to \`tickets/verifier/\`.
- Next reader: verifier should review Done When, Verification command, Notes, and the ticket worktree."
if [ -z "$(trim_spaces "$result_summary")" ]; then
  replace_scalar_field_in_section "$ticket_file" "## Result" "Summary" "Implementation completed; awaiting verifier."
fi
append_note "$ticket_file" "Handed off to verifier at ${timestamp} via scripts/handoff-todo.*"

mv "$ticket_file" "$target_file"

printf 'status=ok\n'
printf 'ticket_id=%s\n' "$ticket_id"
printf 'handoff=%s\n' "$target_file"
printf 'stage=verifier\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
if clear_active_ticket_context_record 2>/dev/null; then
  printf 'context=active_cleared\n'
else
  printf 'context=no_context\n'
fi
