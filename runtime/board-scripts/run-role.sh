#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/cli-common.sh" ]; then
  source "${SCRIPT_DIR}/cli-common.sh"
else
  source "${SCRIPT_DIR}/../../packages/cli/cli-common.sh"
fi
source "$(runtime_scripts_root)/runner-common.sh"

# Thin runtime contract:
# - this entrypoint dispatches one runner tick and exposes state through stable
#   key=value output;
# - it never becomes the workflow brain for planning, verification, recovery, or merge.

usage() {
  cat <<'EOF' >&2
Usage:
  run-role.sh ticket [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh planner [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh todo [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh verifier [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh merge [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh wiki [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh self-improve [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
EOF
}

requested_role="${1:-}"
if [ -z "$requested_role" ]; then
  usage
  exit 1
fi
shift || true

runner_id=""
dry_run="false"
positionals=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --runner)
      shift || true
      runner_id="${1:-}"
      if [ -z "$runner_id" ]; then
        echo "--runner requires a runner id" >&2
        exit 1
      fi
      ;;
    --runner=*)
      runner_id="${1#--runner=}"
      ;;
    --dry-run)
      dry_run="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      positionals+=("$1")
      ;;
  esac
  shift || true
done

case "$requested_role" in
  ticket|owner|ticket-owner)
    public_role="ticket"
    runtime_role="ticket-owner"
    default_runner_id="worker"
    runtime_script="start-ticket-owner.sh"
    ;;
  planner|plan)
    public_role="planner"
    runtime_role="plan"
    default_runner_id="planner"
    runtime_script="start-plan.sh"
    ;;
  todo)
    public_role="todo"
    runtime_role="todo"
    default_runner_id="todo-1"
    runtime_script="start-todo.sh"
    ;;
  verifier|veri)
    public_role="verifier"
    runtime_role="verifier"
    default_runner_id="verifier-1"
    runtime_script="start-verifier.sh"
    ;;
  merge|merge-bot)
    public_role="merge"
    runtime_role="merge"
    default_runner_id="merge-1"
    runtime_script="merge-ready-ticket.sh"
    ;;
  wiki|wiki-maintainer)
    public_role="wiki"
    runtime_role="wiki"
    default_runner_id="wiki"
    runtime_script=""
    ;;
  self-improve|self_improve|selfimprove)
    public_role="self-improve"
    runtime_role="self-improve"
    default_runner_id="self-improve-1"
    runtime_script="start-self-improve.sh"
    ;;
  *)
    echo "Unknown run role: ${requested_role}" >&2
    usage
    exit 1
    ;;
esac

if [ -z "$runner_id" ]; then
  runner_id="$default_runner_id"
fi

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
export AUTOFLOW_BOARD_ROOT="$board_root"
export AUTOFLOW_PROJECT_ROOT="$project_root"
adapter_working_root="$project_root"
adapter_active_ticket_file=""
adapter_active_ticket_id=""
adapter_active_ticket_title=""
adapter_active_stage=""
adapter_active_spec_ref=""
adapter_active_recovery_reason=""
adapter_active_recovery_status=""
adapter_active_recovery_failure_class=""
adapter_active_recovery_worktree_path=""
adapter_active_recovery_worktree_status=""
adapter_active_recovery_board_state=""
planner_diff_context_enabled="false"
planner_diff_mode=""
planner_diff_reason=""
planner_diff_summary_line=""
planner_diff_previous_summary=""
planner_diff_current_manifest_path=""
planner_diff_current_fingerprint=""
planner_diff_previous_fingerprint=""
planner_diff_state_path_value=""
planner_diff_manifest_path_value=""
planner_diff_summary_path_value=""
planner_diff_changed_count="0"
planner_diff_added_count="0"
planner_diff_modified_count="0"
planner_diff_removed_count="0"
planner_diff_unchanged_count="0"
planner_diff_current_count="0"
planner_diff_previous_count="0"
planner_diff_threshold_percent="30"
planner_diff_changed_ratio_percent="0"
planner_diff_force_full_next="false"
planner_diff_added_list=""
planner_diff_modified_list=""
planner_diff_removed_list=""
planner_diff_unchanged_list=""

config_path="$(runner_config_path)"

print_run_header() {
  local status="$1"
  printf 'status=%s\n' "$status"
  printf 'action=run\n'
  printf 'role=%s\n' "$public_role"
  printf 'runtime_role=%s\n' "$runtime_role"
  printf 'runner_id=%s\n' "$runner_id"
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'board_dir_name=%s\n' "$board_dir_name"
  printf 'config_path=%s\n' "$config_path"
}

command_summary_from_array() {
  local arg first

  first=1
  for arg in "$@"; do
    if [ "$first" -eq 0 ]; then
      printf ' '
    fi
    printf '%q' "$arg"
    first=0
  done
}

runner_field() {
  local field="$1"
  runner_config_field "$runner_id" "$field" "$config_path" 2>/dev/null || true
}

runner_state_value() {
  local field="$1"
  runner_state_field "$runner_id" "$field" 2>/dev/null || true
}

runner_active_state_value() {
  runner_state_value "$1"
}

run_role_count_markdown_files() {
  local dir="$1"
  local count

  if [ ! -d "$dir" ]; then
    printf '0'
    return 0
  fi

  count="$(find "$dir" -type f -name '*.md' 2>/dev/null | wc -l | tr -d '[:space:]')"
  case "$count" in
    ''|*[!0-9]*) count=0 ;;
  esac
  printf '%s' "$count"
}

runner_agent_supports_reasoning() {
  case "$agent" in
    codex|opencode)
      return 0
      ;;
    claude)
      runner_claude_supports_effort
      return $?
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_effective_reasoning_for_current_tick() {
  local dynamic_flag
  local planner_actionable_count ticket_actionable_count reject_count

  configured_reasoning="$reasoning"
  effective_reasoning="$configured_reasoning"
  reasoning_complexity="configured"
  reasoning_source="configured"
  reasoning_supported="false"
  reasoning_dynamic_enabled="false"
  reasoning_actionable_count="0"
  reasoning_reject_count="0"

  if runner_agent_supports_reasoning; then
    reasoning_supported="true"
  fi

  dynamic_flag="${AUTOFLOW_REASONING_DYNAMIC_ENABLED:-0}"
  case "$dynamic_flag" in
    1|true|yes|on|TRUE|YES|ON)
      reasoning_dynamic_enabled="true"
      ;;
  esac

  case "$public_role" in
    planner)
      planner_actionable_count="$(run_role_count_markdown_files "${board_root}/tickets/inbox")"
      planner_actionable_count=$((planner_actionable_count + $(run_role_count_markdown_files "$(spec_root_path "$board_root")")))
      reject_count="$(run_role_count_markdown_files "${board_root}/tickets/reject")"
      planner_actionable_count=$((planner_actionable_count + reject_count))
      reasoning_actionable_count="$planner_actionable_count"
      reasoning_reject_count="$reject_count"
      ;;
    ticket)
      if [ -n "${adapter_active_ticket_id:-}" ] || [ -n "${adapter_active_ticket_file:-}" ]; then
        reasoning_actionable_count="1"
      else
        ticket_actionable_count="$(run_role_count_markdown_files "${board_root}/tickets/todo")"
        reasoning_actionable_count="$ticket_actionable_count"
      fi
      ;;
    verifier)
      reasoning_actionable_count="$(run_role_count_markdown_files "${board_root}/tickets/verifier")"
      ;;
  esac

  if [ "$reasoning_dynamic_enabled" != "true" ] || [ "$reasoning_supported" != "true" ]; then
    if [ "$reasoning_dynamic_enabled" = "true" ] && [ "$reasoning_supported" != "true" ]; then
      reasoning_source="configured_unsupported_agent"
    fi
    return 0
  fi

  if [ -n "${adapter_active_recovery_reason:-}" ] ||
     { [ -n "${adapter_active_recovery_status:-}" ] && [ "${adapter_active_recovery_status}" != "healthy" ]; } ||
     [ -n "${adapter_active_recovery_failure_class:-}" ]; then
    effective_reasoning="high"
    reasoning_complexity="complex"
    reasoning_source="dynamic_recovery"
    return 0
  fi

  case "${adapter_active_ticket_file:-}" in
    *"/tickets/reject/"*|tickets/reject/*)
      effective_reasoning="high"
      reasoning_complexity="complex"
      reasoning_source="dynamic_reject"
      return 0
      ;;
  esac

  if [ "${reasoning_reject_count:-0}" -gt 0 ]; then
    effective_reasoning="high"
    reasoning_complexity="complex"
    reasoning_source="dynamic_reject_queue"
  elif [ "${reasoning_actionable_count:-0}" -gt 1 ]; then
    effective_reasoning="high"
    reasoning_complexity="complex"
    reasoning_source="dynamic_multi_actionable"
  elif [ "${reasoning_actionable_count:-0}" -eq 1 ]; then
    effective_reasoning="medium"
    reasoning_complexity="normal"
    reasoning_source="dynamic_single_actionable"
  else
    effective_reasoning="low"
    reasoning_complexity="simple"
    reasoning_source="dynamic_idle"
  fi
}

role_autocommit_scope_paths() {
  case "$public_role" in
    planner)
      printf '%s\n' \
        "${board_root}/tickets/inbox" \
        "${board_root}/tickets/backlog" \
        "${board_root}/tickets/todo" \
        "${board_root}/tickets/inprogress" \
        "${board_root}/tickets/reject" \
        "${board_root}/tickets/done"
      ;;
    wiki)
      printf '%s\n' \
        "${board_root}/wiki" \
        "${board_root}/wiki-raw"
      ;;
  esac
}

role_autocommit_capture_status() {
  local output_file="$1"
  local git_root path
  local -a scope_paths=()

  : > "$output_file"
  case "$public_role" in
    planner|wiki) ;;
    *) return 0 ;;
  esac

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$git_root" ] || return 0

  while IFS= read -r path; do
    [ -n "$path" ] || continue
    scope_paths+=("$path")
  done < <(role_autocommit_scope_paths)
  [ "${#scope_paths[@]}" -gt 0 ] || return 0

  git -C "$git_root" status --porcelain -- "${scope_paths[@]}" > "$output_file" 2>/dev/null || true
}

role_autocommit_message() {
  local git_root="$1"
  shift
  local project_key

  project_key="$(git -C "$git_root" diff --cached --name-only -- "$@" |
    sed -n 's#.*prd_\([0-9][0-9]*\).*#prd_\1#p' |
    head -n 1)"

  case "$public_role" in
    planner)
      [ -n "$project_key" ] || project_key="autoflow_planner"
      printf '[%s] planner board update\n' "$project_key"
      ;;
    wiki)
      if [ -n "$project_key" ]; then
        printf '[%s] wiki knowledge update\n' "$project_key"
      else
        printf '[wiki] wiki knowledge update\n'
      fi
      ;;
  esac
}

role_autocommit_after_adapter() {
  local adapter_exit="$1"
  local before_status_file="$2"
  local git_root path commit_message
  local -a scope_paths=()

  case "$public_role" in
    planner|wiki) ;;
    *) return 0 ;;
  esac

  printf 'autocommit_role=%s\n' "$public_role"

  if [ "${AUTOFLOW_RUNNER_SKIP_SCOPED_AUTOCOMMIT:-}" = "1" ]; then
    printf 'autocommit_status=skipped_by_env\n'
    return 0
  fi
  if [ "$adapter_exit" -ne 0 ]; then
    printf 'autocommit_status=skipped_adapter_exit_%s\n' "$adapter_exit"
    return 0
  fi

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -z "$git_root" ]; then
    printf 'autocommit_status=not_git_repo\n'
    return 0
  fi

  if [ -s "$before_status_file" ]; then
    printf 'autocommit_status=skipped_preexisting_dirty_scope\n'
    return 0
  fi

  while IFS= read -r path; do
    [ -n "$path" ] || continue
    scope_paths+=("$path")
  done < <(role_autocommit_scope_paths)
  if [ "${#scope_paths[@]}" -eq 0 ]; then
    printf 'autocommit_status=no_scope\n'
    return 0
  fi

  if [ -z "$(git -C "$git_root" status --porcelain -- "${scope_paths[@]}" 2>/dev/null)" ]; then
    printf 'autocommit_status=no_changes\n'
    return 0
  fi

  git -C "$git_root" add -A -- "${scope_paths[@]}"
  if git -C "$git_root" diff --cached --quiet -- "${scope_paths[@]}"; then
    printf 'autocommit_status=no_changes\n'
    return 0
  fi

  commit_message="$(role_autocommit_message "$git_root" "${scope_paths[@]}")"
  git -C "$git_root" commit -m "$commit_message" -- "${scope_paths[@]}" >/dev/null
  printf 'autocommit_status=committed\n'
  printf 'autocommit_hash=%s\n' "$(git -C "$git_root" rev-parse --verify HEAD)"
  printf 'autocommit_message=%s\n' "$commit_message"
}

run_wiki_curator_idle_best_effort() {
  local cli_path output status

  [ "$public_role" = "wiki" ] || return 0
  cli_path="${project_root}/bin/autoflow"
  [ -x "$cli_path" ] || return 0

  set +e
  output="$("$cli_path" skill curator-run "$project_root" "$board_dir_name" --idle 2>&1)"
  status=$?
  set -e
  printf 'curator_idle.status=%s\n' "$status"
  printf '%s\n' "$output" | awk -F= '/^(status|reason|last_run_at|run_count|reviewed_count|stale_marked_count|archived_count|pinned_skipped_count|auxiliary_client|main_prompt_cache_touched)=/ { print "curator_idle." $0 }'
}

run_skill_nudge_best_effort() {
  local ticket_file tick_count interval state_file in_progress cli_path output status

  case "$public_role" in
    planner|ticket) ;;
    *) return 0 ;;
  esac
  case "${AUTOFLOW_SKILL_NUDGE_ENABLED:-1}" in
    0|false|off|no|FALSE|OFF|NO) return 0 ;;
  esac

  ticket_file="$(ticket_goal_active_ticket_file 2>/dev/null || true)"
  if [ -z "$ticket_file" ] && [ "$public_role" = "planner" ]; then
    ticket_file="$(runner_active_ticket_file_from_item "$(runner_adapter_state_value "active_item")" 2>/dev/null || true)"
  fi
  [ -n "$ticket_file" ] || return 0
  interval="${AUTOFLOW_SKILL_NUDGE_INTERVAL_TICKS:-10}"
  case "$interval" in ''|*[!0-9]*) interval=10 ;; esac
  [ "$interval" -gt 0 ] || return 0

  tick_count="$(planner_ticket_field "$ticket_file" "Goal Runtime" "Tick Count")"
  case "$tick_count" in ''|*[!0-9]*) tick_count=0 ;; esac
  [ "$tick_count" -gt 0 ] || return 0
  [ $((tick_count % interval)) -eq 0 ] || return 0

  state_file="${board_root}/runners/state/skill-nudge.${runner_id}.state"
  in_progress="$(awk -F= '$1 == "skill_extraction_in_progress" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$state_file" 2>/dev/null || true)"
  if [ "$in_progress" = "true" ]; then
    printf 'skill_nudge.status=skipped_recursion_guard\n'
    printf 'skill_nudge.state_file=%s\n' "$state_file"
    return 0
  fi

  mkdir -p "$(dirname "$state_file")"
  {
    printf 'skill_extraction_in_progress=true\n'
    printf 'runner_id=%s\n' "$runner_id"
    printf 'ticket=%s\n' "$ticket_file"
    printf 'tick_count=%s\n' "$tick_count"
  } > "$state_file"

  cli_path="${project_root}/bin/autoflow"
  if [ -x "$cli_path" ]; then
    set +e
    output="$("$cli_path" skill auto-extract "$project_root" "$board_dir_name" --from-ticket "$ticket_file" --pattern-type skill_nudge --category nudge 2>&1)"
    status=$?
    set -e
  else
    output="autoflow cli missing"
    status=127
  fi

  {
    printf 'skill_extraction_in_progress=false\n'
    printf 'runner_id=%s\n' "$runner_id"
    printf 'ticket=%s\n' "$ticket_file"
    printf 'tick_count=%s\n' "$tick_count"
    printf 'last_exit=%s\n' "$status"
    printf 'last_run_at=%s\n' "$(runner_now_iso)"
  } > "$state_file"

  printf 'skill_nudge.status=%s\n' "$status"
  printf 'skill_nudge.state_file=%s\n' "$state_file"
  printf '%s\n' "$output" | awk -F= '/^(status|skill_file|skill_path|skill_id|created_from)=/ { print "skill_nudge." $0 }'
}

runner_ticket_id_from_active_item() {
  local item="$1"
  local name
  local id

  name="${item##*/}"
  name="${name%.md}"
  case "$name" in
    tickets_[0-9]*)
      id="$(printf '%s' "$name" | sed -n 's/^\(tickets_[0-9][0-9]*\).*/\1/p')"
      [ -n "$id" ] && printf '%s' "$id"
      ;;
    verify_[0-9]*)
      id="$(printf '%s' "$name" | sed -n 's/^\(verify_[0-9][0-9]*\).*/\1/p')"
      [ -n "$id" ] && printf '%s' "$id"
      ;;
  esac
}

runner_adapter_state_value() {
  local field="$1"
  local derived_ticket_id

  case "$field" in
    active_item)
      if [ -n "${adapter_active_ticket_file:-}" ]; then
        printf '%s' "$adapter_active_ticket_file"
      else
        runner_active_state_value "$field"
      fi
      ;;
    active_ticket_id)
      if [ -n "${adapter_active_ticket_id:-}" ]; then
        printf '%s' "$adapter_active_ticket_id"
      elif [ -n "${adapter_active_ticket_file:-}" ]; then
        derived_ticket_id="$(runner_ticket_id_from_active_item "$adapter_active_ticket_file")"
        if [ -n "$derived_ticket_id" ]; then
          printf '%s' "$derived_ticket_id"
        else
          runner_active_state_value "$field"
        fi
      else
        runner_active_state_value "$field"
      fi
      ;;
    active_ticket_title)
      if [ -n "${adapter_active_ticket_title:-}" ]; then
        printf '%s' "$adapter_active_ticket_title"
      else
        runner_active_state_value "$field"
      fi
      ;;
    active_stage)
      if [ -n "${adapter_active_stage:-}" ]; then
        printf '%s' "$adapter_active_stage"
      else
        runner_active_state_value "$field"
      fi
      ;;
    active_spec_ref)
      if [ -n "${adapter_active_spec_ref:-}" ]; then
        printf '%s' "$adapter_active_spec_ref"
      else
        runner_active_state_value "$field"
      fi
      ;;
    *)
      runner_active_state_value "$field"
      ;;
  esac
}

