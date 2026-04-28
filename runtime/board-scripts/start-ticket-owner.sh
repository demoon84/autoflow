#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "ticket-owner"

worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
requested_id="${1:-}"
requested_normalized=""
if [ -n "$requested_id" ]; then
  requested_normalized="$(normalize_id "$requested_id" || true)"
  if [ -z "$requested_normalized" ]; then
    fail_or_idle "Invalid ticket/spec id: ${requested_id}" "invalid_ticket_owner_id"
  fi
fi

set_thread_context_record "ticket-owner" "$worker_id" "" "" ""

ticket_owned_by_worker() {
  local file="$1"
  local owner claimed_by execution_owner verifier_owner

  owner="$(ticket_scalar_field "$file" "AI")"
  claimed_by="$(ticket_scalar_field "$file" "Claimed By")"
  execution_owner="$(ticket_scalar_field "$file" "Execution AI")"
  verifier_owner="$(ticket_scalar_field "$file" "Verifier AI")"

  worker_id_matches_field "$owner" "$worker_id" ||
    worker_id_matches_field "$claimed_by" "$worker_id" ||
    worker_id_matches_field "$execution_owner" "$worker_id" ||
    worker_id_matches_field "$verifier_owner" "$worker_id"
}

ticket_claimed_by_other_worker() {
  local file="$1"
  local field value

  for field in "AI" "Claimed By" "Execution AI" "Verifier AI"; do
    value="$(ticket_scalar_field "$file" "$field")"
    [ -n "$value" ] || continue
    worker_id_matches_field "$value" "$worker_id" && return 1
    return 0
  done

  return 1
}

ticket_claim_owner() {
  local file="$1"
  local field value

  for field in "Claimed By" "Execution AI" "AI" "Verifier AI"; do
    value="$(ticket_scalar_field "$file" "$field")"
    [ -n "$value" ] || continue
    printf '%s' "$value"
    return 0
  done

  return 1
}

find_active_context_ticket() {
  local context_role active_path active_id file

  context_role="$(context_effective_value "role" || true)"
  [ "$context_role" = "ticket-owner" ] || return 1

  active_path="$(context_effective_value "active_ticket_path" || true)"
  active_id="$(context_effective_value "active_ticket_id" || true)"

  if [ -n "$active_path" ]; then
    file="${BOARD_ROOT}/${active_path}"
    [ -f "$file" ] && printf '%s' "$file" && return 0
  fi

  if [ -n "$active_id" ]; then
    active_id="$(normalize_id "$active_id" || true)"
    [ -n "$active_id" ] || return 1
    file="$(ticket_path "inprogress" "$active_id")"
    [ -f "$file" ] && printf '%s' "$file" && return 0
  fi

  return 1
}

find_owned_inprogress_ticket() {
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if ticket_owned_by_worker "$file"; then
      printf '%s' "$file"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  return 1
}

ticket_referenced_by_runner_state() {
  local ticket_file="$1"
  local ticket_id rel_path state_file active_id active_path

  ticket_id="tickets_$(extract_numeric_id "$ticket_file")"
  rel_path="$(board_relative_path "$ticket_file")"

  while IFS= read -r state_file; do
    [ -n "$state_file" ] || continue
    active_id="$(awk -F= '$1 == "active_ticket_id" { print $2; exit }' "$state_file")"
    active_path="$(awk -F= '$1 == "active_ticket_path" { print $2; exit }' "$state_file")"
    [ "$active_id" = "$ticket_id" ] && return 0
    [ "$active_path" = "$rel_path" ] && return 0
    [ -n "$active_path" ] && [ "${BOARD_ROOT}/${active_path}" = "$ticket_file" ] && return 0
  done < <(list_matching_files "${BOARD_ROOT}/runners/state" '*.state')

  return 1
}

