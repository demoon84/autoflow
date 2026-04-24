#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "plan"

worker_id="$(owner_id)"
requested_id="${1:-}"
resume_mode="false"

context_active_plan_file() {
  local context_role active_id active_path active_file

  context_role="$(context_effective_value "role" || true)"
  [ "$context_role" = "plan" ] || return 1

  active_id="$(context_effective_value "active_ticket_id" || true)"
  active_path="$(context_effective_value "active_ticket_path" || true)"
  [ -n "$active_id" ] || return 1

  if [ -n "$active_path" ]; then
    active_file="${BOARD_ROOT}/${active_path}"
  else
    active_file="$(plan_inprogress_path "$active_id")"
  fi

  [ -f "$active_file" ] || return 1
  printf '%s' "$active_file"
}

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

lowest_actionable_plan_in_dir() {
  local plan_root="$1"
  local file status spec_ref candidates

  [ -d "$plan_root" ] || return 1

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
      inprogress)
        candidates="$(extract_execution_candidates "$file")"
        if [ -n "$candidates" ]; then
          printf '%s' "$file"
          return 0
        fi
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

lowest_actionable_plan() {
  local plan_file

  plan_file="$(lowest_actionable_plan_in_dir "$(plan_inprogress_root_path)" || true)"
  if [ -n "$plan_file" ]; then
    printf '%s' "$plan_file"
    return 0
  fi

  lowest_actionable_plan_in_dir "$(plan_root_path)"
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

collapse_ws() {
  tr '\r\n' '  ' | sed 's/[[:space:]][[:space:]]*/ /g; s/^[[:space:]]*//; s/[[:space:]]*$//'
}

extract_reject_reason_field() {
  local reject_file="$1"
  local field="$2"

  awk -v field="$field" '
    /^## Reject Reason/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && index($0, "- " field ":") == 1 {
      sub("^- " field ":[[:space:]]*", "", $0)
      print
      exit
    }
  ' "$reject_file" | collapse_ws
}

reject_retry_candidate() {
  local reject_file="$1"
  local reject_id hint cause summary

  reject_id="$(extract_numeric_id "$reject_file")"
  hint="$(extract_reject_reason_field "$reject_file" "재계획 힌트")"
  cause="$(extract_reject_reason_field "$reject_file" "원인")"
  summary="$(extract_scalar_field_in_section "$reject_file" "Result" "Summary" | collapse_ws)"

  if [ -n "$hint" ]; then
    printf '`tickets_%s` reject reason 을 반영해 %s' "$reject_id" "$hint"
    return 0
  fi

  if [ -n "$cause" ]; then
    printf '`tickets_%s` reject reason 을 반영해 %s' "$reject_id" "$cause"
    return 0
  fi

  if [ -n "$summary" ]; then
    printf '`tickets_%s` reject reason 을 반영해 %s' "$reject_id" "$summary"
    return 0
  fi

  printf '`tickets_%s` reject reason 을 반영해 검증 실패 원인을 해결하는 재시도 작업을 수행한다.' "$reject_id"
}

plan_mentions_reject_retry() {
  local plan_file="$1"
  local reject_id="$2"

  { grep -qsF "tickets_${reject_id}" "$plan_file" && grep -qsi "reject reason" "$plan_file"; } || \
    grep -qsF "reject_${reject_id}" "$plan_file"
}

plan_has_execution_candidate() {
  local plan_file="$1"
  local candidate="$2"

  grep -qsF -- "- [ ] ${candidate}" "$plan_file" || grep -qsF -- "- [x] ${candidate}" "$plan_file"
}

append_execution_candidate() {
  local plan_file="$1"
  local candidate="$2"
  local tmp

  tmp="$(autoflow_mktemp)"
  awk -v candidate="$candidate" '
    BEGIN { inserted=0 }
    $0 == "## Execution Candidates" {
      print
      print "- [ ] " candidate
      inserted=1
      next
    }
    { print }
    END {
      if (!inserted) {
        print ""
        print "## Execution Candidates"
        print "- [ ] " candidate
      }
    }
  ' "$plan_file" > "$tmp"
  mv "$tmp" "$plan_file"
}