ticket_goal_common_call() {
  local common_path="${board_root}/scripts/common.sh"

  [ -f "$common_path" ] || return 1

  (
    export AUTOFLOW_BOARD_ROOT="$board_root"
    export AUTOFLOW_PROJECT_ROOT="$project_root"
    # shellcheck source=/dev/null
    source "$common_path"
    "$@"
  )
}

ticket_goal_active_ticket_file() {
  local file active_path active_id id candidate

  [ "$public_role" = "ticket" ] || return 1

  file="${adapter_active_ticket_file:-}"
  if [ -n "$file" ]; then
    case "$file" in
      /*) ;;
      *) file="${board_root}/${file}" ;;
    esac
    [ -f "$file" ] && printf '%s' "$file" && return 0
  fi

  active_path="$(runner_active_state_value "active_ticket_path")"
  if [ -n "$active_path" ]; then
    case "$active_path" in
      /*) file="$active_path" ;;
      *) file="${board_root}/${active_path}" ;;
    esac
    [ -f "$file" ] && printf '%s' "$file" && return 0
  fi

  active_id="${adapter_active_ticket_id:-$(runner_active_state_value "active_ticket_id")}"
  id="$(printf '%s' "$active_id" | sed -n 's/^tickets_\([0-9][0-9][0-9]\)$/\1/p')"
  [ -n "$id" ] || id="$(printf '%s' "$active_id" | sed -n 's/^\([0-9][0-9][0-9]\)$/\1/p')"
  [ -n "$id" ] || return 1

  for candidate in \
    "${board_root}/tickets/inprogress/tickets_${id}.md" \
    "${board_root}/tickets/ready-to-merge/tickets_${id}.md" \
    "${board_root}/tickets/merge-blocked/tickets_${id}.md" \
    "${board_root}/tickets/verifier/tickets_${id}.md" \
    "${board_root}/tickets/todo/tickets_${id}.md"; do
    [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
  done

  return 1
}

ticket_goal_prompt_block_for_current_ticket() {
  local ticket_file

  ticket_file="$(ticket_goal_active_ticket_file || true)"
  [ -n "$ticket_file" ] || return 0
  ticket_goal_common_call ticket_goal_prompt_block "$ticket_file"
}

ticket_goal_progress_fingerprint_for_current_ticket() {
  local ticket_file

  ticket_file="$(ticket_goal_active_ticket_file || true)"
  [ -n "$ticket_file" ] || return 0
  ticket_goal_common_call ticket_goal_progress_fingerprint "$ticket_file"
}

ticket_goal_record_adapter_result_for_current_ticket() {
  local adapter_exit="$1"
  local before_fingerprint="${2:-}"
  local ticket_file

  ticket_file="$(ticket_goal_active_ticket_file || true)"
  [ -n "$ticket_file" ] || return 0
  ticket_goal_common_call ticket_goal_record_adapter_result "$ticket_file" "$adapter_exit" "$before_fingerprint" "$runner_id"
}

planner_ticket_field() {
  local file="$1"
  local section="$2"
  local field="$3"

  ticket_goal_common_call extract_scalar_field_in_section "$file" "$section" "$field" 2>/dev/null || true
}

runner_active_ticket_file_from_item() {
  local item="$1"
  local ticket_name ticket_number file candidate

  [ -n "$item" ] || return 1

  case "$item" in
    /*)
      [ -f "$item" ] && printf '%s' "$item" && return 0
      ;;
    tickets/*)
      file="${board_root}/${item}"
      [ -f "$file" ] && printf '%s' "$file" && return 0
      ;;
    "${board_dir_name}/tickets/"*)
      file="${project_root}/${item}"
      [ -f "$file" ] && printf '%s' "$file" && return 0
      ;;
  esac

  ticket_name="$(runner_ticket_id_from_active_item "$item")"
  [ -n "$ticket_name" ] || return 1
  ticket_number="${ticket_name#tickets_}"
  ticket_number="${ticket_number#verify_}"

  for candidate in \
    "${board_root}/tickets/inprogress/${ticket_name}.md" \
    "${board_root}/tickets/ready-to-merge/${ticket_name}.md" \
    "${board_root}/tickets/merge-blocked/${ticket_name}.md" \
    "${board_root}/tickets/verifier/${ticket_name}.md" \
    "${board_root}/tickets/todo/${ticket_name}.md" \
    "${board_root}/tickets/reject/${ticket_name}.md" \
    "${board_root}/tickets/done"/*/"${ticket_name}.md" \
    "${board_root}/tickets/inprogress/tickets_${ticket_number}.md" \
    "${board_root}/tickets/ready-to-merge/tickets_${ticket_number}.md" \
    "${board_root}/tickets/merge-blocked/tickets_${ticket_number}.md" \
    "${board_root}/tickets/todo/tickets_${ticket_number}.md"; do
    [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
  done

  return 1
}

runner_hydrate_active_ticket_metadata() {
  local ticket_file ticket_id_from_file title stage spec_ref
  local recovery_status recovery_failure_class recovery_reason

  ticket_file="$(runner_active_ticket_file_from_item "${active_item:-}" || true)"
  if [ -z "$ticket_file" ] && [ -n "${active_ticket_id:-}" ]; then
    ticket_file="$(runner_active_ticket_file_from_item "$active_ticket_id" || true)"
  fi
  [ -n "$ticket_file" ] || return 0

  ticket_id_from_file="$(runner_ticket_id_from_active_item "$ticket_file")"
  if [ -z "${active_ticket_id:-}" ] && [ -n "$ticket_id_from_file" ]; then
    active_ticket_id="$ticket_id_from_file"
  fi

  title="$(planner_ticket_field "$ticket_file" "Ticket" "Title")"
  stage="$(planner_ticket_field "$ticket_file" "Ticket" "Stage")"
  spec_ref="$(planner_ticket_field "$ticket_file" "Ticket" "PRD Key")"
  [ -n "$spec_ref" ] || spec_ref="$(planner_ticket_field "$ticket_file" "References" "PRD")"
  recovery_status="$(planner_ticket_field "$ticket_file" "Recovery State" "Status")"
  recovery_failure_class="$(planner_ticket_field "$ticket_file" "Recovery State" "Failure Class")"
  case "$recovery_status" in
    stalled|blocked|repairing|requeued|needs_user)
      recovery_reason="recovery_state_${recovery_status}"
      ;;
    *)
      recovery_reason=""
      ;;
  esac

  [ -n "${active_ticket_title:-}" ] || active_ticket_title="$title"
  [ -n "${active_stage:-}" ] || active_stage="$stage"
  [ -n "${active_spec_ref:-}" ] || active_spec_ref="$spec_ref"
  [ -n "${active_recovery_reason:-}" ] || active_recovery_reason="$recovery_reason"
  [ -n "${active_recovery_status:-}" ] || active_recovery_status="$recovery_status"
  [ -n "${active_recovery_failure_class:-}" ] || active_recovery_failure_class="$recovery_failure_class"
}

runner_replace_state_field_preserving() {
  local target_runner_id="$1"
  local field="$2"
  local value="$3"
  local state_path temp_file

  runner_validate_id "$target_runner_id" || return 1
  runner_validate_key "$field" || return 1

  state_path="$(runner_state_path "$target_runner_id")"
  [ -f "$state_path" ] || return 1
  temp_file="$(mktemp "${state_path}.XXXXXX")"

  awk -F= -v field="$field" -v value="$value" '
    $1 == field {
      print field "=" value
      replaced = 1
      next
    }
    { print }
    END { exit(replaced ? 0 : 1) }
  ' "$state_path" > "$temp_file" || {
    rm -f "$temp_file"
    return 1
  }

  mv "$temp_file" "$state_path"
}

runner_ticket_self_refresh_dirty_path() {
  local ticket_file="$1"
  local dirty_path="$2"
  local ticket_id board_dir

  [ -n "$dirty_path" ] || return 1
  ticket_id="$(runner_ticket_id_from_active_item "$ticket_file")"
  ticket_id="${ticket_id#tickets_}"
  [ -n "$ticket_id" ] || return 1
  board_dir="$(basename "$board_root")"

  case "$dirty_path" in
    "${board_dir}/tickets/inprogress/tickets_${ticket_id}.md"|\
    "${board_dir}/tickets/inprogress/verify_${ticket_id}.md")
      return 0
      ;;
  esac

  return 1
}

