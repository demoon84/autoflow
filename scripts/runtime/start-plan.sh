#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "plan"
set_thread_context_record "plan" "$(owner_id)" "" "" ""

spec_is_populated() {
  local spec_ref="$1"
  [ -n "$spec_ref" ] || return 1
  [ -f "${BOARD_ROOT}/${spec_ref}" ] || return 1
  if spec_file_is_placeholder "${BOARD_ROOT}/${spec_ref}"; then
    return 1
  fi
  return 0
}

plan_status_value() {
  local plan_file="$1"
  extract_scalar_field_in_section "$plan_file" "Plan" "Status" | tr -d ' '
}

lowest_actionable_plan() {
  local plan_root inprogress_root
  plan_root="$(plan_root_path)"
  inprogress_root="${BOARD_ROOT}/tickets/inprogress"
  local file status spec_ref candidates

  if [ -d "$inprogress_root" ]; then
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      if plan_file_is_placeholder "$file"; then
        continue
      fi
      status="$(plan_status_value "$file")"
      if [ "$status" = "inprogress" ]; then
        printf '%s' "$file"
        return 0
      fi
    done < <(list_matching_files "$inprogress_root" 'plan_[0-9][0-9][0-9].md')
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if plan_file_is_placeholder "$file"; then
      continue
    fi
    status="$(plan_status_value "$file")"
    case "$status" in
      ready)
        printf '%s' "$file"
        return 0
        ;;
      draft)
        spec_ref="$(strip_markdown_code_ticks "$(extract_reference_value "$file" "Spec References" "Project Spec")")"
        if spec_is_populated "$spec_ref"; then
          candidates="$(extract_execution_candidates "$file")"
          if [ -n "$candidates" ]; then
            printf '%s' "$file"
            return 0
          fi
        fi
        ;;
    esac
  done < <(list_matching_files "$plan_root" 'plan_[0-9][0-9][0-9].md')
  return 1
}

claim_plan_for_ticketing() {
  local source_plan="$1"
  local plan_id target_plan

  [ -n "$source_plan" ] || return 1
  [ -f "$source_plan" ] || return 1

  plan_id="$(extract_numeric_id "$source_plan")"
  target_plan="$(plan_inprogress_path "$plan_id")"
  mkdir -p "$(dirname "$target_plan")"

  if [ "$source_plan" = "$target_plan" ]; then
    replace_scalar_field_in_section "$target_plan" "## Plan" "Status" "inprogress"
    printf '%s' "$target_plan"
    return 0
  fi

  if mv "$source_plan" "$target_plan" 2>/dev/null; then
    replace_scalar_field_in_section "$target_plan" "## Plan" "Status" "inprogress"
    printf '%s' "$target_plan"
    return 0
  fi

  if [ -f "$target_plan" ]; then
    printf '%s' "$target_plan"
    return 0
  fi

  return 1
}

reject_count=0
reject_list=""
if [ -d "${BOARD_ROOT}/tickets/reject" ]; then
  while IFS= read -r reject_file; do
    [ -n "$reject_file" ] || continue
    reject_count=$((reject_count + 1))
    reject_list="${reject_list}$(basename "$reject_file")\n"
  done < <(list_reject_ticket_files)
fi

requested_id="${1:-}"
if [ -n "$requested_id" ]; then
  plan_id="$(normalize_id "$requested_id")"
  target_plan="$(plan_path "$plan_id")"
  if [ ! -f "$target_plan" ] && [ -f "$(plan_inprogress_path "$plan_id")" ]; then
    target_plan="$(plan_inprogress_path "$plan_id")"
  fi
else
  target_plan="$(lowest_actionable_plan || true)"
  if [ -z "$target_plan" ]; then
    printf 'status=idle\n'
    printf 'reason=no_actionable_plan\n'
    printf 'reject_count=%s\n' "$reject_count"
    [ "$reject_count" -gt 0 ] && printf 'reject_tickets=\n%b' "$reject_list"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'worker_role=%s\n' "$(worker_role)"
    exit 0
  fi
  plan_id="$(extract_numeric_id "$target_plan")"
fi

if [ ! -f "$target_plan" ]; then
  fail_or_idle "Plan file not found: $target_plan" "plan_file_missing"
fi

target_plan="$(claim_plan_for_ticketing "$target_plan" || true)"
if [ -z "$target_plan" ] || [ ! -f "$target_plan" ]; then
  fail_or_idle "Plan is already claimed by another planner: plan_${plan_id}.md" "plan_claim_conflict"
fi

if plan_file_is_placeholder "$target_plan"; then
  printf 'status=idle\n'
  printf 'reason=no_actionable_plan\n'
  printf 'placeholder_plan=%s\n' "$target_plan"
  printf 'reject_count=%s\n' "$reject_count"
  [ "$reject_count" -gt 0 ] && printf 'reject_tickets=\n%b' "$reject_list"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'worker_role=%s\n' "$(worker_role)"
  exit 0
fi

project_spec_raw="$(extract_reference_value "$target_plan" "Spec References" "Project Spec")"
project_spec_ref="$(strip_markdown_code_ticks "$project_spec_raw")"
feature_spec_raw="$(extract_reference_value "$target_plan" "Spec References" "Feature Spec")"
feature_spec_ref="$(strip_markdown_code_ticks "$feature_spec_raw")"