find_adoptable_inprogress_ticket() {
  local file stage

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    ticket_owned_by_worker "$file" && continue
    ticket_claimed_by_other_worker "$file" && continue
    ticket_referenced_by_runner_state "$file" && continue
    stage="$(ticket_stage "$file")"
    stage_is_execution_candidate "$stage" || continue
    printf '%s' "$file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  return 1
}

ticket_for_requested_id() {
  local id="$1"
  local file

  for state in inprogress todo verifier; do
    file="$(ticket_path "$state" "$id")"
    [ -f "$file" ] && printf '%s' "$file" && return 0
  done

  return 1
}

claim_existing_ticket() {
  local source_file="$1"
  local id target_file source_dir

  id="$(extract_numeric_id "$source_file")"
  source_dir="$(basename "$(dirname "$source_file")")"

  case "$source_dir" in
    inprogress)
      if ticket_claimed_by_other_worker "$source_file"; then
        return 1
      fi
      printf '%s' "$source_file"
      return 0
      ;;
    todo|verifier)
      target_file="$(ticket_path "inprogress" "$id")"
      if mv "$source_file" "$target_file" 2>/dev/null; then
        printf '%s' "$target_file"
        return 0
      fi
      [ -f "$target_file" ] && printf '%s' "$target_file" && return 0
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

sync_runner_active_state() {
  local ticket_file="$1"
  local stage="$2"
  local state_path temp_file ticket_id title project_key spec_ref active_item

  state_path="${BOARD_ROOT}/runners/state/${worker_id}.state"
  [ -f "$state_path" ] || return 0

  ticket_id="tickets_$(extract_numeric_id "$ticket_file")"
  title="$(ticket_scalar_field "$ticket_file" "Title")"
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  spec_ref="$(extract_scalar_field_in_section "$ticket_file" "References" "PRD")"
  active_item="$ticket_id"
  [ -n "$title" ] && active_item="${active_item} — ${title}"
  [ -n "$project_key" ] && active_item="${active_item} (${project_key})"

  temp_file="$(autoflow_mktemp)"
  awk -F= \
    -v active_item="$active_item" \
    -v active_ticket_id="$ticket_id" \
    -v active_ticket_title="$title" \
    -v active_stage="$stage" \
    -v active_spec_ref="$spec_ref" '
    BEGIN {
      order[1] = "active_item"
      order[2] = "active_ticket_id"
      order[3] = "active_ticket_title"
      order[4] = "active_stage"
      order[5] = "active_spec_ref"
      values["active_item"] = active_item
      values["active_ticket_id"] = active_ticket_id
      values["active_ticket_title"] = active_ticket_title
      values["active_stage"] = active_stage
      values["active_spec_ref"] = active_spec_ref
    }
    {
      if ($1 in values) {
        print $1 "=" values[$1]
        seen[$1] = 1
        next
      }
      print $0
    }
    END {
      for (idx = 1; idx <= 5; idx += 1) {
        key = order[idx]
        if (!(key in seen)) {
          print key "=" values[key]
        }
      }
    }
  ' "$state_path" > "$temp_file"
  mv "$temp_file" "$state_path"
}

auto_resume_finish_pass_or_continue() {
  local ticket_file="$1"
  local recovery_output

  if recovery_output="$(recover_passed_inprogress_ticket "$ticket_file" "auto-resumed by recovery path" 2>&1)"; then
    printf '%s\n' "$recovery_output"
    exit 0
  fi
}

