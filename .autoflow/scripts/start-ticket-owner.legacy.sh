#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"
source "$(cd "$(dirname "$0")" && pwd)/runner-common.sh"

ensure_expected_role "ticket-owner"

worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
owner_pid="$(ticket_owner_lock_pid)"
requested_id="${1:-}"
requested_normalized=""
if [ -n "$requested_id" ]; then
  requested_normalized="$(normalize_id "$requested_id" || true)"
  if [ -z "$requested_normalized" ]; then
    fail_or_idle "Invalid ticket/spec id: ${requested_id}" "invalid_ticket_owner_id"
  fi
fi

set_thread_context_record "ticket-owner" "$worker_id" "" "" ""

# Claimed By uses a runner-id:runner-pid:spawned-at-iso token so the same
# runner-id can safely take over after a PTY restart while a different alive
# runner still blocks claim.

# PRD_279 (2026-05-12): dispatcher race window protection.
# acquire_dispatch_lock uses mkdir atomicity — only one process can create the
# dir at a time. The PID file holds $$ (parent PID in bash subshells) so the
# lock is tied to the outer process even when called from $() substitution.
# Stale locks (dead holder + >30 s old) are auto-reclaimed.
acquire_dispatch_lock() {
  local lock_dir="${BOARD_ROOT}/runners/state/dispatch.lock"
  local pid_file="${lock_dir}/pid"
  local held_pid lock_mtime now_epoch stale_threshold=30

  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s\n' "$$" > "$pid_file"
    return 0
  fi

  held_pid="$(cat "$pid_file" 2>/dev/null || true)"
  if autoflow_pid_is_running "${held_pid:-}"; then
    return 1
  fi

  now_epoch="$(date +%s)"
  lock_mtime="$(stat -f%m "$lock_dir" 2>/dev/null || stat -c%Y "$lock_dir" 2>/dev/null || echo 0)"
  if [ $((now_epoch - lock_mtime)) -lt $stale_threshold ]; then
    return 1
  fi

  rm -rf "$lock_dir" 2>/dev/null || true
  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s\n' "$$" > "$pid_file"
    return 0
  fi

  return 1
}

# Release only when we own the lock (PID check prevents removing another
# worker's lock if we lost a mkdir race during stale reclaim).
release_dispatch_lock() {
  local lock_dir="${BOARD_ROOT}/runners/state/dispatch.lock"
  local held_pid
  held_pid="$(cat "${lock_dir}/pid" 2>/dev/null || true)"
  [ "${held_pid:-}" = "$$" ] && rm -rf "$lock_dir" 2>/dev/null || true
}

# PRD 5 (2026-05-09): multi-worker path conflict guard — default on.
# Returns 0 (conflict) when candidate's Allowed Paths overlap any inprogress
# ticket owned by a different worker. Returns 1 otherwise. Disable explicitly
# with AUTOFLOW_PATH_CONFLICT_CHECK=off (or 0/false/no).
todo_conflicts_with_other_inprogress() {
  local candidate="$1"
  case "${AUTOFLOW_PATH_CONFLICT_CHECK:-on}" in
    off|0|false|no) return 1 ;;
  esac

  local script_dir conflict_script other_file owner_field
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  conflict_script="${script_dir}/path-conflict-check.sh"
  [ -x "$conflict_script" ] || return 1

  while IFS= read -r other_file; do
    [ -n "$other_file" ] || continue
    [ -f "$other_file" ] || continue
    [ "$other_file" = "$candidate" ] && continue
    owner_field="$(ticket_claim_owner "$other_file" 2>/dev/null || true)"
    [ -n "$owner_field" ] || continue
    worker_id_matches_field "$owner_field" "$worker_id" && continue
    if ! "$conflict_script" "$candidate" "$other_file" >/dev/null 2>&1; then
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'Todo-*.md' 'tickets_*.md')

  return 1
}

find_next_dispatchable_todo() {
  acquire_dispatch_lock || return 1

  case "${AUTOFLOW_PATH_CONFLICT_CHECK:-on}" in
    off|0|false|no)
      lowest_matching_file "${BOARD_ROOT}/tickets/todo" 'Todo-*.md' 'tickets_*.md'
      return
      ;;
  esac

  local candidate
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    todo_conflicts_with_other_inprogress "$candidate" && continue
    printf '%s' "$candidate"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/todo" 'Todo-*.md' 'tickets_*.md')
  return 1
}

ticket_owned_by_worker() {
  local decision

  decision="$(ticket_claim_decision_kind "$1")"
  case "$decision" in
    owned_same_pid|owned_legacy|takeover_same_runner|takeover_stale_pid|takeover_legacy)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ticket_claimed_by_other_worker() {
  [ "$(ticket_claim_decision_kind "$1")" = "blocked_other_runner_alive" ]
}

