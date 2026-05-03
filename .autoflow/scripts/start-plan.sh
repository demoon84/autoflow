#!/usr/bin/env bash

# Plan AI runtime (post-refactor 2026-04-27).
#
# Plan AI now owns three responsibilities — all purely board-side, no product
# code edits — and emits a ticket in tickets/todo/ as the only output:
#   1. Auto-replan rejected tickets back to todo (reject/ -> todo/).
#   2. Promote lightweight orders in tickets/inbox/ into PRD/todo work.
#   3. Convert populated PRDs in backlog/ into a fresh tickets_NNN.md in todo/.
# Legacy plan/ files (rules/plan or tickets/plan) are still consumed as a
# transitional fallback when neither (1), (2), nor (3) yields work, so older
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
    if [ "$reason" = "max_retries_reached" ]; then
      printf 'replan_skipped.%s.failure_class=retry_limit\n' "$index"
      printf 'replan_skipped.%s.recovery_state=needs_user\n' "$index"
    fi
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

# --- Ralph loop guards (lint + iteration fingerprint) -------------------------

lint_ticket_enabled() {
  case "${AUTOFLOW_LINT_TICKET:-on}" in
    off|false|0|no) return 1 ;;
    *) return 0 ;;
  esac
}

iteration_fingerprint_enabled() {
  case "${AUTOFLOW_ITERATION_FINGERPRINT:-on}" in
    off|false|0|no) return 1 ;;
    *) return 0 ;;
  esac
}

# Wraps lint-ticket.sh invocation. Captures exit code without tripping set -e
# and prints lint output keys to stdout via the caller's printf chain. Returns
# the lint exit code (0=ok|warn, 1=block).
run_lint_ticket() {
  local target="$1"
  local lint_script="${SCRIPT_DIR}/lint-ticket.sh"

  [ -x "$lint_script" ] || return 0

  set +e
  "$lint_script" "$target"
  local rc=$?
  set -e
  return "$rc"
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
    list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md' 'project_*.md'
  )

  return 1
}

order_ref_is_already_promoted() {
  local order_ref="$1"
  local spec_file

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    [ -f "$spec_file" ] || continue
    if grep -Fq -- "Source: \`${order_ref}\`" "$spec_file" || grep -Fq -- "Source: ${order_ref}" "$spec_file"; then
      return 0
    fi
  done < <(
    {
      list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md' 'project_*.md'
      if [ -d "${BOARD_ROOT}/tickets/done" ]; then
        find "${BOARD_ROOT}/tickets/done" -mindepth 2 -maxdepth 2 -type f \( -name 'prd_*.md' -o -name 'project_*.md' \)
      fi
    }
  )

  return 1
}

order_file_is_actionable() {
  local order_file="$1"
  local order_ref status

  [ -f "$order_file" ] || return 1
  order_ref="$(board_relative_path "$order_file")"
  if order_ref_is_already_promoted "$order_ref"; then
    return 1
  fi

  status="$(extract_scalar_field_in_section "$order_file" "Order" "Status")"
  status="$(trim_spaces "$status")"

  case "$status" in
    ""|inbox|ready|pending|needs-info)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

select_inbox_order() {
  local order_file id

  if [ -n "$requested_normalized" ]; then
    order_file="${BOARD_ROOT}/tickets/inbox/order_${requested_normalized}.md"
    if order_file_is_actionable "$order_file"; then
      printf '%s' "$order_file"
      return 0
    fi
    return 1
  fi

  while IFS= read -r order_file; do
    [ -n "$order_file" ] || continue
    order_file_is_actionable "$order_file" || continue
    id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$order_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inbox" 'order_*.md')

  return 1
}

