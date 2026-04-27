#!/usr/bin/env bash

# Plan AI runtime (post-refactor 2026-04-27).
#
# Plan AI now owns two responsibilities — both purely board-side, no product
# code edits — and emits a ticket in tickets/todo/ as the only output:
#   1. Auto-replan rejected tickets back to todo (reject/ -> todo/).
#   2. Convert populated PRDs in backlog/ into a fresh tickets_NNN.md in todo/.
# Legacy plan/ files (rules/plan or tickets/plan) are still consumed as a
# transitional fallback when neither (1) nor (2) yields work, so older
# sample boards keep functioning.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "plan"

worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
set_thread_context_record "plan" "$worker_id" "" "" ""

requested_id="${1:-}"
requested_normalized=""
if [ -n "$requested_id" ]; then
  requested_normalized="$(normalize_id "$requested_id" || true)"
fi

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

create_todo_ticket_from_spec() {
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
  ticket_file="$(ticket_path "todo" "$ticket_id")"
  ticket_note="[[tickets_${ticket_id}]]"
  project_note="[[${project_key}]]"
  timestamp="$(now_iso)"

  title="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Name")"
  goal="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Goal")"
  verification_command="$(extract_scalar_field_in_section "$archived_spec_file" "Verification" "Command")"
  allowed_paths="$(extract_spec_allowed_paths "$archived_spec_file")"
  done_when="$(extract_section_checklist "$archived_spec_file" "Global Acceptance Criteria")"

  [ -n "$title" ] || title="AI work for ${project_key}"
  [ -n "$goal" ] || goal="Implement the approved spec for ${project_key}."
  [ -n "$allowed_paths" ] || allowed_paths="- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims."
  [ -n "$done_when" ] || done_when="- [ ] Implementation stays inside Allowed Paths
- [ ] Verification evidence is recorded before done/reject"

  mkdir -p "$(dirname "$ticket_file")"
  cat > "$ticket_file" <<EOF
# Ticket

## Ticket

- ID: tickets_${ticket_id}
- PRD Key: ${project_key}
- Plan Candidate: Plan AI handoff from ${archived_spec_ref}
- Title: ${title}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: ${archived_spec_ref}
- Feature Spec:
- Plan Source: plan-ai-direct

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

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by ${display_id} (Plan AI) from ${archived_spec_ref} at ${timestamp}.

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

# --- Branch 1: reject auto-replan ---------------------------------------------
replan_skipped_file="$(autoflow_mktemp)"
replanned_reject="$(find_replannable_reject "$replan_skipped_file" || true)"
if [ -n "$replanned_reject" ]; then
  replanned_ticket="$(replan_reject_to_todo "$replanned_reject" || true)"
  if [ -z "$replanned_ticket" ]; then
    fail_or_idle "Reject ticket could not be replanned: $(board_relative_path "$replanned_reject")" "reject_replan_failed"
  fi

  printf 'status=ok\n'
  printf 'source=reject-replan\n'
  printf 'reject_origin=%s\n' "$(board_relative_path "$replanned_reject")"
  printf 'todo_ticket=%s\n' "$replanned_ticket"
  printf 'retry_count=%s\n' "$(ticket_retry_count "$replanned_ticket")"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Reject ticket %s was bumped back to todo by Plan AI. Impl AI will claim it on the next tick. No further action this turn.\n' "$(basename "$replanned_ticket")"
  exit 0
fi

# --- Branch 2: backlog PRD -> todo ticket -------------------------------------
spec_file="$(select_populated_spec || true)"
if [ -n "$spec_file" ]; then
  created_ticket="$(create_todo_ticket_from_spec "$spec_file")"
  printf 'status=ok\n'
  printf 'source=backlog-to-todo\n'
  printf 'spec=%s\n' "$spec_file"
  printf 'todo_ticket=%s\n' "$created_ticket"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Plan AI created todo ticket %s from %s. Refine Allowed Paths and Done When if the PRD has more specific scope, then let Impl AI claim it on the next tick.\n' "$(basename "$created_ticket")" "$(board_relative_path "$spec_file")"
  exit 0
fi

# --- Branch 3: legacy plan/ fallback -----------------------------------------
plan_root="$(plan_root_path 2>/dev/null || true)"
if [ -n "$plan_root" ] && [ -d "$plan_root" ]; then
  legacy_plan="$(lowest_matching_file "$plan_root" 'plan_[0-9][0-9][0-9].md' || true)"
  if [ -n "$legacy_plan" ] && ! plan_file_is_placeholder "$legacy_plan"; then
    printf 'status=ok\n'
    printf 'source=legacy-plan\n'
    printf 'plan=%s\n' "$legacy_plan"
    emit_replan_skipped_metadata "$replan_skipped_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Legacy plan file detected at %s. Convert any unticketed Plan Candidates into tickets in tickets/todo/ this turn.\n' "$legacy_plan"
    exit 0
  fi
fi

# --- Idle --------------------------------------------------------------------
printf 'status=idle\n'
printf 'reason=no_actionable_plan_input\n'
emit_replan_skipped_metadata "$replan_skipped_file"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'worker_role=%s\n' "$(worker_role)"