runner_ticket_allowed_paths_dirty_excluding_self_refresh() {
  local ticket_file="$1"
  local git_root="$2"
  local status_file allowed_path dirty_path found=false

  [ -f "$ticket_file" ] || return 1
  [ -n "$git_root" ] || return 1
  git -C "$git_root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1

  status_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-dirty-paths.XXXXXX")"
  git -C "$git_root" status --porcelain --untracked-files=all 2>/dev/null | while IFS= read -r line; do
    [ -n "$line" ] || continue
    dirty_path="${line#?? }"
    case "$dirty_path" in
      *" -> "*) dirty_path="${dirty_path##* -> }" ;;
    esac
    [ -n "$dirty_path" ] || continue
    runner_ticket_self_refresh_dirty_path "$ticket_file" "$dirty_path" && continue
    printf '%s\n' "$dirty_path"
  done > "$status_file"

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    while IFS= read -r dirty_path; do
      [ -n "$dirty_path" ] || continue
      if [ "$dirty_path" = "$allowed_path" ] || [ "${dirty_path#"$allowed_path"/}" != "$dirty_path" ]; then
        found=true
        break
      fi
    done < "$status_file"
    [ "$found" = "true" ] && break
  done < <(
    awk '
      /^## Allowed Paths/ { in_section = 1; next }
      /^## / && in_section { exit }
      in_section && /^[[:space:]]*-[[:space:]]*`/ {
        line = $0
        sub(/^[[:space:]]*-[[:space:]]*`/, "", line)
        sub(/`[[:space:]]*$/, "", line)
        print line
      }
    ' "$ticket_file"
  )

  rm -f "$status_file"
  [ "$found" = "true" ]
}

reset_stale_ticket_stage_blocked_last_result_if_scope_clean() {
  local last_result active_item active_ticket_id ticket_file git_root

  [ "$public_role" = "ticket" ] || return 0

  last_result="$(runner_state_field "$runner_id" "last_result" 2>/dev/null || true)"
  [ "$last_result" = "ticket_stage_blocked" ] || return 0

  active_item="$(runner_state_field "$runner_id" "active_item" 2>/dev/null || true)"
  active_ticket_id="$(runner_state_field "$runner_id" "active_ticket_id" 2>/dev/null || true)"
  ticket_file="$(runner_active_ticket_file_from_item "$active_item" 2>/dev/null || true)"
  if [ -z "$ticket_file" ] && [ -n "$active_ticket_id" ]; then
    ticket_file="$(runner_active_ticket_file_from_item "$active_ticket_id" 2>/dev/null || true)"
  fi
  [ -n "$ticket_file" ] && [ -f "$ticket_file" ] || return 0

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$project_root")"
  if runner_ticket_allowed_paths_dirty_excluding_self_refresh "$ticket_file" "$git_root"; then
    return 0
  fi

  runner_replace_state_field_preserving "$runner_id" "last_result" "" || return 0
  runner_append_log "$runner_id" "stale_last_result_reset" \
    "role=${public_role}" \
    "reason=ticket_stage_blocked_scope_clean" \
    "ticket=$(runner_board_relative_path "$ticket_file")"
}

runner_board_relative_path() {
  local path="$1"

  case "$path" in
    "${board_root}/"*)
      printf '%s' "${path#${board_root}/}"
      ;;
    *)
      printf '%s' "$path"
      ;;
  esac
}

planner_ticket_file_for_ticket_ref() {
  local ticket_ref="$1"
  local ticket_num="${ticket_ref#tickets_}"
  local candidate

  for candidate in \
    "${board_root}/tickets/inprogress/${ticket_ref}.md" \
    "${board_root}/tickets/ready-to-merge/${ticket_ref}.md" \
    "${board_root}/tickets/merge-blocked/${ticket_ref}.md" \
    "${board_root}/tickets/verifier/${ticket_ref}.md" \
    "${board_root}/tickets/todo/${ticket_ref}.md" \
    "${board_root}/tickets/reject/${ticket_ref}.md" \
    "${board_root}/tickets/reject/reject_${ticket_num}.md"; do
    [ -f "$candidate" ] && {
      printf '%s' "$candidate"
      return 0
    }
  done

  if [ -d "${board_root}/tickets/done" ]; then
    find "${board_root}/tickets/done" -type f -name "${ticket_ref}.md" -print -quit
  fi
}

planner_ticket_board_state() {
  local file="$1"

  case "$file" in
    "${board_root}/tickets/inprogress/"*|"${board_root}/tickets/ready-to-merge/"*|"${board_root}/tickets/merge-blocked/"*|"${board_root}/tickets/verifier/"*|"${board_root}/tickets/todo/"*)
      printf 'active'
      ;;
    "${board_root}/tickets/reject/"*)
      printf 'rejected'
      ;;
    "${board_root}/tickets/done/"*)
      printf 'done'
      ;;
    *)
      printf 'unknown'
      ;;
  esac
}

planner_resolved_ticket_worktree_signal() {
  local line worktree_path branch ticket_ref ticket_file board_state dirty_output
  local reason ticket_id title stage spec_ref

  git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      worktree\ *)
        worktree_path="${line#worktree }"
        branch=""
        ;;
      branch\ refs/heads/autoflow/tickets_[0-9][0-9][0-9]*)
        branch="${line#branch refs/heads/}"
        ticket_ref="${branch##*/}"
        ticket_file="$(planner_ticket_file_for_ticket_ref "$ticket_ref")"
        [ -n "$ticket_file" ] || continue
        board_state="$(planner_ticket_board_state "$ticket_file")"
        case "$board_state" in
          rejected|done)
            ;;
          *)
            continue
            ;;
        esac

        dirty_output=""
        if [ -d "$worktree_path" ]; then
          dirty_output="$(git -C "$worktree_path" status --porcelain 2>/dev/null || true)"
        fi
        if [ -n "$dirty_output" ]; then
          reason="resolved_ticket_worktree_dirty"
        else
          reason="resolved_ticket_worktree_leftover"
        fi

        if ticket_goal_common_call is_recovery_auto_enabled; then
          if [ -z "$dirty_output" ]; then
            ticket_goal_common_call backup_diff_and_discard_worktree "$ticket_file" "$worktree_path" "$reason"
            continue
          fi
          base_commit="$(planner_ticket_field "$ticket_file" "Worktree" "Base Commit")"
          if ticket_goal_common_call is_agent_only_worktree "$ticket_file" "$worktree_path" "$base_commit"; then
            ticket_goal_common_call backup_diff_and_discard_worktree "$ticket_file" "$worktree_path" "$reason"
            continue
          fi
        fi

        ticket_id="$(planner_ticket_field "$ticket_file" "Ticket" "ID")"
        [ -n "$ticket_id" ] || ticket_id="$ticket_ref"
        title="$(planner_ticket_field "$ticket_file" "Ticket" "Title")"
        stage="$(planner_ticket_field "$ticket_file" "Ticket" "Stage")"
        [ -n "$stage" ] || stage="$board_state"
        spec_ref="$(planner_ticket_field "$ticket_file" "Ticket" "PRD Key")"
        [ -n "$spec_ref" ] || spec_ref="$(planner_ticket_field "$ticket_file" "References" "PRD")"

        printf 'status=recovery\n'
        printf 'reason=%s\n' "$reason"
        printf 'ticket=%s\n' "$(runner_board_relative_path "$ticket_file")"
        printf 'ticket_id=%s\n' "$ticket_id"
        printf 'ticket_title=%s\n' "$title"
        printf 'ticket_stage=%s\n' "$stage"
        printf 'spec_ref=%s\n' "$spec_ref"
        printf 'recovery_status=needs_user\n'
        printf 'failure_class=leftover_worktree\n'
        printf 'worktree_path=%s\n' "$worktree_path"
        printf 'worktree_status=%s\n' "$([ -n "$dirty_output" ] && printf 'dirty' || printf 'clean')"
        printf 'board_state=%s\n' "$board_state"
        return 0
        ;;
      "")
        worktree_path=""
        branch=""
        ;;
    esac
  done < <(git -C "$project_root" worktree list --porcelain 2>/dev/null || true)

  return 1
}

planner_orchestration_signal() {
  local file recovery_status failure_class goal_status suppressed stage integration_status
  local worktree_path branch base_commit reason derived_recovery_status derived_failure_class
  local ticket_id title spec_ref

  [ "$public_role" = "planner" ] || return 1
  [ -f "${board_root}/scripts/common.sh" ] || return 1

  for file in \
    "${board_root}"/tickets/inprogress/tickets_*.md \
    "${board_root}"/tickets/merge-blocked/tickets_*.md \
    "${board_root}"/tickets/ready-to-merge/tickets_*.md \
    "${board_root}"/tickets/todo/tickets_*.md; do
    [ -f "$file" ] || continue

    recovery_status="$(planner_ticket_field "$file" "Recovery State" "Status")"
    failure_class="$(planner_ticket_field "$file" "Recovery State" "Failure Class")"
    goal_status="$(planner_ticket_field "$file" "Goal Runtime" "Status")"
    suppressed="$(planner_ticket_field "$file" "Goal Runtime" "Continuation Suppressed")"
    stage="$(planner_ticket_field "$file" "Ticket" "Stage")"
    integration_status="$(planner_ticket_field "$file" "Worktree" "Integration Status")"
    ticket_id="$(runner_ticket_id_from_active_item "$file")"
    title="$(planner_ticket_field "$file" "Ticket" "Title")"
    spec_ref="$(planner_ticket_field "$file" "Ticket" "PRD Key")"

    case "$recovery_status" in
      stalled|blocked|repairing|requeued|needs_user)
        reason="recovery_state_${recovery_status}"
        ;;
      *)
        reason=""
        ;;
    esac

    if [ -z "$reason" ]; then
      case "$goal_status" in
        blocked|stalled)
          reason="goal_runtime_${goal_status}"
          ;;
      esac
    fi

    if [ -z "$reason" ] && [ "$suppressed" = "true" ]; then
      reason="goal_runtime_no_progress"
    fi

    if [ -z "$reason" ]; then
      case "$stage" in
        blocked|merge_blocked|merge-blocked)
          reason="ticket_stage_${stage}"
          ;;
      esac
    fi

    if [ -z "$reason" ]; then
      case "$file" in
        "${board_root}"/tickets/todo/*)
          worktree_path="$(planner_ticket_field "$file" "Worktree" "Path")"
          branch="$(planner_ticket_field "$file" "Worktree" "Branch")"
          base_commit="$(planner_ticket_field "$file" "Worktree" "Base Commit")"
          case "$integration_status" in
            ""|pending|pending_claim)
              ;;
            *)
              reason="stale_todo_worktree_metadata"
              ;;
          esac
          if [ -z "$reason" ] && { [ -n "$worktree_path" ] || [ -n "$branch" ] || [ -n "$base_commit" ]; }; then
            reason="stale_todo_worktree_metadata"
          fi
          ;;
      esac
    fi

    [ -n "$reason" ] || continue
    derived_recovery_status="$recovery_status"
    derived_failure_class="$failure_class"
    case "$reason" in
      stale_todo_worktree_metadata)
        case "$derived_recovery_status" in ""|healthy) derived_recovery_status="blocked" ;; esac
        [ -n "$derived_failure_class" ] || derived_failure_class="stale_todo_worktree"
        ;;
      goal_runtime_no_progress)
        case "$derived_recovery_status" in ""|healthy) derived_recovery_status="stalled" ;; esac
        [ -n "$derived_failure_class" ] || derived_failure_class="adapter_no_progress"
        ;;
      goal_runtime_blocked|ticket_stage_blocked|ticket_stage_merge_blocked|ticket_stage_merge-blocked)
        case "$derived_recovery_status" in ""|healthy) derived_recovery_status="blocked" ;; esac
        ;;
      goal_runtime_stalled)
        case "$derived_recovery_status" in ""|healthy) derived_recovery_status="stalled" ;; esac
        ;;
    esac
    printf 'status=recovery\n'
    printf 'reason=%s\n' "$reason"
    printf 'ticket=%s\n' "$(runner_board_relative_path "$file")"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'ticket_title=%s\n' "$title"
    printf 'ticket_stage=%s\n' "$stage"
    printf 'spec_ref=%s\n' "$spec_ref"
    printf 'recovery_status=%s\n' "$derived_recovery_status"
    printf 'failure_class=%s\n' "$derived_failure_class"
    return 0
  done

  planner_resolved_ticket_worktree_signal && return 0

  return 1
}

runner_state_pid_for_start() {
  if [ "${mode:-}" = "loop" ]; then
    runner_state_value "pid"
    return 0
  fi

  printf '%s' "$$"
}

runner_state_pid_for_finish() {
  if [ "${mode:-}" = "loop" ]; then
    runner_state_value "pid"
  fi
}

runner_state_started_at() {
  local fallback="$1"
  local value=""

  if [ "${mode:-}" = "loop" ]; then
    value="$(runner_state_value "started_at")"
  fi

  printf '%s' "${value:-$fallback}"
}

wiki_inputs_hash_stream() {
  local rel_dir dir file rel checksum

  for rel_dir in tickets/done tickets/reject logs conversations wiki; do
    dir="${board_root}/${rel_dir}"
    [ -d "$dir" ] || continue
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      case "$(basename "$file")" in
        README.md)
          continue
          ;;
      esac
      rel="${file#"$board_root"/}"
      if command -v shasum >/dev/null 2>&1; then
        checksum="$(shasum -a 256 "$file" | awk '{ print $1 }')"
      elif command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$file" | awk '{ print $1 }')"
      else
        checksum="$(cksum "$file" | awk '{ print $1 ":" $2 }')"
      fi
      printf '%s  %s\n' "$checksum" "$rel"
    done < <(find "$dir" -type f \( -name '*.md' -o -name '*.log' -o -name '*.txt' -o -name '*.json' -o -name '*.jsonl' \) | LC_ALL=C sort)
  done
}

wiki_inputs_fingerprint() {
  if command -v shasum >/dev/null 2>&1; then
    wiki_inputs_hash_stream | shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    wiki_inputs_hash_stream | sha256sum | awk '{ print $1 }'
  else
    wiki_inputs_hash_stream | cksum | awk '{ print $1 ":" $2 }'
  fi
}

wiki_inputs_fingerprint_path() {
  runner_ensure_dirs
  printf '%s/%s.wiki-inputs.fingerprint' "$(runner_state_dir)" "$runner_id"
}

wiki_inputs_manifest_path() {
  runner_ensure_dirs
  printf '%s/%s.wiki-inputs.manifest' "$(runner_state_dir)" "$runner_id"
}

wiki_debounce_state_path() {
  runner_ensure_dirs
  printf '%s/%s.wiki-debounce.state' "$(runner_state_dir)" "$runner_id"
}

wiki_debounce_read_field() {
  local field="$1"
  local path
  path="$(wiki_debounce_state_path)"
  [ -f "$path" ] || { printf ''; return 0; }
  awk -F= -v k="$field" 'BEGIN{r=""} $1==k {sub(/^[^=]*=/,""); r=$0} END{print r}' "$path"
}

wiki_debounce_write_field() {
  local field="$1"
  local value="$2"
  local path tmp
  path="$(wiki_debounce_state_path)"
  tmp="$(mktemp)"
  if [ -f "$path" ]; then
    awk -F= -v k="$field" '$1!=k {print}' "$path" > "$tmp"
  fi
  printf '%s=%s\n' "$field" "$value" >> "$tmp"
  mv -f "$tmp" "$path"
}

wiki_debounce_clear_field() {
  local field="$1"
  local path tmp
  path="$(wiki_debounce_state_path)"
  [ -f "$path" ] || return 0
  tmp="$(mktemp)"
  awk -F= -v k="$field" '$1!=k {print}' "$path" > "$tmp"
  if [ -s "$tmp" ]; then
    mv -f "$tmp" "$path"
  else
    rm -f "$path" "$tmp"
  fi
}

wiki_compute_inputs_state() {
  if [ -n "${WIKI_CURRENT_MANIFEST_PATH:-}" ] && [ -f "$WIKI_CURRENT_MANIFEST_PATH" ] && [ -n "${WIKI_CURRENT_FINGERPRINT:-}" ]; then
    return 0
  fi
  WIKI_CURRENT_MANIFEST_PATH="$(mktemp "${TMPDIR:-/tmp}/autoflow-wiki-manifest.XXXXXX")"
  wiki_inputs_hash_stream | LC_ALL=C sort > "$WIKI_CURRENT_MANIFEST_PATH"
  if command -v shasum >/dev/null 2>&1; then
    WIKI_CURRENT_FINGERPRINT="$(shasum -a 256 "$WIKI_CURRENT_MANIFEST_PATH" | awk '{ print $1 }')"
  elif command -v sha256sum >/dev/null 2>&1; then
    WIKI_CURRENT_FINGERPRINT="$(sha256sum "$WIKI_CURRENT_MANIFEST_PATH" | awk '{ print $1 }')"
  else
    WIKI_CURRENT_FINGERPRINT="$(cksum "$WIKI_CURRENT_MANIFEST_PATH" | awk '{ print $1 ":" $2 }')"
  fi
}

idle_preflight_inputs_hash_stream() {
  local rel_dir dir file rel checksum

  case "$public_role" in
    planner)
      set -- tickets/inbox tickets/backlog tickets/reject tickets/todo tickets/inprogress tickets/done tickets/plan plan
      ;;
    ticket)
      set -- tickets/todo tickets/inprogress tickets/verifier
      ;;
    *)
      return 0
      ;;
  esac

  for rel_dir in "$@"; do
    dir="${board_root}/${rel_dir}"
    [ -d "$dir" ] || continue
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      case "$(basename "$file")" in
        README.md)
          continue
          ;;
      esac
      rel="${file#"$board_root"/}"
      if command -v shasum >/dev/null 2>&1; then
        checksum="$(shasum -a 256 "$file" | awk '{ print $1 }')"
      elif command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$file" | awk '{ print $1 }')"
      else
        checksum="$(cksum "$file" | awk '{ print $1 ":" $2 }')"
      fi
      printf '%s  %s\n' "$checksum" "$rel"
    done < <(find "$dir" -type f \( -name '*.md' -o -name '*.log' -o -name '*.txt' -o -name '*.json' -o -name '*.jsonl' \) | LC_ALL=C sort)
  done
}

idle_preflight_inputs_fingerprint() {
  if command -v shasum >/dev/null 2>&1; then
    idle_preflight_inputs_hash_stream | shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    idle_preflight_inputs_hash_stream | sha256sum | awk '{ print $1 }'
  else
    idle_preflight_inputs_hash_stream | cksum | awk '{ print $1 ":" $2 }'
  fi
}

idle_preflight_fingerprint_path() {
  runner_ensure_dirs
  printf '%s/%s.%s-idle-inputs.fingerprint' "$(runner_state_dir)" "$runner_id" "$public_role"
}

planner_recovery_fingerprint_path() {
  runner_ensure_dirs
  printf '%s/%s.planner-recovery-inputs.fingerprint' "$(runner_state_dir)" "$runner_id"
}

planner_recovery_inputs_hash_stream() {
  local preflight_status="$1"
  local preflight_reason="$2"
  local orchestration_output="$3"
  local ticket_rel ticket_file field

  printf 'preflight_status=%s\n' "$preflight_status"
  printf 'preflight_reason=%s\n' "$preflight_reason"
  printf 'orchestration_signal_begin\n'
  cat "$orchestration_output" 2>/dev/null || true
  printf 'orchestration_signal_end\n'

  ticket_rel="$(awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
  case "$ticket_rel" in
    "")
      return 0
      ;;
    "$board_root"/*)
      ticket_file="$ticket_rel"
      ticket_rel="${ticket_file#"$board_root"/}"
      ;;
    /*)
      ticket_file="$ticket_rel"
      ;;
    *)
      ticket_file="${board_root}/${ticket_rel}"
      ;;
  esac

  printf 'ticket=%s\n' "$ticket_rel"
  if [ ! -f "$ticket_file" ]; then
    printf 'ticket_missing=true\n'
    return 0
  fi

  for field in \
    "Ticket:Stage" \
    "Ticket:PRD Key" \
    "Ticket:Title" \
    "Worktree:Path" \
    "Worktree:Branch" \
    "Worktree:Base Commit" \
    "Worktree:Integration Status" \
    "Goal Runtime:Status" \
    "Goal Runtime:Continuation Suppressed" \
    "Goal Runtime:Last Event" \
    "Goal Runtime:Last Progress Fingerprint" \
    "Recovery State:Status" \
    "Recovery State:Detected By" \
    "Recovery State:Failure Class" \
    "Recovery State:Evidence" \
    "Recovery State:Planner Decision" \
    "Recovery State:Owner Resume Instruction"; do
    printf '%s=%s\n' "$field" "$(planner_ticket_field "$ticket_file" "${field%%:*}" "${field#*:}")"
  done
}

planner_recovery_inputs_fingerprint() {
  local preflight_status="$1"
  local preflight_reason="$2"
  local orchestration_output="$3"

  if command -v shasum >/dev/null 2>&1; then
    planner_recovery_inputs_hash_stream "$preflight_status" "$preflight_reason" "$orchestration_output" | shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    planner_recovery_inputs_hash_stream "$preflight_status" "$preflight_reason" "$orchestration_output" | sha256sum | awk '{ print $1 }'
  else
    planner_recovery_inputs_hash_stream "$preflight_status" "$preflight_reason" "$orchestration_output" | cksum | awk '{ print $1 ":" $2 }'
  fi
}

idle_preflight_skip_reason() {
  case "$public_role" in
    planner)
      printf 'planner_inputs_unchanged'
      ;;
    ticket)
      printf 'ticket_inputs_unchanged'
      ;;
  esac
}

maybe_skip_unchanged_planner_recovery_signal() {
  local orchestration_reason="$1"
  local preflight_status="$2"
  local preflight_reason="$3"
  local preflight_output="$4"
  local preflight_log_path="$5"
  local orchestration_output="$6"
  local fingerprint_path current_fingerprint previous_fingerprint timestamp

  [ "$public_role" = "planner" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "${AUTOFLOW_PLANNER_RECOVERY_IDLE_SKIP:-1}" != "0" ] || return 1

  fingerprint_path="$(planner_recovery_fingerprint_path)"
  current_fingerprint="$(planner_recovery_inputs_fingerprint "$preflight_status" "$preflight_reason" "$orchestration_output")"
  previous_fingerprint=""
  if [ -f "$fingerprint_path" ]; then
    previous_fingerprint="$(cat "$fingerprint_path" 2>/dev/null || true)"
  fi
  printf '%s\n' "$current_fingerprint" > "$fingerprint_path"

  [ -n "$previous_fingerprint" ] || return 1
  [ "$current_fingerprint" = "$previous_fingerprint" ] || return 1

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=${adapter_active_ticket_file}" \
    "active_ticket_id=${adapter_active_ticket_id}" \
    "active_ticket_title=${adapter_active_ticket_title}" \
    "active_stage=${adapter_active_stage}" \
    "active_spec_ref=${adapter_active_spec_ref}" \
    "active_recovery_reason=${adapter_active_recovery_reason}" \
    "active_recovery_status=${adapter_active_recovery_status}" \
    "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
    "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
    "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
    "active_recovery_board_state=${adapter_active_recovery_board_state}" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=planner_recovery_inputs_unchanged" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=planner_recovery_inputs_unchanged" \
    "recovery_reason=${orchestration_reason:-recovery}" \
    "active_item=${adapter_active_ticket_file}" \
    "active_ticket_id=${adapter_active_ticket_id}" \
    "fingerprint=${current_fingerprint}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=0\n'
  printf 'reason=planner_recovery_inputs_unchanged\n'
  printf 'runtime_reason=%s\n' "$preflight_reason"
  printf 'recovery_reason=%s\n' "${orchestration_reason:-recovery}"
  printf 'active_item=%s\n' "$adapter_active_ticket_file"
  printf 'active_ticket_id=%s\n' "$adapter_active_ticket_id"
  printf 'active_recovery_status=%s\n' "$adapter_active_recovery_status"
  printf 'active_recovery_failure_class=%s\n' "$adapter_active_recovery_failure_class"
  printf 'active_recovery_worktree_path=%s\n' "$adapter_active_recovery_worktree_path"
  printf 'active_recovery_worktree_status=%s\n' "$adapter_active_recovery_worktree_status"
  printf 'active_recovery_board_state=%s\n' "$adapter_active_recovery_board_state"
  printf 'recovery_inputs_fingerprint=%s\n' "$current_fingerprint"
  printf 'fingerprint_path=%s\n' "$fingerprint_path"
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  printf 'recovery_signal_begin\n'
  cat "$orchestration_output"
  printf 'recovery_signal_end\n'
  rm -f "$preflight_output" "$orchestration_output"
  exit 0
}

maybe_skip_planner_needs_user_decision_signal() {
  local orchestration_reason="$1"
  local preflight_status="$2"
  local preflight_reason="$3"
  local preflight_output="$4"
  local preflight_log_path="$5"
  local orchestration_output="$6"
  local timestamp

  [ "$public_role" = "planner" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "${AUTOFLOW_PLANNER_NEEDS_USER_IDLE_SKIP:-1}" != "0" ] || return 1
  [ "${adapter_active_recovery_status:-}" = "needs_user" ] || return 1
  [ "${adapter_active_recovery_failure_class:-}" = "needs_user_decision" ] || return 1

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=${adapter_active_ticket_file}" \
    "active_ticket_id=${adapter_active_ticket_id}" \
    "active_ticket_title=${adapter_active_ticket_title}" \
    "active_stage=${adapter_active_stage}" \
    "active_spec_ref=${adapter_active_spec_ref}" \
    "active_recovery_reason=${adapter_active_recovery_reason}" \
    "active_recovery_status=${adapter_active_recovery_status}" \
    "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
    "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
    "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
    "active_recovery_board_state=${adapter_active_recovery_board_state}" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=planner_needs_user_decision_waiting" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=planner_needs_user_decision_waiting" \
    "recovery_reason=${orchestration_reason:-recovery}" \
    "active_item=${adapter_active_ticket_file}" \
    "active_ticket_id=${adapter_active_ticket_id}" \
    "failure_class=${adapter_active_recovery_failure_class}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=0\n'
  printf 'reason=planner_needs_user_decision_waiting\n'
  printf 'runtime_reason=%s\n' "$preflight_reason"
  printf 'recovery_reason=%s\n' "${orchestration_reason:-recovery}"
  printf 'active_item=%s\n' "$adapter_active_ticket_file"
  printf 'active_ticket_id=%s\n' "$adapter_active_ticket_id"
  printf 'active_recovery_status=%s\n' "$adapter_active_recovery_status"
  printf 'active_recovery_failure_class=%s\n' "$adapter_active_recovery_failure_class"
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  printf 'recovery_signal_begin\n'
  cat "$orchestration_output"
  printf 'recovery_signal_end\n'
  rm -f "$preflight_output" "$orchestration_output"
  exit 0
}

maybe_skip_unchanged_idle_preflight() {
  local preflight_status="$1"
  local preflight_reason="$2"
  local preflight_output="$3"
  local preflight_log_path="$4"
  local fingerprint_path current_fingerprint previous_fingerprint skip_reason timestamp

  idle_preflight_fingerprint=""
  idle_preflight_fingerprint_path_value=""

  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  case "$public_role:$preflight_status:$preflight_reason" in
    planner:idle:no_actionable_plan_input|ticket:idle:no_actionable_ticket)
      ;;
    *)
      return 1
      ;;
  esac

  fingerprint_path="$(idle_preflight_fingerprint_path)"
  current_fingerprint="$(idle_preflight_inputs_fingerprint)"
  previous_fingerprint=""
  if [ -f "$fingerprint_path" ]; then
    previous_fingerprint="$(cat "$fingerprint_path" 2>/dev/null || true)"
  fi
  printf '%s\n' "$current_fingerprint" > "$fingerprint_path"

  idle_preflight_fingerprint="$current_fingerprint"
  idle_preflight_fingerprint_path_value="$fingerprint_path"

  [ -n "$previous_fingerprint" ] || return 1
  [ "$current_fingerprint" = "$previous_fingerprint" ] || return 1

  skip_reason="$(idle_preflight_skip_reason)"
  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=" \
    "active_ticket_id=" \
    "active_ticket_title=" \
    "active_stage=" \
    "active_spec_ref=" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=${skip_reason}" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=${skip_reason}" \
    "runtime_reason=${preflight_reason}" \
    "fingerprint=${current_fingerprint}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=0\n'
  printf 'reason=%s\n' "$skip_reason"
  printf 'runtime_reason=%s\n' "$preflight_reason"
  printf 'active_item=\n'
  printf 'idle_inputs_fingerprint=%s\n' "$current_fingerprint"
  printf 'fingerprint_path=%s\n' "$fingerprint_path"
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  rm -f "$preflight_output"
  exit 0
}

planner_differential_enabled() {
  [ "$public_role" = "planner" ] || return 1
  case "${AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED:-0}" in
    1|true|TRUE|on|ON|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

planner_differential_threshold_percent() {
  local value="${AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT:-30}"
  case "$value" in
    ''|*[!0-9]*)
      printf '30'
      ;;
    *)
      if [ "$value" -gt 100 ]; then
        printf '100'
      else
        printf '%s' "$value"
      fi
      ;;
  esac
}

planner_differential_state_path() {
  runner_ensure_dirs
  printf '%s/%s.differential.state' "$(runner_state_dir)" "$runner_id"
}

planner_differential_manifest_path() {
  runner_ensure_dirs
  printf '%s/%s.differential.manifest' "$(runner_state_dir)" "$runner_id"
}

planner_differential_summary_path() {
  runner_ensure_dirs
  printf '%s/%s.differential.summary.md' "$(runner_state_dir)" "$runner_id"
}

planner_differential_state_field() {
  local state_file="$1"
  local field="$2"

  [ -f "$state_file" ] || return 0
  sed -n "s/^${field}=//p" "$state_file" | tail -n 1
}

planner_differential_manifest_fingerprint() {
  local manifest_file="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$manifest_file" | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$manifest_file" | awk '{ print $1 }'
  else
    cksum "$manifest_file" | awk '{ print $1 ":" $2 }'
  fi
}

planner_differential_file_title() {
  local rel="$1"
  local file="${board_root}/${rel}"
  local title=""

  if [ ! -f "$file" ]; then
    printf '%s' "$(basename "$rel")"
    return 0
  fi

  title="$(awk '
    /^# / {
      sub(/^# /, "", $0)
      print
      exit
    }
    /^[[:space:]]*-[[:space:]]*Title:[[:space:]]*/ {
      sub(/^[[:space:]]*-[[:space:]]*Title:[[:space:]]*/, "", $0)
      print
      exit
    }
  ' "$file")"
  if [ -n "$title" ]; then
    printf '%s' "$title"
  else
    printf '%s' "$(basename "$rel")"
  fi
}

planner_differential_emit_file_body() {
  local rel="$1"
  local file="${board_root}/${rel}"
  local title

  title="$(planner_differential_file_title "$rel")"
  printf '### `%s`\n' "$rel"
  printf -- '- Title: %s\n' "$title"
  if [ -f "$file" ]; then
    printf '```text\n'
    cat "$file"
    printf '\n```\n'
  else
    printf -- '- Status: removed\n'
  fi
}

