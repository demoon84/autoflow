#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "ticket-owner"

worker_id="$(owner_id)"
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

  owner="$(ticket_scalar_field "$file" "Owner")"
  claimed_by="$(ticket_scalar_field "$file" "Claimed By")"
  execution_owner="$(ticket_scalar_field "$file" "Execution Owner")"
  verifier_owner="$(ticket_scalar_field "$file" "Verifier Owner")"

  [ "$owner" = "$worker_id" ] ||
    [ "$claimed_by" = "$worker_id" ] ||
    [ "$execution_owner" = "$worker_id" ] ||
    [ "$verifier_owner" = "$worker_id" ]
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

ticket_for_requested_id() {
  local id="$1"
  local file

  for state in inprogress todo verifier; do
    file="$(ticket_path "$state" "$id")"
    [ -f "$file" ] && printf '%s' "$file" && return 0
  done

  return 1
}

emit_replan_skipped_metadata() {
  local skipped_file="$1"
  local index=0 line rel reason retry_count

  [ -f "$skipped_file" ] || return 0

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    rel="${line%%|*}"
    reason="${line#*|}"
    retry_count="${reason##*|}"
    reason="${reason%|*}"
    index=$((index + 1))
    printf 'replan_skipped.%s=%s\n' "$index" "$rel"
    printf 'replan_skipped.%s.reason=%s\n' "$index" "$reason"
    printf 'replan_skipped.%s.retry_count=%s\n' "$index" "$retry_count"
  done < "$skipped_file"
}

claim_existing_ticket() {
  local source_file="$1"
  local id target_file source_dir

  id="$(extract_numeric_id "$source_file")"
  source_dir="$(basename "$(dirname "$source_file")")"

  case "$source_dir" in
    inprogress)
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

project_key_has_ticket() {
  local project_key="$1"
  local file current_project_key

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    current_project_key="$(project_key_from_ticket_file "$file")"
    [ "$current_project_key" = "$project_key" ] && return 0
  done < <(list_ticket_record_files_under "${BOARD_ROOT}/tickets")

  return 1
}

extract_section_checklist() {
  local file="$1"
  local heading="$2"

  awk -v heading="$heading" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- \[[ xX]\]/ { print }
  ' "$file"
}

extract_spec_allowed_paths() {
  local file="$1"

  awk '
    /^## Allowed Paths/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*[-*] / {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      if ($0 != "" && $0 != "...") print "- " $0
    }
  ' "$file"
}

create_ticket_from_spec() {
  local spec_file="$1"
  local spec_ref project_key ticket_id ticket_file ticket_note project_note
  local archived_spec_ref archived_spec_file title goal allowed_paths done_when verification_command timestamp

  spec_ref="$(board_relative_path "$spec_file")"
  project_key="$(project_key_from_spec_ref "$spec_ref")"

  if project_key_has_ticket "$project_key"; then
    printf 'status=blocked\n'
    printf 'reason=project_already_has_ticket\n'
    printf 'project_key=%s\n' "$project_key"
    printf 'spec=%s\n' "$spec_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  archived_spec_ref="$(archive_spec_to_done_if_needed "$spec_ref")"
  archived_spec_file="${BOARD_ROOT}/${archived_spec_ref}"
  ticket_id="$(next_ticket_id)"
  ticket_file="$(ticket_path "inprogress" "$ticket_id")"
  ticket_note="[[tickets_${ticket_id}]]"
  project_note="[[${project_key}]]"
  timestamp="$(now_iso)"

  title="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Name")"
  goal="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Goal")"
  verification_command="$(extract_scalar_field_in_section "$archived_spec_file" "Verification" "Command")"
  allowed_paths="$(extract_spec_allowed_paths "$archived_spec_file")"
  done_when="$(extract_section_checklist "$archived_spec_file" "Global Acceptance Criteria")"

  [ -n "$title" ] || title="Ticket owner work for ${project_key}"
  [ -n "$goal" ] || goal="Implement the approved spec for ${project_key}."
  [ -n "$allowed_paths" ] || allowed_paths="- TODO: define concrete repo-relative paths before editing product code"
  [ -n "$done_when" ] || done_when="- [ ] Ticket owner writes a concrete mini-plan into this ticket
- [ ] Implementation stays inside Allowed Paths
- [ ] Verification evidence is recorded before done/reject"

  mkdir -p "$(dirname "$ticket_file")"
  cat > "$ticket_file" <<EOF
# Ticket

## Ticket

- ID: tickets_${ticket_id}
- PRD Key: ${project_key}
- Plan Candidate: Direct ticket-owner handoff from ${archived_spec_ref}
- Title: ${title}
- Stage: planning
- Owner: ${worker_id}
- Claimed By: ${worker_id}
- Execution Owner: ${worker_id}
- Verifier Owner: ${worker_id}
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: ${archived_spec_ref}
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: ${project_note}
- Plan Note:
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

${done_when}

## Next Action

- 다음에 바로 이어서 할 일: ticket owner mini-plan 을 이 티켓에 적고, Allowed Paths 가 TODO 이면 먼저 구체 경로로 좁힌 뒤 구현을 시작한다.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by ${worker_id} from ${archived_spec_ref} at ${timestamp}.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
EOF

  printf '%s' "$ticket_file"
}

