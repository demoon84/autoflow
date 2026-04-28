#!/usr/bin/env bash
#
# DEPRECATED: legacy verifier runtime.
#
# In the 3-runner topology (planner-1 + owner-1 + wiki-1), Impl AI
# (`owner-1`) runs AI-led verification inline via
# `verify-ticket-owner.sh` and decides pass/fail based on the
# evidence. There is no separate verifier worker.
#
# This script is kept reachable as `autoflow run verifier` (and the
# `#veri` heartbeat) only for backwards compatibility with users
# still on the legacy role-pipeline. New boards should use the
# ticket-owner flow instead.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "verifier"

worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
worker_role_value="$(worker_role)"
[ -n "$worker_role_value" ] || worker_role_value="verifier"
requested_id="${1:-}"
resume_mode="false"

verifier_dir="${BOARD_ROOT}/tickets/verifier"
mkdir -p "$verifier_dir"

context_active_verification_file() {
  local context_role active_id active_path active_file

  context_role="$(context_effective_value "role" || true)"
  [ "$context_role" = "verifier" ] || return 1

  active_id="$(context_effective_value "active_ticket_id" || true)"
  active_path="$(context_effective_value "active_ticket_path" || true)"
  [ -n "$active_id" ] || return 1

  if [ -n "$active_path" ]; then
    active_file="${BOARD_ROOT}/${active_path}"
  else
    active_file="${verifier_dir}/tickets_${active_id}.md"
  fi

  [ -f "$active_file" ] || return 1
  printf '%s' "$active_file"
}

find_owned_verification_target() {
  local candidate_file candidate_verifier_owner candidate_owner candidate_stage candidate_integration_status

  while IFS= read -r candidate_file; do
    [ -n "$candidate_file" ] || continue

    candidate_integration_status="$(trim_spaces "$(ticket_worktree_field "$candidate_file" "Integration Status")")"
    case "$candidate_integration_status" in
      blocked_*)
        continue
        ;;
    esac

    candidate_verifier_owner="$(ticket_scalar_field "$candidate_file" "Verifier AI")"
    candidate_owner="$(ticket_scalar_field "$candidate_file" "AI")"
    candidate_stage="$(ticket_stage "$candidate_file")"

    if worker_id_matches_field "$candidate_verifier_owner" "$worker_id" || \
       { field_is_unassigned "$candidate_verifier_owner" && worker_id_matches_field "$candidate_owner" "$worker_id" && [ "$candidate_stage" = "verifying" ]; }; then
      printf '%s' "$candidate_file"
      return 0
    fi
  done < <(list_matching_files "$verifier_dir" 'tickets_*.md')

  return 1
}

active_verification_file="$(context_active_verification_file || true)"
owned_verification_file=""
if [ -n "$active_verification_file" ]; then
  owned_verification_file="$active_verification_file"
else
  owned_verification_file="$(find_owned_verification_target || true)"
fi

if [ -n "$owned_verification_file" ]; then
  owned_ticket_id="$(extract_numeric_id "$owned_verification_file")"
  requested_ticket_id=""
  if [ -n "$requested_id" ]; then
    requested_ticket_id="$(normalize_id "$requested_id")"
  fi

  if [ -n "$requested_ticket_id" ] && [ "$requested_ticket_id" != "$owned_ticket_id" ]; then
    printf 'status=blocked\n'
    printf 'reason=conversation_already_has_active_verification\n'
    printf 'active_ticket_id=%s\n' "$owned_ticket_id"
    printf 'active_ticket=%s\n' "$owned_verification_file"
    printf 'requested_ticket_id=%s\n' "$requested_ticket_id"
    printf 'worker_id=%s\n' "$worker_id"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Resume or finish the active verification in this conversation before starting another verification. Use a new Codex conversation for parallel verification.\n'
    exit 0
  fi

  requested_id="$owned_ticket_id"
  resume_mode="true"
else
  set_thread_context_record "verifier" "$worker_id" "" "" ""
fi

select_verification_target() {
  local requested_id="${1:-}"
  local candidate_file candidate_verifier_owner candidate_owner candidate_integration_status id

  if [ -n "$requested_id" ]; then
    id="$(normalize_id "$requested_id")"
    printf '%s' "${verifier_dir}/tickets_${id}.md"
    return 0
  fi

  while IFS= read -r candidate_file; do
    [ -n "$candidate_file" ] || continue

    candidate_integration_status="$(trim_spaces "$(ticket_worktree_field "$candidate_file" "Integration Status")")"
    case "$candidate_integration_status" in
      blocked_*)
        continue
        ;;
    esac

    if [ "$worker_role_value" = "verifier" ]; then
      candidate_verifier_owner="$(ticket_scalar_field "$candidate_file" "Verifier AI")"
      candidate_owner="$(ticket_scalar_field "$candidate_file" "AI")"
      if worker_id_matches_field "$candidate_verifier_owner" "$worker_id" || \
         { field_is_unassigned "$candidate_verifier_owner" && worker_id_matches_field "$candidate_owner" "$worker_id"; } || \
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

target_file="$(select_verification_target "$requested_id" || true)"