ticket_claim_owner() {
  ticket_claim_status_value "$1" "value"
}

ticket_claim_status() {
  local file="$1"
  local field value output

  for field in "Claimed By" "Execution AI" "AI"; do
    value="$(ticket_scalar_field "$file" "$field")"
    [ -n "$value" ] || continue
    output="$(ticket_owner_claim_decision "$value" "$worker_id" "$owner_pid")"
    printf 'field=%s\n' "$field"
    printf 'value=%s\n' "$value"
    printf '%s\n' "$output"
    return 0
  done

  printf 'field=\n'
  printf 'value=\n'
  ticket_owner_claim_decision "" "$worker_id" "$owner_pid"
}

ticket_claim_status_value() {
  local file="$1"
  local key="$2"

  ticket_claim_status "$file" | awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print
      exit
    }
  '
}

ticket_claim_decision_kind() {
  ticket_claim_status_value "$1" "decision"
}

ticket_claim_is_takeover() {
  case "$(ticket_claim_decision_kind "$1")" in
    takeover_same_runner|takeover_stale_pid|takeover_legacy)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ticket_owner_self_refresh_dirty_path() {
  local ticket_file="$1"
  local dirty_path="$2"
  local ticket_id board_dir

  [ -n "$dirty_path" ] || return 1
  ticket_id="$(extract_numeric_id "$ticket_file")"
  [ -n "$ticket_id" ] || return 1
  board_dir="$(basename "$BOARD_ROOT")"

  case "$dirty_path" in
    "${board_dir}/tickets/inprogress/Todo-${ticket_id}.md"|"${board_dir}/tickets/inprogress/tickets_${ticket_id}.md")
      return 0
      ;;
  esac

  return 1
}

filter_ticket_owner_non_self_refresh_dirty_paths() {
  local ticket_file="$1"
  local dirty_path

  while IFS= read -r dirty_path; do
    [ -n "$dirty_path" ] || continue
    ticket_owner_self_refresh_dirty_path "$ticket_file" "$dirty_path" && continue
    printf '%s\n' "$dirty_path"
  done
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
    ticket_owner_queue_parked_blocker "$file" && continue
    if ticket_owned_by_worker "$file"; then
      printf '%s' "$file"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'Todo-*.md' 'tickets_*.md')

  return 1
}