if [ -z "$project_spec_ref" ]; then
  fail_or_idle "Project spec reference is required in $target_plan" "missing_spec_reference"
fi

if ! spec_is_populated "$project_spec_ref"; then
  fail_or_idle "Referenced spec is missing or still a placeholder: ${project_spec_ref}" "spec_not_populated"
fi

ticket_project_spec_ref="$(done_spec_ref_for_spec_ref "$project_spec_ref")"
ticket_feature_spec_ref=""
if [ -n "$feature_spec_ref" ]; then
  ticket_feature_spec_ref="$(done_spec_ref_for_spec_ref "$feature_spec_ref")"
fi

project_key="$(project_key_from_spec_ref "$project_spec_ref")"
project_note="[[${project_key}]]"
plan_note="[[plan_${plan_id}]]"
plan_source_ref="$(board_relative_path "$target_plan")"

replace_section_block "$target_plan" "Obsidian Links" "- Project Note: ${project_note}
- Plan Note: ${plan_note}"

pre_status="$(plan_status_value "$target_plan")"
if [ "$pre_status" = "draft" ]; then
  replace_scalar_field_in_section "$target_plan" "## Plan" "Status" "ready"
  printf 'auto_flipped_to_ready=%s\n' "$target_plan"
fi

allowed_paths="$(extract_allowed_paths_block "$target_plan")"
if [ -z "$allowed_paths" ]; then
  fail_or_idle "Allowed Paths must be declared in $target_plan" "missing_allowed_paths"
fi

candidates_file="$(mktemp)"
extract_execution_candidates "$target_plan" > "$candidates_file"
if [ ! -s "$candidates_file" ]; then
  rm -f "$candidates_file"
  fail_or_idle "No unchecked execution candidates in $target_plan" "no_execution_candidates"
fi

total_count=0
existing_count=0
pending_count=0
last_allocated_id_num=""

while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue
  total_count=$((total_count + 1))

  if ticket_exists_for_plan_candidate "$plan_id" "$candidate"; then
    existing_count=$((existing_count + 1))
    continue
  fi

  if [ -z "$last_allocated_id_num" ]; then
    last_allocated_id_num="$((10#$(next_ticket_id)))"
  else
    last_allocated_id_num=$((last_allocated_id_num + 1))
  fi
  ticket_id="$(printf '%03d' "$last_allocated_id_num")"
  ticket_file="$(ticket_path "todo" "$ticket_id")"
  ticket_note="[[tickets_${ticket_id}]]"

  printf 'pending_ticket_begin\n'
  printf 'id=%s\n' "$ticket_id"
  printf 'file=%s\n' "$ticket_file"
  printf 'candidate=%s\n' "$candidate"
  printf 'note=%s\n' "$ticket_note"
  printf 'project_key=%s\n' "$project_key"
  printf 'project_spec_ref=%s\n' "$ticket_project_spec_ref"
  printf 'feature_spec_ref=%s\n' "$ticket_feature_spec_ref"
  printf 'plan_source_ref=%s\n' "$plan_source_ref"
  printf 'project_note=%s\n' "$project_note"
  printf 'plan_note=%s\n' "$plan_note"
  printf 'pending_ticket_end\n'

  pending_count=$((pending_count + 1))
done < "$candidates_file"

rm -f "$candidates_file"

if [ "$pending_count" -eq 0 ] && [ "$total_count" -gt 0 ]; then
  archived_project_spec_ref="$(archive_spec_to_done_if_needed "$project_spec_ref")"
  if [ "$archived_project_spec_ref" != "$project_spec_ref" ]; then
    replace_scalar_field_in_section "$target_plan" "## Spec References" "Project Spec" "\`${archived_project_spec_ref}\`"
  fi

  if [ -n "$feature_spec_ref" ]; then
    archived_feature_spec_ref="$(archive_spec_to_done_if_needed "$feature_spec_ref")"
    if [ "$archived_feature_spec_ref" != "$feature_spec_ref" ]; then
      replace_scalar_field_in_section "$target_plan" "## Spec References" "Feature Spec" "\`${archived_feature_spec_ref}\`"
    fi
  fi

  target_plan="$(archive_ticketed_plan_file "$target_plan" "$project_key")"
  printf 'archived_plan=%s\n' "$target_plan"
  archive_replanned_rejects_for_plan "$plan_id"
fi

printf 'status=ok\n'
printf 'plan=%s\n' "$target_plan"
printf 'total_candidate_count=%s\n' "$total_count"
printf 'pending_ticket_count=%s\n' "$pending_count"
printf 'existing_ticket_count=%s\n' "$existing_count"
printf 'reject_count=%s\n' "$reject_count"
[ "$reject_count" -gt 0 ] && printf 'reject_tickets=\n%b' "$reject_list"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
if [ "$pending_count" -gt 0 ]; then
  printf 'next_action=For each pending_ticket block above, create the ticket file at "file" with Plan Candidate verbatim (dedup key). Enrich Title/Goal/Done When/Verification using spec at project_spec_ref and Allowed Paths from the plan. See reference/ticket-template.md.\n'
fi