prepare_ticket_owner_context() {
  local ticket_file="$1"
  local source_kind="$2"
  local ticket_id timestamp worktree_output implementation_root run_file
  local project_key project_note ticket_note verification_note stage done_target reject_target
  local pre_stage recovery_attempted=false shared_blockers blockers_summary blocked_next_action blocked_reason
  local shared_head_blockers shared_head_summary

  ticket_id="$(extract_numeric_id "$ticket_file")"
  timestamp="$(now_iso)"

  if ticket_claimed_by_other_worker "$ticket_file"; then
    set_thread_context_record "ticket-owner" "$worker_id" "" "" ""
    printf 'status=idle\n'
    printf 'reason=ticket_claimed_by_another_owner\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'claimed_by=%s\n' "$(ticket_claim_owner "$ticket_file" || true)"
    printf 'worker_id=%s\n' "$worker_id"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  pre_stage="$(ticket_stage "$ticket_file")"
  if [ "$pre_stage" = "blocked" ]; then
    if auto_recover_blocked_ticket "$ticket_file"; then
      recovery_attempted=true
    else
      shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
      if [ -n "$shared_blockers" ]; then
        blockers_summary="$(printf '%s\n' "$shared_blockers" | shared_allowed_path_blockers_summary)"
        mark_ticket_shared_allowed_path_blocked "$ticket_file" "$worker_id" "$timestamp" "$shared_blockers"
        blocked_next_action="Runtime is waiting for lower-number in-progress ticket(s) holding overlapping project-root fallback paths. The next tick will retry automatically."
        blocked_reason="shared_allowed_path_conflict"
      else
        blocked_next_action="$(
          extract_section_text "$ticket_file" "Next Action" \
            | sed -E 's/^[[:space:]]*[-*][[:space:]]*//' \
            | tr '\n' ' ' \
            | sed 's/[[:space:]]\+/ /g; s/[[:space:]]*$//'
        )"
        [ -n "$blocked_next_action" ] || blocked_next_action="Ticket is blocked; explicit recovery required (or run a legacy coordinator runner if the project still uses one)."
        blocked_reason="ticket_stage_blocked"
      fi

      set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
      sync_runner_active_state "$ticket_file" "blocked"
      printf 'status=blocked\n'
      printf 'reason=%s\n' "$blocked_reason"
      printf 'ticket=%s\n' "$ticket_file"
      printf 'ticket_id=%s\n' "$ticket_id"
      if [ -n "${blockers_summary:-}" ]; then
        printf 'blockers=%s\n' "$blockers_summary"
      fi
      printf 'next_action=%s\n' "$blocked_next_action"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    fi
  fi

  local worktree_failed=false
  if ! worktree_output="$(ensure_ticket_worktree "$ticket_file" 2>&1)"; then
    worktree_failed=true
    if [ "$recovery_attempted" = "false" ] && auto_recover_blocked_ticket "$ticket_file"; then
      recovery_attempted=true
      if worktree_output="$(ensure_ticket_worktree "$ticket_file" 2>&1)"; then
        worktree_failed=false
      fi
    fi
  fi
  if [ "$worktree_failed" = "true" ]; then
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: worktree 생성 실패를 해결한 뒤 ticket-owner 실행을 재개한다."
    append_note "$ticket_file" "AI ${display_id} worktree setup failed at ${timestamp}: ${worktree_output}"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    printf 'status=blocked\n'
    printf 'reason=worktree_setup_failed\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf '%s\n' "$worktree_output"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
  if [ -n "$shared_blockers" ]; then
    blockers_summary="$(printf '%s\n' "$shared_blockers" | shared_allowed_path_blockers_summary)"
    mark_ticket_shared_allowed_path_blocked "$ticket_file" "$worker_id" "$timestamp" "$shared_blockers"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    sync_runner_active_state "$ticket_file" "blocked"
    printf 'status=blocked\n'
    printf 'reason=shared_allowed_path_conflict\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'blockers=%s\n' "$blockers_summary"
    printf '%s\n' "$worktree_output"
    printf 'next_action=Runtime is waiting for lower-number in-progress ticket(s) holding overlapping project-root fallback paths. The next tick will retry automatically.\n'
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  shared_head_blockers="$(ticket_shared_nonbase_head_blockers "$ticket_file" || true)"
  if [ -n "$shared_head_blockers" ]; then
    shared_head_summary="$(printf '%s\n' "$shared_head_blockers" | shared_nonbase_head_blockers_summary)"
    mark_ticket_shared_nonbase_head_blocked "$ticket_file" "$worker_id" "$timestamp" "$shared_head_blockers"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    sync_runner_active_state "$ticket_file" "blocked"
    printf 'status=blocked\n'
    printf 'reason=shared_nonbase_head_conflict\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'blockers=%s\n' "$shared_head_summary"
    printf '%s\n' "$worktree_output"
    printf 'next_action=Restore an isolated clean snapshot for this ticket before owner verify/finish resumes.\n'
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  implementation_root="$(ticket_working_root "$ticket_file")"
  run_file="$(ensure_runs_file "$ticket_id")"
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  project_note="[[${project_key}]]"
  ticket_note="[[tickets_${ticket_id}]]"
  verification_note="[[verify_${ticket_id}]]"
  done_target="$(done_ticket_path_for_ticket_file "$ticket_file")"
  reject_target="$(reject_ticket_path_for_ticket_file "$ticket_file")"
  stage="$(ticket_stage "$ticket_file")"
  case "${stage:-}" in
    ""|todo|claimed)
      stage="executing"
      ;;
  esac

  replace_scalar_field_in_section "$run_file" "## Meta" "PRD Key" "$project_key"
  replace_scalar_field_in_section "$run_file" "## Meta" "Status" "pending"
  replace_scalar_field_in_section "$run_file" "## Meta" "Working Root" "$implementation_root"
  replace_section_block "$run_file" "Obsidian Links" "- Project Note: ${project_note}