extract_spec_source_order_ref() {
  local file="$1"

  awk '
    $0 == "## Conversation Handoff" { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- Source:[[:space:]]*/ {
      sub(/^[[:space:]]*- Source:[[:space:]]*/, "", $0)
      gsub(/`/, "", $0)
      print
      exit
    }
  ' "$file"
}

archive_source_order_for_spec() {
  local project_key="$1"
  local spec_file="$2"
  local order_ref order_file target_file

  order_ref="$(extract_spec_source_order_ref "$spec_file")"
  case "$order_ref" in
    tickets/inbox/order_*.md)
      ;;
    *)
      return 0
      ;;
  esac

  order_file="${BOARD_ROOT}/${order_ref}"
  [ -f "$order_file" ] || return 0

  target_file="${BOARD_ROOT}/tickets/done/${project_key}/$(basename "$order_file")"
  if [ -f "$target_file" ]; then
    if cmp -s "$order_file" "$target_file"; then
      rm -f "$order_file"
    fi
    return 0
  fi

  mkdir -p "$(dirname "$target_file")"
  mv "$order_file" "$target_file"
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
  archive_source_order_for_spec "$project_key" "$archived_spec_file"
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

## Reference Notes

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

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

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
  # Iteration fingerprint check (Ralph loop pattern (b)): if the same fail
  # reason has been seen in a previously archived reject for this PRD, do not
  # consume another retry slot. Park as needs_user via source=iteration-no-progress.
  if iteration_fingerprint_enabled; then
    candidate_fp="$(compute_iteration_fingerprint "$replanned_reject" 2>/dev/null || true)"
    candidate_prd_key="$(extract_ticket_prd_key "$replanned_reject" 2>/dev/null || true)"
    if [ -n "$candidate_fp" ] && [ -n "$candidate_prd_key" ]; then
      prior_fp="$(latest_archived_reject_fingerprint "$candidate_prd_key" "$replanned_reject" 2>/dev/null || true)"
      if [ -n "$prior_fp" ] && [ "$prior_fp" = "$candidate_fp" ]; then
        printf 'status=ok\n'
        printf 'source=iteration-no-progress\n'
        printf 'reject_origin=%s\n' "$(board_relative_path "$replanned_reject")"
        printf 'prd_key=%s\n' "$candidate_prd_key"
        printf 'fingerprint=%s\n' "$candidate_fp"
        printf 'prior_fingerprint=%s\n' "$prior_fp"
        printf 'failure_class=iteration_no_progress\n'
        printf 'recovery_state=needs_user\n'
        emit_replan_skipped_metadata "$replan_skipped_file"
        printf 'board_root=%s\n' "$BOARD_ROOT"
        printf 'project_root=%s\n' "$PROJECT_ROOT"
        printf 'next_action=Reject %s repeats the same Failure Class/Reject Reason as the previous archived attempt for %s. Park as needs_user; planner orchestrator AI must address the root cause (Allowed Paths, verification command, dependent PRD split) before another retry.\n' \
          "$(basename "$replanned_reject")" \
          "$candidate_prd_key"
        exit 0
      fi
    fi
  fi

  replanned_ticket="$(replan_reject_to_todo "$replanned_reject" || true)"
  if [ -z "$replanned_ticket" ]; then
    fail_or_idle "Reject ticket could not be replanned: $(board_relative_path "$replanned_reject")" "reject_replan_failed"
  fi

  # Record the fingerprint on the new todo so the planner orchestrator AI can
  # see iteration history without re-deriving it from archived rejects.
  if iteration_fingerprint_enabled && [ -n "${candidate_fp:-}" ]; then
    append_iteration_fingerprint "$replanned_ticket" "$candidate_fp" 2>/dev/null || true
  fi

  printf 'status=ok\n'
  printf 'source=reject-replan\n'
  printf 'reject_origin=%s\n' "$(board_relative_path "$replanned_reject")"
  printf 'todo_ticket=%s\n' "$replanned_ticket"
  printf 'retry_count=%s\n' "$(ticket_retry_count "$replanned_ticket")"
  record_orchestration_check_best_effort \
    "reject-auto-replan" \
    "Reject auto-replan created $(basename "$replanned_ticket")" \
    "$(extract_ticket_prd_key "$replanned_ticket" 2>/dev/null || true)" \
    "$(extract_numeric_id "$replanned_ticket" 2>/dev/null || true)" \
    "start-plan.sh" \
    "Reject ticket $(board_relative_path "$replanned_reject") was automatically returned to todo as $(board_relative_path "$replanned_ticket")." \
    "retry_count=$(ticket_retry_count "$replanned_ticket"); reject_origin=$(board_relative_path "$replanned_reject"); todo_ticket=$(board_relative_path "$replanned_ticket")" \
    "새 todo 티켓의 retry context와 Reject History를 확인하고 필요한 경우 미확인 상태를 해제한다."
  if [ -n "${candidate_fp:-}" ]; then
    printf 'iteration_fingerprint=%s\n' "$candidate_fp"
  fi
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Reject ticket %s returned to todo; follow plan-to-ticket-agent.md for retry handling.\n' "$(basename "$replanned_ticket")"
  exit 0
fi

# --- Branch 1.5: reject auto-close after retry cap ----------------------------
# When a reject is parked at retry cap (max_retries_reached), the planner tries
# the PRD's Verification Command at PROJECT_ROOT. The first reject whose command
# returns exit 0 is archived to tickets/done/<prd_key>/ with a
# `## Manual Resolution (auto-close)` note. Verification failures for other
# candidates are recorded as metadata so the next tick can retry them. At most
# one reject is archived per tick to bound cost.
if reject_auto_close_enabled; then
  auto_close_attempt_index=0
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    [ -f "$candidate" ] || continue

    candidate_prd_key="$(extract_ticket_prd_key "$candidate")"
    if [ -z "$candidate_prd_key" ]; then
      auto_close_attempt_index=$((auto_close_attempt_index + 1))
      printf 'auto_close_attempt.%s=%s\n' "$auto_close_attempt_index" "$(board_relative_path "$candidate")"
      printf 'auto_close_attempt.%s.result=missing_prd_key\n' "$auto_close_attempt_index"
      continue
    fi

    candidate_prd_file="$(prd_file_for_reject "$candidate_prd_key" || true)"
    if [ -z "$candidate_prd_file" ]; then
      auto_close_attempt_index=$((auto_close_attempt_index + 1))
      printf 'auto_close_attempt.%s=%s\n' "$auto_close_attempt_index" "$(board_relative_path "$candidate")"
      printf 'auto_close_attempt.%s.prd_key=%s\n' "$auto_close_attempt_index" "$candidate_prd_key"
      printf 'auto_close_attempt.%s.result=prd_file_not_found\n' "$auto_close_attempt_index"
      continue
    fi

    candidate_command="$(extract_prd_verification_command "$candidate_prd_file")"
    if [ -z "$candidate_command" ]; then
      auto_close_attempt_index=$((auto_close_attempt_index + 1))
      printf 'auto_close_attempt.%s=%s\n' "$auto_close_attempt_index" "$(board_relative_path "$candidate")"
      printf 'auto_close_attempt.%s.prd_key=%s\n' "$auto_close_attempt_index" "$candidate_prd_key"
      printf 'auto_close_attempt.%s.result=verification_command_empty\n' "$auto_close_attempt_index"
      continue
    fi

    if run_verification_command_for_auto_close "$candidate_command"; then
      auto_close_target="$(archive_reject_with_manual_resolution \
        "$candidate" \
        "$candidate_prd_key" \
        "$candidate_command")"

      printf 'status=ok\n'
      printf 'source=reject-auto-close\n'
      printf 'reject_origin=%s\n' "$(board_relative_path "$candidate")"
      printf 'prd_key=%s\n' "$candidate_prd_key"
      printf 'prd_file=%s\n' "$(board_relative_path "$candidate_prd_file")"
      printf 'verification_command=%s\n' "$candidate_command"
      printf 'archived_to=%s\n' "$(board_relative_path "$auto_close_target")"
      record_orchestration_check_best_effort \
        "reject-auto-close" \
        "Reject auto-close archived $(basename "$auto_close_target")" \
        "$candidate_prd_key" \
        "$(extract_numeric_id "$candidate" 2>/dev/null || true)" \
        "start-plan.sh" \
        "Retry cap reject $(board_relative_path "$candidate") was automatically archived after the PRD verification command passed at PROJECT_ROOT." \
        "verification_command=${candidate_command}; archived_to=$(board_relative_path "$auto_close_target"); prd_file=$(board_relative_path "$candidate_prd_file")" \
        "자동 close가 의도한 수동 해결인지 확인하고 필요한 경우 관련 reject archive를 검토한다."
      emit_replan_skipped_metadata "$replan_skipped_file"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      printf 'next_action=Reject %s auto-closed to %s after PRD verification command passed at PROJECT_ROOT.\n' \
        "$(basename "$candidate")" \
        "$(board_relative_path "$auto_close_target")"
      exit 0
    fi

    auto_close_attempt_index=$((auto_close_attempt_index + 1))
    printf 'auto_close_attempt.%s=%s\n' "$auto_close_attempt_index" "$(board_relative_path "$candidate")"
    printf 'auto_close_attempt.%s.prd_key=%s\n' "$auto_close_attempt_index" "$candidate_prd_key"
    printf 'auto_close_attempt.%s.verification_command=%s\n' "$auto_close_attempt_index" "$candidate_command"
    printf 'auto_close_attempt.%s.result=verification_failed\n' "$auto_close_attempt_index"
  done < <(list_max_retried_rejects)
fi

# --- Branch 1.6: blocked inprogress dirty_root recovery -----------------------
# When an inprogress ticket is parked at Stage=blocked because PROJECT_ROOT had
# dirty changes overlapping its Allowed Paths, two outcomes are possible:
#   (a) the dirty paths are now clean -> return the ticket to tickets/todo/ with
#       a fresh Recovery State so ticket-owner can rebuild a worktree from main.
#   (b) the dirty paths are still present -> emit a `blocked-dirty-orchestration`
#       signal so the planner orchestrator AI can analyze, classify, and either
#       integrate (local commit), stash, or escalate to needs_user. The shell
#       runtime no longer rubber-stamps `needs_user`; it surfaces evidence and
#       lets the orchestrator AI decide. `git push` is still forbidden (rule 8).
if blocked_auto_recover_enabled; then
  blocked_attempt_index=0
  while IFS= read -r blocked_ticket; do
    [ -n "$blocked_ticket" ] || continue
    [ -f "$blocked_ticket" ] || continue

    blocked_failure_class="$(ticket_failure_class "$blocked_ticket")"
    case "$blocked_failure_class" in
      dirty_root|dirty_project_root_conflict)
        ;;
      *)
        blocked_attempt_index=$((blocked_attempt_index + 1))
        printf 'blocked_recover_skip.%s=%s\n' "$blocked_attempt_index" "$(board_relative_path "$blocked_ticket")"
        printf 'blocked_recover_skip.%s.failure_class=%s\n' "$blocked_attempt_index" "$blocked_failure_class"
        printf 'blocked_recover_skip.%s.reason=failure_class_out_of_scope\n' "$blocked_attempt_index"
        continue
        ;;
    esac

    blocked_dirty_paths="$(project_root_dirty_paths "$(git_root_path || printf '%s' "$PROJECT_ROOT")" 2>/dev/null || true)"
    if [ -n "$blocked_dirty_paths" ]; then
      blocked_dirty_summary="$(printf '%s\n' "$blocked_dirty_paths" | dirty_project_root_paths_summary)"
      printf 'status=ok\n'
      printf 'source=blocked-dirty-orchestration\n'
      printf 'blocked_origin=%s\n' "$(board_relative_path "$blocked_ticket")"
      printf 'failure_class=%s\n' "$blocked_failure_class"
      printf 'dirty_paths=%s\n' "$blocked_dirty_summary"
      record_orchestration_check_best_effort \
        "blocked-dirty-orchestration" \
        "Blocked dirty orchestration requested for $(basename "$blocked_ticket")" \
        "$(extract_ticket_prd_key "$blocked_ticket" 2>/dev/null || true)" \
        "$(extract_numeric_id "$blocked_ticket" 2>/dev/null || true)" \
        "start-plan.sh" \
        "Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration." \
        "blocked_origin=$(board_relative_path "$blocked_ticket"); failure_class=${blocked_failure_class}; dirty_paths=${blocked_dirty_summary}" \
        "Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다."
      emit_replan_skipped_metadata "$replan_skipped_file"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      printf 'next_action=Orchestrator AI must group dirty PROJECT_ROOT paths by Allowed Paths ownership and integrate each group into a local commit ([PRD_NNN][ticket_NNN] orchestration cleanup: ... or [ticket_NNN] orchestration cleanup: misc housekeeping for ambiguous paths). Default is integrate; the Autoflow 1원칙 (do not stop) outranks classification perfectionism. Re-check git status after the commits; the next planner tick will surface source=blocked-auto-recover when paths are clean. Never git push. needs_user is reserved for mechanically impossible cases (git missing/locked).\n'
      exit 0
    fi

    blocked_target="$(unblock_dirty_root_resolved_ticket "$blocked_ticket" || true)"
    if [ -z "$blocked_target" ]; then
      blocked_attempt_index=$((blocked_attempt_index + 1))
      printf 'blocked_recover_attempt.%s=%s\n' "$blocked_attempt_index" "$(board_relative_path "$blocked_ticket")"
      printf 'blocked_recover_attempt.%s.failure_class=%s\n' "$blocked_attempt_index" "$blocked_failure_class"
      printf 'blocked_recover_attempt.%s.result=unblock_helper_failed\n' "$blocked_attempt_index"
      continue
    fi

    printf 'status=ok\n'
    printf 'source=blocked-auto-recover\n'
    printf 'blocked_origin=%s\n' "$(board_relative_path "$blocked_ticket")"
    printf 'failure_class=%s\n' "$blocked_failure_class"
    printf 'returned_to=%s\n' "$(board_relative_path "$blocked_target")"
    record_orchestration_check_best_effort \
      "blocked-auto-recover" \
      "Blocked ticket auto-recovered to todo $(basename "$blocked_target")" \
      "$(extract_ticket_prd_key "$blocked_target" 2>/dev/null || true)" \
      "$(extract_numeric_id "$blocked_target" 2>/dev/null || true)" \
      "start-plan.sh" \
      "A blocked dirty-root ticket was automatically returned to todo after PROJECT_ROOT no longer reported overlapping dirty Allowed Paths." \
      "blocked_origin=$(board_relative_path "$blocked_ticket"); returned_to=$(board_relative_path "$blocked_target"); failure_class=${blocked_failure_class}" \
      "새 worktree claim 후 Recovery State가 resolved 상태로 이어지는지 확인한다."
    emit_replan_skipped_metadata "$replan_skipped_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Blocked ticket %s returned to todo at %s after PROJECT_ROOT cleared dirty Allowed Paths; ticket-owner will rebuild a fresh worktree on the next claim.\n' \
      "$(basename "$blocked_ticket")" \
      "$(board_relative_path "$blocked_target")"
    exit 0
  done < <(list_blocked_inprogress_tickets)
fi

# --- Branch 2: quick order inbox -> AI-generated PRD/todo ---------------------
order_file="$(select_inbox_order || true)"
if [ -n "$order_file" ]; then
  printf 'status=ok\n'
  printf 'source=order-inbox\n'
  printf 'order=%s\n' "$order_file"
  printf 'order_id=%s\n' "$(extract_numeric_id "$order_file")"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Promote order %s per plan-to-ticket-agent.md, then rerun start-plan.\n' "$(board_relative_path "$order_file")"
  exit 0
fi

# --- Branch 3: backlog PRD -> todo ticket -------------------------------------
spec_file="$(select_populated_spec || true)"
if [ -n "$spec_file" ]; then
  # Done When / Global Acceptance Criteria vagueness lint (Ralph loop pattern
  # (a)): if the PRD's Completion Promise is too vague to verify, do not promote
  # to todo. The planner orchestrator AI is expected to either rework the PRD
  # via spec-author-agent or override AUTOFLOW_LINT_TICKET=off after review.
  lint_status_value=""
  lint_score_value=""
  lint_terms_value=""
  if lint_ticket_enabled; then
    lint_output_file="$(autoflow_mktemp)"
    set +e
    "${SCRIPT_DIR}/lint-ticket.sh" "$spec_file" > "$lint_output_file" 2>&1
    lint_rc=$?
    set -e
    lint_status_value="$(awk -F= '/^lint_status=/ { print $2; exit }' "$lint_output_file" 2>/dev/null || true)"
    lint_score_value="$(awk -F= '/^vagueness_score=/ { print $2; exit }' "$lint_output_file" 2>/dev/null || true)"
    lint_terms_value="$(awk -F= '/^vague_terms=/ { sub(/^vague_terms=/, ""); print; exit }' "$lint_output_file" 2>/dev/null || true)"
    if [ "$lint_rc" -ne 0 ] || [ "$lint_status_value" = "block" ]; then
      printf 'status=ok\n'
      printf 'source=vague-done-when\n'
      printf 'spec=%s\n' "$spec_file"
      printf 'lint_status=%s\n' "${lint_status_value:-block}"
      printf 'lint_vagueness_score=%s\n' "${lint_score_value:-unknown}"
      printf 'lint_vague_terms=%s\n' "${lint_terms_value:-}"
      printf 'failure_class=vague_completion_promise\n'
      printf 'recovery_state=needs_user\n'
      emit_replan_skipped_metadata "$replan_skipped_file"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      printf 'next_action=PRD %s has a vague Completion Promise (lint_status=%s, vagueness_score=%s). spec-author-agent must rework Done When / Global Acceptance Criteria with concrete signals (commands, file paths, exit codes, numeric metrics) before promoting to todo. Override only after review with AUTOFLOW_LINT_TICKET=off.\n' \
        "$(board_relative_path "$spec_file")" \
        "${lint_status_value:-block}" \
        "${lint_score_value:-unknown}"
      exit 0
    fi
  fi

  created_ticket="$(create_todo_ticket_from_spec "$spec_file")"
  if [ -n "$lint_status_value" ] && [ -f "$created_ticket" ]; then
    replace_scalar_field_in_section "$created_ticket" "## Goal Runtime" "Last Lint Status" "$lint_status_value"
    replace_scalar_field_in_section "$created_ticket" "## Goal Runtime" "Last Lint Vagueness Score" "${lint_score_value:-0}"
  fi
  printf 'status=ok\n'
  printf 'source=backlog-to-todo\n'
  printf 'spec=%s\n' "$spec_file"
  printf 'todo_ticket=%s\n' "$created_ticket"
  if [ -n "$lint_status_value" ]; then
    printf 'lint_status=%s\n' "$lint_status_value"
    printf 'lint_vagueness_score=%s\n' "${lint_score_value:-0}"
  fi
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Todo %s created from %s; hand off to ticket owner.\n' "$(basename "$created_ticket")" "$(board_relative_path "$spec_file")"
  exit 0
fi

# --- Branch 4: legacy plan/ fallback -----------------------------------------
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
    printf 'next_action=Convert unticketed candidates from legacy plan %s.\n' "$legacy_plan"
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