planner_differential_emit_catalog() {
  local list_file="$1"
  local rel title

  if [ ! -f "$list_file" ] || [ ! -s "$list_file" ]; then
    printf -- '- (none)\n'
    return 0
  fi

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    title="$(planner_differential_file_title "$rel")"
    printf -- '- `%s` — %s\n' "$rel" "$title"
  done < "$list_file"
}

planner_differential_emit_file_bodies_from_list() {
  local list_file="$1"
  local rel

  if [ ! -f "$list_file" ] || [ ! -s "$list_file" ]; then
    printf -- '- (none)\n'
    return 0
  fi

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    planner_differential_emit_file_body "$rel"
  done < "$list_file"
}

planner_differential_prepare_context() {
  local current_manifest previous_manifest state_file manifest_file summary_file
  local previous_force_full total_count

  planner_diff_context_enabled="false"
  planner_diff_mode=""
  planner_diff_reason=""
  planner_diff_summary_line=""
  planner_diff_previous_summary=""
  planner_diff_current_manifest_path=""
  planner_diff_current_fingerprint=""
  planner_diff_previous_fingerprint=""
  planner_diff_state_path_value=""
  planner_diff_manifest_path_value=""
  planner_diff_summary_path_value=""
  planner_diff_changed_count="0"
  planner_diff_added_count="0"
  planner_diff_modified_count="0"
  planner_diff_removed_count="0"
  planner_diff_unchanged_count="0"
  planner_diff_current_count="0"
  planner_diff_previous_count="0"
  planner_diff_threshold_percent="$(planner_differential_threshold_percent)"
  planner_diff_changed_ratio_percent="0"
  planner_diff_force_full_next="false"
  planner_diff_added_list=""
  planner_diff_modified_list=""
  planner_diff_removed_list=""
  planner_diff_unchanged_list=""

  planner_differential_enabled || return 1

  planner_diff_context_enabled="true"
  current_manifest="$(autoflow_mktemp)"
  idle_preflight_inputs_hash_stream | LC_ALL=C sort > "$current_manifest"
  planner_diff_current_manifest_path="$current_manifest"
  planner_diff_current_fingerprint="$(planner_differential_manifest_fingerprint "$current_manifest")"
  planner_diff_current_count="$(wc -l < "$current_manifest" | tr -d '[:space:]')"

  state_file="$(planner_differential_state_path)"
  manifest_file="$(planner_differential_manifest_path)"
  summary_file="$(planner_differential_summary_path)"
  planner_diff_state_path_value="$state_file"
  planner_diff_manifest_path_value="$manifest_file"
  planner_diff_summary_path_value="$summary_file"
  planner_diff_previous_summary="$(planner_differential_state_field "$state_file" "summary")"
  planner_diff_previous_fingerprint="$(planner_differential_state_field "$state_file" "fingerprint")"
  previous_force_full="$(planner_differential_state_field "$state_file" "force_full_next")"
  case "$previous_force_full" in
    true|1|yes|on)
      planner_diff_force_full_next="true"
      ;;
    *)
      planner_diff_force_full_next="false"
      ;;
  esac

  if [ -f "$manifest_file" ]; then
    previous_manifest="$manifest_file"
    planner_diff_previous_count="$(wc -l < "$previous_manifest" | tr -d '[:space:]')"
  else
    previous_manifest=""
  fi

  planner_diff_added_list="$(autoflow_mktemp)"
  planner_diff_modified_list="$(autoflow_mktemp)"
  planner_diff_removed_list="$(autoflow_mktemp)"
  planner_diff_unchanged_list="$(autoflow_mktemp)"

  if [ -n "$previous_manifest" ]; then
    awk -v added="$planner_diff_added_list" \
      -v modified="$planner_diff_modified_list" \
      -v removed="$planner_diff_removed_list" \
      -v unchanged="$planner_diff_unchanged_list" '
      NR==FNR {
        prev_rel=$2
        prev_sum[prev_rel]=$1
        next
      }
      {
        curr_rel=$2
        curr_sum[curr_rel]=$1
      }
      END {
        for (rel in curr_sum) {
          if (!(rel in prev_sum)) {
            print rel >> added
          } else if (curr_sum[rel] != prev_sum[rel]) {
            print rel >> modified
          } else {
            print rel >> unchanged
          }
        }
        for (rel in prev_sum) {
          if (!(rel in curr_sum)) {
            print rel >> removed
          }
        }
      }
    ' "$previous_manifest" "$current_manifest"
    LC_ALL=C sort -o "$planner_diff_added_list" "$planner_diff_added_list"
    LC_ALL=C sort -o "$planner_diff_modified_list" "$planner_diff_modified_list"
    LC_ALL=C sort -o "$planner_diff_removed_list" "$planner_diff_removed_list"
    LC_ALL=C sort -o "$planner_diff_unchanged_list" "$planner_diff_unchanged_list"
  fi

  planner_diff_added_count="$(wc -l < "$planner_diff_added_list" | tr -d '[:space:]')"
  planner_diff_modified_count="$(wc -l < "$planner_diff_modified_list" | tr -d '[:space:]')"
  planner_diff_removed_count="$(wc -l < "$planner_diff_removed_list" | tr -d '[:space:]')"
  planner_diff_unchanged_count="$(wc -l < "$planner_diff_unchanged_list" | tr -d '[:space:]')"
  planner_diff_changed_count="$((planner_diff_added_count + planner_diff_modified_count + planner_diff_removed_count))"
  total_count="$planner_diff_current_count"
  if [ "$planner_diff_previous_count" -gt "$total_count" ]; then
    total_count="$planner_diff_previous_count"
  fi
  if [ "$total_count" -le 0 ]; then
    total_count=1
  fi
  planner_diff_changed_ratio_percent="$((planner_diff_changed_count * 100 / total_count))"

  if [ -z "$previous_manifest" ] || [ -z "$planner_diff_previous_fingerprint" ]; then
    planner_diff_mode="full"
    planner_diff_reason="first_tick"
  elif [ "$planner_diff_force_full_next" = "true" ]; then
    planner_diff_mode="full"
    planner_diff_reason="adapter_requested_full_context"
  elif [ "$planner_diff_changed_ratio_percent" -ge "$planner_diff_threshold_percent" ]; then
    planner_diff_mode="full"
    planner_diff_reason="change_ratio_exceeded"
  else
    planner_diff_mode="diff"
    planner_diff_reason="differential"
  fi

  case "$planner_diff_mode:$planner_diff_reason" in
    full:first_tick)
      planner_diff_summary_line="full:first_tick files=${planner_diff_current_count} fingerprint=${planner_diff_current_fingerprint}"
      ;;
    full:adapter_requested_full_context)
      planner_diff_summary_line="full:adapter_requested_full_context files=${planner_diff_current_count} changed=${planner_diff_changed_count} previous=${planner_diff_previous_fingerprint}"
      ;;
    full:change_ratio_exceeded)
      planner_diff_summary_line="full:change_ratio_exceeded changed=${planner_diff_changed_count}/${total_count} ratio=${planner_diff_changed_ratio_percent}% threshold=${planner_diff_threshold_percent}%"
      ;;
    *)
      planner_diff_summary_line="diff changed=${planner_diff_changed_count} added=${planner_diff_added_count} modified=${planner_diff_modified_count} removed=${planner_diff_removed_count} unchanged=${planner_diff_unchanged_count}"
      ;;
  esac

  return 0
}

planner_differential_prompt_block() {
  local rel
  [ "$planner_diff_context_enabled" = "true" ] || return 0

  cat <<EOF
- Differential Enabled: true
- Runner: ${runner_id}
- Mode: ${planner_diff_mode}
- Reason: ${planner_diff_reason}
- Current Manifest Fingerprint: ${planner_diff_current_fingerprint}
- Previous Manifest Fingerprint: ${planner_diff_previous_fingerprint:-none}
- Current File Count: ${planner_diff_current_count}
- Previous File Count: ${planner_diff_previous_count}
- Changed File Count: ${planner_diff_changed_count}
- Changed Ratio Percent: ${planner_diff_changed_ratio_percent}
- Full Threshold Percent: ${planner_diff_threshold_percent}
- Summary State Path: ${planner_diff_state_path_value}
- Summary File Path: ${planner_diff_summary_path_value}
EOF

  if [ "$planner_diff_mode" = "full" ]; then
    printf '\nCurrent board context (full snapshot):\n'
    if [ ! -s "$planner_diff_current_manifest_path" ]; then
      printf -- '- (no board files)\n'
      return 0
    fi
    while read -r _ rel; do
      [ -n "${rel:-}" ] || continue
      planner_differential_emit_file_body "$rel"
    done < "$planner_diff_current_manifest_path"
    return 0
  fi

  printf '\nPrevious tick summary:\n'
  printf -- '- %s\n' "${planner_diff_previous_summary:-none}"
  printf '\nChanged files:\n'
  printf 'Added:\n'
  planner_differential_emit_catalog "$planner_diff_added_list"
  printf 'Modified:\n'
  planner_differential_emit_catalog "$planner_diff_modified_list"
  printf 'Removed:\n'
  planner_differential_emit_catalog "$planner_diff_removed_list"
  printf '\nChanged file bodies:\n'
  planner_differential_emit_file_bodies_from_list "$planner_diff_added_list"
  planner_differential_emit_file_bodies_from_list "$planner_diff_modified_list"
  printf '\nUnchanged files (path/title only):\n'
  planner_differential_emit_catalog "$planner_diff_unchanged_list"
}

planner_differential_write_state() {
  local force_full_next="$1"
  local tmp_file

  [ "$planner_diff_context_enabled" = "true" ] || return 0
  tmp_file="$(autoflow_mktemp)"
  cat > "$tmp_file" <<EOF
enabled=true
runner_id=${runner_id}
mode=${planner_diff_mode}
reason=${planner_diff_reason}
fingerprint=${planner_diff_current_fingerprint}
previous_fingerprint=${planner_diff_previous_fingerprint}
summary=${planner_diff_summary_line}
summary_path=${planner_diff_summary_path_value}
manifest_path=${planner_diff_manifest_path_value}
current_file_count=${planner_diff_current_count}
previous_file_count=${planner_diff_previous_count}
changed_file_count=${planner_diff_changed_count}
added_file_count=${planner_diff_added_count}
modified_file_count=${planner_diff_modified_count}
removed_file_count=${planner_diff_removed_count}
unchanged_file_count=${planner_diff_unchanged_count}
changed_ratio_percent=${planner_diff_changed_ratio_percent}
full_threshold_percent=${planner_diff_threshold_percent}
force_full_next=${force_full_next}
updated_at=$(runner_now_iso)
EOF
  mv "$tmp_file" "$planner_diff_state_path_value"
}

planner_differential_persist_after_prompt() {
  [ "$planner_diff_context_enabled" = "true" ] || return 0
  [ "$dry_run" = "false" ] || return 0

  cp "$planner_diff_current_manifest_path" "$planner_diff_manifest_path_value"
  printf '%s\n' "$planner_diff_summary_line" > "$planner_diff_summary_path_value"
  planner_differential_write_state "false"
  runner_append_log "$runner_id" "planner_prompt_context" \
    "mode=${planner_diff_mode}" \
    "reason=${planner_diff_reason}" \
    "fingerprint=${planner_diff_current_fingerprint}" \
    "previous_fingerprint=${planner_diff_previous_fingerprint}" \
    "changed_file_count=${planner_diff_changed_count}" \
    "changed_ratio_percent=${planner_diff_changed_ratio_percent}" \
    "full_threshold_percent=${planner_diff_threshold_percent}"
}

planner_differential_output_requests_full_context() {
  local file

  for file in "$@"; do
    [ -n "${file:-}" ] || continue
    [ -f "$file" ] || continue
    if grep -Fq "전체 컨텍스트 필요" "$file"; then
      return 0
    fi
  done
  return 1
}

planner_differential_finalize_after_run() {
  local force_full_next="false"

  [ "$planner_diff_context_enabled" = "true" ] || return 0
  [ "$dry_run" = "false" ] || return 0

  if planner_differential_output_requests_full_context "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}"; then
    force_full_next="true"
    runner_append_log "$runner_id" "planner_prompt_context" \
      "mode=${planner_diff_mode}" \
      "reason=adapter_requested_full_context_marker_detected" \
      "next_mode=full" \
      "fingerprint=${planner_diff_current_fingerprint}"
  fi

  planner_differential_write_state "$force_full_next"
}

wiki_record_inputs_fingerprint() {
  local fingerprint_path manifest_path now_epoch

  [ "$public_role" = "wiki" ] || return 0
  [ "${mode:-}" = "loop" ] || return 0

  wiki_compute_inputs_state
  fingerprint_path="$(wiki_inputs_fingerprint_path)"
  manifest_path="$(wiki_inputs_manifest_path)"
  printf '%s\n' "$WIKI_CURRENT_FINGERPRINT" > "$fingerprint_path"
  cp -f "$WIKI_CURRENT_MANIFEST_PATH" "$manifest_path"

  now_epoch="$(date +%s)"
  wiki_debounce_write_field "last_synth_at_epoch" "$now_epoch"
  wiki_debounce_clear_field "pending_since_epoch"
}

maybe_skip_unchanged_wiki_turn() {
  local fingerprint_path previous_fingerprint timestamp

  [ "$public_role" = "wiki" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "${AUTOFLOW_WIKI_IDLE_SKIP:-1}" != "0" ] || return 1

  wiki_compute_inputs_state
  fingerprint_path="$(wiki_inputs_fingerprint_path)"
  previous_fingerprint=""
  if [ -f "$fingerprint_path" ]; then
    previous_fingerprint="$(cat "$fingerprint_path" 2>/dev/null || true)"
  fi

  [ -n "$previous_fingerprint" ] || return 1
  [ "$WIKI_CURRENT_FINGERPRINT" = "$previous_fingerprint" ] || return 1

  wiki_debounce_clear_field "pending_since_epoch"
  rm -f "$WIKI_CURRENT_MANIFEST_PATH"

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "active_item")" \
    "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=wiki_inputs_unchanged"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=wiki_inputs_unchanged" \
    "fingerprint=${WIKI_CURRENT_FINGERPRINT}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'adapter=%s\n' "$agent"
  printf 'reason=wiki_inputs_unchanged\n'
  run_wiki_curator_idle_best_effort
  printf 'wiki_inputs_fingerprint=%s\n' "$WIKI_CURRENT_FINGERPRINT"
  printf 'fingerprint_path=%s\n' "$fingerprint_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  exit 0
}