- Plan Note:
- Ticket Note: ${ticket_note}
- Verification Note: ${verification_note}"

  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "$stage"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Verification" "- Run file: \`tickets/inprogress/$(basename "$run_file")\`
- Log file: pending
- Result: pending ticket-owner by ${display_id}"
  replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다."
  append_note "$ticket_file" "AI ${display_id} prepared ${source_kind} at ${timestamp}; worktree=${implementation_root}; run=$(board_relative_path "$run_file")"
  set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "$stage" "$(board_relative_path "$ticket_file")"
  sync_runner_active_state "$ticket_file" "$stage"

  printf 'ticket=%s\n' "$ticket_file"
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'owner=%s\n' "$worker_id"
  printf 'stage=%s\n' "$stage"
  printf 'source=%s\n' "$source_kind"
  printf '%s\n' "$worktree_output"
  printf 'implementation_root=%s\n' "$implementation_root"
  printf 'run=%s\n' "$run_file"
  printf 'done_target=%s\n' "$done_target"
  printf 'reject_target=%s\n' "$reject_target"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Use this same ticket owner AI turn to update the mini-plan, implement within Allowed Paths, run and inspect verification commands directly, manually merge verified changes into PROJECT_ROOT, then use scripts/finish-ticket-owner.sh %s pass "<summary>" or fail "<reason>" as a bookkeeping/finalization tool. Never split planner/todo/verifier roles and never git push.\n' "$ticket_id"
  printf 'routing_verify=AI must run the ticket/PRD verification command itself from implementation_root or PROJECT_ROOT as appropriate, inspect the evidence, and update the run file. scripts/verify-ticket-owner.sh %s is only an optional evidence-recording tool, not the verifier decision-maker.\n' "$ticket_id"
  printf 'routing_pass=After AI has verified the work and manually integrated it into PROJECT_ROOT, keep the ticket worktree/snapshot aligned with the resolved PROJECT_ROOT content, then run scripts/finish-ticket-owner.sh %s pass "<short summary>". It finalizes board/log/wiki/local commit only after validating the AI-merged result; it does not rebase, cherry-pick, resolve conflicts, or otherwise merge code. Never push.\n' "$ticket_id"
  printf 'routing_fail=If the owner cannot fix the failure in scope, run scripts/finish-ticket-owner.sh %s fail "<concrete reject reason>". It moves the ticket to reject, writes the verifier log, and does not commit failed work.\n' "$ticket_id"
}

active_file="$(find_active_context_ticket || true)"
owned_file=""
if [ -n "$active_file" ] && ticket_owned_by_worker "$active_file"; then
  owned_file="$active_file"
else
  owned_file="$(find_owned_inprogress_ticket || true)"
fi

if [ -n "$owned_file" ]; then
  owned_id="$(extract_numeric_id "$owned_file")"
  if [ -n "$requested_normalized" ] && [ "$requested_normalized" != "$owned_id" ]; then
    printf 'status=blocked\n'
    printf 'reason=conversation_already_has_active_ticket\n'
    printf 'active_ticket_id=%s\n' "$owned_id"
    printf 'active_ticket=%s\n' "$owned_file"
    printf 'requested_id=%s\n' "$requested_normalized"
    printf 'worker_id=%s\n' "$worker_id"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  auto_resume_finish_pass_or_continue "$owned_file"
  printf 'status=resume\n'
  prepare_ticket_owner_context "$owned_file" "resume"
  exit 0
fi

if [ -z "$requested_normalized" ]; then
  adoptable_ticket="$(find_adoptable_inprogress_ticket || true)"
  if [ -n "$adoptable_ticket" ]; then
    auto_resume_finish_pass_or_continue "$adoptable_ticket"
    printf 'status=resume\n'
    prepare_ticket_owner_context "$adoptable_ticket" "adopted-inprogress"
    exit 0
  fi
fi

if [ -n "$requested_normalized" ]; then
  requested_ticket="$(ticket_for_requested_id "$requested_normalized" || true)"
  if [ -n "$requested_ticket" ]; then
    claimed_ticket="$(claim_existing_ticket "$requested_ticket" || true)"
    if [ -z "$claimed_ticket" ]; then
      fail_or_idle "Ticket is already claimed by another owner: tickets_${requested_normalized}.md" "ticket_claim_conflict"
    fi
    auto_resume_finish_pass_or_continue "$claimed_ticket"
    printf 'status=ok\n'
    prepare_ticket_owner_context "$claimed_ticket" "requested-ticket"
    exit 0
  fi
else
  next_ticket="$(lowest_matching_file "${BOARD_ROOT}/tickets/todo" 'tickets_*.md' || true)"
  if [ -n "$next_ticket" ]; then
    claimed_ticket="$(claim_existing_ticket "$next_ticket" || true)"
    if [ -z "$claimed_ticket" ]; then
      fail_or_idle "Ticket is already claimed by another owner." "ticket_claim_conflict"
    fi
    printf 'status=ok\n'
    prepare_ticket_owner_context "$claimed_ticket" "todo"
    exit 0
  fi

  legacy_verifier_ticket="$(lowest_matching_file "${BOARD_ROOT}/tickets/verifier" 'tickets_*.md' || true)"
  if [ -n "$legacy_verifier_ticket" ]; then
    claimed_ticket="$(claim_existing_ticket "$legacy_verifier_ticket" || true)"
    if [ -z "$claimed_ticket" ]; then
      fail_or_idle "Verifier ticket is already claimed by another owner." "ticket_claim_conflict"
    fi
    replace_scalar_field_in_section "$claimed_ticket" "## Ticket" "Stage" "verifying"
    printf 'status=ok\n'
    prepare_ticket_owner_context "$claimed_ticket" "legacy-verifier"
    exit 0
  fi
fi

# Reject auto-replan and backlog/PRD ticket-creation are now Plan AI's
# responsibility (start-plan.sh). Impl AI only claims from todo/inprogress.
printf 'status=idle\n'
printf 'reason=no_actionable_ticket\n'
printf 'next_action=Plan AI feeds tickets/todo/. Impl AI will claim on the next tick when one is available.\n'
printf 'worker_id=%s\n' "$worker_id"
printf 'worker_role=%s\n' "$(worker_role)"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