ensure_plan_available_for_reject() {
  local reject_file="$1"
  local plan_id="$2"
  local project_key="$3"
  local active_plan inprogress_plan done_plan

  active_plan="$(plan_path "$plan_id")"
  inprogress_plan="$(plan_inprogress_path "$plan_id")"
  done_plan="$(done_plan_path_for_project_key "$project_key" "$plan_id")"

  if [ -f "$active_plan" ]; then
    printf '%s' "$active_plan"
    return 0
  fi

  if [ -f "$inprogress_plan" ]; then
    printf '%s' "$inprogress_plan"
    return 0
  fi

  if [ -f "$done_plan" ]; then
    mkdir -p "$(dirname "$active_plan")"
    mv "$done_plan" "$active_plan"
    printf '%s' "$active_plan"
    return 0
  fi

  return 1
}

process_reject_replans() {
  local plan_filter="${1:-}"
  local reject_file reject_id plan_id project_key plan_file candidate timestamp processed_one

  processed_one="false"

  while IFS= read -r reject_file; do
    [ -n "$reject_file" ] || continue

    reject_id="$(extract_numeric_id "$reject_file")"
    plan_id="$(plan_id_from_ticket_file "$reject_file")"
    [ -n "$plan_id" ] || continue
    if [ -n "$plan_filter" ] && [ "$plan_id" != "$plan_filter" ]; then
      continue
    fi
    if [ -z "$plan_filter" ] && [ "$processed_one" = "true" ]; then
      continue
    fi

    project_key="$(project_key_from_ticket_file "$reject_file")"
    [ -n "$project_key" ] || continue

    plan_file="$(ensure_plan_available_for_reject "$reject_file" "$plan_id" "$project_key" || true)"
    [ -n "$plan_file" ] && [ -f "$plan_file" ] || continue

    candidate="$(reject_retry_candidate "$reject_file")"
    if ! plan_has_execution_candidate "$plan_file" "$candidate" && ! plan_mentions_reject_retry "$plan_file" "$reject_id"; then
      append_execution_candidate "$plan_file" "$candidate"
      timestamp="$(now_iso)"
      append_note "$plan_file" "Reject ${reject_id} was converted into a retry candidate at ${timestamp}."
      printf 'replanned_reject=%s\n' "$(basename "$reject_file")"
    else
      printf 'replanned_reject=%s\n' "$(basename "$reject_file")"
      printf 'replan_candidate_status=already_present\n'
    fi

    replace_scalar_field_in_section "$plan_file" "## Plan" "Status" "ready"
    processed_one="true"
  done < <(list_reject_ticket_files)
}

reject_exists_for_plan() {
  local wanted_plan_id="$1"
  local reject_file

  while IFS= read -r reject_file; do
    [ -n "$reject_file" ] || continue
    if ticket_belongs_to_plan_id "$reject_file" "$wanted_plan_id"; then
      return 0
    fi
  done < <(list_reject_ticket_files)

  return 1
}

active_plan_file="$(context_active_plan_file || true)"
if [ -n "$active_plan_file" ]; then
  active_plan_id="$(extract_numeric_id "$active_plan_file")"
  requested_plan_id=""
  if [ -n "$requested_id" ]; then
    requested_plan_id="$(normalize_id "$requested_id")"
  fi

  if [ -n "$requested_plan_id" ] && [ "$requested_plan_id" != "$active_plan_id" ]; then
    printf 'status=blocked\n'
    printf 'reason=conversation_already_has_active_plan\n'
    printf 'active_plan_id=%s\n' "$active_plan_id"
    printf 'active_plan=%s\n' "$active_plan_file"
    printf 'requested_plan_id=%s\n' "$requested_plan_id"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'worker_role=%s\n' "$(worker_role)"
    printf 'next_action=Resume or finish the active plan in this conversation before starting another plan. Use a new Codex conversation for parallel planning.\n'
    exit 0
  fi

  requested_id="$active_plan_id"
  resume_mode="true"
else
  set_thread_context_record "plan" "$worker_id" "" "" ""
fi

process_reject_replans "$requested_id"
archive_orphan_reject_runs