maybe_skip_debounced_wiki_turn() {
  local manifest_path changed_count now_epoch
  local pending_since_epoch pending_age min_changes max_age_seconds
  local last_synth_at_epoch synth_age timestamp fingerprint_path

  [ "$public_role" = "wiki" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "${AUTOFLOW_WIKI_IDLE_SKIP:-1}" != "0" ] || return 1
  [ "${AUTOFLOW_WIKI_DEBOUNCE:-1}" != "0" ] || return 1

  wiki_compute_inputs_state

  min_changes="${AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES:-3}"
  max_age_seconds="${AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS:-1800}"

  manifest_path="$(wiki_inputs_manifest_path)"
  if [ -f "$manifest_path" ]; then
    changed_count="$(LC_ALL=C comm -3 "$WIKI_CURRENT_MANIFEST_PATH" <(LC_ALL=C sort "$manifest_path") 2>/dev/null | awk 'NF{c++} END{print c+0}')"
  else
    changed_count="$(awk 'END{print NR+0}' "$WIKI_CURRENT_MANIFEST_PATH")"
  fi

  now_epoch="$(date +%s)"
  pending_since_epoch="$(wiki_debounce_read_field "pending_since_epoch")"
  case "$pending_since_epoch" in
    ''|*[!0-9]*)
      pending_since_epoch="$now_epoch"
      wiki_debounce_write_field "pending_since_epoch" "$pending_since_epoch"
      ;;
  esac
  pending_age=$((now_epoch - pending_since_epoch))

  last_synth_at_epoch="$(wiki_debounce_read_field "last_synth_at_epoch")"
  case "$last_synth_at_epoch" in
    ''|*[!0-9]*) synth_age="" ;;
    *) synth_age=$((now_epoch - last_synth_at_epoch)) ;;
  esac

  if [ "$changed_count" -ge "$min_changes" ] || [ "$pending_age" -ge "$max_age_seconds" ]; then
    return 1
  fi

  rm -f "$WIKI_CURRENT_MANIFEST_PATH"
  fingerprint_path="$(wiki_inputs_fingerprint_path)"
  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "active_item")" \
    "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=wiki_debounced"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=wiki_debounced" \
    "changed_count=${changed_count}" \
    "pending_since_epoch=${pending_since_epoch}" \
    "pending_age_seconds=${pending_age}" \
    "min_changes=${min_changes}" \
    "max_age_seconds=${max_age_seconds}" \
    "last_synth_age_seconds=${synth_age}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'adapter=%s\n' "$agent"
  printf 'reason=wiki_debounced\n'
  run_wiki_curator_idle_best_effort
  printf 'wiki_inputs_fingerprint=%s\n' "$WIKI_CURRENT_FINGERPRINT"
  printf 'fingerprint_path=%s\n' "$fingerprint_path"
  printf 'changed_count=%s\n' "$changed_count"
  printf 'pending_since_epoch=%s\n' "$pending_since_epoch"
  printf 'pending_age_seconds=%s\n' "$pending_age"
  printf 'min_changes=%s\n' "$min_changes"
  printf 'max_age_seconds=%s\n' "$max_age_seconds"
  printf 'last_synth_age_seconds=%s\n' "$synth_age"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  exit 0
}

write_blocked_state() {
  local reason="$1"
  local timestamp

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=blocked" \
    "role=${public_role}" \
    "agent=${agent:-}" \
    "mode=${mode:-}" \
    "model=${model:-}" \
    "reasoning=${reasoning:-}" \
    "active_item=" \
    "pid=" \
    "started_at=" \
    "last_event_at=${timestamp}" \
    "last_result=${reason}"
  runner_append_log "$runner_id" "run_blocked" \
    "role=${public_role}" \
    "reason=${reason}"
}

agent_instruction_path() {
  case "$public_role" in
    planner)
      printf '%s/agents/plan-to-ticket-agent.md' "$board_root"
      ;;
    ticket)
      printf '%s/agents/ticket-owner-agent.md' "$board_root"
      ;;
    todo)
      printf '%s/agents/todo-queue-agent.md' "$board_root"
      ;;
    verifier)
      printf '%s/agents/verifier-agent.md' "$board_root"
      ;;
    merge)
      printf '%s/agents/merge-bot-agent.md' "$board_root"
      ;;
    wiki)
      printf '%s/agents/wiki-maintainer-agent.md' "$board_root"
      ;;
  esac
}

role_boundary_for_current_role() {
  # Emit only the boundary line for the current public_role. Other roles'
  # boundaries are not relevant to this adapter call and shipping all of
  # them inflates per-call token usage; agents loading their own role
  # instruction file already see the full contract there.
  case "$public_role" in
    ticket)
      printf '%s\n' "- ticket: own one ticket from local planning through implementation, verification, evidence logging, AI-led merge into PROJECT_ROOT, and done/reject movement. Do not split the work across planner/todo/verifier runners. Never push."
      ;;
    planner)
      printf '%s\n' "- planner: act as Orchestrator AI. Promote quick orders into generated PRDs, create/update plans and todo tickets, and repair board markdown when owner work stalls or breaks. Query the wiki before order promotion, drafting, ticket generation, or recovery decisions. Do not implement product code, manage worktrees directly, manage runner or OS processes, verify, manually git commit, or push. The runner harness creates a scoped local commit for planner-owned board changes after a successful turn."
      ;;
    todo)
      printf '%s\n' "- todo (legacy): claim/resume one todo ticket, query the wiki before implementation, implement within Allowed Paths, then hand off to verifier when done. Do not verify, commit, or push. Not part of the default 3-runner topology — Impl AI claims todo directly."
      ;;
    verifier)
      printf '%s\n' "- verifier (legacy): verify one verifier ticket, record pass/fail evidence, move it to done or reject, and local commit only on pass. Never push. Not part of the default 3-runner topology — Impl AI runs AI-led verification inline."
      ;;
    wiki)
      printf '%s\n' "- wiki: inspect done tickets, reject records, logs, and existing managed sections, then update derived wiki pages only when content actually changes. In the 3-runner topology this is \`wiki\`'s exclusive responsibility: Impl AI finalizers do not call \`update-wiki.sh\` or stage \`.autoflow/wiki/\`. Check-only state belongs in \`runners/state/wiki-baseline.history\`. Do not manually git commit; the runner harness creates a scoped local commit for wiki-owned content after a successful turn. Never treat the wiki as proof of completion."
      ;;
    coordinator)
      printf '%s\n' "- coordinator (legacy): diagnose board/runtime health, blocked ticket chains, worktree state, runner readiness, and wiki maintenance status. Not part of the default 3-runner topology; kept as a backwards-compat role identifier. Do not implement, verify, rebase, cherry-pick, resolve merge conflicts, or push."
      ;;
    self-improve)
      printf '%s\n' "- self-improve (trial): scan recent runner logs for repeated operational issues and emit low-risk improvement candidates as PRD drafts. Disabled by default; deterministic log scanner only — does not call AI tools."
      ;;
  esac
}

emit_required_flow() {
  # Emit the full Required-flow numbered list in order. Items 1, 2, 4, 5, 6,
  # 9, 10, 11 are always emitted. Items 3 and 7 are role-gated so they only
  # ship for the roles that actually need them.
  printf '%s\n' "1. Read the role instruction file, any protocol files it references, and the current board state."
  printf '%s\n' "2. Execute exactly one safe ${public_role} turn. Autoflow is AI-led: shell scripts are deterministic tools for claim/state/finalization, not replacement workers or hidden decision makers."
  case "$public_role" in
    planner|ticket|todo)
      printf '%s\n' "3. Run a wiki context pass before planning or implementation: use 'autoflow wiki query --rag' with distinctive terms from the memo/PRD/ticket title, request, goal, allowed paths, modules, and reject reason if present. Skip only when both the wiki and 'tickets/done/' are empty."
      ;;
  esac
  printf '%s\n' "4. Treat wiki results as memory and planning constraints: prior decisions, repeated failures, related completed tickets, architecture notes, and known patterns. Do not treat wiki content as proof of completion or as authority over ticket stage."
  printf '%s\n' "5. Cite relevant wiki/ticket findings in the plan, ticket Notes, or Resume Context when they shape the work."
  printf '%s\n' "6. Use runtime scripts as tools when claiming or preparing board state if a runtime script is defined; inspect their key=value output before choosing the next action."
  case "$public_role" in
    ticket)
      printf '%s\n' "7. The AI owns implementation, verification judgment, and merge judgment end to end. Scripts are tools for claim/state/finalization only: do not let a script be the actor that verifies, rebases, cherry-picks, resolves conflicts, or decides pass. The AI must run and inspect verification commands, manually integrate verified changes into PROJECT_ROOT, resolve conflicts when needed, and only then use finish-ticket-owner as the final bookkeeping/log/wiki/local-commit tool."
      ;;
    planner)
      printf '%s\n' "7. After AI-authored recovery edits, run 'autoflow guard' or 'scripts/board-guard.sh' and repair any guard errors before creating more work. Treat guard warnings as orchestration evidence: record leftover/dirty worktree cleanup candidates in Recovery State, Next Action, or Resume Context, but do not delete or reset worktrees yourself. Do not manage runner or OS processes: no kill/pkill, no runner start/stop/restart, no background process cleanup. If recovery evidence and decision are unchanged, do not append duplicate Notes or rewrite Last Recovery At; leave the ticket idempotently blocked and report the unchanged blocker."
      ;;
    coordinator)
      printf '%s\n' "7. Do not invoke autoflow runners start/restart or autoflow run coordinator from inside this adapter turn. Execute the Runtime script directly once, inspect its output, report the next safe action, and summarize any wiki maintenance result surfaced by the finalizer runtime."
      ;;
  esac
  printf '%s\n' "9. Keep durable progress in board files, runner logs, ticket Notes, Result, and Resume Context."
  printf '%s\n' "10. Do not rely on this prompt as future memory."
  printf '%s\n' "11. Never git push."
}

emit_planner_recovery_action_contract() {
  if [ "$public_role" != "planner" ] || [ -z "${adapter_active_recovery_reason:-}" ]; then
    return 0
  fi

  cat <<'EOF'
Planner recovery action contract:
- This wake-up is for board-state repair and orchestration, not product-code implementation.
- Read protocols/board-orchestration.md and protocols/recovery.md before editing ticket markdown.
- Update the ticket markdown first: Recovery State, Next Action, Resume Context, and Notes must describe the chosen recovery decision.
- If no safe board-only repair exists, set Recovery State Status to needs_user with an explicit Failure Class and Owner Resume Instruction.
- After markdown repair, run autoflow guard or scripts/board-guard.sh and fix guard errors before creating new work.
- Do not call start-ticket-owner, verify-ticket-owner, finish-ticket-owner, merge-ready-ticket, runner start/stop/restart, kill/pkill, or git worktree cleanup.
EOF
}

write_agent_prompt() {
  local instruction_file="$1"
  local required_flow_block role_boundary_line goal_prompt_block planner_recovery_contract_block active_item_display planner_context_block
  required_flow_block="$(emit_required_flow)"
  role_boundary_line="$(role_boundary_for_current_role)"
  goal_prompt_block="$(ticket_goal_prompt_block_for_current_ticket || true)"
  planner_recovery_contract_block="$(emit_planner_recovery_action_contract || true)"
  planner_differential_prepare_context || true
  planner_context_block="$(planner_differential_prompt_block || true)"
  active_item_display="${adapter_active_ticket_file:-${adapter_active_ticket_id:-}}"
  if [ -n "$active_item_display" ]; then
    active_item_display="$(runner_board_relative_path "$active_item_display")"
  fi

  cat <<EOF
Autoflow Local Runner Mode

You are running as a local Autoflow agent adapter. The file board is the source
of truth; chat history is not.

Context:
- Project root: ${project_root}
- Implementation root: ${adapter_working_root}
- Board root: ${board_root}
- Board dir name: ${board_dir_name}
- Runner id: ${runner_id}
- Public role: ${public_role}
- Runtime role: ${runtime_role}
- Runtime script: ${runtime_path}
- Active item: ${active_item_display}
EOF

  if [ -n "${adapter_active_recovery_reason:-}" ]; then
    printf '%s\n' "- Active recovery reason: ${adapter_active_recovery_reason}"
    printf '%s\n' "- Active recovery status: ${adapter_active_recovery_status:-}"
    printf '%s\n' "- Active recovery failure class: ${adapter_active_recovery_failure_class:-}"
    if [ -n "${adapter_active_recovery_worktree_path:-}" ]; then
      printf '%s\n' "- Active recovery worktree path: ${adapter_active_recovery_worktree_path}"
      printf '%s\n' "- Active recovery worktree status: ${adapter_active_recovery_worktree_status:-}"
    fi
    if [ -n "${adapter_active_recovery_board_state:-}" ]; then
      printf '%s\n' "- Active recovery board state: ${adapter_active_recovery_board_state}"
    fi
  fi

  cat <<EOF
- Role instruction file: ${instruction_file}
- Agent adapter: ${agent}
- Model: ${model:-}
- Reasoning: ${reasoning:-}
- Repo-local CLI: $(autoflow_cli_path)

Language policy:
- Write all user-visible terminal/chat prose, progress summaries, explanations,
  and natural-language adapter output in Korean by default.
- Keep machine-readable keys, required output formats, paths, commands, code,
  quoted source text, ticket fields, and board/runtime contracts exactly as
  their template or parser requires.

Required flow:
${required_flow_block}
EOF

  if [ -n "$planner_context_block" ]; then
    printf '\nPlanner board context:\n%s\n' "$planner_context_block"
  fi

  if [ -n "$goal_prompt_block" ]; then
    printf '\nGoal guardrail:\n%s\n' "$goal_prompt_block"
  fi

  if [ -n "$planner_recovery_contract_block" ]; then
    printf '\n%s\n' "$planner_recovery_contract_block"
  fi

  cat <<EOF
Role boundary:
${role_boundary_line}
When there is no actionable work, leave the runner and board in an idle state
with a concise explanation.
EOF
}

run_custom_adapter_command() {
  local prompt_file="$1"

  prepare_adapter_cli_env
  command_summary="$command_value"
  (
    cd "$adapter_working_root"
    AUTOFLOW_ROLE="$runtime_role" \
      AUTOFLOW_WORKER_ID="$runner_id" \
      AUTOFLOW_BACKGROUND=1 \
      AUTOFLOW_BOARD_ROOT="$board_root" \
      AUTOFLOW_PROJECT_ROOT="$project_root" \
      AUTOFLOW_IMPLEMENTATION_ROOT="$adapter_working_root" \
    AUTOFLOW_PROMPT_FILE="$prompt_file" \
      bash -lc "$command_value" < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
  )
}

run_adapter_with_identity() {
  prepare_adapter_cli_env
  AUTOFLOW_ROLE="$runtime_role" \
    AUTOFLOW_WORKER_ID="$runner_id" \
    AUTOFLOW_BACKGROUND=1 \
    AUTOFLOW_CLI="${AUTOFLOW_CLI:-$(autoflow_cli_path)}" \
    AUTOFLOW_BOARD_ROOT="$board_root" \
    AUTOFLOW_PROJECT_ROOT="$project_root" \
    AUTOFLOW_IMPLEMENTATION_ROOT="$adapter_working_root" \
    "$@"
}

normalize_claude_model_alias() {
  local raw="$1"
  case "$raw" in
    opus-1m)
      printf 'claude-opus-4-7[1m]'
      ;;
    sonnet-1m)
      printf 'claude-sonnet-4-6[1m]'
      ;;
    haiku-1m)
      printf 'claude-haiku-4-5-20251001[1m]'
      ;;
    *)
      printf '%s' "$raw"
      ;;
  esac
}

