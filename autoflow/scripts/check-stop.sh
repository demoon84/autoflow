#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

stop_bypass_enabled() {
  case "${AUTOFLOW_STOP_BYPASS:-}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

emit_block() {
  local reason="$1"
  reason="${reason//\\/\\\\}"
  reason="${reason//\"/\\\"}"

  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "decision": "block",
    "reason": "$reason"
  }
}
EOF
}

resolve_context_file() {
  local thread_file current_file

  thread_file="$(thread_context_path "$(current_thread_key || true)" || true)"
  if [ -n "$thread_file" ] && [ -f "$thread_file" ]; then
    printf '%s' "$thread_file"
    return 0
  fi

  current_file="$(current_context_path)"
  if [ -f "$current_file" ]; then
    printf '%s' "$current_file"
    return 0
  fi

  return 1
}

load_context() {
  local context_file

  hook_role="${AUTOFLOW_ROLE:-}"
  hook_worker_id="${AUTOFLOW_WORKER_ID:-}"
  hook_execution_pool="${AUTOFLOW_EXECUTION_POOL:-}"
  hook_verifier_pool="${AUTOFLOW_VERIFIER_POOL:-}"

  context_file="$(resolve_context_file || true)"
  hook_context_file="${context_file:-}"

  if [ -n "$context_file" ]; then
    [ -n "$hook_role" ] || hook_role="$(context_file_read_value "$context_file" "role" || true)"
    [ -n "$hook_worker_id" ] || hook_worker_id="$(context_file_read_value "$context_file" "worker_id" || true)"
    [ -n "$hook_execution_pool" ] || hook_execution_pool="$(context_file_read_value "$context_file" "execution_pool" || true)"
    [ -n "$hook_verifier_pool" ] || hook_verifier_pool="$(context_file_read_value "$context_file" "verifier_pool" || true)"
  fi
}

spec_is_populated() {
  local spec_file="$1"

  [ -n "$spec_file" ] || return 1
  [ -f "$spec_file" ] || return 1
  if spec_file_is_placeholder "$spec_file"; then
    return 1
  fi
  return 0
}

plan_status_value() {
  local plan_file="$1"
  extract_scalar_field_in_section "$plan_file" "Plan" "Status" | tr -d ' '
}

plan_hook_reason() {
  local reject_file spec_root plan_root spec_file spec_id plan_file status spec_ref candidates

  reject_file="$(list_reject_ticket_files | head -n 1 || true)"
  if [ -n "$reject_file" ]; then
    printf 'planner work remains: reject ticket %s still needs replanning.' "$(basename "$reject_file")"
    return 0
  fi

  spec_root="${BOARD_ROOT}/tickets/backlog"
  if [ -d "$spec_root" ]; then
    while IFS= read -r spec_file; do
      [ -n "$spec_file" ] || continue
      if ! spec_is_populated "$spec_file"; then
        continue
      fi

      spec_id="$(extract_numeric_id "$spec_file" 2>/dev/null || true)"
      [ -n "$spec_id" ] || continue
      plan_file="$(plan_path "$spec_id")"
      if [ ! -f "$plan_file" ] || plan_file_is_placeholder "$plan_file"; then
        printf 'planner work remains: populated backlog spec %s still needs a real plan.' "$(basename "$spec_file")"
        return 0
      fi
    done < <(find "$spec_root" -maxdepth 1 -type f -name 'project_*.md' | sort)
  fi

  plan_root="$(plan_root_path)"
  if [ -d "$plan_root" ]; then
    while IFS= read -r plan_file; do
      [ -n "$plan_file" ] || continue
      if plan_file_is_placeholder "$plan_file"; then
        continue
      fi

      status="$(plan_status_value "$plan_file")"
      case "$status" in
        ready)
          printf 'planner work remains: plan %s is ready to generate todo tickets.' "$(basename "$plan_file")"
          return 0
          ;;
        draft)
          spec_ref="$(strip_markdown_code_ticks "$(extract_reference_value "$plan_file" "Spec References" "Project Spec")")"
          candidates="$(extract_execution_candidates "$plan_file")"
          if spec_is_populated "${BOARD_ROOT}/${spec_ref}" && [ -n "$candidates" ]; then
            printf 'planner work remains: draft plan %s can be auto-flipped and ticketed.' "$(basename "$plan_file")"
            return 0
          fi
          ;;
      esac
    done < <(find "$plan_root" -maxdepth 1 -type f -name 'plan_[0-9][0-9][0-9].md' | sort)
  fi

  return 1
}

todo_hook_reason() {
  local inprogress_file stage execution_owner owner todo_file

  if [ -z "$hook_worker_id" ]; then
    return 1
  fi

  while IFS= read -r inprogress_file; do
    [ -n "$inprogress_file" ] || continue
    stage="$(ticket_stage "$inprogress_file")"
    execution_owner="$(ticket_scalar_field "$inprogress_file" "Execution Owner")"
    owner="$(ticket_scalar_field "$inprogress_file" "Owner")"

    if [ "$execution_owner" = "$hook_worker_id" ] || [ "$owner" = "$hook_worker_id" ] || { field_is_unassigned "$execution_owner" && [ "$owner" = "$hook_worker_id" ]; }; then
      case "${stage:-}" in
        ""|claimed|executing)
          printf 'todo work remains: worker %s still has inprogress ticket %s.' "$hook_worker_id" "$(basename "$inprogress_file")"
          return 0
          ;;
      esac
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  export AUTOFLOW_EXECUTION_POOL="${hook_execution_pool:-$hook_worker_id}"
  if execution_pool_has_capacity; then
    todo_file="$(lowest_matching_file "${BOARD_ROOT}/tickets/todo" 'tickets_*.md' || true)"
    if [ -n "$todo_file" ]; then
      printf 'todo work remains: claimable todo ticket %s is waiting.' "$(basename "$todo_file")"
      return 0
    fi
  fi

  return 1
}

verifier_hook_reason() {
  local verifier_file verifier_owner owner

  if [ -z "$hook_worker_id" ]; then
    return 1
  fi

  while IFS= read -r verifier_file; do
    [ -n "$verifier_file" ] || continue
    verifier_owner="$(ticket_scalar_field "$verifier_file" "Verifier Owner")"
    owner="$(ticket_scalar_field "$verifier_file" "Owner")"

    if [ "$verifier_owner" = "$hook_worker_id" ] || \
       { field_is_unassigned "$verifier_owner" && [ "$owner" = "$hook_worker_id" ]; } || \
       field_is_unassigned "$verifier_owner"; then
      printf 'verifier work remains: ticket %s is awaiting verification.' "$(basename "$verifier_file")"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/verifier" 'tickets_*.md')

  return 1
}

if stop_bypass_enabled; then
  exit 0
fi

load_context

if [ -z "${hook_role:-}" ]; then
  exit 0
fi

reason=""
case "$hook_role" in
  plan)
    reason="$(plan_hook_reason || true)"
    ;;
  todo)
    reason="$(todo_hook_reason || true)"
    ;;
  verifier)
    reason="$(verifier_hook_reason || true)"
    ;;
  *)
    exit 0
    ;;
esac

if [ -z "$reason" ]; then
  exit 0
fi

emit_block "$reason"
exit 0