ticket_referenced_by_runner_state() {
  local ticket_file="$1"
  local ticket_id rel_path state_file active_id active_path

  ticket_id="Todo-$(extract_numeric_id "$ticket_file")"
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
    ticket_owner_queue_parked_blocker "$file" && continue
    ticket_owned_by_worker "$file" && continue
    ticket_claimed_by_other_worker "$file" && continue
    ticket_referenced_by_runner_state "$file" && continue
    stage="$(ticket_stage "$file")"
    stage_is_execution_candidate "$stage" || continue
    printf '%s' "$file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'Todo-*.md' 'tickets_*.md')

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

  ticket_id="Todo-20 20 12 61 79 80 81 701 33 98 100 204 250 395 398 399 400extract_numeric_id "$ticket_file")"
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

announce_runner_stage() {
  local stage="$1"
  local ticket_file="$2"
  local runner_id
  local script_path
  local ticket_id

  [ -n "$stage" ] || stage="inprogress"
  [ -n "$ticket_file" ] || return 0
  runner_id="${RUNNER_ID:-$worker_id}"
  script_path="${BOARD_ROOT}/scripts/runner-stage.js"

  if [ ! -x "$script_path" ]; then
    return 0
  fi

  ticket_id="$(extract_numeric_id "$ticket_file")"
  ticket_id="Todo-${ticket_id}"

  node "$script_path" "$stage" --runner "$runner_id" --ticket "$ticket_id" >/dev/null 2>&1 || true
}

auto_resume_finish_pass_or_continue() {
  local ticket_file="$1"
  local recovery_output

  if recovery_output="$(recover_passed_inprogress_ticket "$ticket_file" "auto-resumed by recovery path" 2>&1)"; then
    printf '%s\n' "$recovery_output"
    exit 0
  fi
}

block_missing_worktree_after_setup() {
  local ticket_file="$1"
  local ticket_id="$2"
  local timestamp="$3"
  local worktree_output="$4"
  local worktree_path display_evidence owner_lock_value

  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  display_evidence="worktree_status=ready but path is missing or not a git worktree: ${worktree_path:-empty}"
  owner_lock_value="$(ticket_owner_lock_value "$worker_id" "$owner_pid" "$timestamp")"

  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$owner_lock_value"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_recovery_missing_worktree"
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Status" "blocked"
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Detected By" "runtime"
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Failure Class" "missing_worktree"
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Evidence" "$display_evidence"
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Owner Resume Instruction" "Repair or recreate the missing worktree before running implementation."
  replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Last Recovery At" "$timestamp"
  replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: missing worktree 경로를 복구하거나 AUTOFLOW_WORKTREE_ROOT 를 쓰기 가능한 위치로 조정한 뒤 ticket-owner 를 재개한다."
  append_note "$ticket_file" "Runtime blocked missing worktree at ${timestamp}: ${display_evidence}"
  set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
  sync_runner_active_state "$ticket_file" "blocked"
  ticket_goal_block "$ticket_file" "missing_worktree"

  printf 'status=blocked\n'
  printf 'reason=missing_worktree_after_setup\n'
  printf 'ticket=%s\n' "$ticket_file"
  printf 'ticket_id=%s\n' "$ticket_id"
  printf '%s\n' "$worktree_output"
  printf 'worktree_path=%s\n' "${worktree_path:-}"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Repair or recreate the missing worktree before running implementation.\n'
  exit 0
}

ensure_ready_worktree_exists_or_block() {
  local ticket_file="$1"
  local ticket_id="$2"
  local timestamp="$3"
  local worktree_output="$4"
  local worktree_path

  printf '%s\n' "$worktree_output" | grep -Fxq "worktree_status=ready" || return 0
  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  if [ -n "$worktree_path" ] && git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  block_missing_worktree_after_setup "$ticket_file" "$ticket_id" "$timestamp" "$worktree_output"
}

prepare_ticket_owner_context() {
  local ticket_file="$1"
  local source_kind="$2"
  local ticket_id timestamp worktree_output implementation_root worktree_evidence
  local project_key project_note ticket_note stage done_target
  local pre_stage recovery_attempted=false shared_blockers blockers_summary blocked_next_action blocked_reason
  local shared_head_blockers shared_head_summary integration_status merge_continuation=false next_action_line verification_block owner_lock_value
  local dirty_project_root_paths dirty_project_root_summary dirty_path

  ticket_id="$(extract_numeric_id "$ticket_file")"
  timestamp="$(now_iso)"
  owner_lock_value="$(ticket_owner_lock_value "$worker_id" "$owner_pid" "$timestamp")"

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
    cleanup_integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
    cleanup_last_event="$(trim_spaces "$(ticket_goal_field "$ticket_file" "Last Event")")"
    if [ "$cleanup_integration_status" = "blocked_post_merge_cleanup" ] || [ "$cleanup_last_event" = "post_merge_cleanup_failed" ]; then
      set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
      sync_runner_active_state "$ticket_file" "blocked"
      printf 'status=idle\n'
      printf 'reason=post_merge_cleanup_blocked_preserved\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf 'ticket_id=%s\n' "$ticket_id"
      printf 'next_action=Cleanup-only blocked ticket left in board for user/wiki review; no retry order generated.\n'
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    fi
    recovery_status="$(awk '/^## Recovery State$/{f=1;next} /^## /{f=0} f && /^- Status:/{sub(/^- Status:[[:space:]]*/,"");sub(/[[:space:]]*$/,"");print;exit}' "$ticket_file")"
    recovery_class="$(awk '/^## Recovery State$/{f=1;next} /^## /{f=0} f && /^- Failure Class:/{sub(/^- Failure Class:[[:space:]]*/,"");sub(/[[:space:]]*$/,"");print;exit}' "$ticket_file")"
    if [ -n "$recovery_status" ] || [ -n "$recovery_class" ]; then
      set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
      sync_runner_active_state "$ticket_file" "blocked"
      state_file="${BOARD_ROOT}/runners/state/${worker_id}.state"
      if [ -f "$state_file" ]; then
        for kv in "active_recovery_reason=recovery_state_blocked" "active_recovery_status=${recovery_status}" "active_recovery_failure_class=${recovery_class}"; do
          k="${kv%%=*}"
          if grep -q "^${k}=" "$state_file"; then
            perl -0pi -e "s/^${k}=.*\$/${kv}/m" "$state_file"
          else
            printf '%s\n' "$kv" >> "$state_file"
          fi
        done
      fi
      printf 'status=blocked\nrunner_status=blocked\nruntime_status=blocked\nactive_item=%s\nticket=%s\nticket_id=%s\nreason=ticket_stage_blocked\nactive_recovery_reason=recovery_state_blocked\nboard_root=%s\nproject_root=%s\nnext_action=Recovery State already marks ticket blocked; not auto-failing.\n' "$ticket_file" "$ticket_file" "$ticket_id" "$BOARD_ROOT" "$PROJECT_ROOT"
      exit 0
    fi
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
        integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
        if [ "$integration_status" = "blocked_stale_todo_worktree" ]; then
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Status" "blocked"
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Detected By" "runtime"
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Failure Class" "stale_todo_worktree"
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Evidence" "stale todo worktree remains blocked; ticket-owner must not continue until it is resolved."
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Owner Resume Instruction" "Inspect the stale worktree, then merge/rebase, back up and discard, or park it before ticket-owner continues."
          replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Last Recovery At" "$timestamp"
          blocked_next_action="Stale todo worktree is still blocked. Inspect the worktree, then merge/rebase, back up and discard, or park it before ticket-owner continues."
          blocked_reason="stale_todo_worktree"
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
      fi

      # Single-flow safety: if a Stage=blocked ticket cannot self-recover,
      # delegate to finish-ticket-owner fail so it routes through the inbox
      # retry order like every other failure. Prevents ticket_stage_blocked
      # dead-lock from re-emerging on dirty_root / sanity_gate stale states.
      finish_script="$(cd "$(dirname "$0")" && pwd)/finish-ticket-owner.sh"
      if [ -x "$finish_script" ]; then
        AUTOFLOW_ROLE=ticket-owner \
        AUTOFLOW_WORKER_ID="${worker_id}" \
        AUTOFLOW_BOARD_ROOT="${BOARD_ROOT}" \
        AUTOFLOW_PROJECT_ROOT="${PROJECT_ROOT}" \
        "$finish_script" "$ticket_id" fail "auto-fail from start-ticket-owner: ${blocked_reason} — ${blocked_next_action}" 2>&1 || true
      fi
      printf 'status=failed\n'
      printf 'outcome=fail\n'
      printf 'reason=%s\n' "$blocked_reason"
      printf 'next_action=auto-routed to inbox retry order\n'
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
    worktree_evidence="$(printf '%s' "$worktree_output" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/[[:space:]]*$//')"
    integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
    if [ "$integration_status" = "blocked_stale_todo_worktree" ]; then
      set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
      sync_runner_active_state "$ticket_file" "blocked"
      ticket_goal_block "$ticket_file" "stale_todo_worktree"
      printf 'status=blocked\n'
      printf 'reason=stale_todo_worktree\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf 'ticket_id=%s\n' "$ticket_id"
      printf '%s\n' "$worktree_output"
      printf 'next_action=Resolve stale ticket worktree before ticket-owner continues: %s\n' "$worktree_evidence"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    fi
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$owner_lock_value"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_worktree_setup_failed"
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Status" "blocked"
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Detected By" "runtime"
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Failure Class" "tooling_failure"
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Evidence" "worktree setup failed: ${worktree_evidence}"
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Owner Resume Instruction" "Fix the worktree setup failure, then rerun ticket-owner."
    replace_scalar_field_in_section "$ticket_file" "## Recovery State" "Last Recovery At" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- 다음에 바로 이어서 할 일: worktree 생성 실패를 해결한 뒤 ticket-owner 실행을 재개한다."
    append_note "$ticket_file" "AI ${display_id} worktree setup failed at ${timestamp}: ${worktree_output}"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    sync_runner_active_state "$ticket_file" "blocked"
    ticket_goal_block "$ticket_file" "worktree_setup_failed"
    printf 'status=blocked\n'
    printf 'reason=worktree_setup_failed\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf '%s\n' "$worktree_output"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  ensure_ready_worktree_exists_or_block "$ticket_file" "$ticket_id" "$timestamp" "$worktree_output"

  shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
  if [ -n "$shared_blockers" ]; then
    blockers_summary="$(printf '%s\n' "$shared_blockers" | shared_allowed_path_blockers_summary)"
    mark_ticket_shared_allowed_path_blocked "$ticket_file" "$worker_id" "$timestamp" "$shared_blockers"
    set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "blocked" "$(board_relative_path "$ticket_file")"
    sync_runner_active_state "$ticket_file" "blocked"
    ticket_goal_block "$ticket_file" "shared_allowed_path_conflict"
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
    ticket_goal_block "$ticket_file" "shared_nonbase_head_conflict"
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
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  project_note="[[${project_key}]]"
  ticket_note="[[Todo-${ticket_id}]]"
  done_target="$(done_ticket_path_for_ticket_file "$ticket_file")"
  stage="$(ticket_stage "$ticket_file")"
  integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
  case "${stage:-}" in
    ""|todo|claimed)
      stage="executing"
      ;;
  esac
  case "${stage}:${integration_status}" in
    ready_to_merge:*|ready-to-merge:*|merging:*|*:needs_ai_merge|*:ready_to_merge)
      merge_continuation=true
      ;;
  esac
  # dirty_project_root_conflict pre-check removed (refactor 2026-05-07): a
  # single live worker + .gitignore separation means autoflow no longer creates
  # dirty paths itself. If the user is editing PROJECT_ROOT externally, the
  # worker still works inside its own worktree; conflicts surface naturally at
  # merge time and are routed through finish-ticket-owner fail → inbox retry
  # order.
  if [ "$merge_continuation" = "true" ]; then
    next_action_line="- Next: continue AI-led merge for this ticket. Manually integrate verified worktree changes into PROJECT_ROOT/main inside Allowed Paths, resolve conflicts if needed, rerun required verification from PROJECT_ROOT, then rerun \`scripts/finish-ticket-owner.sh ${ticket_id} pass \"<summary>\"\`. Do not claim another ticket or call merge-ready-ticket directly."
    verification_block="- Result: previous pass is waiting for AI-led PROJECT_ROOT merge and post-merge verification by ${display_id}"
  else
    next_action_line="- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다."
    verification_block="- Result: pending ticket-owner by ${display_id}"
  fi

  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "$stage"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$owner_lock_value"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Verification" "$verification_block"
  replace_section_block "$ticket_file" "Next Action" "$next_action_line"
  append_note_replacing "$ticket_file" \
    "AI ${display_id} prepared ${source_kind} at ${timestamp}; worktree=${implementation_root}" \
    "AI ${display_id} prepared ${source_kind}"
  if ticket_claim_is_takeover "$ticket_file"; then
    append_note_replacing "$ticket_file" \
      "stale lock takeover by ${worker_id}:${owner_pid} at ${timestamp}" \
      "stale lock takeover by ${worker_id}:"
  fi
  set_thread_context_record "ticket-owner" "$worker_id" "$ticket_id" "$stage" "$(board_relative_path "$ticket_file")"
  sync_runner_active_state "$ticket_file" "$stage"
  announce_stage="$stage"
  case "$source_kind" in
    requested-ticket|todo|adopted-inprogress)
      announce_stage="inprogress"
      ;;
  esac
  announce_runner_stage "$announce_stage" "$ticket_file"
  ticket_goal_activate "$ticket_file" "$source_kind"

  printf 'ticket=%s\n' "$ticket_file"
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'owner=%s\n' "$worker_id"
  printf 'stage=%s\n' "$stage"
  printf 'source=%s\n' "$source_kind"
  printf '%s\n' "$worktree_output"
  printf 'implementation_root=%s\n' "$implementation_root"
  printf 'done_target=%s\n' "$done_target"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  if [ "$merge_continuation" = "true" ]; then
    printf 'next_action=Continue AI-led merge for ticket %s: integrate verified worktree changes into PROJECT_ROOT/main, rerun verification, then rerun finish-ticket-owner pass.\n' "$ticket_id"
  else
    printf 'next_action=Follow ticket-owner-agent.md flow for ticket %s.\n' "$ticket_id"
  fi
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
      fail_or_idle "Ticket is already claimed by another owner: Todo-${requested_normalized}.md" "ticket_claim_conflict"
    fi
    auto_resume_finish_pass_or_continue "$claimed_ticket"
    printf 'status=ok\n'
    prepare_ticket_owner_context "$claimed_ticket" "requested-ticket"
    exit 0
  fi
else
  # PRD 5 (2026-05-09) / PRD_279 (2026-05-12): walk the todo queue with
  # path-conflict filtering (default on). find_next_dispatchable_todo holds the
  # dispatch.lock through the claim so two workers cannot pick the same ticket.
  # release_dispatch_lock is called after mv completes (or when none found).
  next_ticket="$(find_next_dispatchable_todo || true)"
  if [ -n "$next_ticket" ]; then
    claimed_ticket="$(claim_existing_ticket "$next_ticket" || true)"
    release_dispatch_lock
    if [ -z "$claimed_ticket" ]; then
      fail_or_idle "Ticket is already claimed by another owner." "ticket_claim_conflict"
    fi
    printf 'status=ok\n'
    prepare_ticket_owner_context "$claimed_ticket" "todo"
    exit 0
  fi
  release_dispatch_lock

  legacy_verifier_ticket="$(lowest_matching_file "${BOARD_ROOT}/tickets/verifier" 'Todo-*.md' 'tickets_*.md' || true)"
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