if [ -z "$target_file" ] || [ ! -f "$target_file" ]; then
  fail_or_idle "No unblocked ticket in tickets/verifier/ awaiting verification." "no_unblocked_verification_ticket"
fi

current_verifier_owner="$(ticket_scalar_field "$target_file" "Verifier AI")"
if [ "$worker_role_value" = "verifier" ] && \
   ! field_is_unassigned "$current_verifier_owner" && \
   ! worker_id_matches_field "$current_verifier_owner" "$worker_id"; then
  fail_or_idle "Ticket is assigned to a different verifier owner: ${current_verifier_owner}" "verifier_owner_mismatch"
fi

ticket_id="$(extract_numeric_id "$target_file")"
ticket_title="$(ticket_scalar_field "$target_file" "Title")"
commit_ticket_name="${ticket_title:-tickets_${ticket_id}}"
commit_ticket_name="$(printf '%s' "$commit_ticket_name" | tr '\r\n' '  ' | sed 's/"/'\''/g')"
run_file="$(ensure_runs_file "$ticket_id")"
timestamp="$(now_iso)"
project_key="$(project_key_from_ticket_file "$target_file")"
project_note="[[${project_key}]]"
plan_note_name="$(plan_note_name_from_ticket_file "$target_file")"
plan_note=""
if [ -n "$plan_note_name" ]; then
  plan_note="[[${plan_note_name}]]"
fi
ticket_note_name="$(ticket_note_name_from_ticket_file "$target_file")"
ticket_note="[[${ticket_note_name}]]"
verification_note_name="$(verification_note_name_for_ticket "$ticket_id")"
verification_note="[[${verification_note_name}]]"
working_root="$(ticket_working_root "$target_file")"
done_target="$(done_ticket_path_for_ticket_file "$target_file")"
done_target_rel="$(board_relative_path "$done_target")"
reject_target="$(reject_ticket_path_for_ticket_file "$target_file")"
reject_target_rel="$(board_relative_path "$reject_target")"
worktree_path="$(ticket_worktree_path_from_file "$target_file")"
integration_command="$(shell_quote "${BOARD_ROOT}/scripts/integrate-worktree.sh") $(shell_quote "$target_file")"

mkdir -p "$(dirname "$done_target")"
mkdir -p "$(dirname "$reject_target")"

replace_scalar_field_in_section "$run_file" "## Meta" "PRD Key" "$project_key"
replace_scalar_field_in_section "$run_file" "## Meta" "Status" "pending"
replace_scalar_field_in_section "$run_file" "## Meta" "Working Root" "$working_root"
replace_section_block "$run_file" "Obsidian Links" "- Project Note: ${project_note}
- Plan Note: ${plan_note}
- Ticket Note: ${ticket_note}
- Verification Note: ${verification_note}"
replace_scalar_field_in_section "$target_file" "## Ticket" "Stage" "verifying"
replace_scalar_field_in_section "$target_file" "## Ticket" "AI" "$display_id"
if field_is_unassigned "$current_verifier_owner"; then
  replace_scalar_field_in_section "$target_file" "## Ticket" "Verifier AI" "$display_id"
fi
replace_scalar_field_in_section "$target_file" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$target_file" "Verification" "- Run file: \`tickets/inprogress/$(basename "$run_file")\`
- Log file: pending
- Result: pending verifier by ${display_id}"
if [ "$resume_mode" = "true" ]; then
  append_note "$target_file" "Verifier resumed by ${display_id} via scripts/start-verifier.sh at ${timestamp}"
else
  append_note "$target_file" "Verifier prepared by ${display_id} via scripts/start-verifier.sh at ${timestamp}"
fi
set_thread_context_record "verifier" "$worker_id" "$ticket_id" "verifying" "$(board_relative_path "$target_file")"

if [ "$resume_mode" = "true" ]; then
  printf 'status=resume\n'
else
  printf 'status=ok\n'
fi
printf 'verify=%s\n' "$target_file"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'ticket_title=%s\n' "$ticket_title"
printf 'run=%s\n' "$run_file"
printf 'log_dir=%s\n' "${BOARD_ROOT}/logs"
printf 'worker_id=%s\n' "$worker_id"
printf 'working_root=%s\n' "$working_root"
printf 'worktree_path=%s\n' "$worktree_path"
printf 'integration_command=%s\n' "$integration_command"
printf 'stage=verifying\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
cat <<EOF
routing_pass=If worktree_path is set, first run ${integration_command} to bring ticket code changes into PROJECT_ROOT without committing. Then move the ticket file to ${done_target_rel}, write a verifier completion log under logs/ (write-verifier-log clears the active runtime context), then from PROJECT_ROOT run: git add . && git commit -m "[${commit_ticket_name}] <간략 수정내용>". Replace <간략 수정내용> with a concise one-line summary from Result.Summary or the verified change. Never run git push.
routing_fail=Move the ticket file to ${reject_target_rel}, append a ## Reject Reason section describing what failed and what the planner should re-address, and write a verifier completion log under logs/ (write-verifier-log clears the active runtime context).
EOF