reject_count=0
reject_list=""
if [ -d "${BOARD_ROOT}/tickets/reject" ]; then
  while IFS= read -r reject_file; do
    [ -n "$reject_file" ] || continue
    reject_count=$((reject_count + 1))
    reject_list="${reject_list}$(basename "$reject_file")\n"
  done < <(list_reject_ticket_files)
fi

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

set_thread_context_record "plan" "$worker_id" "$plan_id" "ticketing" "$(board_relative_path "$target_plan")"

if plan_file_is_placeholder "$target_plan"; then
  clear_active_ticket_context_record >/dev/null 2>&1 || true
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

candidates_file="$(autoflow_mktemp)"
extract_execution_candidates "$target_plan" > "$candidates_file"
if [ ! -s "$candidates_file" ]; then
  rm -f "$candidates_file"
  fail_or_idle "No unchecked execution candidates in $target_plan" "no_execution_candidates"
fi

generated_count=0
completed_plan_context="false"
while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue

  if ticket_exists_for_plan_candidate "$plan_id" "$candidate"; then
    continue
  fi

  ticket_id="$(next_ticket_id)"
  ticket_file="$(ticket_path "todo" "$ticket_id")"
  timestamp="$(now_iso)"
  ticket_note="[[tickets_${ticket_id}]]"

  cat > "$ticket_file" <<EOF
# Ticket

## Ticket

- ID: ${ticket_id}
- Project Key: ${project_key}
- Title: ${candidate}
- Stage: todo
- Owner: unassigned
- Claimed By: unclaimed
- Execution Owner: unassigned
- Verifier Owner: unassigned
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${candidate}

## References

- Project Spec: \`${ticket_project_spec_ref}\`
- Feature Spec: ${ticket_feature_spec_ref:+\`${ticket_feature_spec_ref}\`}
- Plan Source: \`${plan_source_ref}\`

## Obsidian Links

- Project Note: ${project_note}
- Plan Note: ${plan_note}
- Ticket Note: ${ticket_note}

## Allowed Paths

${allowed_paths}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Done When

- [ ] ${candidate} 작업 결과가 반영되었다.
- [ ] 관련 메모와 결과가 티켓에 기록되었다.

## Next Action

- 다음에 바로 이어서 할 일: todo worker 가 이 티켓을 claim 해서 inprogress 로 옮기고 구현을 진행

## Resume Context

- 현재 상태 요약: plan 에서 생성된 새 todo 티켓
- 직전 작업: scripts/start-plan.sh 로 생성됨
- 재개 시 먼저 볼 것: Goal, Allowed Paths, Done When

## Notes

- Generated by scripts/start-plan.sh at ${timestamp}

## Verification

- Run file:
- Result:

## Result

- Summary:
- Remaining risk:

## Path Notes

- \`References\` 는 \`BOARD_ROOT\` 상대 경로다.
- \`Allowed Paths\` 는 repo-relative 경로다. 구현 중에는 티켓 worktree 루트 기준으로 해석하고, worktree 가 없으면 \`PROJECT_ROOT\` 기준으로 fallback 한다.
EOF

  append_generated_ticket "$target_plan" "${ticket_note} generated from candidate: ${candidate}"
  generated_count=$((generated_count + 1))
  printf 'generated=%s\n' "$ticket_file"
done < "$candidates_file"

rm -f "$candidates_file"

if [ "$generated_count" -gt 0 ]; then
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
  completed_plan_context="true"
elif [ "$reject_count" -gt 0 ] && reject_exists_for_plan "$plan_id"; then
  archive_replanned_rejects_for_plan "$plan_id"
  target_plan="$(archive_ticketed_plan_file "$target_plan" "$project_key")"
  printf 'archived_plan=%s\n' "$target_plan"
  completed_plan_context="true"
fi

archive_orphan_reject_runs

if [ "$completed_plan_context" = "true" ]; then
  clear_active_ticket_context_record >/dev/null 2>&1 || true
  resume_mode="false"
fi

if [ "$resume_mode" = "true" ]; then
  printf 'status=resume\n'
else
  printf 'status=ok\n'
fi
printf 'plan=%s\n' "$target_plan"
printf 'generated_count=%s\n' "$generated_count"
printf 'reject_count=%s\n' "$reject_count"
[ "$reject_count" -gt 0 ] && printf 'reject_tickets=\n%b' "$reject_list"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