ensure_agent_on_path() {
  local agent="$1"
  command -v "$agent" >/dev/null 2>&1 && return 0

  local login_path
  login_path="$(bash -lc 'printf %s "$PATH"' 2>/dev/null || true)"
  if [ -n "$login_path" ]; then
    PATH="${PATH}:${login_path}"
    export PATH
    command -v "$agent" >/dev/null 2>&1 && return 0
  fi

  local roots=()
  [ -n "${HOME:-}" ] && roots+=("$HOME")
  if [ -n "${USERPROFILE:-}" ] && [ "${USERPROFILE}" != "${HOME:-}" ]; then
    roots+=("$USERPROFILE")
  fi
  if [ -d "/mnt/c/Users" ]; then
    local wsl_user_dir
    for wsl_user_dir in /mnt/c/Users/*/; do
      [ -d "${wsl_user_dir}AppData/Roaming/nvm" ] || [ -d "${wsl_user_dir}AppData/Roaming/npm" ] || continue
      roots+=("${wsl_user_dir%/}")
    done
  fi
  [ ${#roots[@]} -gt 0 ] || return 1

  local root candidate ver_dir
  for root in "${roots[@]}"; do
    for candidate in \
      "$root/AppData/Roaming/npm" \
      "$root/AppData/Roaming/nvm/current" \
      "$root/.local/bin" \
      "$root/.npm-global/bin" \
      "$root/bin"; do
      [ -d "$candidate" ] || continue
      if [ -e "$candidate/$agent" ] || [ -e "$candidate/$agent.cmd" ] || [ -e "$candidate/$agent.exe" ]; then
        PATH="${PATH}:${candidate}"
        export PATH
        command -v "$agent" >/dev/null 2>&1 && return 0
      fi
    done

    if [ -d "$root/AppData/Roaming/nvm" ]; then
      while IFS= read -r ver_dir; do
        [ -d "$ver_dir" ] || continue
        if [ -e "$ver_dir/$agent" ] || [ -e "$ver_dir/$agent.cmd" ] || [ -e "$ver_dir/$agent.exe" ]; then
          PATH="${PATH}:${ver_dir}"
          export PATH
          command -v "$agent" >/dev/null 2>&1 && return 0
        fi
      done < <(find "$root/AppData/Roaming/nvm" -maxdepth 1 -type d -name 'v*' 2>/dev/null | sort -r)
    fi
  done

  return 1
}

autoflow_cli_path() {
  local candidate="${project_root}/bin/autoflow"
  if [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  candidate="$(cd "${SCRIPT_DIR}/../.." 2>/dev/null && pwd)/bin/autoflow"
  if [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if command -v autoflow >/dev/null 2>&1; then
    command -v autoflow
    return 0
  fi

  printf 'autoflow\n'
}

prepare_adapter_cli_env() {
  local cli_path cli_dir

  cli_path="$(autoflow_cli_path)"
  export AUTOFLOW_CLI="$cli_path"
  if [ -x "$cli_path" ]; then
    cli_dir="$(dirname "$cli_path")"
    case ":$PATH:" in
      *":$cli_dir:"*) ;;
      *)
        PATH="${cli_dir}:${PATH}"
        export PATH
        ;;
    esac
  fi
}

runner_claude_base_cmd() {
  local __dest_var="$1"
  eval "${__dest_var}=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)"
}

runner_claude_supports_effort() {
  if [ -n "${__autoflow_claude_effort_cached:-}" ]; then
    [ "$__autoflow_claude_effort_cached" = "yes" ]
    return $?
  fi
  if claude --help 2>&1 | grep -q -- '--effort'; then
    __autoflow_claude_effort_cached="yes"
    return 0
  fi
  __autoflow_claude_effort_cached="no"
  return 1
}

runner_file_size_bytes() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf '0'
    return 0
  fi

  wc -c < "$file" 2>/dev/null | tr -d '[:space:]'
}

telemetry_positive_integer_or_zero() {
  local value="$1"

  case "$value" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$value" ;;
  esac
}

runner_budget_policy_path() {
  printf '%s' "${AUTOFLOW_BUDGET_POLICY_PATH:-${board_root}/policies/budget.toml}"
}

runner_policy_positive_integer_or_empty() {
  local value="$1"

  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  case "$value" in
    ''|*[!0-9]*) printf '' ;;
    *) printf '%s' "$value" ;;
  esac
}

runner_budget_policy_value() {
  local key="$1"
  local policy_path

  policy_path="$(runner_budget_policy_path)"
  [ -f "$policy_path" ] || return 0
  awk -v key="$key" -v role="$public_role" -v runner="$runner_id" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }
    BEGIN { section = ""; value = "" }
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    /^[[:space:]]*\[[^]]+\][[:space:]]*$/ {
      section = $0
      sub(/^[[:space:]]*\[/, "", section)
      sub(/\][[:space:]]*$/, "", section)
      section = trim(section)
      next
    }
    index($0, "=") > 0 {
      line = $0
      sub(/[[:space:]]+#.*$/, "", line)
      name = trim(substr(line, 1, index(line, "=") - 1))
      raw = trim(substr(line, index(line, "=") + 1))
      gsub(/^"|"$/, "", raw)
      if (name != key) {
        next
      }
      if (section == "default" || section == role || section == runner) {
        value = raw
      }
    }
    END { print value }
  ' "$policy_path"
}

runner_epoch_to_iso() {
  local epoch="$1"

  if date -u -r "$epoch" +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
    date -u -r "$epoch" +"%Y-%m-%dT%H:%M:%SZ"
    return 0
  fi
  date -u -d "@$epoch" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || true
}

runner_budget_telemetry_script() {
  if [ -x "${SCRIPT_DIR}/telemetry-project.sh" ]; then
    printf '%s' "${SCRIPT_DIR}/telemetry-project.sh"
    return 0
  fi
  if [ -x "${SCRIPT_DIR}/../../packages/cli/telemetry-project.sh" ]; then
    printf '%s' "${SCRIPT_DIR}/../../packages/cli/telemetry-project.sh"
    return 0
  fi
  return 1
}

runner_budget_telemetry_token_usage_since() {
  local since="$1"
  local output

  output="$(runner_budget_telemetry_token_usage_since_output "$since")"
  printf '%s\n' "$output" | awk -F= '$1 == "token_usage" { print $2; found=1; exit } END { if (!found) print "0" }'
}

runner_budget_telemetry_token_usage_since_output() {
  local since="$1"
  local telemetry_script

  telemetry_script="$(runner_budget_telemetry_script || true)"
  [ -n "$telemetry_script" ] || { printf 'token_usage=0\n'; return 0; }
  "$telemetry_script" token-usage --project-root "$project_root" --runner "$runner_id" --since "$since" 2>/dev/null || printf 'token_usage=0\n'
}

runner_budget_latest_adapter_ended_at() {
  local telemetry_script

  telemetry_script="$(runner_budget_telemetry_script || true)"
  [ -n "$telemetry_script" ] || return 0
  "$telemetry_script" query --project-root "$project_root" --runner "$runner_id" --limit 1 2>/dev/null |
    jq -r '.ended_at // empty' 2>/dev/null |
    head -n 1
}

runner_preflight_skip_is_repeatable() {
  case "${1:-}" in
    token_budget_exceeded|rate_limited|prompt_size_exceeded) return 0 ;;
  esac
  return 1
}

runner_preflight_skip_threshold() {
  local threshold
  threshold="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value preflight_skip_circuit_breaker_threshold)")"
  [ -n "$threshold" ] || threshold="${AUTOFLOW_PREFLIGHT_SKIP_CIRCUIT_BREAKER_THRESHOLD:-3}"
  case "${threshold:-}" in ''|*[!0-9]*|0) threshold=3 ;; esac
  printf '%s' "$threshold"
}

runner_preflight_skip_cooldown_seconds() {
  local cooldown_seconds
  cooldown_seconds="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value preflight_skip_circuit_breaker_cooldown_seconds)")"
  [ -n "$cooldown_seconds" ] || cooldown_seconds="${AUTOFLOW_PREFLIGHT_SKIP_CIRCUIT_BREAKER_COOLDOWN_SECONDS:-300}"
  case "${cooldown_seconds:-}" in ''|*[!0-9]*|0) cooldown_seconds=300 ;; esac
  printf '%s' "$cooldown_seconds"
}

runner_active_ticket_id_or_empty() {
  local active_ticket_id
  active_ticket_id="$(runner_adapter_state_value "active_ticket_id")"
  [ -n "$active_ticket_id" ] && { printf '%s' "$active_ticket_id"; return 0; }
  runner_state_field "$runner_id" "active_ticket_id" 2>/dev/null || true
}

runner_preflight_recovery_field_value() {
  local field="$1"
  local effective_reason="$2"
  local current_value="$3"

  if [ "$effective_reason" != "circuit_breaker_tripped" ] || [ -z "$(runner_active_ticket_id_or_empty)" ]; then
    printf '%s' "$current_value"
    return 0
  fi
  case "$field" in
    status) printf 'blocked' ;;
    failure_class) printf 'tooling_failure' ;;
    reason) printf 'repeated_preflight_skip' ;;
    *) printf '%s' "$current_value" ;;
  esac
}

runner_preflight_skip_streak_metadata() {
  local reason="$1"
  local timestamp="$2"
  local previous_result previous_count next_count threshold cooldown_seconds until_epoch until_iso now_epoch

  previous_result="$(runner_state_field "$runner_id" "consecutive_preflight_skip_result" 2>/dev/null || true)"
  previous_count="$(telemetry_positive_integer_or_zero "$(runner_state_field "$runner_id" "consecutive_preflight_skip_count" 2>/dev/null || true)")"
  if [ "$previous_result" = "$reason" ]; then next_count=$((previous_count + 1)); else next_count=1; fi
  threshold="$(runner_preflight_skip_threshold)"
  cooldown_seconds="$(runner_preflight_skip_cooldown_seconds)"
  now_epoch="$(telemetry_timestamp_to_epoch "$timestamp" || true)"
  [ -n "$now_epoch" ] || now_epoch="$(date -u +%s)"
  until_epoch=$((now_epoch + cooldown_seconds))
  until_iso="$(runner_epoch_to_iso "$until_epoch")"
  printf 'preflight_skip_result=%s\n' "$reason"
  printf 'consecutive_preflight_skip_result=%s\n' "$reason"
  printf 'consecutive_preflight_skip_count=%s\n' "$next_count"
  printf 'last_preflight_skip_at=%s\n' "$timestamp"
  printf 'preflight_skip_circuit_breaker_threshold=%s\n' "$threshold"
  printf 'preflight_skip_circuit_breaker_cooldown_seconds=%s\n' "$cooldown_seconds"
  printf 'preflight_skip_circuit_breaker_until=%s\n' "$until_iso"
  if [ "$next_count" -ge "$threshold" ]; then printf 'preflight_skip_circuit_breaker_tripped=true\n'; else printf 'preflight_skip_circuit_breaker_tripped=false\n'; fi
}

runner_budget_append_skip_log_and_state() {
  local reason="$1" prompt_file="$2" autocommit_before_status="$3" adapter_stdout_path="$4" adapter_stderr_path="$5" adapter_last_message_path="${6:-}"
  shift 6 || true
  local timestamp prompt_log_path effective_reason streak_metadata preflight_cause preflight_count preflight_threshold preflight_until
  local recovery_status recovery_failure_class recovery_reason

  timestamp="$(runner_now_iso)"
  prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
  effective_reason="$reason"
  streak_metadata=""
  preflight_cause="$reason"
  if runner_preflight_skip_is_repeatable "$reason"; then
    streak_metadata="$(runner_preflight_skip_streak_metadata "$reason" "$timestamp")"
    preflight_count="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "consecutive_preflight_skip_count" { print $2; exit }')"
    preflight_threshold="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "preflight_skip_circuit_breaker_threshold" { print $2; exit }')"
    preflight_until="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "preflight_skip_circuit_breaker_until" { print $2; exit }')"
    [ "${preflight_count:-0}" -ge "${preflight_threshold:-3}" ] && effective_reason="circuit_breaker_tripped"
  elif [ "$reason" = "circuit_breaker_tripped" ]; then
    local item
    for item in "$@"; do
      case "$item" in
        preflight_skip_result=*) preflight_cause="${item#*=}" ;;
        consecutive_preflight_skip_count=*) preflight_count="${item#*=}" ;;
        preflight_skip_circuit_breaker_threshold=*) preflight_threshold="${item#*=}" ;;
        preflight_skip_circuit_breaker_until=*) preflight_until="${item#*=}" ;;
      esac
    done
  fi
  recovery_status="$(runner_preflight_recovery_field_value status "$effective_reason" "${adapter_active_recovery_status}")"
  recovery_failure_class="$(runner_preflight_recovery_field_value failure_class "$effective_reason" "${adapter_active_recovery_failure_class}")"
  recovery_reason="$(runner_preflight_recovery_field_value reason "$effective_reason" "${adapter_active_recovery_reason}")"

  runner_write_state "$runner_id" \
    "status=idle" "role=${public_role}" "agent=${agent}" "mode=${mode}" "model=${model}" "reasoning=${reasoning}" \
    "active_item=$(runner_adapter_state_value "active_item")" \
    "active_ticket_id=$(runner_adapter_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_adapter_state_value "active_ticket_title")" \
    "active_stage=$(runner_adapter_state_value "active_stage")" \
    "active_spec_ref=$(runner_adapter_state_value "active_spec_ref")" \
    "active_recovery_reason=${recovery_reason}" \
    "active_recovery_status=${recovery_status}" \
    "active_recovery_failure_class=${recovery_failure_class}" \
    "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
    "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
    "active_recovery_board_state=${adapter_active_recovery_board_state}" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=${effective_reason}" \
    "last_prompt_log=${prompt_log_path}" \
    $streak_metadata \
    "$@"
  runner_append_log "$runner_id" "budget_preflight_skip" "role=${public_role}" "agent=${agent}" "reason=${reason}" "result=${effective_reason}" "action=skip_adapter" $streak_metadata "$@"
  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'reason=%s\n' "$effective_reason"
  if [ "$effective_reason" = "circuit_breaker_tripped" ]; then
    printf 'circuit_breaker_reason=%s\n' "$preflight_cause"
    printf 'circuit_breaker_count=%s\n' "${preflight_count:-}"
    printf 'circuit_breaker_threshold=%s\n' "${preflight_threshold:-}"
    printf 'circuit_breaker_until=%s\n' "${preflight_until:-}"
    printf 'active_recovery_status=%s\n' "$recovery_status"
    printf 'active_recovery_failure_class=%s\n' "$recovery_failure_class"
    printf 'active_recovery_reason=%s\n' "$recovery_reason"
  fi
  printf 'budget_preflight_action=skip_adapter\n'
  printf 'prompt_log_path=%s\n' "$prompt_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  while [ "$#" -gt 0 ]; do printf '%s\n' "$1"; shift || true; done
  rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path"
  exit 0
}

runner_budget_existing_preflight_circuit_or_exit() {
  local prompt_file="$1" autocommit_before_status="$2" adapter_stdout_path="$3" adapter_stderr_path="$4" adapter_last_message_path="${5:-}"
  local count result last_skip_at threshold cooldown_seconds now_iso now_epoch last_epoch until_epoch until_iso

  count="$(telemetry_positive_integer_or_zero "$(runner_state_field "$runner_id" "consecutive_preflight_skip_count" 2>/dev/null || true)")"
  result="$(runner_state_field "$runner_id" "consecutive_preflight_skip_result" 2>/dev/null || true)"
  [ -n "$result" ] || return 0
  runner_preflight_skip_is_repeatable "$result" || return 0
  threshold="$(runner_preflight_skip_threshold)"
  [ "$count" -ge "$threshold" ] || return 0
  last_skip_at="$(runner_state_field "$runner_id" "last_preflight_skip_at" 2>/dev/null || true)"
  [ -n "$last_skip_at" ] || return 0
  now_iso="$(runner_now_iso)"
  now_epoch="$(telemetry_timestamp_to_epoch "$now_iso" || true)"
  [ -n "$now_epoch" ] || now_epoch="$(date -u +%s)"
  last_epoch="$(telemetry_timestamp_to_epoch "$last_skip_at" || true)"
  [ -n "$last_epoch" ] || last_epoch="$now_epoch"
  cooldown_seconds="$(runner_preflight_skip_cooldown_seconds)"
  until_epoch=$((last_epoch + cooldown_seconds))
  [ "$now_epoch" -lt "$until_epoch" ] || return 0
  until_iso="$(runner_epoch_to_iso "$until_epoch")"
  runner_budget_append_skip_log_and_state "circuit_breaker_tripped" "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
    "preflight_skip_result=${result}" "consecutive_preflight_skip_result=${result}" "consecutive_preflight_skip_count=${count}" "last_preflight_skip_at=${last_skip_at}" \
    "preflight_skip_circuit_breaker_threshold=${threshold}" "preflight_skip_circuit_breaker_cooldown_seconds=${cooldown_seconds}" "preflight_skip_circuit_breaker_until=${until_iso}" "preflight_skip_circuit_breaker_tripped=true"
}

runner_budget_preflight_or_exit() {
  local prompt_file="$1" autocommit_before_status="$2" adapter_stdout_path="$3" adapter_stderr_path="$4" adapter_last_message_path="${5:-}"
  local now_iso now_epoch policy_path daily_token_quota quota_window_seconds quota_since_epoch quota_since_iso token_usage telemetry_usage_output token_usage_trusted skipped_suspicious_token_rows minimum_interval_seconds latest_ended_at latest_epoch next_allowed_epoch next_allowed_at remaining_seconds prompt_byte_cap prompt_bytes

  policy_path="$(runner_budget_policy_path)"
  [ -f "$policy_path" ] || return 0
  now_iso="$(runner_now_iso)"
  now_epoch="$(telemetry_timestamp_to_epoch "$now_iso" || true)"
  [ -n "$now_epoch" ] || now_epoch="$(date -u +%s)"
  runner_budget_existing_preflight_circuit_or_exit "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path"
  daily_token_quota="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value daily_token_quota)")"
  if [ -n "$daily_token_quota" ]; then
    quota_window_seconds="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value token_quota_window_seconds)")"
    [ -n "$quota_window_seconds" ] || quota_window_seconds=86400
    quota_since_epoch=$((now_epoch - quota_window_seconds))
    quota_since_iso="$(runner_epoch_to_iso "$quota_since_epoch")"
    telemetry_usage_output="$(runner_budget_telemetry_token_usage_since_output "$quota_since_iso")"
    token_usage="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage" { print $2; found=1; exit } END { if (!found) print "0" }')"
    token_usage="$(telemetry_positive_integer_or_zero "$token_usage")"
    token_usage_trusted="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage_trusted" { print $2; found=1; exit } END { if (!found) print "true" }')"
    skipped_suspicious_token_rows="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "skipped_suspicious_token_rows" { print $2; found=1; exit } END { if (!found) print "0" }')"
    skipped_suspicious_token_rows="$(telemetry_positive_integer_or_zero "$skipped_suspicious_token_rows")"
    if [ "$token_usage" -ge "$daily_token_quota" ]; then
      if [ "$token_usage_trusted" != "true" ]; then
        runner_append_log "$runner_id" "budget_preflight_warning" "role=${public_role}" "agent=${agent}" "reason=token_usage_suspicious" "action=continue_adapter" "budget_policy_path=${policy_path}" "token_usage=${token_usage}" "token_quota=${daily_token_quota}" "token_quota_window_seconds=${quota_window_seconds}" "token_quota_since=${quota_since_iso}" "token_usage_trusted=${token_usage_trusted}" "skipped_suspicious_token_rows=${skipped_suspicious_token_rows}"
      else
        runner_budget_append_skip_log_and_state "token_budget_exceeded" "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" "budget_policy_path=${policy_path}" "token_usage=${token_usage}" "token_quota=${daily_token_quota}" "token_quota_window_seconds=${quota_window_seconds}" "token_quota_since=${quota_since_iso}"
      fi
    fi
  fi
  minimum_interval_seconds="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value minimum_interval_seconds)")"
  if [ -n "$minimum_interval_seconds" ] && [ "$minimum_interval_seconds" -gt 0 ]; then
    latest_ended_at="$(runner_budget_latest_adapter_ended_at)"
    latest_epoch=""
    [ -z "$latest_ended_at" ] || latest_epoch="$(telemetry_timestamp_to_epoch "$latest_ended_at" || true)"
    if [ -n "$latest_epoch" ]; then
      next_allowed_epoch=$((latest_epoch + minimum_interval_seconds))
      if [ "$now_epoch" -lt "$next_allowed_epoch" ]; then
        remaining_seconds=$((next_allowed_epoch - now_epoch))
        next_allowed_at="$(runner_epoch_to_iso "$next_allowed_epoch")"
        runner_budget_append_skip_log_and_state "rate_limited" "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" "budget_policy_path=${policy_path}" "minimum_interval_seconds=${minimum_interval_seconds}" "last_adapter_ended_at=${latest_ended_at}" "next_allowed_at=${next_allowed_at}" "remaining_seconds=${remaining_seconds}"
      fi
    fi
  fi
  prompt_byte_cap="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value prompt_byte_cap)")"
  if [ -n "$prompt_byte_cap" ] && [ "$prompt_byte_cap" -gt 0 ]; then
    prompt_bytes="$(telemetry_positive_integer_or_zero "$(runner_file_size_bytes "$prompt_file")")"
    [ "$prompt_bytes" -le "$prompt_byte_cap" ] || runner_budget_append_skip_log_and_state "prompt_size_exceeded" "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" "budget_policy_path=${policy_path}" "prompt_bytes=${prompt_bytes}" "prompt_byte_cap=${prompt_byte_cap}"
  fi
}

runner_adapter_heartbeat_interval_seconds() {
  local value="${AUTOFLOW_ADAPTER_HEARTBEAT_INTERVAL_SECONDS:-30}"

  case "$value" in
    ''|*[!0-9]*) value=30 ;;
  esac
  [ "$value" -gt 0 ] || value=30
  printf '%s' "$value"
}

runner_adapter_preserved_state_value() {
  local field="$1"
  local fallback="${2:-}"
  local value

  value="$(runner_state_field "$runner_id" "$field" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$fallback"
  fi
}

runner_write_adapter_running_heartbeat() {
  local timestamp="$1"
  local last_chunk_at="${2:-}"

  if [ -z "$last_chunk_at" ]; then
    last_chunk_at="$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)"
  fi

  runner_write_state "$runner_id" \
    "status=running" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "configured_reasoning=${configured_reasoning}" \
    "reasoning_source=${reasoning_source}" \
    "reasoning_complexity=${reasoning_complexity}" \
    "active_item=$(runner_adapter_state_value "active_item")" \
    "active_ticket_id=$(runner_adapter_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_adapter_state_value "active_ticket_title")" \
    "active_stage=adapter_running" \
    "active_spec_ref=$(runner_adapter_state_value "active_spec_ref")" \
    "active_recovery_reason=${adapter_active_recovery_reason}" \
    "active_recovery_status=${adapter_active_recovery_status}" \
    "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
    "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
    "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
    "active_recovery_board_state=${adapter_active_recovery_board_state}" \
    "pid=$(runner_state_pid_for_start)" \
    "started_at=$(runner_state_started_at "$started_at")" \
    "last_event_at=${timestamp}" \
    "last_adapter_chunk_at=${last_chunk_at}" \
    "last_result=" \
    "last_runtime_log=$(runner_adapter_preserved_state_value "last_runtime_log")" \
    "last_prompt_log=$(runner_adapter_preserved_state_value "last_prompt_log")" \
    "last_stdout_log=$(runner_adapter_preserved_state_value "last_stdout_log" "$adapter_stdout")" \
    "last_stderr_log=$(runner_adapter_preserved_state_value "last_stderr_log" "$adapter_stderr")" \
    "consecutive_preflight_skip_count=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_count")" \
    "consecutive_preflight_skip_result=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_result")" \
    "last_preflight_skip_at=$(runner_adapter_preserved_state_value "last_preflight_skip_at")"
}

start_adapter_heartbeat_monitor() {
  local interval_s

  interval_s="$(runner_adapter_heartbeat_interval_seconds)"
  (
    local previous_stdout_size previous_stderr_size current_stdout_size current_stderr_size
    local timestamp last_chunk_at

    previous_stdout_size="$(runner_file_size_bytes "$adapter_stdout")"
    previous_stderr_size="$(runner_file_size_bytes "$adapter_stderr")"
    last_chunk_at="$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)"

    while :; do
      sleep "$interval_s"
      timestamp="$(runner_now_iso)"
      current_stdout_size="$(runner_file_size_bytes "$adapter_stdout")"
      current_stderr_size="$(runner_file_size_bytes "$adapter_stderr")"
      if [ "${current_stdout_size:-0}" -gt "${previous_stdout_size:-0}" ] || [ "${current_stderr_size:-0}" -gt "${previous_stderr_size:-0}" ]; then
        last_chunk_at="$timestamp"
      fi
      runner_write_adapter_running_heartbeat "$timestamp" "$last_chunk_at"
      previous_stdout_size="${current_stdout_size:-0}"
      previous_stderr_size="${current_stderr_size:-0}"
    done
  ) &
  adapter_heartbeat_pid=$!
}

stop_adapter_heartbeat_monitor() {
  if [ -n "${adapter_heartbeat_pid:-}" ] && kill -0 "$adapter_heartbeat_pid" 2>/dev/null; then
    kill -TERM "$adapter_heartbeat_pid" 2>/dev/null || true
    wait "$adapter_heartbeat_pid" 2>/dev/null || true
  fi
  adapter_heartbeat_pid=""
}

run_default_adapter_command() {
  local prompt_file="$1"
  local prompt_text
  local cmd=()
  local command_exit codex_wrapper

  case "$agent" in
    codex)
      ensure_agent_on_path codex || return 127
      cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$adapter_working_root")
      if [ -n "$model" ]; then
        cmd+=(-m "$model")
      fi
      if [ -n "$reasoning" ]; then
        cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
      fi
      cmd+=(-)
      command_summary="$(command_summary_from_array "${cmd[@]}")"
      if [ "$(uname -s 2>/dev/null || true)" = "Darwin" ] && command -v script >/dev/null 2>&1 && [ "${AUTOFLOW_CODEX_DISABLE_PTY:-}" != "1" ]; then
        codex_wrapper="$(mktemp "${TMPDIR:-/tmp}/autoflow-codex-wrapper.XXXXXX")"
        {
          printf '#!/usr/bin/env bash\n'
          printf 'exec'
          printf ' %q' "${cmd[@]}"
          printf ' < "$1"\n'
        } > "$codex_wrapper"
        chmod +x "$codex_wrapper"
        run_adapter_with_identity script -q /dev/null "$codex_wrapper" "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
        rm -f "$codex_wrapper"
      else
        run_adapter_with_identity "${cmd[@]}" < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
      fi
      return "$command_exit"
      ;;
    claude)
      ensure_agent_on_path claude || return 127
      prompt_text="$(cat "$prompt_file")"
      runner_claude_base_cmd cmd
      if [ -n "$model" ]; then
        cmd+=(--model "$(normalize_claude_model_alias "$model")")
      fi
      if [ -n "$reasoning" ] && runner_claude_supports_effort; then
        cmd+=(--effort "$reasoning")
      fi
      cmd+=("$prompt_text")
      command_summary="$(command_summary_from_array "${cmd[@]:0:${#cmd[@]}-1}") prompt"
      (cd "$adapter_working_root" && run_adapter_with_identity "${cmd[@]}") > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    opencode)
      ensure_agent_on_path opencode || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(opencode run)
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      if [ -n "$reasoning" ]; then
        cmd+=(--variant "$reasoning")
      fi
      cmd+=("$prompt_text")
      command_summary="$(command_summary_from_array "${cmd[@]:0:${#cmd[@]}-1}") prompt"
      (cd "$adapter_working_root" && run_adapter_with_identity "${cmd[@]}") > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    gemini)
      ensure_agent_on_path gemini || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(gemini --skip-trust --approval-mode yolo --prompt "$prompt_text")
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      command_summary="$(command_summary_from_array "${cmd[@]:0:4}") prompt"
      (cd "$adapter_working_root" && run_adapter_with_identity "${cmd[@]}") > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    *)
      return 127
      ;;
  esac
}

emit_file_block() {
  local label="$1"
  local file="$2"

  printf '%s_begin\n' "$label"
  if [ -f "$file" ]; then
    cat "$file"
  fi
  printf '%s_end\n' "$label"
}

artifact_stamp() {
  runner_now_iso | tr ':' '-'
}

persist_run_artifact() {
  local source_file="$1"
  local suffix="$2"
  local destination

  runner_ensure_dirs
  destination="$(runner_log_dir)/${runner_id}_$(artifact_stamp)_${suffix}.log"
  cp "$source_file" "$destination"
  printf '%s' "$destination"
}

prepare_adapter_live_logs() {
  local live_stamp

  runner_ensure_dirs
  live_stamp="$(artifact_stamp)"
  adapter_stdout="$(runner_log_dir)/${runner_id}_${live_stamp}_live_stdout.log"
  adapter_stderr="$(runner_log_dir)/${runner_id}_${live_stamp}_live_stderr.log"
  : > "$adapter_stdout"
  : > "$adapter_stderr"
}

agent_runtime_preflight_or_exit() {
  local preflight_output preflight_exit preflight_status preflight_reason preflight_log_path
  local orchestration_output orchestration_reason
  local started_at finished_at command_status runner_status last_result
  local active_item active_ticket_id active_ticket_title active_stage active_spec_ref
  local active_recovery_reason active_recovery_status active_recovery_failure_class
  local active_recovery_worktree_path active_recovery_worktree_status active_recovery_board_state

  case "$public_role" in
    ticket|planner)
      ;;
    *)
      return 0
      ;;
  esac
  reset_stale_ticket_stage_blocked_last_result_if_scope_clean
  [ -n "${runtime_path:-}" ] || return 0
  [ "$dry_run" = "true" ] && return 0

  preflight_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-preflight.XXXXXX")"
  started_at="$(runner_now_iso)"

  set +e
  AUTOFLOW_ROLE="$runtime_role" \
    AUTOFLOW_WORKER_ID="$runner_id" \
    AUTOFLOW_BACKGROUND=1 \
    AUTOFLOW_BOARD_ROOT="$board_root" \
    AUTOFLOW_PROJECT_ROOT="$project_root" \
    "$runtime_path" > "$preflight_output" 2>&1
  preflight_exit=$?
  set -e

  preflight_status="$(awk -F= '$1 == "status" { value=$2; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  preflight_reason="$(awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  implementation_root="$(awk -F= '$1 == "implementation_root" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  active_item="$(awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  active_ticket_id="$(awk -F= '$1 == "ticket_id" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  if [ "$public_role" = "planner" ]; then
    active_item="$(awk -F= '$1 == "memo" || $1 == "spec" || $1 == "plan" || $1 == "reject_origin" || $1 == "todo_ticket" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$preflight_output" 2>/dev/null || true)"
  fi
  if [ -n "$active_ticket_id" ]; then
    case "$active_ticket_id" in
      tickets_*) ;;
      *) active_ticket_id="tickets_${active_ticket_id}" ;;
    esac
    [ -n "$active_item" ] || active_item="$active_ticket_id"
    active_stage="${preflight_status:-}"
  else
    active_item=""
    active_stage=""
  fi
  active_ticket_title=""
  active_spec_ref=""
  active_recovery_reason=""
  active_recovery_status=""
  active_recovery_failure_class=""
  active_recovery_worktree_path=""
  active_recovery_worktree_status=""
  active_recovery_board_state=""
  runner_hydrate_active_ticket_metadata
  preflight_log_path="$(persist_run_artifact "$preflight_output" "runtime")"

  if [ "$preflight_exit" -eq 0 ] && { [ "$preflight_status" = "ok" ] || [ "$preflight_status" = "resume" ]; }; then
    if [ -n "$implementation_root" ] && [ -d "$implementation_root" ]; then
      adapter_working_root="$implementation_root"
    fi
    adapter_active_ticket_file="$active_item"
    adapter_active_ticket_id="$active_ticket_id"
    adapter_active_ticket_title="$active_ticket_title"
    adapter_active_stage="$active_stage"
    adapter_active_spec_ref="$active_spec_ref"
    adapter_active_recovery_reason="$active_recovery_reason"
    adapter_active_recovery_status="$active_recovery_status"
    adapter_active_recovery_failure_class="$active_recovery_failure_class"
    rm -f "$preflight_output"
    return 0
  fi

  orchestration_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-orchestration-signal.XXXXXX")"
  if [ "$preflight_exit" -eq 0 ] && [ "$public_role" = "planner" ] && planner_orchestration_signal > "$orchestration_output"; then
    orchestration_reason="$(awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    active_item="$(awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_ticket_id="$(awk -F= '$1 == "ticket_id" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_ticket_title="$(awk -F= '$1 == "ticket_title" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_stage="$(awk -F= '$1 == "ticket_stage" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_spec_ref="$(awk -F= '$1 == "spec_ref" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_recovery_status="$(awk -F= '$1 == "recovery_status" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_recovery_failure_class="$(awk -F= '$1 == "failure_class" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_recovery_worktree_path="$(awk -F= '$1 == "worktree_path" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_recovery_worktree_status="$(awk -F= '$1 == "worktree_status" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_recovery_board_state="$(awk -F= '$1 == "board_state" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$orchestration_output" 2>/dev/null || true)"
    adapter_active_ticket_file="$active_item"
    adapter_active_recovery_reason="${orchestration_reason:-recovery}"
    maybe_skip_planner_needs_user_decision_signal \
      "$orchestration_reason" \
      "$preflight_status" \
      "$preflight_reason" \
      "$preflight_output" \
      "$preflight_log_path" \
      "$orchestration_output" || true
    maybe_skip_unchanged_planner_recovery_signal \
      "$orchestration_reason" \
      "$preflight_status" \
      "$preflight_reason" \
      "$preflight_output" \
      "$preflight_log_path" \
      "$orchestration_output" || true
    runner_append_log "$runner_id" "orchestrator_recovery_signal" \
      "role=${public_role}" \
      "reason=${orchestration_reason:-recovery}" \
      "active_item=${active_item}" \
      "active_ticket_id=${adapter_active_ticket_id}" \
      "recovery_status=${adapter_active_recovery_status}" \
      "failure_class=${adapter_active_recovery_failure_class}" \
      "worktree_status=${adapter_active_recovery_worktree_status}" \
      "board_state=${adapter_active_recovery_board_state}"
    rm -f "$preflight_output" "$orchestration_output"
    return 0
  fi
  rm -f "$orchestration_output"

  finished_at="$(runner_now_iso)"
  maybe_skip_unchanged_idle_preflight "$preflight_status" "$preflight_reason" "$preflight_output" "$preflight_log_path" || true
  if [ "$preflight_exit" -eq 0 ] && [ "$preflight_status" = "blocked" ]; then
    command_status="blocked"
    runner_status="blocked"
    last_result="${preflight_reason:-blocked}"
  elif [ "$preflight_exit" -eq 0 ]; then
    command_status="ok"
    runner_status="idle"
    last_result="${preflight_status:-idle}"
  else
    command_status="failed"
    runner_status="failed"
    last_result="${preflight_status:-exit_${preflight_exit}}"
  fi

  runner_write_state "$runner_id" \
    "status=${runner_status}" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=${active_item}" \
    "active_ticket_id=${active_ticket_id}" \
    "active_ticket_title=${active_ticket_title}" \
    "active_stage=${active_stage}" \
    "active_spec_ref=${active_spec_ref}" \
    "active_recovery_reason=${active_recovery_reason}" \
    "active_recovery_status=${active_recovery_status}" \
    "active_recovery_failure_class=${active_recovery_failure_class}" \
    "active_recovery_worktree_path=${active_recovery_worktree_path}" \
    "active_recovery_worktree_status=${active_recovery_worktree_status}" \
    "active_recovery_board_state=${active_recovery_board_state}" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$started_at")" \
    "last_event_at=${finished_at}" \
    "last_result=${last_result}" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "runtime_preflight_finish" \
    "role=${public_role}" \
    "runtime_status=${preflight_status:-}" \
    "exit_code=${preflight_exit}" \
    "runner_status=${runner_status}" \
    "reason=${preflight_reason:-}"

  print_run_header "$command_status"
  printf 'runner_status=%s\n' "$runner_status"
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=%s\n' "$preflight_exit"
  printf 'reason=%s\n' "$preflight_reason"
  printf 'active_item=%s\n' "$active_item"
  if [ -n "${idle_preflight_fingerprint:-}" ]; then
    printf 'idle_inputs_fingerprint=%s\n' "$idle_preflight_fingerprint"
    printf 'fingerprint_path=%s\n' "$idle_preflight_fingerprint_path_value"
  fi
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  rm -f "$preflight_output"

  if [ "$preflight_exit" -ne 0 ]; then
    exit "$preflight_exit"
  fi
  exit 0
}

if [ ! -f "$config_path" ]; then
  print_run_header "blocked"
  printf 'reason=runner_config_missing\n'
  exit 0
fi

if ! runner_validate_id "$runner_id"; then
  print_run_header "blocked"
  printf 'reason=invalid_runner_id\n'
  exit 0
fi

if ! runner_config_block "$runner_id" "$config_path" >/dev/null 2>&1; then
  print_run_header "blocked"
  printf 'reason=runner_not_found\n'
  exit 0
fi

configured_role="$(runner_field "role")"
agent="$(runner_field "agent")"
model="$(runner_field "model")"
reasoning="$(runner_field "reasoning")"
configured_reasoning="$reasoning"
effective_reasoning="$reasoning"
reasoning_complexity="configured"
reasoning_source="configured"
reasoning_supported="false"
reasoning_dynamic_enabled="false"
reasoning_actionable_count="0"
reasoning_reject_count="0"
mode="$(runner_field "mode")"
enabled="$(runner_field "enabled")"
command_value="$(runner_field "command")"

[ -n "$agent" ] || agent="manual"
[ -n "$mode" ] || mode="one-shot"
[ -n "$enabled" ] || enabled="true"

if [ "$enabled" != "true" ]; then
  write_blocked_state "runner_disabled"
  print_run_header "blocked"
  printf 'reason=runner_disabled\n'
  printf 'configured_role=%s\n' "$configured_role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  exit 0
fi

if [ "$mode" = "watch" ] && [ "${AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT:-}" != "1" ] && [ "$public_role" != "wiki" ] && [ "$public_role" != "coordinator" ]; then
  write_blocked_state "runner_mode_not_supported_for_run"
  print_run_header "blocked"
  printf 'reason=runner_mode_not_supported_for_run\n'
  printf 'mode=%s\n' "$mode"
  exit 0
fi

case "$public_role:$configured_role" in
  ticket:ticket-owner|ticket:owner|planner:planner|planner:plan|todo:todo|verifier:verifier|merge:merge|merge:merge-bot|wiki:wiki-maintainer|wiki:wiki|wiki:coordinator|wiki:coord|wiki:doctor|wiki:diagnose|coordinator:coordinator|coordinator:coord|coordinator:doctor|coordinator:diagnose|self-improve:self-improve|self-improve:self_improve|self-improve:selfimprove)
    ;;
  *)
    write_blocked_state "runner_role_mismatch"
    print_run_header "blocked"
    printf 'reason=runner_role_mismatch\n'
    printf 'configured_role=%s\n' "$configured_role"
    exit 0
    ;;
esac

if [ "$public_role" = "wiki" ]; then
  runtime_path="${SCRIPT_DIR}/wiki-project.sh"
elif [ -z "$runtime_script" ]; then
  write_blocked_state "role_run_not_implemented"
  print_run_header "blocked"
  printf 'reason=role_run_not_implemented\n'
  exit 0
else
  runtime_path="${board_root}/scripts/${runtime_script}"
fi

if [ ! -f "$runtime_path" ]; then
  write_blocked_state "runtime_script_missing"
  print_run_header "blocked"
  printf 'reason=runtime_script_missing\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  exit 0
fi

case "$agent" in
  shell|manual)
    ;;
  codex|claude|opencode|gemini)
    if [ "$public_role" = "coordinator" ]; then
      # Coordinator diagnostics are deterministic and should not spend an
      # adapter turn just to re-summarize doctor output. Wiki turns may still
      # reuse this same configured runner as an adapter.
      :
    else
    instruction_file="$(agent_instruction_path)"
    if [ ! -f "$instruction_file" ]; then
      write_blocked_state "agent_instruction_missing"
      print_run_header "blocked"
      printf 'reason=agent_instruction_missing\n'
      printf 'agent=%s\n' "$agent"
      printf 'instruction_file=%s\n' "$instruction_file"
      exit 0
    fi

    agent_runtime_preflight_or_exit
    maybe_skip_unchanged_wiki_turn || true
    maybe_skip_debounced_wiki_turn || true
    run_skill_nudge_best_effort >/dev/null 2>&1 || true

    started_at="$(runner_now_iso)"
    prompt_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-agent-prompt.XXXXXX")"
    autocommit_before_status="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-before-status.XXXXXX")"
    adapter_stdout=""
    adapter_stderr=""
    ticket_goal_before_fingerprint="$(ticket_goal_progress_fingerprint_for_current_ticket || true)"
    prepare_adapter_live_logs
    role_autocommit_capture_status "$autocommit_before_status"
    write_agent_prompt "$instruction_file" > "$prompt_file"
    planner_differential_persist_after_prompt || true
    runner_budget_preflight_or_exit "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}" || true
    resolve_effective_reasoning_for_current_tick
    reasoning="$effective_reasoning"

    runner_write_state "$runner_id" \
      "status=running" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "configured_reasoning=${configured_reasoning}" \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "active_item=$(runner_adapter_state_value "active_item")" \
      "active_ticket_id=$(runner_adapter_state_value "active_ticket_id")" \
      "active_ticket_title=$(runner_adapter_state_value "active_ticket_title")" \
      "active_stage=adapter_running" \
      "active_spec_ref=$(runner_adapter_state_value "active_spec_ref")" \
      "active_recovery_reason=${adapter_active_recovery_reason}" \
      "active_recovery_status=${adapter_active_recovery_status}" \
      "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
      "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
      "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
      "active_recovery_board_state=${adapter_active_recovery_board_state}" \
      "pid=$(runner_state_pid_for_start)" \
      "started_at=$(runner_state_started_at "$started_at")" \
      "last_event_at=${started_at}" \
      "last_adapter_chunk_at=$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)" \
      "last_result=" \
      "last_runtime_log=$(runner_adapter_preserved_state_value "last_runtime_log")" \
      "last_prompt_log=$(runner_adapter_preserved_state_value "last_prompt_log")" \
      "last_stdout_log=${adapter_stdout}" \
      "last_stderr_log=${adapter_stderr}" \
      "consecutive_preflight_skip_count=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_count")" \
      "consecutive_preflight_skip_result=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_result")" \
      "last_preflight_skip_at=$(runner_adapter_preserved_state_value "last_preflight_skip_at")"
    runner_append_log "$runner_id" "adapter_start" \
      "role=${public_role}" \
      "runtime_role=${runtime_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "configured_reasoning=${configured_reasoning}" \
      "effective_reasoning=${reasoning}" \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "reasoning_actionable_count=${reasoning_actionable_count}" \
      "reasoning_reject_count=${reasoning_reject_count}"

    adapter_exit=0
    command_summary=""

    if [ "$dry_run" = "true" ]; then
      if [ -n "$command_value" ]; then
        command_summary="$command_value"
      else
        case "$agent" in
          codex)
            dry_cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$adapter_working_root")
            [ -z "$model" ] || dry_cmd+=(-m "$model")
            [ -z "$reasoning" ] || dry_cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
            dry_cmd+=(-)
            command_summary="$(command_summary_from_array "${dry_cmd[@]}")"
            ;;
          claude)
            runner_claude_base_cmd dry_cmd
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            if [ -n "$reasoning" ] && runner_claude_supports_effort; then
              dry_cmd+=(--effort "$reasoning")
            fi
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
          opencode)
            dry_cmd=(opencode run)
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            [ -z "$reasoning" ] || dry_cmd+=(--variant "$reasoning")
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
          gemini)
            dry_cmd=(gemini --skip-trust --approval-mode yolo --prompt)
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
        esac
      fi

      finished_at="$(runner_now_iso)"
      prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
      runner_write_state "$runner_id" \
        "status=idle" \
        "role=${public_role}" \
        "agent=${agent}" \
        "mode=${mode}" \
        "model=${model}" \
        "reasoning=${reasoning}" \
        "configured_reasoning=${configured_reasoning}" \
        "reasoning_source=${reasoning_source}" \
        "reasoning_complexity=${reasoning_complexity}" \
        "active_item=$(runner_adapter_state_value "active_item")" \
        "active_ticket_id=$(runner_adapter_state_value "active_ticket_id")" \
        "active_ticket_title=$(runner_adapter_state_value "active_ticket_title")" \
        "active_stage=$(runner_adapter_state_value "active_stage")" \
        "active_spec_ref=$(runner_adapter_state_value "active_spec_ref")" \
        "active_recovery_reason=${adapter_active_recovery_reason}" \
        "active_recovery_status=${adapter_active_recovery_status}" \
        "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
        "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
        "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
        "active_recovery_board_state=${adapter_active_recovery_board_state}" \
        "pid=$(runner_state_pid_for_finish)" \
        "started_at=$(runner_state_started_at "$started_at")" \
        "last_event_at=${finished_at}" \
        "last_result=dry_run" \
        "last_prompt_log=${prompt_log_path}"
      runner_append_log "$runner_id" "adapter_dry_run" \
        "role=${public_role}" \
        "agent=${agent}" \
        "command=${command_summary}" \
        "configured_reasoning=${configured_reasoning}" \
        "effective_reasoning=${reasoning}" \
        "reasoning_source=${reasoning_source}" \
        "reasoning_complexity=${reasoning_complexity}" \
        "reasoning_actionable_count=${reasoning_actionable_count}" \
        "reasoning_reject_count=${reasoning_reject_count}"

      print_run_header "dry_run"
      printf 'runner_status=idle\n'
      printf 'adapter=%s\n' "$agent"
      printf 'configured_reasoning=%s\n' "$configured_reasoning"
      printf 'effective_reasoning=%s\n' "$reasoning"
      printf 'reasoning_source=%s\n' "$reasoning_source"
      printf 'reasoning_complexity=%s\n' "$reasoning_complexity"
      printf 'reasoning_actionable_count=%s\n' "$reasoning_actionable_count"
      printf 'reasoning_reject_count=%s\n' "$reasoning_reject_count"
      printf 'adapter_command=%s\n' "$command_summary"
      printf 'prompt_file=%s\n' "$prompt_file"
      printf 'prompt_log_path=%s\n' "$prompt_log_path"
      if [ "$planner_diff_context_enabled" = "true" ]; then
        printf 'planner_prompt_context_mode=%s\n' "$planner_diff_mode"
        printf 'planner_prompt_context_reason=%s\n' "$planner_diff_reason"
        printf 'planner_prompt_context_fingerprint=%s\n' "$planner_diff_current_fingerprint"
      fi
      printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
      printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
      emit_file_block "adapter_prompt" "$prompt_file"
      rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr"
      exit 0
    fi

    adapter_heartbeat_pid=""
    start_adapter_heartbeat_monitor
    set +e
    if [ -n "$command_value" ]; then
      run_custom_adapter_command "$prompt_file"
    else
      run_default_adapter_command "$prompt_file"
    fi
    adapter_exit=$?
    stop_adapter_heartbeat_monitor
    set -e

    finished_at="$(runner_now_iso)"
    planner_differential_finalize_after_run || true
    if [ "$adapter_exit" -eq 0 ]; then
      command_status="ok"
      runner_status="idle"
    elif [ "$adapter_exit" -eq 127 ]; then
      command_status="blocked"
      runner_status="blocked"
    elif runner_file_has_quota_limit "$adapter_stdout" "$adapter_stderr"; then
      command_status="blocked"
      runner_status="stopped"
    else
      command_status="failed"
      runner_status="failed"
    fi

    prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
    stdout_log_path="$(persist_run_artifact "$adapter_stdout" "stdout")"
    stderr_log_path="$(persist_run_artifact "$adapter_stderr" "stderr")"
    autocommit_output="$(role_autocommit_after_adapter "$adapter_exit" "$autocommit_before_status" 2>&1)"
    if [ "$adapter_exit" -eq 0 ]; then
      wiki_record_inputs_fingerprint
    fi
    ticket_goal_record_adapter_result_for_current_ticket "$adapter_exit" "$ticket_goal_before_fingerprint" || true

    runner_write_state "$runner_id" \
      "status=${runner_status}" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "configured_reasoning=${configured_reasoning}" \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "active_item=$(runner_adapter_state_value "active_item")" \
      "active_ticket_id=$(runner_adapter_state_value "active_ticket_id")" \
      "active_ticket_title=$(runner_adapter_state_value "active_ticket_title")" \
      "active_stage=$(runner_adapter_state_value "active_stage")" \
      "active_spec_ref=$(runner_adapter_state_value "active_spec_ref")" \
      "active_recovery_reason=${adapter_active_recovery_reason}" \
      "active_recovery_status=${adapter_active_recovery_status}" \
      "active_recovery_failure_class=${adapter_active_recovery_failure_class}" \
      "active_recovery_worktree_path=${adapter_active_recovery_worktree_path}" \
      "active_recovery_worktree_status=${adapter_active_recovery_worktree_status}" \
      "active_recovery_board_state=${adapter_active_recovery_board_state}" \
      "pid=$([ "$runner_status" = "stopped" ] && printf '' || runner_state_pid_for_finish)" \
      "started_at=$(runner_state_started_at "$started_at")" \
      "last_event_at=${finished_at}" \
      "last_adapter_chunk_at=$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)" \
      "last_result=$([ "$runner_status" = "stopped" ] && printf 'quota_limited' || printf 'adapter_exit_%s' "$adapter_exit")" \
      "last_runtime_log=$(runner_adapter_preserved_state_value "last_runtime_log")" \
      "last_prompt_log=${prompt_log_path}" \
      "last_stdout_log=${stdout_log_path}" \
      "last_stderr_log=${stderr_log_path}" \
      "consecutive_preflight_skip_count=$([ "$adapter_exit" -eq 0 ] && printf '0' || runner_adapter_preserved_state_value "consecutive_preflight_skip_count")" \
      "consecutive_preflight_skip_result=$([ "$adapter_exit" -eq 0 ] && printf '' || runner_adapter_preserved_state_value "consecutive_preflight_skip_result")" \
      "last_preflight_skip_at=$([ "$adapter_exit" -eq 0 ] && printf '' || runner_adapter_preserved_state_value "last_preflight_skip_at")"
    runner_append_log "$runner_id" "adapter_finish" \
      "role=${public_role}" \
      "agent=${agent}" \
      "exit_code=${adapter_exit}" \
      "runner_status=${runner_status}" \
      "configured_reasoning=${configured_reasoning}" \
      "effective_reasoning=${reasoning}" \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "reasoning_actionable_count=${reasoning_actionable_count}" \
      "reasoning_reject_count=${reasoning_reject_count}" \
      "reason=$([ "$runner_status" = "stopped" ] && printf 'quota_limited' || true)" \
      "command=${command_summary}"

    print_run_header "$command_status"
    printf 'runner_status=%s\n' "$runner_status"
    printf 'adapter=%s\n' "$agent"
    printf 'adapter_exit_code=%s\n' "$adapter_exit"
    printf 'configured_reasoning=%s\n' "$configured_reasoning"
    printf 'effective_reasoning=%s\n' "$reasoning"
    printf 'reasoning_source=%s\n' "$reasoning_source"
    printf 'reasoning_complexity=%s\n' "$reasoning_complexity"
    printf 'reasoning_actionable_count=%s\n' "$reasoning_actionable_count"
    printf 'reasoning_reject_count=%s\n' "$reasoning_reject_count"
    printf 'adapter_command=%s\n' "$command_summary"
    printf 'prompt_log_path=%s\n' "$prompt_log_path"
    printf 'stdout_log_path=%s\n' "$stdout_log_path"
    printf 'stderr_log_path=%s\n' "$stderr_log_path"
    if [ "$adapter_exit" -eq 127 ]; then
      printf 'reason=adapter_executable_missing\n'
    elif [ "$runner_status" = "stopped" ]; then
      printf 'reason=quota_limited\n'
    fi
    printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
    printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
    if [ -n "$autocommit_output" ]; then
      printf '%s\n' "$autocommit_output"
    fi
    emit_file_block "adapter_stdout" "$adapter_stdout"
    emit_file_block "adapter_stderr" "$adapter_stderr"
    rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr"
    if [ "$adapter_exit" -ne 0 ] && [ "$adapter_exit" -ne 127 ] && [ "$runner_status" != "stopped" ]; then
      exit "$adapter_exit"
    fi
    exit 0
    fi
    ;;
  *)
    write_blocked_state "agent_run_not_implemented"
    print_run_header "blocked"
    printf 'reason=agent_run_not_implemented\n'
    printf 'agent=%s\n' "$agent"
    exit 0
    ;;
esac

if [ "$dry_run" = "true" ]; then
  started_at="$(runner_now_iso)"
  finished_at="$started_at"
  dry_run_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-dry-run.XXXXXX")"

  {
    print_run_header "dry_run"
    printf 'runner_status=idle\n'
    printf 'runtime_script=%s\n' "$runtime_path"
    printf 'adapter=%s\n' "$agent"
    printf 'reason=dry_run\n'
    printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
    printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  } > "$dry_run_output"

  runtime_output_log_path="$(persist_run_artifact "$dry_run_output" "dry-run")"
  printf 'runtime_output_log_path=%s\n' "$runtime_output_log_path" >> "$runtime_output_log_path"

  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "active_item")" \
    "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$started_at")" \
    "last_event_at=${finished_at}" \
    "last_result=dry_run" \
    "last_runtime_log=${runtime_output_log_path}"
  runner_append_log "$runner_id" "run_dry_run" \
    "role=${public_role}" \
    "runtime_role=${runtime_role}" \
    "agent=${agent}" \
    "runtime_script=${runtime_path}" \
    "runtime_output_log_path=${runtime_output_log_path}"

  cat "$runtime_output_log_path"
  rm -f "$dry_run_output"
  exit 0
fi

started_at="$(runner_now_iso)"
runner_write_state "$runner_id" \
  "status=running" \
  "role=${public_role}" \
  "agent=${agent}" \
  "mode=${mode}" \
  "model=${model}" \
  "reasoning=${reasoning}" \
  "active_item=$(runner_active_state_value "active_item")" \
  "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
  "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
  "active_stage=$(runner_active_state_value "active_stage")" \
  "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
  "pid=$(runner_state_pid_for_start)" \
  "started_at=$(runner_state_started_at "$started_at")" \
  "last_event_at=${started_at}" \
  "last_result="
runner_append_log "$runner_id" "run_start" \
  "role=${public_role}" \
  "runtime_role=${runtime_role}" \
  "agent=${agent}" \
  "mode=${mode}"

runtime_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-output.XXXXXX")"
runtime_command=("$runtime_path")
if [ "$public_role" = "wiki" ]; then
  runtime_command+=("update" "$project_root" "$board_dir_name")
fi
set +e
AUTOFLOW_ROLE="$runtime_role" \
  AUTOFLOW_WORKER_ID="$runner_id" \
  AUTOFLOW_BACKGROUND=1 \
  AUTOFLOW_BOARD_ROOT="$board_root" \
  AUTOFLOW_PROJECT_ROOT="$project_root" \
  "${runtime_command[@]}" > "$runtime_output" 2>&1
runtime_exit=$?
set -e

runtime_status="$(awk -F= '$1 == "status" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$runtime_output" 2>/dev/null || true)"
active_item="$(awk -F= '$1 == "claimed" || $1 == "verify" || $1 == "plan" { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' "$runtime_output" 2>/dev/null || true)"
[ -n "$active_item" ] || active_item="$(runner_active_state_value "active_item")"
finished_at="$(runner_now_iso)"
runtime_output_log_path="$(persist_run_artifact "$runtime_output" "runtime")"

if [ "$runtime_exit" -eq 0 ]; then
  command_status="ok"
  runner_status="idle"
else
  command_status="failed"
  runner_status="failed"
fi

runner_write_state "$runner_id" \
  "status=${runner_status}" \
  "role=${public_role}" \
  "agent=${agent}" \
  "mode=${mode}" \
  "model=${model}" \
  "reasoning=${reasoning}" \
  "active_item=${active_item}" \
  "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
  "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
  "active_stage=$(runner_active_state_value "active_stage")" \
  "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
  "pid=$(runner_state_pid_for_finish)" \
  "started_at=$(runner_state_started_at "$started_at")" \
  "last_event_at=${finished_at}" \
  "last_result=${runtime_status:-exit_${runtime_exit}}" \
  "last_runtime_log=${runtime_output_log_path}"
runner_append_log "$runner_id" "run_finish" \
  "role=${public_role}" \
  "runtime_status=${runtime_status:-}" \
  "exit_code=${runtime_exit}" \
  "runner_status=${runner_status}"

runtime_reason=""
if [ "$runtime_status" = "blocked" ]; then
  runtime_reason="$(awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' "$runtime_output" 2>/dev/null || true)"
fi
runtime_output_suppressed=""
if [ "$public_role" = "coordinator" ] && [ "$runtime_reason" = "unchanged_problem" ] && grep -Fqx 'coordinator.diagnosis_cached=true' "$runtime_output"; then
  runtime_output_suppressed="unchanged_problem"
fi

print_run_header "$command_status"
printf 'runner_status=%s\n' "$runner_status"
printf 'runtime_script=%s\n' "$runtime_path"
printf 'runtime_status=%s\n' "$runtime_status"
printf 'runtime_exit_code=%s\n' "$runtime_exit"
if [ "$runtime_status" = "blocked" ]; then
  printf 'reason=%s\n' "$runtime_reason"
fi
printf 'active_item=%s\n' "$active_item"
printf 'runtime_output_log_path=%s\n' "$runtime_output_log_path"
printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
if [ -n "$runtime_output_suppressed" ]; then
  printf 'runtime_output_suppressed=%s\n' "$runtime_output_suppressed"
  awk -F= '
    $1 == "doctor_status" ||
    $1 == "coordinator.problem_detected" ||
    $1 == "coordinator.problem_reason" ||
    $1 == "coordinator.diagnosis_attempted" ||
    $1 == "coordinator.diagnosis_cached" ||
    $1 == "coordinator.diagnosis_skipped_reason" ||
    $1 == "coordinator.precheck_active_blocked_ticket_count" ||
    $1 == "coordinator.precheck_active_blocked_tickets" ||
    $1 == "coordinator.operational_blockers" ||
    $1 == "coordinator.shared_path_blocked_ticket_count" ||
    $1 == "coordinator.worktree_issue_count" ||
    $1 == "coordinator.project_root_dirty_overlap_count" ||
    $1 == "coordinator.shared_nonbase_head_group_count" ||
    $1 == "coordinator.ready_to_merge_count" ||
    $1 == "coordinator.merge_attempted" ||
    $1 == "coordinator.next_action" { print }
  ' "$runtime_output"
else
  printf 'runtime_output_begin\n'
  cat "$runtime_output"
  printf 'runtime_output_end\n'
fi
rm -f "$runtime_output"

if [ "$runtime_exit" -ne 0 ]; then
  exit "$runtime_exit"
fi