select_populated_spec() {
  local spec_file id

  if [ -n "$requested_normalized" ]; then
    for spec_file in \
      "${BOARD_ROOT}/tickets/backlog/prd_${requested_normalized}.md" \
      "${BOARD_ROOT}/tickets/backlog/project_${requested_normalized}.md"; do
      if [ -f "$spec_file" ] && ! spec_file_is_placeholder "$spec_file"; then
        printf '%s' "$spec_file"
        return 0
      fi
    done
    return 1
  fi

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    spec_file_is_placeholder "$spec_file" && continue
    id="$(extract_numeric_id "$spec_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$spec_file"
    return 0
  done < <(
    {
      list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md'
      list_matching_files "${BOARD_ROOT}/tickets/backlog" 'project_*.md'
    } | sort
  )

  return 1
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

prepare_ticket_owner_context() {
  local ticket_file="$1"
  local source_kind="$2"
  local ticket_id timestamp worktree_output implementation_root run_file
  local project_key project_note ticket_note verification_note stage done_target reject_target

  ticket_id="$(extract_numeric_id "$ticket_file")"
  timestamp="$(now_iso)"

  if ! worktree_output="$(ensure_ticket_worktree "$ticket_file" 2>&1)"; then
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: worktree 생성 실패를 해결한 뒤 ticket-owner 실행을 재개한다."
    append_note "$ticket_file" "Ticket owner worktree setup failed at ${timestamp}: ${worktree_output}"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    printf 'status=blocked\n'
    printf 'reason=worktree_setup_failed\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf '%s\n' "$worktree_output"
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
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Owner" "$worker_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$worker_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution Owner" "$worker_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier Owner" "$worker_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Verification" "- Run file: \`tickets/inprogress/$(basename "$run_file")\`
- Log file: pending
- Result: pending ticket-owner by ${worker_id}"
  replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다."
  append_note "$ticket_file" "Ticket owner ${worker_id} prepared ${source_kind} at ${timestamp}; worktree=${implementation_root}; run=$(board_relative_path "$run_file")"
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
  printf 'next_action=Use this same ticket owner turn to update the mini-plan and implement within Allowed Paths. Then run scripts/verify-ticket-owner.sh %s, followed by scripts/finish-ticket-owner.sh %s pass "<summary>" or fail "<reason>". Never split planner/todo/verifier roles and never git push.\n' "$ticket_id" "$ticket_id"
  printf 'routing_verify=Run scripts/verify-ticket-owner.sh %s to execute the ticket/spec verification command from implementation_root and record command/output/evidence in the run file.\n' "$ticket_id"
  printf 'routing_pass=After verification evidence passes, run scripts/finish-ticket-owner.sh %s pass "<short summary>". It integrates the worktree if needed, moves the ticket to done, writes the verifier log, clears active context, and creates a local commit when PROJECT_ROOT is a git repo. Never push.\n' "$ticket_id"
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

  printf 'status=resume\n'
  prepare_ticket_owner_context "$owned_file" "resume"
  exit 0
fi

if [ -n "$requested_normalized" ]; then
  requested_ticket="$(ticket_for_requested_id "$requested_normalized" || true)"
  if [ -n "$requested_ticket" ]; then
    claimed_ticket="$(claim_existing_ticket "$requested_ticket" || true)"
    if [ -z "$claimed_ticket" ]; then
      fail_or_idle "Ticket is already claimed by another owner: tickets_${requested_normalized}.md" "ticket_claim_conflict"
    fi
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

replan_skipped_file="$(autoflow_mktemp)"
replanned_reject="$(find_replannable_reject "$replan_skipped_file" || true)"
if [ -n "$replanned_reject" ]; then
  replanned_ticket="$(replan_reject_to_todo "$replanned_reject" || true)"
  if [ -z "$replanned_ticket" ]; then
    fail_or_idle "Reject ticket could not be replanned: $(board_relative_path "$replanned_reject")" "reject_replan_failed"
  fi

  printf 'status=ok\n'
  printf 'ticket=%s\n' "$replanned_ticket"
  printf 'ticket_id=%s\n' "$(extract_numeric_id "$replanned_ticket")"
  printf 'stage=todo\n'
  printf 'source=replan\n'
  printf 'reject_origin=%s\n' "$(board_relative_path "$replanned_reject")"
  printf 'retry_count=%s\n' "$(ticket_retry_count "$replanned_ticket")"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Run scripts/start-ticket-owner.sh again to claim the replanned todo ticket. The next mini-plan must address the latest Reject History entry.\n'
  exit 0
fi

spec_file="$(select_populated_spec || true)"
if [ -n "$spec_file" ]; then
  created_ticket="$(create_ticket_from_spec "$spec_file")"
  printf 'status=ok\n'
  emit_replan_skipped_metadata "$replan_skipped_file"
  prepare_ticket_owner_context "$created_ticket" "spec"
  exit 0
fi

printf 'status=idle\n'
printf 'reason=no_actionable_ticket_or_spec\n'
emit_replan_skipped_metadata "$replan_skipped_file"
printf 'worker_id=%s\n' "$worker_id"
printf 'worker_role=%s\n' "$(worker_role)"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
