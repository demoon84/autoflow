#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

# Thin runtime contract:
# - this entrypoint dispatches one runner tick and exposes state through stable
#   key=value output;
# - it never becomes the workflow brain for planning, verification, recovery, or merge.

usage() {
  cat <<'EOF' >&2
Usage:
  run-role.sh planner [project-root] [board-dir-name] [--runner runner-id] [--dry-run]      # Plan AI (3-runner default)
  run-role.sh ticket [project-root] [board-dir-name] [--runner runner-id] [--dry-run]       # Impl AI (3-runner default)
  run-role.sh wiki [project-root] [board-dir-name] [--runner runner-id] [--dry-run]         # Wiki AI (3-runner default)
  run-role.sh todo [project-root] [board-dir-name] [--runner runner-id] [--dry-run]         # legacy role-pipeline
  run-role.sh coordinator [project-root] [board-dir-name] [--runner runner-id] [--dry-run]  # legacy
  run-role.sh self-improve [project-root] [board-dir-name] [--runner runner-id] [--dry-run] # trial (disabled by default)
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
  wiki|wiki-maintainer)
    public_role="wiki"
    runtime_role="wiki"
    default_runner_id="wiki"
    runtime_script=""
    ;;
  coordinator|coord|doctor|diagnose)
    public_role="coordinator"
    runtime_role="coordinator"
    default_runner_id="coordinator-1"
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
runner_config_fingerprint=""
runner_config_applied_at=""
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

runner_normalize_interval_seconds() {
  local value="${1:-}"

  case "$value" in
    ""|*[!0-9]*)
      printf '60'
      return 0
      ;;
  esac

  if [ "$value" -lt 1 ] || [ "$value" -gt 86400 ]; then
    printf '60'
    return 0
  fi

  printf '%s' "$value"
}

runner_hash_stream() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    cksum | awk '{ print $1 ":" $2 }'
  fi
}

runner_current_config_fingerprint() {
  {
    printf 'role=%s\n' "$configured_role"
    printf 'agent=%s\n' "$agent"
    printf 'model=%s\n' "$model"
    printf 'reasoning=%s\n' "$configured_reasoning"
    printf 'mode=%s\n' "$mode"
    printf 'interval_seconds=%s\n' "$(runner_normalize_interval_seconds "${interval_seconds:-}")"
    printf 'enabled=%s\n' "$enabled"
    printf 'realtime_enabled=%s\n' "${realtime_enabled:-false}"
    printf 'command=%s\n' "$command_value"
  } | runner_hash_stream
}

runner_config_state_fields() {
  printf 'config_fingerprint=%s\n' "${runner_config_fingerprint:-}"
  printf 'applied_config_fingerprint=%s\n' "${runner_config_fingerprint:-}"
  printf 'config_applied_at=%s\n' "${runner_config_applied_at:-}"
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
      planner_actionable_count=$(
        run_role_count_markdown_files "${board_root}/tickets/inbox"
      )
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
    [ -e "$path" ] || [ -n "$(git -C "$git_root" ls-files -- "$path" 2>/dev/null)" ] || continue
    scope_paths+=("$path")
  done < <(role_autocommit_scope_paths)
  [ "${#scope_paths[@]}" -gt 0 ] || return 0

  git -C "$git_root" status --porcelain -- "${scope_paths[@]}" > "$output_file" 2>/dev/null || true
}

role_wiki_normalize_path() {
  local path="$1"
  path="${path#"$board_root"/}"
  path="${path#${board_dir_name}/}"
  path="${path#.autoflow/}"
  printf '%s\n' "$path"
}

role_wiki_path_category() {
  local rel
  rel="$(role_wiki_normalize_path "$1")"
  case "$rel" in
    wiki/answers/*) printf 'answers' ;;
    wiki/learnings/*) printf 'learnings' ;;
    wiki/skills/*) printf 'skills' ;;
    wiki/skills-local/*) printf 'skills-local' ;;
    wiki/features/*) printf 'features' ;;
    wiki/decisions/*) printf 'decisions' ;;
    wiki/sources/*) printf 'sources' ;;
    wiki/operations/*) printf 'operations' ;;
    wiki/architecture/*) printf 'architecture' ;;
    wiki/agents/*) printf 'agents' ;;
    wiki-raw/*) printf 'raw' ;;
    wiki/*) printf 'wiki' ;;
    *) printf 'other' ;;
  esac
}

role_wiki_path_weight() {
  local rel base
  rel="$(role_wiki_normalize_path "$1")"
  base="$(basename "$rel")"
  case "$rel" in
    wiki/index.md|wiki/log.md|*.manifest|*.history|*.fingerprint)
      printf '0'
      return 0
      ;;
  esac
  case "$rel" in
    wiki/answers/*|wiki/learnings/*|wiki/skills/*|wiki/skills-local/*)
      printf '5'
      ;;
    wiki/features/*|wiki/decisions/*)
      printf '3'
      ;;
    wiki/sources/*|wiki/operations/*|wiki/architecture/*|wiki/agents/*|wiki-raw/*|wiki/*)
      printf '1'
      ;;
    *)
      case "$base" in
        *.md|*.txt|*.json|*.jsonl|*.log) printf '1' ;;
        *) printf '0' ;;
      esac
      ;;
  esac
}

role_wiki_commit_threshold() {
  local value="${AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD:-5}"
  case "$value" in
    ''|*[!0-9]*) printf '5' ;;
    *) printf '%s' "$value" ;;
  esac
}

role_wiki_commit_min_lines() {
  local value="${AUTOFLOW_WIKI_COMMIT_MIN_LINES:-30}"
  case "$value" in
    ''|*[!0-9]*) printf '30' ;;
    *) printf '%s' "$value" ;;
  esac
}

role_wiki_staged_diff_stats() {
  local git_root="$1"
  shift
  local status path rest weight category add del line_delta
  local threshold min_lines total_files total_weight added_files deleted_files content_delta
  local line_additions line_deletions
  local primary_category primary_weight gate_reason

  threshold="$(role_wiki_commit_threshold)"
  min_lines="$(role_wiki_commit_min_lines)"
  total_files=0
  total_weight=0
  added_files=0
  deleted_files=0
  line_delta=0
  line_additions=0
  line_deletions=0
  primary_category="none"
  primary_weight=0

  if git -C "$git_root" diff --cached -w --quiet -- "$@"; then
    content_delta=0
  else
    content_delta=1
  fi

  while IFS=$'\t' read -r add del path rest; do
    [ -n "${path:-}" ] || continue
    case "$add" in ''|-) add=0 ;; *[!0-9]*) add=0 ;; esac
    case "$del" in ''|-) del=0 ;; *[!0-9]*) del=0 ;; esac
    line_additions=$((line_additions + add))
    line_deletions=$((line_deletions + del))
    line_delta=$((line_delta + add + del))
  done < <(git -C "$git_root" diff --cached --numstat -- "$@")

  while IFS=$'\t' read -r status path rest; do
    [ -n "${status:-}" ] || continue
    case "$status" in
      R*|C*) path="$rest" ;;
    esac
    [ -n "${path:-}" ] || continue
    weight="$(role_wiki_path_weight "$path")"
    category="$(role_wiki_path_category "$path")"
    total_files=$((total_files + 1))
    total_weight=$((total_weight + weight))
    case "$status" in
      A*) added_files=$((added_files + 1)) ;;
      D*) deleted_files=$((deleted_files + 1)) ;;
    esac
    if [ "$weight" -gt "$primary_weight" ]; then
      primary_weight="$weight"
      primary_category="$category"
    fi
  done < <(git -C "$git_root" diff --cached --name-status -- "$@")

  if [ "$content_delta" -eq 0 ]; then
    gate_reason="cosmetic_only"
  elif [ "$deleted_files" -gt 0 ]; then
    gate_reason="meaningful_delete"
  elif [ "$total_weight" -eq 0 ]; then
    gate_reason="zero_weight"
  elif [ "$total_weight" -lt "$threshold" ]; then
    gate_reason="below_weight_threshold"
  elif [ "$added_files" -gt 0 ]; then
    gate_reason="meaningful_add"
  elif [ "$line_delta" -lt "$min_lines" ]; then
    gate_reason="below_line_threshold"
  else
    gate_reason="meaningful_update"
  fi

  printf 'wiki_commit_weight=%s\n' "$total_weight"
  printf 'wiki_commit_line_delta=%s\n' "$line_delta"
  printf 'wiki_commit_primary_category=%s\n' "$primary_category"
  printf 'wiki_commit_gate_reason=%s\n' "$gate_reason"
  printf 'wiki_commit_total_files=%s\n' "$total_files"
  printf 'wiki_commit_added_files=%s\n' "$added_files"
  printf 'wiki_commit_deleted_files=%s\n' "$deleted_files"
  printf 'wiki_commit_additions=%s\n' "$line_additions"
  printf 'wiki_commit_deletions=%s\n' "$line_deletions"
  printf 'wiki_commit_weight_threshold=%s\n' "$threshold"
  printf 'wiki_commit_min_lines=%s\n' "$min_lines"
}

role_wiki_staged_commit_allowed() {
  local stats="$1" reason
  reason="$(printf '%s\n' "$stats" | sed -n 's/^wiki_commit_gate_reason=//p' | tail -n 1)"
  case "$reason" in
    meaningful_*) return 0 ;;
    *) return 1 ;;
  esac
}

role_wiki_autocommit_message_from_stats() {
  local stats="$1" category total added deleted
  category="$(printf '%s\n' "$stats" | sed -n 's/^wiki_commit_primary_category=//p' | tail -n 1)"
  total="$(printf '%s\n' "$stats" | sed -n 's/^wiki_commit_total_files=//p' | tail -n 1)"
  added="$(printf '%s\n' "$stats" | sed -n 's/^wiki_commit_additions=//p' | tail -n 1)"
  deleted="$(printf '%s\n' "$stats" | sed -n 's/^wiki_commit_deletions=//p' | tail -n 1)"
  printf '[wiki] update: %s / %s total, +%s/-%s\n' "${category:-wiki}" "${total:-0}" "${added:-0}" "${deleted:-0}"
}

role_autocommit_message() {
  local git_root="$1"
  shift
  local project_key source_context

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
        source_context="$(role_autocommit_wiki_source_context)"
        printf '[wiki][source: %s] wiki knowledge update\n' "${source_context:-unknown}"
      fi
      ;;
  esac
}

role_autocommit_wiki_source_context() {
  local latest_source source_project source_ticket

  latest_source="$(find "${board_root}/tickets/done" -type f \( -name 'tickets_[0-9]*.md' -o -name 'prd_[0-9]*.md' \) -exec ls -t {} + 2>/dev/null | head -n 1)"
  [ -n "$latest_source" ] || return 0

  source_project="$(printf '%s\n' "$latest_source" | sed -n 's#.*tickets/done/\(prd_[0-9][0-9]*\)/.*#\1#p' | head -n 1)"
  source_ticket="$(basename "$latest_source" .md | sed -n 's#^\(tickets_[0-9][0-9]*\)$#\1#p')"

  if [ -n "$source_project" ] && [ -n "$source_ticket" ]; then
    printf '%s/%s\n' "$source_project" "$source_ticket"
  elif [ -n "$source_project" ]; then
    printf '%s\n' "$source_project"
  fi
}

role_autocommit_after_adapter() {
  local adapter_exit="$1"
  local before_status_file="$2"
  local git_root path commit_message wiki_commit_stats
  local -a scope_paths=()
  local -a commit_scope_paths=()

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
    [ -e "$path" ] || [ -n "$(git -C "$git_root" ls-files -- "$path" 2>/dev/null)" ] || continue
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

  if [ "$public_role" = "wiki" ]; then
    wiki_commit_stats="$(role_wiki_staged_diff_stats "$git_root" "${scope_paths[@]}")"
    printf '%s\n' "$wiki_commit_stats"
    runner_append_log "$runner_id" "wiki_commit_admission" \
      "role=${public_role}" \
      $(printf '%s\n' "$wiki_commit_stats")
    if ! role_wiki_staged_commit_allowed "$wiki_commit_stats"; then
      git -C "$git_root" restore --staged -- "${scope_paths[@]}" >/dev/null 2>&1 || true
      printf 'autocommit_status=skipped_wiki_commit_gate\n'
      return 0
    fi
    commit_message="$(role_wiki_autocommit_message_from_stats "$wiki_commit_stats")"
  else
    commit_message="$(role_autocommit_message "$git_root" "${scope_paths[@]}")"
  fi
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    commit_scope_paths+=("$path")
  done < <(git -C "$git_root" diff --cached --name-only -- "${scope_paths[@]}" 2>/dev/null)
  if [ "${#commit_scope_paths[@]}" -eq 0 ]; then
    printf 'autocommit_status=no_changes\n'
    return 0
  fi
  git -C "$git_root" commit -m "$commit_message" -- "${commit_scope_paths[@]}" >/dev/null
  printf 'autocommit_status=committed\n'
  printf 'autocommit_hash=%s\n' "$(git -C "$git_root" rev-parse --verify HEAD)"
  printf 'autocommit_message=%s\n' "$commit_message"
}

# adapter_exit==124 (timeout) 시 wiki working tree 의 partial 변경을 폐기한다.
# Opt-in: AUTOFLOW_WIKI_TIMEOUT_DISCARD_PARTIAL=1 일 때만 수행.
# Default 는 비활성 — 다음 tick 의 manifest hash 가 partial 을 input 으로 잡아서 자연 회복한다.
role_post_adapter_cleanup_on_timeout() {
  local adapter_exit="$1"
  local discard_flag git_root wiki_path

  [ "$adapter_exit" -eq 124 ] || return 0
  case "$public_role" in
    wiki) ;;
    *) return 0 ;;
  esac

  discard_flag="${AUTOFLOW_WIKI_TIMEOUT_DISCARD_PARTIAL:-0}"
  case "$discard_flag" in
    ''|0|false|no|off|FALSE|NO|OFF) return 0 ;;
  esac

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -z "$git_root" ]; then
    printf 'wiki_partial_discarded=skipped_not_git_repo\n'
    return 0
  fi

  wiki_path="${board_root}/wiki"
  if [ ! -d "$wiki_path" ]; then
    printf 'wiki_partial_discarded=skipped_no_wiki_dir\n'
    return 0
  fi

  if [ -z "$(git -C "$git_root" status --porcelain -- "$wiki_path" 2>/dev/null)" ]; then
    printf 'wiki_partial_discarded=false\n'
    return 0
  fi

  git -C "$git_root" checkout -- "$wiki_path" 2>/dev/null || true
  git -C "$git_root" clean -fd -- "$wiki_path" 2>/dev/null || true
  printf 'wiki_partial_discarded=true\n'
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

telemetry_file_size_bytes() {
  local file="$1"
  if [ -f "$file" ]; then
    wc -c < "$file" 2>/dev/null | tr -d '[:space:]' || printf '0'
  else
    printf '0'
  fi
}

telemetry_file_size_bytes_without_codex_guard_warnings() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf '0'
    return 0
  fi

  awk '
    /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9](\.[0-9]+)?Z[[:space:]]+WARN codex_core_(plugins::manifest|skills::loader):/ { next }
    { bytes += length($0) + 1 }
    END { printf "%d", bytes + 0 }
  ' "$file" 2>/dev/null || printf '0'
}

telemetry_estimated_tokens_for_file() {
  local file="$1"
  local byte_count

  byte_count="$(telemetry_file_size_bytes_without_codex_guard_warnings "$file")"
  case "$byte_count" in
    ''|*[!0-9]*) byte_count=0 ;;
  esac
  if [ "$byte_count" -le 0 ]; then
    printf '0'
    return 0
  fi
  printf '%s' $(((byte_count + 3) / 4))
}

telemetry_positive_integer_or_zero() {
  local value="$1"

  case "$value" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$value" ;;
  esac
}

telemetry_max_row_tokens() {
  local value="${AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS:-100000000}"

  case "$value" in
    ''|*[!0-9]*|0) value=100000000 ;;
  esac
  printf '%s' "$value"
}

telemetry_extract_token_components_from_logs() {
  awk '
    function first_number(value) {
      gsub(/,/, "", value)
      if (match(value, /[0-9]+/)) {
        return substr(value, RSTART, RLENGTH) + 0
      }
      return 0
    }

    function add_token_key_value(key, value, lower_key) {
      lower_key = tolower(key)
      if (value <= 0) {
        return
      }
      if (lower_key ~ /total/) {
        total += value
      } else if (lower_key ~ /(prompt|input|cache|cached)/) {
        input += value
      } else if (lower_key ~ /(completion|output|candidate|reasoning)/) {
        output += value
      }
    }

    function scan_json_token_keys(value, fragment, key, number_text) {
      while (match(value, /"[^"]*(token|Token)[^"]*"[[:space:]]*:[[:space:]]*[0-9][0-9,]*/)) {
        fragment = substr(value, RSTART, RLENGTH)
        key = fragment
        sub(/^"/, "", key)
        sub(/".*/, "", key)
        number_text = fragment
        sub(/^.*:[[:space:]]*/, "", number_text)
        gsub(/,/, "", number_text)
        add_token_key_value(key, number_text + 0)
        value = substr(value, RSTART + RLENGTH)
      }
    }

    function is_trusted_usage_json(value, lower_value) {
      lower_value = tolower(value)
      return lower_value ~ /^[[:space:]]*\{/ && lower_value ~ /"usage(metadata)?"[[:space:]]*:/
    }

    function is_claude_intermediate_stream_event(value, lower_value) {
      # claude stream-json emits a `usage` field on every assistant / user /
      # stream_event message and a final cumulative one on the result event.
      # Only the result event holds authoritative per-turn totals — summing the
      # intermediates would multi-count by 10x+.
      lower_value = tolower(value)
      return lower_value ~ /^[[:space:]]*\{/ && lower_value ~ /"type"[[:space:]]*:[[:space:]]*"(assistant|user|stream_event|system|message_delta|tool_use|partial)"/
    }

    function is_codex_intermediate_stream_event(value, lower_value) {
      # codex --json emits item.completed with embedded aggregated_output that
      # may itself include past telemetry JSON ("usage": {"input_tokens":...}).
      # Only turn.completed carries authoritative cumulative usage. Skip every
      # other codex stream event to prevent ghost-summing of nested JSON.
      lower_value = tolower(value)
      return lower_value ~ /^[[:space:]]*\{/ && lower_value ~ /"type"[[:space:]]*:[[:space:]]*"(thread\.started|turn\.started|item\.started|item\.completed|message_delta|tool_use|partial)"/
    }

    {
      line = $0
      gsub(/\r$/, "", line)
      gsub(/\033\[[0-9;?]*[A-Za-z]/, "", line)
      lower = tolower(line)
      if (pending_total) {
        if (lower ~ /^[[:space:]]*[0-9][0-9,]*[[:space:]]*$/) {
          total += first_number(lower)
          pending_total = 0
          next
        }
        pending_total = 0
      }

      if (is_claude_intermediate_stream_event(line)) {
        next
      }

      if (is_codex_intermediate_stream_event(line)) {
        next
      }

      if (is_trusted_usage_json(line)) {
        scan_json_token_keys(line)
      }

      if (lower ~ /^[[:space:]]*tokens[[:space:]]+used[[:space:]]*$/) {
        pending_total = 1
        next
      }
      if (lower ~ /^[[:space:]]*tokens[[:space:]]+used[^0-9]*[0-9]/) {
        value = first_number(lower)
        total += value
        next
      }

      if (lower ~ /^[[:space:]]*(total[_ -]?tokens|totaltokens)[^0-9]*[0-9]/) {
        value = first_number(lower)
        total += value
        next
      }

      if (lower ~ /^[[:space:]]*(input|prompt|cache|cached)[_ -]?tokens[^0-9]*[0-9]/) {
        value = first_number(lower)
        input += value
        next
      }
      if (lower ~ /^[[:space:]]*(input|prompt|cache|cached)tokens[^0-9]*[0-9]/) {
        value = first_number(lower)
        input += value
        next
      }

      if (lower ~ /^[[:space:]]*(output|completion|reasoning)[_ -]?tokens[^0-9]*[0-9]/) {
        value = first_number(lower)
        output += value
        next
      }
      if (lower ~ /^[[:space:]]*(output|completion|reasoning)tokens[^0-9]*[0-9]/) {
        value = first_number(lower)
        output += value
        next
      }
    }

    END {
      printf "%d %d %d\n", input, output, total
    }
  ' "$@" 2>/dev/null || printf '0 0 0\n'
}

telemetry_adapter_token_usage() {
  local prompt_file="$1"
  local stdout_file="$2"
  local stderr_file="$3"
  local adapter_exit="$4"
  local parsed token_input token_output token_total estimated_input estimated_output row_total max_row_tokens

  parsed="$(telemetry_extract_token_components_from_logs "$stdout_file" "$stderr_file")"
  token_input="$(telemetry_positive_integer_or_zero "$(printf '%s' "$parsed" | awk '{print $1}')")"
  token_output="$(telemetry_positive_integer_or_zero "$(printf '%s' "$parsed" | awk '{print $2}')")"
  token_total="$(telemetry_positive_integer_or_zero "$(printf '%s' "$parsed" | awk '{print $3}')")"
  max_row_tokens="$(telemetry_max_row_tokens)"

  if [ "$token_total" -gt 0 ] && [ $((token_input + token_output)) -le 0 ]; then
    estimated_output="$(telemetry_estimated_tokens_for_file "$stdout_file")"
    if [ "$estimated_output" -gt 0 ] && [ "$token_total" -gt 1 ]; then
      if [ "$estimated_output" -ge "$token_total" ]; then
        token_output=1
      else
        token_output="$estimated_output"
      fi
      token_input=$((token_total - token_output))
    else
      token_input="$token_total"
      token_output=0
    fi
  fi

  row_total=$((token_input + token_output))
  if [ "$token_input" -ge "$max_row_tokens" ] || [ "$token_output" -ge "$max_row_tokens" ] || [ "$row_total" -ge "$max_row_tokens" ]; then
    token_input=0
    token_output=0
  fi

  if [ "$adapter_exit" -ne 127 ] && [ $((token_input + token_output)) -le 0 ]; then
    # When the adapter stdout is JSONL (claude stream-json or codex --json),
    # the only authoritative token usage is the final result/turn.completed
    # event. If it never arrived (early termination, partial output), the
    # `byte_count / 4` heuristic is wildly inaccurate because JSONL byte size
    # is dominated by event wrappers, not model tokens. Record 0 in that case
    # so the dashboard does not inflate with phantom estimates.
    if [ -f "$stdout_file" ] && head -c 1 "$stdout_file" 2>/dev/null | grep -q '^{'; then
      token_input=0
      token_output=0
    else
      estimated_input="$(telemetry_estimated_tokens_for_file "$prompt_file")"
      estimated_output="$(( $(telemetry_estimated_tokens_for_file "$stdout_file") + $(telemetry_estimated_tokens_for_file "$stderr_file") ))"
      [ "$estimated_input" -gt 0 ] || estimated_input=1
      [ "$estimated_output" -gt 0 ] || estimated_output=1
      token_input="$estimated_input"
      token_output="$estimated_output"
    fi
  fi

  printf '%s %s\n' "$token_input" "$token_output"
}

run_role_record_worker_tick_telemetry() {
  local started_at="$1"
  local ended_at="$2"
  local adapter_exit="$3"
  local adapter_stdout_path="$4"
  local adapter_stderr_path="$5"
  local prompt_path="$6"
  local telemetry_script telemetry_result telemetry_failure_class
  local start_epoch end_epoch duration_ms
  local token_pair token_input token_output stdout_bytes stderr_bytes ticket_ref

  telemetry_script="${SCRIPT_DIR}/telemetry-project.sh"
  [ -x "$telemetry_script" ] || return 0

  start_epoch="$(telemetry_timestamp_to_epoch "$started_at" || true)"
  end_epoch="$(telemetry_timestamp_to_epoch "$ended_at" || true)"
  if [ -n "$start_epoch" ] && [ -n "$end_epoch" ] && [ "$end_epoch" -ge "$start_epoch" ]; then
    duration_ms=$(((end_epoch - start_epoch) * 1000))
  else
    duration_ms=0
  fi

  case "$adapter_exit" in
    0)
      telemetry_result="success"
      telemetry_failure_class=""
      ;;
    124)
      telemetry_result="killed"
      telemetry_failure_class="adapter_timeout"
      ;;
    *)
      telemetry_result="failed"
      telemetry_failure_class="adapter_exit_${adapter_exit}"
      ;;
  esac

  if [ "$telemetry_result" != "success" ] && [ -f "$adapter_stderr_path" ] && [ -s "$adapter_stderr_path" ] && [ -z "$telemetry_failure_class" ]; then
    telemetry_failure_class="adapter_stderr_nonempty"
  fi

  if [ "$telemetry_result" != "success" ] && [ -z "$telemetry_failure_class" ]; then
    telemetry_failure_class="unknown_failure"
  fi

  token_pair="$(telemetry_adapter_token_usage "$prompt_path" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_exit")"
  token_input="$(telemetry_positive_integer_or_zero "$(printf '%s' "$token_pair" | awk '{print $1}')")"
  token_output="$(telemetry_positive_integer_or_zero "$(printf '%s' "$token_pair" | awk '{print $2}')")"
  stdout_bytes="$(telemetry_positive_integer_or_zero "$(telemetry_file_size_bytes "$adapter_stdout_path")")"
  stderr_bytes="$(telemetry_positive_integer_or_zero "$(telemetry_file_size_bytes "$adapter_stderr_path")")"
  ticket_ref="$(runner_adapter_state_value "active_ticket_id")"

  if [ "$telemetry_result" != "success" ]; then
    "$telemetry_script" record \
      --project-root "$project_root" \
      --runner "$runner_id" \
      --result "$telemetry_result" \
      --started-at "$started_at" \
      --ended-at "$ended_at" \
      --duration-ms "$duration_ms" \
      --token-input "$token_input" \
      --token-output "$token_output" \
      --ticket-id "$ticket_ref" \
      --prd-key "$(runner_adapter_state_value "active_spec_ref")" \
      --model "$model" \
      --stdout-bytes "$stdout_bytes" \
      --stderr-bytes "$stderr_bytes" \
      --failure-class "$telemetry_failure_class" \
      >/dev/null 2>&1 || true
    return 0
  fi

  "$telemetry_script" record \
    --project-root "$project_root" \
    --runner "$runner_id" \
    --result "$telemetry_result" \
    --started-at "$started_at" \
    --ended-at "$ended_at" \
    --duration-ms "$duration_ms" \
    --token-input "$token_input" \
    --token-output "$token_output" \
    --ticket-id "$ticket_ref" \
    --prd-key "$(runner_adapter_state_value "active_spec_ref")" \
    --model "$model" \
    --stdout-bytes "$stdout_bytes" \
    --stderr-bytes "$stderr_bytes" \
    >/dev/null 2>&1 || true
}

planner_ticket_field() {
  local file="$1"
  local section="$2"
  local field="$3"

  ticket_goal_common_call extract_scalar_field_in_section "$file" "$section" "$field" 2>/dev/null || true
}

runner_ticket_is_parked_needs_user() {
  local ticket_file="$1"
  local recovery_status failure_class

  [ -f "$ticket_file" ] || return 1
  recovery_status="$(planner_ticket_field "$ticket_file" "Recovery State" "Status")"
  [ "$recovery_status" = "needs_user" ] || return 1
  failure_class="$(planner_ticket_field "$ticket_file" "Recovery State" "Failure Class")"
  [ "$failure_class" != "needs_user_decision" ] || return 1

  grep -Eiq \
    'outside the worker claim queue|Do not loop|do not loop|Parked needs_user|Planner parking: source=inprogress-needs-user-parked|no physical worktree remains' \
    "$ticket_file"
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

runner_ticket_allowed_paths_dirty() {
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

runner_repairing_timeout_seconds() {
  local value="${AUTOFLOW_REPAIRING_TIMEOUT_SECONDS:-1800}"

  case "$value" in
    ''|*[!0-9]*) value=1800 ;;
  esac
  [ "$value" -gt 0 ] || value=1800
  printf '%s' "$value"
}

runner_iso_to_epoch() {
  local value="${1:-}"

  [ -n "$value" ] || return 1
  if date -u -d "$value" +%s >/dev/null 2>&1; then
    date -u -d "$value" +%s
    return 0
  fi
  if date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$value" +%s >/dev/null 2>&1; then
    date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$value" +%s
    return 0
  fi
  return 1
}

runner_ticket_repairing_age_seconds() {
  local ticket_file="$1"
  local timestamp then_epoch now_epoch

  for timestamp in \
    "$(planner_ticket_field "$ticket_file" "Recovery State" "Last Recovery At")" \
    "$(planner_ticket_field "$ticket_file" "Goal Runtime" "Updated At")" \
    "$(planner_ticket_field "$ticket_file" "Ticket" "Last Updated")"; do
    timestamp="$(printf '%s' "$timestamp" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$timestamp" ] || continue
    then_epoch="$(runner_iso_to_epoch "$timestamp" || true)"
    [ -n "$then_epoch" ] || continue
    now_epoch="$(date -u +%s)"
    printf '%s' "$((now_epoch - then_epoch))"
    return 0
  done

  return 1
}

runner_ticket_repairing_timeout_stale() {
  local ticket_file="$1"
  local age_seconds timeout_seconds

  [ "$(planner_ticket_field "$ticket_file" "Recovery State" "Status")" = "repairing" ] || return 1
  age_seconds="$(runner_ticket_repairing_age_seconds "$ticket_file" || true)"
  [ -n "$age_seconds" ] || return 1
  timeout_seconds="$(runner_repairing_timeout_seconds)"
  [ "$age_seconds" -ge "$timeout_seconds" ]
}

runner_clear_stale_active_ticket_state() {
  local reason="$1"
  local ticket_file="$2"
  local field

  for field in \
    active_item \
    active_ticket_id \
    active_ticket_title \
    active_ticket_path \
    active_stage \
    active_spec_ref \
    active_recovery_reason \
    active_recovery_status \
    active_recovery_failure_class \
    active_recovery_worktree_path \
    active_recovery_worktree_status \
    active_recovery_board_state; do
    runner_replace_state_field_preserving "$runner_id" "$field" "" || true
  done
  runner_replace_state_field_preserving "$runner_id" "last_result" "" || true
  AUTOFLOW_ROLE="ticket-owner" AUTOFLOW_WORKER_ID="$runner_id" \
    ticket_goal_common_call clear_active_ticket_context_record >/dev/null 2>&1 || true
  runner_append_log "$runner_id" "stale_active_ticket_cleared" \
    "role=${public_role}" \
    "reason=${reason}" \
    "ticket=$(runner_board_relative_path "$ticket_file")"
}

clear_parked_or_stale_repairing_active_ticket_before_dispatch() {
  local active_item active_ticket_id ticket_file stage recovery_status

  [ "$public_role" = "ticket" ] || return 0

  active_item="$(runner_state_field "$runner_id" "active_item" 2>/dev/null || true)"
  active_ticket_id="$(runner_state_field "$runner_id" "active_ticket_id" 2>/dev/null || true)"
  ticket_file="$(runner_active_ticket_file_from_item "$active_item" 2>/dev/null || true)"
  if [ -z "$ticket_file" ] && [ -n "$active_ticket_id" ]; then
    ticket_file="$(runner_active_ticket_file_from_item "$active_ticket_id" 2>/dev/null || true)"
  fi
  [ -n "$ticket_file" ] && [ -f "$ticket_file" ] || return 0

  case "$(planner_ticket_board_state "$ticket_file")" in
    done|rejected)
      runner_clear_stale_active_ticket_state "resolved_active_ticket_state" "$ticket_file"
      return 0
      ;;
  esac

  stage="$(planner_ticket_field "$ticket_file" "Ticket" "Stage")"
  recovery_status="$(planner_ticket_field "$ticket_file" "Recovery State" "Status")"
  if [ "$stage" = "blocked" ] && [ "$recovery_status" = "needs_user" ]; then
    runner_clear_stale_active_ticket_state "parked_needs_user_active_item" "$ticket_file"
    return 0
  fi
  if runner_ticket_repairing_timeout_stale "$ticket_file"; then
    runner_clear_stale_active_ticket_state "stale_repairing_active_item" "$ticket_file"
  fi
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
    "${board_root}/tickets/inprogress/"*|"${board_root}/tickets/ready-to-merge/"*|"${board_root}/tickets/merge-blocked/"*|"${board_root}/tickets/todo/"*)
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
    runner_ticket_is_parked_needs_user "$file" && continue

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
  local root rel_dir dir file rel checksum

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

wiki_manifest_change_stats() {
  local current_manifest="$1"
  local previous_manifest="$2"
  local changed_paths_file total_count meaningful_count telemetry_count path weight
  local meaningful_weight primary_category primary_weight category

  changed_paths_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-wiki-changed-paths.XXXXXX")"
  if [ -f "$previous_manifest" ]; then
    LC_ALL=C comm -3 "$current_manifest" <(LC_ALL=C sort "$previous_manifest") 2>/dev/null |
      awk 'NF { $1=""; sub(/^  */, ""); print }' |
      LC_ALL=C sort -u > "$changed_paths_file"
  else
    awk 'NF { $1=""; sub(/^  */, ""); print }' "$current_manifest" |
      LC_ALL=C sort -u > "$changed_paths_file"
  fi

  total_count=0
  meaningful_count=0
  meaningful_weight=0
  primary_category="none"
  primary_weight=0
  telemetry_count=0
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    total_count=$((total_count + 1))
    weight="$(role_wiki_path_weight "$path")"
    category="$(role_wiki_path_category "$path")"
    meaningful_weight=$((meaningful_weight + weight))
    if [ "$weight" -gt "$primary_weight" ]; then
      primary_weight="$weight"
      primary_category="$category"
    fi
    case "$path" in
      wiki/operations/runner-health.md|wiki/operations/runner-timing.md|wiki/agents/prompt-evolution.md)
        telemetry_count=$((telemetry_count + 1))
        ;;
      *)
        meaningful_count=$((meaningful_count + 1))
        ;;
    esac
  done < "$changed_paths_file"
  rm -f "$changed_paths_file"

  printf 'total_changed_count=%s\n' "$total_count"
  printf 'meaningful_changed_count=%s\n' "$meaningful_count"
  printf 'meaningful_changed_weight=%s\n' "$meaningful_weight"
  printf 'primary_changed_category=%s\n' "$primary_category"
  printf 'telemetry_summary_changed_count=%s\n' "$telemetry_count"
}

idle_preflight_inputs_hash_stream() {
  local rel_dir dir file rel checksum

  case "$public_role" in
    planner)
      # Planner idle-skip fingerprints should only cover planner-owned input
      # queues. Worker progress/done churn is checked separately by
      # planner_orchestration_signal; including it here re-opens the LLM on
      # every completion even when there is no actionable planning input.
      set -- tickets/inbox tickets/backlog tickets/reject tickets/plan plan
      ;;
    ticket)
      set -- tickets/todo tickets/inprogress
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
  printf 'narrative=Plan AI · 복구 입력 변동 없음 — 동일 fingerprint(%s) 유지. 다음 tick 까지 idle.\n' "${adapter_active_ticket_id:-no-ticket}"
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

maybe_skip_stale_planner_recovery_before_adapter() {
  local requested_item requested_is_active_queue="false"
  local current_ticket_file current_board_state="missing" timestamp

  [ "$public_role" = "planner" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ -n "${adapter_active_recovery_reason:-}" ] || return 1

  case "${adapter_active_recovery_reason}" in
    resolved_ticket_worktree_dirty|resolved_ticket_worktree_leftover)
      return 1
      ;;
  esac

  requested_item="${adapter_active_ticket_file:-${adapter_active_ticket_id:-}}"
  [ -n "$requested_item" ] || return 1
  case "$requested_item" in
    "${board_root}/tickets/inprogress/"*|\
    "${board_root}/tickets/ready-to-merge/"*|\
    "${board_root}/tickets/merge-blocked/"*|\
    "${board_root}/tickets/todo/"*|\
    tickets/inprogress/*|\
    tickets/ready-to-merge/*|\
    tickets/merge-blocked/*|\
    tickets/todo/*)
      requested_is_active_queue="true"
      ;;
  esac
  [ "$requested_is_active_queue" = "true" ] || return 1

  current_ticket_file="$(runner_active_ticket_file_from_item "$requested_item" 2>/dev/null || true)"
  if [ -z "$current_ticket_file" ] && [ -n "${adapter_active_ticket_id:-}" ]; then
    current_ticket_file="$(runner_active_ticket_file_from_item "$adapter_active_ticket_id" 2>/dev/null || true)"
  fi
  if [ -n "$current_ticket_file" ]; then
    current_board_state="$(planner_ticket_board_state "$current_ticket_file")"
  fi
  case "$current_board_state" in
    done|rejected|missing)
      ;;
    *)
      return 1
      ;;
  esac

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
    "active_recovery_reason=" \
    "active_recovery_status=" \
    "active_recovery_failure_class=" \
    "active_recovery_worktree_path=" \
    "active_recovery_worktree_status=" \
    "active_recovery_board_state=" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=planner_stale_recovery_resolved_skipped" \
    "last_runtime_log=$(runner_adapter_preserved_state_value "last_runtime_log")"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=planner_stale_recovery_resolved_skipped" \
    "recovery_reason=${adapter_active_recovery_reason}" \
    "stale_active_item=${requested_item}" \
    "active_ticket_id=${adapter_active_ticket_id}" \
    "current_board_state=${current_board_state}" \
    "current_ticket=$(runner_board_relative_path "$current_ticket_file")"

  rm -f "${prompt_file:-}" "${autocommit_before_status:-}" \
    "${adapter_stdout:-}" "${adapter_stderr:-}" "${adapter_last_message:-}"

  print_run_header "ok"
  printf 'narrative=Plan AI · 이미 완료/반려된 복구 신호라 adapter 호출을 생략했습니다: %s (%s).\n' "${adapter_active_ticket_id:-no-ticket}" "$current_board_state"
  printf 'runner_status=idle\n'
  printf 'reason=planner_stale_recovery_resolved_skipped\n'
  printf 'recovery_reason=%s\n' "$adapter_active_recovery_reason"
  printf 'stale_active_item=%s\n' "$requested_item"
  printf 'active_ticket_id=%s\n' "$adapter_active_ticket_id"
  printf 'current_board_state=%s\n' "$current_board_state"
  printf 'current_ticket=%s\n' "$(runner_board_relative_path "$current_ticket_file")"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  exit 0
}

clear_finished_ticket_active_state_if_resolved() {
  local requested_item current_ticket_file current_board_state="missing"
  local requested_is_active_queue="false"

  [ "$public_role" = "ticket" ] || return 0
  [ "${runner_status:-}" = "idle" ] || return 0
  [ "${adapter_exit:-1}" -eq 0 ] || return 0

  requested_item="${finished_active_item:-${finished_active_ticket_id:-}}"
  [ -n "$requested_item" ] || return 0
  case "$requested_item" in
    "${board_root}/tickets/inprogress/"*|\
    "${board_root}/tickets/ready-to-merge/"*|\
    "${board_root}/tickets/merge-blocked/"*|\
    "${board_root}/tickets/todo/"*|\
    tickets/inprogress/*|\
    tickets/ready-to-merge/*|\
    tickets/merge-blocked/*|\
    tickets/todo/*|\
    tickets_[0-9]*)
      requested_is_active_queue="true"
      ;;
  esac
  [ "$requested_is_active_queue" = "true" ] || return 0

  current_ticket_file="$(runner_active_ticket_file_from_item "$requested_item" 2>/dev/null || true)"
  if [ -z "$current_ticket_file" ] && [ -n "${finished_active_ticket_id:-}" ]; then
    current_ticket_file="$(runner_active_ticket_file_from_item "$finished_active_ticket_id" 2>/dev/null || true)"
  fi
  if [ -n "$current_ticket_file" ]; then
    current_board_state="$(planner_ticket_board_state "$current_ticket_file")"
  fi
  case "$current_board_state" in
    done|rejected|missing)
      ;;
    *)
      return 0
      ;;
  esac

  runner_append_log "$runner_id" "active_ticket_resolved_after_adapter" \
    "role=${public_role}" \
    "stale_active_item=${requested_item}" \
    "active_ticket_id=${finished_active_ticket_id}" \
    "current_board_state=${current_board_state}" \
    "current_ticket=$(runner_board_relative_path "$current_ticket_file")"

  finished_active_item=""
  finished_active_ticket_id=""
  finished_active_ticket_title=""
  finished_active_stage=""
  finished_active_spec_ref=""
  finished_active_recovery_reason=""
  finished_active_recovery_status=""
  finished_active_recovery_failure_class=""
  finished_active_recovery_worktree_path=""
  finished_active_recovery_worktree_status=""
  finished_active_recovery_board_state=""
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
  printf 'narrative=Plan AI · 사용자 결정 대기(needs_user_decision) — 티켓 %s. 새 입력이 들어올 때까지 idle.\n' "${adapter_active_ticket_id:-no-ticket}"
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

maybe_skip_planner_parked_needs_user_preflight() {
  local preflight_status="$1"
  local preflight_reason="$2"
  local preflight_output="$3"
  local preflight_log_path="$4"
  local source blocked_origin recovery_state failure_class timestamp
  local parked_ticket_file parked_ticket_id parked_ticket_title parked_ticket_stage parked_spec_ref
  local state_active_item state_active_ticket_id state_active_ticket_title state_active_stage state_active_spec_ref
  local state_recovery_reason state_recovery_status state_recovery_failure_class
  local result_reason runtime_reason

  [ "$public_role" = "planner" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "$preflight_status" = "ok" ] || return 1

  source="$(awk -F= '$1 == "source" { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  blocked_origin="$(awk -F= '$1 == "blocked_origin" { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  recovery_state="$(awk -F= '$1 == "recovery_state" { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  failure_class="$(awk -F= '$1 == "failure_class" { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  if [ -z "$blocked_origin" ]; then
    blocked_origin="$(awk -F= '$1 ~ /^blocked_recover_skip\.[0-9]+$/ { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  fi
  if [ -z "$recovery_state" ]; then
    recovery_state="$(awk -F= '$1 ~ /^blocked_recover_skip\.[0-9]+\.recovery_state$/ { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  fi
  if [ -z "$failure_class" ]; then
    failure_class="$(awk -F= '$1 ~ /^blocked_recover_skip\.[0-9]+\.failure_class$/ { sub(/^[^=]*=/, "", $0); print; exit }' "$preflight_output" 2>/dev/null || true)"
  fi
  if [ "$source" != "inprogress-needs-user-parked" ]; then
    [ -z "$source" ] || return 1
    [ "$recovery_state" = "needs_user" ] || return 1
  fi
  [ -n "$blocked_origin" ] || return 1
  [ -n "$recovery_state" ] || recovery_state="needs_user"
  state_recovery_reason="recovery_state_${recovery_state}"
  runtime_reason="${preflight_reason:-no_actionable_plan_input}"

  if [ "$failure_class" != "needs_user_decision" ]; then
    local other_recovery_output other_recovery_ticket
    other_recovery_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-other-recovery.XXXXXX")"
    if planner_orchestration_signal > "$other_recovery_output"; then
      other_recovery_ticket="$(awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); print; exit }' "$other_recovery_output" 2>/dev/null || true)"
      rm -f "$other_recovery_output"
      if [ -n "$other_recovery_ticket" ] && [ "$other_recovery_ticket" != "$blocked_origin" ]; then
        return 1
      fi
    else
      rm -f "$other_recovery_output"
    fi
  fi

  parked_ticket_file="$(runner_active_ticket_file_from_item "$blocked_origin" 2>/dev/null || true)"
  parked_ticket_id=""
  parked_ticket_title=""
  parked_ticket_stage=""
  parked_spec_ref=""
  if [ -n "$parked_ticket_file" ] && [ -f "$parked_ticket_file" ]; then
    parked_ticket_id="$(runner_ticket_id_from_active_item "$parked_ticket_file")"
    parked_ticket_title="$(planner_ticket_field "$parked_ticket_file" "Ticket" "Title")"
    parked_ticket_stage="$(planner_ticket_field "$parked_ticket_file" "Ticket" "Stage")"
    parked_spec_ref="$(planner_ticket_field "$parked_ticket_file" "Ticket" "PRD Key")"
    [ -n "$parked_spec_ref" ] || parked_spec_ref="$(planner_ticket_field "$parked_ticket_file" "References" "PRD")"
  fi

  state_active_item=""
  state_active_ticket_id=""
  state_active_ticket_title=""
  state_active_stage=""
  state_active_spec_ref=""
  state_recovery_status=""
  state_recovery_failure_class=""
  result_reason="planner_parked_needs_user_skipped"
  if [ "$failure_class" = "needs_user_decision" ]; then
    state_active_item="$blocked_origin"
    state_active_ticket_id="$parked_ticket_id"
    state_active_ticket_title="$parked_ticket_title"
    state_active_stage="$parked_ticket_stage"
    state_active_spec_ref="$parked_spec_ref"
    state_recovery_status="$recovery_state"
    state_recovery_failure_class="$failure_class"
    result_reason="planner_needs_user_decision_waiting"
  fi

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=${state_active_item}" \
    "active_ticket_id=${state_active_ticket_id}" \
    "active_ticket_title=${state_active_ticket_title}" \
    "active_stage=${state_active_stage}" \
    "active_spec_ref=${state_active_spec_ref}" \
    "active_recovery_reason=$([ -n "$state_recovery_status" ] && printf '%s' "$state_recovery_reason")" \
    "active_recovery_status=${state_recovery_status}" \
    "active_recovery_failure_class=${state_recovery_failure_class}" \
    "active_recovery_worktree_path=" \
    "active_recovery_worktree_status=" \
    "active_recovery_board_state=" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=${result_reason}" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=${result_reason}" \
    "source=${source:-blocked_recover_skip}" \
    "parked_ticket=${blocked_origin}" \
    "failure_class=${failure_class}"

  print_run_header "ok"
  printf 'narrative=Plan AI · parked needs_user 처리 — adapter 호출 없이 idle.\n'
  printf 'runner_status=idle\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=0\n'
  printf 'reason=%s\n' "$result_reason"
  printf 'runtime_reason=%s\n' "$runtime_reason"
  printf 'recovery_reason=%s\n' "$state_recovery_reason"
  printf 'active_item=%s\n' "$state_active_item"
  printf 'active_ticket_id=%s\n' "$state_active_ticket_id"
  printf 'active_recovery_status=%s\n' "$state_recovery_status"
  printf 'active_recovery_failure_class=%s\n' "$state_recovery_failure_class"
  printf 'parked_ticket=%s\n' "$blocked_origin"
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  rm -f "$preflight_output"
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

  if [ "$public_role" = "planner" ] && [ "$preflight_status" = "idle" ] && [ "$preflight_reason" = "no_actionable_plan_input" ]; then
    skip_reason="planner_no_actionable_input"
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
    printf 'narrative=%s · 처리할 planner 입력 없음(%s) — adapter 호출 없이 idle.\n' "${public_role}" "${skip_reason}"
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
  fi

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
  printf 'narrative=%s · 새 입력 없음(%s) — 동일 fingerprint 유지. 다음 tick 까지 idle.\n' "${public_role}" "${skip_reason}"
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
    $(runner_config_state_fields) \
    "active_item=" \
    "active_ticket_id=" \
    "active_ticket_title=" \
    "active_stage=" \
    "active_spec_ref=" \
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
  printf 'narrative=Wiki AI · wiki 입력 변동 없음 — 동일 fingerprint 유지. 다음 tick 까지 idle.\n'
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
  local manifest_path changed_count changed_weight primary_category total_changed_count telemetry_summary_changed_count now_epoch
  local pending_since_epoch pending_age min_changes max_age_seconds
  local last_synth_at_epoch synth_age timestamp fingerprint_path change_stats

  [ "$public_role" = "wiki" ] || return 1
  [ "${mode:-}" = "loop" ] || return 1
  [ "$dry_run" = "false" ] || return 1
  [ "${AUTOFLOW_WIKI_IDLE_SKIP:-1}" != "0" ] || return 1
  [ "${AUTOFLOW_WIKI_DEBOUNCE:-1}" != "0" ] || return 1

  wiki_compute_inputs_state

  min_changes="${AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES:-3}"
  max_age_seconds="${AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS:-1800}"

  manifest_path="$(wiki_inputs_manifest_path)"
  change_stats="$(wiki_manifest_change_stats "$WIKI_CURRENT_MANIFEST_PATH" "$manifest_path")"
  total_changed_count="$(printf '%s\n' "$change_stats" | sed -n 's/^total_changed_count=//p' | tail -n 1)"
  changed_count="$(printf '%s\n' "$change_stats" | sed -n 's/^meaningful_changed_count=//p' | tail -n 1)"
  changed_weight="$(printf '%s\n' "$change_stats" | sed -n 's/^meaningful_changed_weight=//p' | tail -n 1)"
  primary_category="$(printf '%s\n' "$change_stats" | sed -n 's/^primary_changed_category=//p' | tail -n 1)"
  telemetry_summary_changed_count="$(printf '%s\n' "$change_stats" | sed -n 's/^telemetry_summary_changed_count=//p' | tail -n 1)"
  total_changed_count="${total_changed_count:-0}"
  changed_count="${changed_count:-0}"
  changed_weight="${changed_weight:-0}"
  primary_category="${primary_category:-none}"
  telemetry_summary_changed_count="${telemetry_summary_changed_count:-0}"

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

  # Debounce is defined in terms of meaningful change count. Weight is still
  # surfaced for commit-gating/diagnostics, but using it here made a single
  # high-weight learned-skill file open the wiki adapter on every tick.
  if [ "$changed_count" -gt 0 ] && { [ "$changed_count" -ge "$min_changes" ] || [ "$pending_age" -ge "$max_age_seconds" ]; }; then
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
    $(runner_config_state_fields) \
    "active_item=" \
    "active_ticket_id=" \
    "active_ticket_title=" \
    "active_stage=" \
    "active_spec_ref=" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=wiki_debounced"
  runner_append_log "$runner_id" "adapter_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=wiki_debounced" \
    "changed_count=${changed_count}" \
    "wiki_commit_weight=${changed_weight}" \
    "wiki_commit_line_delta=0" \
    "wiki_commit_primary_category=${primary_category}" \
    "wiki_commit_gate_reason=debounced" \
    "total_changed_count=${total_changed_count}" \
    "telemetry_summary_changed_count=${telemetry_summary_changed_count}" \
    "pending_since_epoch=${pending_since_epoch}" \
    "pending_age_seconds=${pending_age}" \
    "min_changes=${min_changes}" \
    "max_age_seconds=${max_age_seconds}" \
    "last_synth_age_seconds=${synth_age}"

  print_run_header "ok"
  printf 'narrative=Wiki AI · debounce 대기 중 — 의미 변경 %s건 / 최소 %s건, telemetry summary 변경 %s건, 누적 %ss / 최대 %ss. 다음 tick 까지 idle.\n' "$changed_count" "$min_changes" "$telemetry_summary_changed_count" "$pending_age" "$max_age_seconds"
  printf 'runner_status=idle\n'
  printf 'adapter=%s\n' "$agent"
  printf 'reason=wiki_debounced\n'
  run_wiki_curator_idle_best_effort
  printf 'wiki_inputs_fingerprint=%s\n' "$WIKI_CURRENT_FINGERPRINT"
  printf 'fingerprint_path=%s\n' "$fingerprint_path"
  printf 'changed_count=%s\n' "$changed_count"
  printf 'wiki_commit_weight=%s\n' "$changed_weight"
  printf 'wiki_commit_line_delta=0\n'
  printf 'wiki_commit_primary_category=%s\n' "$primary_category"
  printf 'wiki_commit_gate_reason=debounced\n'
  printf 'total_changed_count=%s\n' "$total_changed_count"
  printf 'telemetry_summary_changed_count=%s\n' "$telemetry_summary_changed_count"
  printf 'pending_since_epoch=%s\n' "$pending_since_epoch"
  printf 'pending_age_seconds=%s\n' "$pending_age"
  printf 'min_changes=%s\n' "$min_changes"
  printf 'max_age_seconds=%s\n' "$max_age_seconds"
  printf 'last_synth_age_seconds=%s\n' "$synth_age"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
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
    $(runner_config_state_fields) \
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
    wiki)
      printf '%s/agents/wiki-maintainer-agent.md' "$board_root"
      ;;
    coordinator)
      printf '%s/agents/coordinator-agent.md' "$board_root"
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
      printf '%s\n' "- ticket: own one ticket from local planning through implementation, verification, evidence logging, AI-led merge into PROJECT_ROOT, and done/reject movement. Do not split the work across planner/todo runners. Never push."
      ;;
    planner)
      printf '%s\n' "- planner: act as Planner AI. Promote quick orders into generated PRDs, create/update plans and todo tickets, and repair board markdown when owner work stalls or breaks. Query the wiki before order promotion, drafting, ticket generation, or recovery decisions. Do not implement product code, manage worktrees directly, manage runner or OS processes, verify, manually git commit, or push. The runner harness creates a scoped local commit for planner-owned board changes after a successful turn."
      ;;
    todo)
      printf '%s\n' "- todo (legacy): claim/resume one todo ticket, query the wiki before implementation, implement within Allowed Paths. Do not verify, commit, or push. Not part of the default 3-runner topology — Impl AI claims todo directly."
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
      printf '%s\n' "3. Run a wiki context pass before planning or implementation: use 'autoflow wiki query' with distinctive terms from the order/PRD/ticket title, request, goal, allowed paths, modules, and reject reason if present. Skip only when both the wiki and 'tickets/done/' are empty."
      ;;
  esac
  printf '%s\n' "4. Treat wiki results as context and planning constraints: prior decisions, repeated failures, related completed tickets, architecture notes, and known patterns. Do not treat wiki content as proof of completion or as authority over ticket stage."
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
  printf '%s\n' "10. Do not rely on this prompt as future context."
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

  if [ "$public_role" = "wiki" ]; then
    cat <<EOF

Wiki filesystem boundary:
- Board-relative paths such as wiki/log.md resolve under Board root:
  ${board_root}/wiki/log.md.
- Do not create or edit project-root wiki/ paths such as ${project_root}/wiki/log.md.
- Do not create or edit project-root Users/... paths or copies of absolute board paths
  with the leading slash removed.
- Prefer the repo-local CLI for writes: $(autoflow_cli_path) wiki ...
EOF
  fi

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

role_prompt_byte_cap_value() {
  local value=""

  case "$public_role" in
    planner)
      value="${AUTOFLOW_PLANNER_PROMPT_BYTES:-65536}"
      ;;
    ticket)
      value="${AUTOFLOW_WORKER_PROMPT_BYTES:-98304}"
      ;;
    *)
      value=""
      ;;
  esac

  case "$value" in
    ''|*[!0-9]*)
      printf ''
      ;;
    *)
      printf '%s' "$value"
      ;;
  esac
}

role_prompt_byte_cap_env_name() {
  case "$public_role" in
    planner)
      printf 'AUTOFLOW_PLANNER_PROMPT_BYTES'
      ;;
    ticket)
      printf 'AUTOFLOW_WORKER_PROMPT_BYTES'
      ;;
    *)
      printf ''
      ;;
  esac
}

role_output_token_cap_value() {
  local env_name default_value raw_value

  case "$public_role" in
    planner)
      env_name="AUTOFLOW_PLANNER_MAX_OUTPUT_TOKENS"
      default_value=8000
      ;;
    ticket)
      env_name="AUTOFLOW_WORKER_MAX_OUTPUT_TOKENS"
      default_value=16000
      ;;
    wiki)
      env_name="AUTOFLOW_WIKI_MAX_OUTPUT_TOKENS"
      default_value=2000
      ;;
    *)
      printf ''
      return 0
      ;;
  esac

  raw_value="${!env_name:-}"
  if [ -z "$raw_value" ]; then
    printf '%s' "$default_value"
    return 0
  fi

  autoflow_positive_integer_or_zero "$raw_value"
}

role_output_token_cap_env_name() {
  case "$public_role" in
    planner)
      printf 'AUTOFLOW_PLANNER_MAX_OUTPUT_TOKENS'
      ;;
    ticket)
      printf 'AUTOFLOW_WORKER_MAX_OUTPUT_TOKENS'
      ;;
    wiki)
      printf 'AUTOFLOW_WIKI_MAX_OUTPUT_TOKENS'
      ;;
    *)
      printf ''
      ;;
  esac
}

apply_role_prompt_byte_cap() {
  local prompt_file="$1"
  local prompt_cap cap_output applied original_bytes final_bytes capped_bytes byte_cap

  prompt_cap="$(role_prompt_byte_cap_value)"
  if [ -z "$prompt_cap" ]; then
    printf 'applied=false\n'
    return 0
  fi

  cap_output="$(autoflow_apply_head_tail_byte_cap "$prompt_file" "$prompt_cap")"
  applied="$(printf '%s\n' "$cap_output" | sed -n 's/^applied=//p' | tail -n 1)"
  original_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^original_bytes=//p' | tail -n 1)"
  final_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^final_bytes=//p' | tail -n 1)"
  capped_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^capped_bytes=//p' | tail -n 1)"
  byte_cap="$(printf '%s\n' "$cap_output" | sed -n 's/^byte_cap=//p' | tail -n 1)"

  printf 'applied=%s\n' "${applied:-false}"
  printf 'original_bytes=%s\n' "${original_bytes:-0}"
  printf 'final_bytes=%s\n' "${final_bytes:-0}"
  printf 'capped_bytes=%s\n' "${capped_bytes:-0}"
  printf 'byte_cap=%s\n' "${byte_cap:-0}"
}

apply_role_output_token_cap_to_file() {
  local target_file="$1"
  local output_cap cap_output applied original_bytes final_bytes capped_bytes token_cap byte_cap

  output_cap="$(role_output_token_cap_value)"
  if [ -z "$output_cap" ] || [ ! -f "$target_file" ]; then
    printf 'applied=false\n'
    printf 'original_bytes=0\n'
    printf 'final_bytes=0\n'
    printf 'capped_bytes=0\n'
    printf 'token_cap=0\n'
    printf 'byte_cap=0\n'
    return 0
  fi

  cap_output="$(autoflow_apply_output_token_cap "$target_file" "$output_cap")"
  applied="$(printf '%s\n' "$cap_output" | sed -n 's/^applied=//p' | tail -n 1)"
  original_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^original_bytes=//p' | tail -n 1)"
  final_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^final_bytes=//p' | tail -n 1)"
  capped_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^capped_bytes=//p' | tail -n 1)"
  token_cap="$(printf '%s\n' "$cap_output" | sed -n 's/^token_cap=//p' | tail -n 1)"
  byte_cap="$(printf '%s\n' "$cap_output" | sed -n 's/^byte_cap=//p' | tail -n 1)"

  printf 'applied=%s\n' "${applied:-false}"
  printf 'original_bytes=%s\n' "${original_bytes:-0}"
  printf 'final_bytes=%s\n' "${final_bytes:-0}"
  printf 'capped_bytes=%s\n' "${capped_bytes:-0}"
  printf 'token_cap=%s\n' "${token_cap:-0}"
  printf 'byte_cap=%s\n' "${byte_cap:-0}"
}

apply_role_output_token_cap() {
  local output_target output_target_label cap_output applied
  local original_bytes final_bytes capped_bytes token_cap byte_cap

  output_target=""
  output_target_label="none"
  if [ -n "${adapter_last_message:-}" ] && [ -s "${adapter_last_message:-}" ]; then
    output_target="$adapter_last_message"
    output_target_label="last_message"
  elif [ -n "${adapter_stdout:-}" ] && [ -s "${adapter_stdout:-}" ]; then
    output_target="$adapter_stdout"
    output_target_label="stdout"
  fi

  if [ -z "$output_target" ]; then
    printf 'applied=false\n'
    printf 'target=none\n'
    printf 'original_bytes=0\n'
    printf 'final_bytes=0\n'
    printf 'capped_bytes=0\n'
    printf 'token_cap=0\n'
    printf 'byte_cap=0\n'
    return 0
  fi

  cap_output="$(apply_role_output_token_cap_to_file "$output_target")"
  applied="$(printf '%s\n' "$cap_output" | sed -n 's/^applied=//p' | tail -n 1)"
  original_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^original_bytes=//p' | tail -n 1)"
  final_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^final_bytes=//p' | tail -n 1)"
  capped_bytes="$(printf '%s\n' "$cap_output" | sed -n 's/^capped_bytes=//p' | tail -n 1)"
  token_cap="$(printf '%s\n' "$cap_output" | sed -n 's/^token_cap=//p' | tail -n 1)"
  byte_cap="$(printf '%s\n' "$cap_output" | sed -n 's/^byte_cap=//p' | tail -n 1)"

  printf 'applied=%s\n' "${applied:-false}"
  printf 'target=%s\n' "$output_target_label"
  printf 'original_bytes=%s\n' "${original_bytes:-0}"
  printf 'final_bytes=%s\n' "${final_bytes:-0}"
  printf 'capped_bytes=%s\n' "${capped_bytes:-0}"
  printf 'token_cap=%s\n' "${token_cap:-0}"
  printf 'byte_cap=%s\n' "${byte_cap:-0}"
}

run_custom_adapter_command() {
  local prompt_file="$1"
  local adapter_timeout_seconds adapter_kill_after_seconds

  prepare_adapter_cli_env
  command_summary="$command_value"
  adapter_timeout_seconds="$(runner_resolve_int_env "AUTOFLOW_AGENT_TIMEOUT_SECONDS" 1200)"
  adapter_kill_after_seconds="$(runner_resolve_int_env "AUTOFLOW_AGENT_KILL_AFTER_SECONDS" 30)"
  run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
    adapter_run_in_cwd "$adapter_working_root" \
      env \
        AUTOFLOW_ROLE="$runtime_role" \
        AUTOFLOW_WORKER_ID="$runner_id" \
        AUTOFLOW_BACKGROUND=1 \
        AUTOFLOW_BOARD_ROOT="$board_root" \
        AUTOFLOW_PROJECT_ROOT="$project_root" \
        AUTOFLOW_IMPLEMENTATION_ROOT="$adapter_working_root" \
        AUTOFLOW_PROMPT_FILE="$prompt_file" \
      bash -lc "$command_value" < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
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

# 정수 env var 해석 (비어있거나 non-numeric 이면 default 반환).
runner_resolve_int_env() {
  local var_name="$1"
  local default_value="$2"
  local value="${!var_name:-}"
  if [ -z "$value" ]; then
    printf '%s' "$default_value"
    return 0
  fi
  case "$value" in
    *[!0-9]*) printf '%s' "$default_value" ;;
    *) printf '%s' "$value" ;;
  esac
}

# adapter 호출용 timeout watchdog. macOS BSD (timeout/gtimeout 부재) 호환.
# 사용: run_with_timeout TIMEOUT_SECONDS KILL_AFTER_SECONDS COMMAND [ARGS...]
# - TIMEOUT_SECONDS 가 0/empty/non-numeric 이면 watchdog 비활성 (그대로 실행).
# - timeout 으로 SIGTERM 보낸 뒤에도 KILL_AFTER_SECONDS 동안 살아있으면 SIGKILL.
# - timeout 발생 시 exit code 124 반환. 그 외에는 child 의 exit code 그대로 반환.
run_with_timeout() {
  local timeout_s="${1:-0}"; shift || true
  local kill_after_s="${1:-30}"; shift || true

  case "$timeout_s" in
    ''|*[!0-9]*) timeout_s=0 ;;
  esac
  case "$kill_after_s" in
    ''|*[!0-9]*) kill_after_s=30 ;;
  esac

  if [ "$timeout_s" -le 0 ]; then
    "$@"
    return $?
  fi

  local marker prev_errexit prev_monitor
  marker="$(mktemp "${TMPDIR:-/tmp}/autoflow-adapter-timeout.XXXXXX")"

  # 호출자의 shell option (errexit, monitor) 보존을 위해 저장.
  case "$-" in
    *e*) prev_errexit=1 ;;
    *) prev_errexit=0 ;;
  esac
  case "$-" in
    *m*) prev_monitor=1 ;;
    *) prev_monitor=0 ;;
  esac
  # 백그라운드 child 가 SIGTERM 으로 죽을 때 bash 가 stderr 에 "Terminated: 15" 노이즈 찍는 것 방지.
  set +m

  "$@" <&0 &
  local child_pid=$!

  (
    sleep "$timeout_s"
    if kill -0 "$child_pid" 2>/dev/null; then
      printf 'timeout' > "$marker"
      tree_pids="$child_pid"
      scan_pids="$child_pid"
      while [ -n "$scan_pids" ]; do
        next_pids=""
        for scan_pid in $scan_pids; do
          while IFS= read -r descendant_pid; do
            [ -n "$descendant_pid" ] || continue
            case " $tree_pids " in
              *" $descendant_pid "*) ;;
              *)
                tree_pids="${tree_pids} ${descendant_pid}"
                next_pids="${next_pids} ${descendant_pid}"
                ;;
            esac
          done < <(pgrep -P "$scan_pid" 2>/dev/null || ps -axo ppid=,pid= 2>/dev/null | while read -r ppid pid; do [ "$ppid" = "$scan_pid" ] && printf '%s\n' "$pid"; done)
        done
        scan_pids="$next_pids"
      done
      for tree_pid in $tree_pids; do
        [ "$tree_pid" = "$child_pid" ] && continue
        kill -TERM "$tree_pid" 2>/dev/null || true
      done
      kill -TERM "$child_pid" 2>/dev/null || true
      sleep "$kill_after_s"
      if kill -0 "$child_pid" 2>/dev/null; then
        scan_pids="$child_pid"
        while [ -n "$scan_pids" ]; do
          next_pids=""
          for scan_pid in $scan_pids; do
            while IFS= read -r descendant_pid; do
              [ -n "$descendant_pid" ] || continue
              case " $tree_pids " in
                *" $descendant_pid "*) ;;
                *)
                  tree_pids="${tree_pids} ${descendant_pid}"
                  next_pids="${next_pids} ${descendant_pid}"
                  ;;
              esac
            done < <(pgrep -P "$scan_pid" 2>/dev/null || ps -axo ppid=,pid= 2>/dev/null | while read -r ppid pid; do [ "$ppid" = "$scan_pid" ] && printf '%s\n' "$pid"; done)
          done
          scan_pids="$next_pids"
        done
        for tree_pid in $tree_pids; do
          [ "$tree_pid" = "$child_pid" ] && continue
          kill -KILL "$tree_pid" 2>/dev/null || true
        done
        kill -KILL "$child_pid" 2>/dev/null || true
      fi
    fi
  ) &
  local watcher_pid=$!

  set +e
  wait "$child_pid"
  local child_exit=$?
  if [ "$prev_errexit" = "1" ]; then set -e; fi

  if kill -0 "$watcher_pid" 2>/dev/null; then
    kill -TERM "$watcher_pid" 2>/dev/null || true
    wait "$watcher_pid" 2>/dev/null || true
  fi

  if [ "$prev_monitor" = "1" ]; then set -m; fi

  if [ -s "$marker" ]; then
    rm -f "$marker"
    return 124
  fi
  rm -f "$marker"
  return "$child_exit"
}

runner_file_size_bytes() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf '0'
    return 0
  fi

  wc -c < "$file" 2>/dev/null | tr -d '[:space:]'
}

adapter_finish_class() {
  local adapter_exit="$1"
  local runner_status_value="$2"
  local output_truncated_value="${3:-false}"

  if [ "$runner_status_value" = "stopped" ]; then
    printf 'quota_limited'
  elif [ "$adapter_exit" -eq 125 ]; then
    printf 'adapter_auth_required'
  elif [ "$adapter_exit" -eq 126 ]; then
    printf 'adapter_start_failed'
  elif [ "$adapter_exit" -eq 0 ] && [ "$output_truncated_value" = "true" ]; then
    printf 'normal_output_truncated'
  elif [ "$adapter_exit" -eq 0 ]; then
    printf 'normal'
  elif [ "$adapter_exit" -eq 124 ]; then
    printf 'adapter_timeout_sigterm'
  elif [ "$adapter_exit" -eq 127 ]; then
    printf 'adapter_executable_missing'
  else
    printf 'adapter_exit_%s' "$adapter_exit"
  fi
}

runner_file_has_adapter_start_failure() {
  local file

  for file in "$@"; do
    [ -f "$file" ] || continue
    if grep -Eiq 'Error: thread/start|thread/start failed|error creating thread|Fatal error: Codex cannot access session files|Failed to create session' "$file"; then
      return 0
    fi
  done

  return 1
}

runner_file_has_adapter_auth_required() {
  local file

  for file in "$@"; do
    [ -f "$file" ] || continue
    if grep -Eiq 'Opening authentication page in your browser|Attempting to open authentication page in your browser|Authentication consent could not be obtained|Failed to sign in|When using Gemini API, you must specify the GEMINI_API_KEY' "$file"; then
      return 0
    fi
  done

  return 1
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
  local timeout_count

  if [ -z "$last_chunk_at" ]; then
    last_chunk_at="$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)"
  fi
  timeout_count="$(runner_state_field "$runner_id" "consecutive_timeout_count" 2>/dev/null || true)"
  case "${timeout_count:-0}" in
    ''|*[!0-9]*) timeout_count=0 ;;
  esac

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
    "consecutive_timeout_count=${timeout_count}" \
    "consecutive_preflight_skip_count=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_count")" \
    "consecutive_preflight_skip_result=$(runner_adapter_preserved_state_value "consecutive_preflight_skip_result")" \
    "last_preflight_skip_at=$(runner_adapter_preserved_state_value "last_preflight_skip_at")"
}

start_adapter_heartbeat_monitor() {
  local interval_s

  interval_s="$(runner_resolve_int_env "AUTOFLOW_ADAPTER_HEARTBEAT_INTERVAL_SECONDS" 30)"
  [ "$interval_s" -gt 0 ] || interval_s=30

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

# run_with_timeout 안에서 cd 후 명령을 실행할 때 사용 (cd 가 watchdog subshell 안에 머무름).
adapter_run_in_cwd() {
  local cwd="$1"; shift
  cd "$cwd" || return 1
  "$@"
}

run_gemini_adapter_command() {
  local adapter_timeout_seconds="$1"
  local adapter_kill_after_seconds="$2"
  local child_pid started_epoch now_epoch elapsed_seconds command_exit

  (
    cd "$adapter_working_root" || exit 1
    exec </dev/null
    run_adapter_with_identity "${cmd[@]}"
  ) > "$adapter_stdout" 2> "$adapter_stderr" &
  child_pid=$!
  started_epoch="$(date +%s)"

  while kill -0 "$child_pid" 2>/dev/null; do
    if runner_file_has_adapter_auth_required "$adapter_stdout" "$adapter_stderr"; then
      kill -TERM "$child_pid" 2>/dev/null || true
      wait "$child_pid" 2>/dev/null || true
      printf '\nautoflow_adapter_error=gemini_auth_required\n' >> "$adapter_stderr"
      printf 'autoflow_adapter_hint=run gemini interactively to authenticate, or provide GEMINI_API_KEY/GOOGLE_API_KEY for non-interactive runner use\n' >> "$adapter_stderr"
      return 125
    fi

    if [ "${adapter_timeout_seconds:-0}" -gt 0 ]; then
      now_epoch="$(date +%s)"
      elapsed_seconds=$((now_epoch - started_epoch))
      if [ "$elapsed_seconds" -ge "$adapter_timeout_seconds" ]; then
        kill -TERM "$child_pid" 2>/dev/null || true
        if [ "${adapter_kill_after_seconds:-0}" -gt 0 ]; then
          sleep "$adapter_kill_after_seconds"
        fi
        if kill -0 "$child_pid" 2>/dev/null; then
          kill -KILL "$child_pid" 2>/dev/null || true
        fi
        wait "$child_pid" 2>/dev/null || true
        return 124
      fi
    fi

    sleep 1
  done

  wait "$child_pid"
  command_exit=$?
  if runner_file_has_adapter_auth_required "$adapter_stdout" "$adapter_stderr"; then
    printf '\nautoflow_adapter_error=gemini_auth_required\n' >> "$adapter_stderr"
    printf 'autoflow_adapter_hint=run gemini interactively to authenticate, or provide GEMINI_API_KEY/GOOGLE_API_KEY for non-interactive runner use\n' >> "$adapter_stderr"
    return 125
  fi
  return "$command_exit"
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

runner_claude_supports_stream() {
  # Best-effort detection of `--output-format stream-json` on the installed
  # claude CLI. Cached per shell. AUTOFLOW_CLAUDE_STREAM=0 forces legacy text
  # mode regardless of CLI capability (rollback escape hatch).
  if [ "${AUTOFLOW_CLAUDE_STREAM:-1}" = "0" ]; then
    return 1
  fi
  if [ -n "${__autoflow_claude_stream_cached:-}" ]; then
    [ "$__autoflow_claude_stream_cached" = "yes" ]
    return $?
  fi
  if claude --help 2>&1 | grep -q -- 'stream-json'; then
    __autoflow_claude_stream_cached="yes"
    return 0
  fi
  __autoflow_claude_stream_cached="no"
  return 1
}

runner_codex_json_mode_active() {
  # AUTOFLOW_CODEX_JSON=0 disables --json streaming (rollback escape hatch).
  [ "${AUTOFLOW_CODEX_JSON:-1}" != "0" ]
}

runner_codex_extract_last_message() {
  # Read codex --json JSONL from $1 and write the last agent_message text into
  # $2. Scans item.completed events for type=agent_message text.
  local stdout_file="$1"
  local dest_file="$2"

  [ -n "$dest_file" ] || return 1
  [ -f "$stdout_file" ] || return 1
  [ -s "$stdout_file" ] || return 1

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$stdout_file" "$dest_file" <<'PY' && return 0
import json, sys
src, dst = sys.argv[1], sys.argv[2]
last_text = None
try:
    with open(src, "r", encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") == "item.completed":
                item = obj.get("item") or {}
                if item.get("type") == "agent_message":
                    text = item.get("text")
                    if isinstance(text, str) and text:
                        last_text = text
except Exception:
    pass
if last_text:
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(last_text)
    sys.exit(0)
sys.exit(1)
PY
  fi
  return 1
}

runner_claude_base_cmd() {
  # Populate the named array variable with the canonical claude invocation.
  # Defaults to stream-json + include-partial-messages so JSONL flushes per
  # event into stdout (live_stdout grows during the tick instead of at the
  # end). Falls back to legacy text mode when AUTOFLOW_CLAUDE_STREAM=0 or the
  # installed CLI lacks stream-json support.
  local __dest_var="$1"
  if runner_claude_supports_stream; then
    eval "${__dest_var}=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format stream-json --include-partial-messages --verbose)"
  else
    eval "${__dest_var}=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)"
  fi
}

runner_claude_extract_last_message() {
  # Read stream-json JSONL from $1 and write the last assistant message text
  # into $2. Prefers the final `{"type":"result","subtype":"success",...}`
  # event's `result` field; falls back to concatenating assistant text blocks
  # if no result event was emitted; leaves the destination untouched if both
  # paths fail (caller may copy raw stdout as last-resort legacy fallback).
  local stdout_file="$1"
  local dest_file="$2"

  [ -n "$dest_file" ] || return 1
  [ -f "$stdout_file" ] || return 1
  [ -s "$stdout_file" ] || return 1

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$stdout_file" "$dest_file" <<'PY' && return 0
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
last_result_text = None
assistant_chunks = []
try:
    with open(src, "r", encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            t = obj.get("type")
            if t == "result" and obj.get("subtype") == "success":
                value = obj.get("result")
                if isinstance(value, str) and value:
                    last_result_text = value
            elif t == "assistant":
                msg = obj.get("message") or {}
                for block in msg.get("content") or []:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text")
                        if isinstance(text, str) and text:
                            assistant_chunks.append(text)
except Exception:
    sys.exit(2)

text = last_result_text if last_result_text else ("".join(assistant_chunks) if assistant_chunks else "")
if not text:
    sys.exit(3)
with open(dst, "w", encoding="utf-8") as out:
    out.write(text)
PY
  fi

  return 1
}

runner_claude_supports_effort() {
  # Best-effort detection of `--effort` flag on the installed claude CLI.
  # Returns 0 if --effort appears in `claude --help`, else 1. Cached per shell.
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

gemini_usage_value_from_files() {
  local key_pattern="$1"
  shift

  awk -v key_pattern="$key_pattern" '
    {
      line = $0
      while (match(line, "\"(" key_pattern ")\"[[:space:]]*:[[:space:]]*[0-9]+")) {
        value = substr(line, RSTART, RLENGTH)
        sub(/^.*:[[:space:]]*/, "", value)
        if (value + 0 > max) {
          max = value + 0
        }
        line = substr(line, RSTART + RLENGTH)
      }
    }
    END {
      if (max > 0) {
        print max
      }
    }
  ' "$@" 2>/dev/null | tail -n 1
}

append_gemini_token_marker() {
  local prompt_file="$1"
  local stdout_file="$2"
  local stderr_file="$3"
  local total_tokens input_tokens output_tokens prompt_chars output_chars

  total_tokens="$(gemini_usage_value_from_files 'totalTokenCount|total_token_count' "$stdout_file" "$stderr_file")"
  input_tokens="$(gemini_usage_value_from_files 'promptTokenCount|prompt_token_count|inputTokenCount|input_token_count' "$stdout_file" "$stderr_file")"
  output_tokens="$(gemini_usage_value_from_files 'candidatesTokenCount|candidates_token_count|outputTokenCount|output_token_count' "$stdout_file" "$stderr_file")"

  if [ -n "$total_tokens" ] && [ "$total_tokens" -gt 0 ] 2>/dev/null; then
    printf '\ntotal_tokens=%s\n' "$total_tokens" >> "$stdout_file"
    return 0
  fi

  if [ -n "$input_tokens" ] && [ "$input_tokens" -gt 0 ] 2>/dev/null &&
     [ -n "$output_tokens" ] && [ "$output_tokens" -gt 0 ] 2>/dev/null; then
    printf '\ninput_tokens=%s\noutput_tokens=%s\n' "$input_tokens" "$output_tokens" >> "$stdout_file"
    return 0
  fi

  prompt_chars="$(wc -c < "$prompt_file" 2>/dev/null | tr -d '[:space:]' || true)"
  output_chars="$(wc -c < "$stdout_file" 2>/dev/null | tr -d '[:space:]' || true)"
  case "$prompt_chars" in ''|*[!0-9]*) prompt_chars=0 ;; esac
  case "$output_chars" in ''|*[!0-9]*) output_chars=0 ;; esac

  input_tokens=$(( (prompt_chars + 3) / 4 ))
  output_tokens=$(( (output_chars + 3) / 4 ))
  [ "$input_tokens" -gt 0 ] || input_tokens=1
  [ "$output_tokens" -gt 0 ] || output_tokens=1
  printf '\ninput_tokens=%s\noutput_tokens=%s\n' "$input_tokens" "$output_tokens" >> "$stdout_file"
}

filter_codex_guard_warnings_in_place() {
  local file="$1"
  local tmp count_file removed

  [ -f "$file" ] || return 0
  tmp="$(mktemp "${TMPDIR:-/tmp}/autoflow-codex-stdout-filter.XXXXXX")" || return 0
  count_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-codex-stdout-filter-count.XXXXXX")" || {
    rm -f "$tmp"
    return 0
  }

  if ! awk -v count_file="$count_file" '
    /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9](\.[0-9]+)?Z[[:space:]]+WARN codex_core_(plugins::manifest|skills::loader):/ { removed++; next }
    { print }
    END { print removed + 0 > count_file }
  ' "$file" > "$tmp"; then
    rm -f "$tmp" "$count_file"
    return 0
  fi

  removed="$(cat "$count_file" 2>/dev/null || printf '0')"
  case "$removed" in ''|*[!0-9]*) removed=0 ;; esac
  if [ "$removed" -gt 0 ]; then
    mv -f "$tmp" "$file"
    runner_append_log "$runner_id" "codex_stdout_filter_applied" \
      "role=${public_role}" \
      "removed_lines=${removed}" \
      "stdout_path=${file}"
  else
    rm -f "$tmp"
  fi
  rm -f "$count_file"
}

run_default_adapter_command() {
  local prompt_file="$1"
  local prompt_text
  local cmd=()
  local command_exit codex_wrapper
  local adapter_timeout_seconds adapter_kill_after_seconds

  # adapter 호출 timeout. ECONNRESET 등으로 인한 무한 hang 을 끊기 위해 외부 watchdog 으로 강제 종료.
  # 0 또는 unset 으로 두면 watchdog 비활성 (이전 동작 그대로).
  adapter_timeout_seconds="$(runner_resolve_int_env "AUTOFLOW_AGENT_TIMEOUT_SECONDS" 1200)"
  adapter_kill_after_seconds="$(runner_resolve_int_env "AUTOFLOW_AGENT_KILL_AFTER_SECONDS" 30)"

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
      if runner_codex_json_mode_active; then
        # --json streams JSONL per event (item.completed, turn.completed, …)
        # so live_stdout.log grows during the tick. PTY wrapper not needed.
        cmd+=(--json)
      else
        # legacy text mode: capture final message via -o sidecar
        if [ -n "${adapter_last_message:-}" ]; then
          cmd+=(-o "$adapter_last_message")
        fi
      fi
      cmd+=(-)
      command_summary="$(command_summary_from_array "${cmd[@]}")"
      if runner_codex_json_mode_active; then
        run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
          run_adapter_with_identity "${cmd[@]}" \
          < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
      elif [ "$(uname -s 2>/dev/null || true)" = "Darwin" ] && command -v script >/dev/null 2>&1 && [ "${AUTOFLOW_CODEX_DISABLE_PTY:-}" != "1" ]; then
        codex_wrapper="$(mktemp "${TMPDIR:-/tmp}/autoflow-codex-wrapper.XXXXXX")"
        {
          printf '#!/usr/bin/env bash\n'
          printf 'exec'
          printf ' %q' "${cmd[@]}"
          printf ' < "$1"\n'
        } > "$codex_wrapper"
        chmod +x "$codex_wrapper"
        run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
          run_adapter_with_identity script -q /dev/null "$codex_wrapper" "$prompt_file" \
          > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
        rm -f "$codex_wrapper"
      else
        run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
          run_adapter_with_identity "${cmd[@]}" \
          < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
      fi
      filter_codex_guard_warnings_in_place "$adapter_stdout"
      if runner_codex_json_mode_active && [ -n "${adapter_last_message:-}" ] && [ -s "$adapter_stdout" ]; then
        if ! runner_codex_extract_last_message "$adapter_stdout" "$adapter_last_message"; then
          cp "$adapter_stdout" "$adapter_last_message" 2>/dev/null || true
        fi
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
      run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
        adapter_run_in_cwd "$adapter_working_root" run_adapter_with_identity "${cmd[@]}" \
        > "$adapter_stdout" 2> "$adapter_stderr"
      command_exit=$?
      # stream-json 모드에서는 stdout 이 JSONL (system/init, assistant,
      # stream_event, result ...) 이므로 narrative sidecar 에는 마지막 result
      # 이벤트의 result 필드 (또는 assistant text concat fallback) 만 추출해
      # 기록한다. legacy text 모드일 때는 stdout 자체가 최종 응답이라 그대로
      # 복사한다 (1원칙: legacy fallback 항상 살아 있음).
      if [ -n "${adapter_last_message:-}" ] && [ -s "$adapter_stdout" ]; then
        if runner_claude_supports_stream; then
          if ! runner_claude_extract_last_message "$adapter_stdout" "$adapter_last_message"; then
            cp "$adapter_stdout" "$adapter_last_message" 2>/dev/null || true
          fi
        else
          cp "$adapter_stdout" "$adapter_last_message" 2>/dev/null || true
        fi
      fi
      return "$command_exit"
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
      run_with_timeout "$adapter_timeout_seconds" "$adapter_kill_after_seconds" \
        adapter_run_in_cwd "$adapter_working_root" run_adapter_with_identity "${cmd[@]}" \
        > "$adapter_stdout" 2> "$adapter_stderr"
      command_exit=$?
      if [ -n "${adapter_last_message:-}" ] && [ -s "$adapter_stdout" ]; then
        cp "$adapter_stdout" "$adapter_last_message" 2>/dev/null || true
      fi
      return "$command_exit"
      ;;
    gemini)
      ensure_agent_on_path gemini || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(gemini --skip-trust --approval-mode yolo --prompt "$prompt_text")
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      command_summary="$(command_summary_from_array "${cmd[@]:0:4}") prompt"
      run_gemini_adapter_command "$adapter_timeout_seconds" "$adapter_kill_after_seconds"
      command_exit=$?
      if [ "$command_exit" -eq 0 ]; then
        append_gemini_token_marker "$prompt_file" "$adapter_stdout" "$adapter_stderr"
      fi
      if [ -n "${adapter_last_message:-}" ] && [ -s "$adapter_stdout" ]; then
        cp "$adapter_stdout" "$adapter_last_message" 2>/dev/null || true
      fi
      return "$command_exit"
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

  case "$suffix" in
    prompt|runtime|dry-run)
      printf ''
      return 0
      ;;
    stderr)
      if [ ! -s "$source_file" ]; then
        printf ''
        return 0
      fi
      ;;
  esac

  runner_ensure_dirs
  destination="$(runner_log_dir)/${runner_id}_$(artifact_stamp)_${suffix}.log"
  cp "$source_file" "$destination"
  printf '%s' "$destination"
}

run_role_pid_is_running() {
  local pid="${1:-}"
  local kill_output kill_status

  case "$pid" in
    ""|*[!0-9]*)
      return 1
      ;;
  esac

  kill_output="$(kill -0 "$pid" 2>&1)"
  kill_status=$?
  [ "$kill_status" -eq 0 ] && return 0

  case "$kill_output" in
    *[Oo]peration\ not\ permitted*|*[Nn]ot\ permitted*)
      return 0
      ;;
  esac

  return 1
}

run_role_process_children() {
  local pid="${1:-}"

  case "$pid" in
    ""|*[!0-9]*)
      return 0
      ;;
  esac

  if command -v pgrep >/dev/null 2>&1; then
    pgrep -P "$pid" 2>/dev/null || true
  else
    ps -axo ppid=,pid= 2>/dev/null | awk -v ppid="$pid" '$1 == ppid { print $2 }' || true
  fi
}

run_role_count_process_tree() {
  local pid="${1:-}"
  local child total child_total

  case "$pid" in
    ""|*[!0-9]*)
      printf '0'
      return 0
      ;;
  esac

  total=0
  while IFS= read -r child; do
    [ -n "$child" ] || continue
    child_total="$(run_role_count_process_tree "$child")"
    total=$((total + 1 + child_total))
  done < <(run_role_process_children "$pid")
  printf '%s' "$total"
}

run_role_kill_process_tree_signal() {
  local pid="${1:-}"
  local signal="${2:-TERM}"
  local child

  case "$pid" in
    ""|*[!0-9]*)
      return 0
      ;;
  esac

  while IFS= read -r child; do
    [ -n "$child" ] || continue
    run_role_kill_process_tree_signal "$child" "$signal"
  done < <(run_role_process_children "$pid")

  kill "-${signal}" "$pid" 2>/dev/null || true
}

run_role_user_process_count() {
  local user_name count

  user_name="$(id -un 2>/dev/null || printf '')"
  if [ -n "$user_name" ]; then
    count="$(ps -u "$user_name" -o pid= 2>/dev/null | wc -l | tr -d '[:space:]' || true)"
    case "$count" in
      ''|*[!0-9]*) ;;
      *) printf '%s' "$count"; return 0 ;;
    esac
  fi

  ps -axo pid= 2>/dev/null | wc -l | tr -d '[:space:]' || printf '0'
}

run_role_process_pressure_snapshot() {
  local user_limit runner_child_limit user_count runner_child_count result

  user_limit="$(runner_resolve_int_env "AUTOFLOW_PROCESS_PRESSURE_USER_LIMIT" 1000)"
  runner_child_limit="$(runner_resolve_int_env "AUTOFLOW_PROCESS_PRESSURE_RUNNER_CHILD_LIMIT" 200)"
  user_count="$(run_role_user_process_count)"
  runner_child_count="$(run_role_count_process_tree "$$")"
  result="ok"

  if [ "$user_limit" -gt 0 ] && [ "$user_count" -ge "$user_limit" ]; then
    result="user_limit"
  elif [ "$runner_child_limit" -gt 0 ] && [ "$runner_child_count" -ge "$runner_child_limit" ]; then
    result="runner_child_limit"
  fi

  printf 'result=%s\n' "$result"
  printf 'user_process_count=%s\n' "$user_count"
  printf 'user_process_limit=%s\n' "$user_limit"
  printf 'runner_child_count=%s\n' "$runner_child_count"
  printf 'runner_child_limit=%s\n' "$runner_child_limit"
}

run_role_process_pressure_reason() {
  awk -F= '$1 == "result" { print $2; exit }'
}

maybe_skip_adapter_for_process_pressure() {
  local prompt_file="$1"
  local autocommit_before_status="$2"
  local adapter_stdout_path="$3"
  local adapter_stderr_path="$4"
  local adapter_last_message_path="${5:-}"
  local snapshot reason timestamp prompt_log_path
  local user_count user_limit runner_child_count runner_child_limit

  snapshot="$(run_role_process_pressure_snapshot)"
  reason="$(printf '%s\n' "$snapshot" | run_role_process_pressure_reason)"
  [ "$reason" != "ok" ] || return 1

  user_count="$(printf '%s\n' "$snapshot" | awk -F= '$1 == "user_process_count" { print $2; exit }')"
  user_limit="$(printf '%s\n' "$snapshot" | awk -F= '$1 == "user_process_limit" { print $2; exit }')"
  runner_child_count="$(printf '%s\n' "$snapshot" | awk -F= '$1 == "runner_child_count" { print $2; exit }')"
  runner_child_limit="$(printf '%s\n' "$snapshot" | awk -F= '$1 == "runner_child_limit" { print $2; exit }')"

  runner_append_log "$runner_id" "process_pressure_guard" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=${reason}" \
    "user_process_count=${user_count}" \
    "user_process_limit=${user_limit}" \
    "runner_child_count=${runner_child_count}" \
    "runner_child_limit=${runner_child_limit}" \
    "action=skip_adapter"

  timestamp="$(runner_now_iso)"
  prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
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
    "started_at=$(runner_state_started_at "$timestamp")" \
    "last_event_at=${timestamp}" \
    "last_result=process_pressure_guard" \
    "last_prompt_log=${prompt_log_path}" \
    "process_pressure_reason=${reason}" \
    "process_pressure_user_count=${user_count}" \
    "process_pressure_user_limit=${user_limit}" \
    "process_pressure_runner_child_count=${runner_child_count}" \
    "process_pressure_runner_child_limit=${runner_child_limit}"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'reason=process_pressure_guard\n'
  printf 'process_pressure_reason=%s\n' "$reason"
  printf 'process_pressure_action=skip_adapter\n'
  printf 'user_process_count=%s\n' "$user_count"
  printf 'user_process_limit=%s\n' "$user_limit"
  printf 'runner_child_count=%s\n' "$runner_child_count"
  printf 'runner_child_limit=%s\n' "$runner_child_limit"
  printf 'prompt_log_path=%s\n' "$prompt_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path"
  exit 0
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

runner_budget_telemetry_token_usage_since() {
  local since="$1"
  local output

  output="$(runner_budget_telemetry_token_usage_since_output "$since")"
  printf '%s\n' "$output" | awk -F= '$1 == "token_usage" { print $2; found=1; exit } END { if (!found) print "0" }'
}

runner_budget_telemetry_token_usage_since_output() {
  local since="$1"
  local telemetry_script

  telemetry_script="${SCRIPT_DIR}/telemetry-project.sh"
  [ -x "$telemetry_script" ] || { printf 'token_usage=0\n'; return 0; }
  "$telemetry_script" token-usage --project-root "$project_root" --runner "$runner_id" --since "$since" 2>/dev/null || printf 'token_usage=0\n'
}

runner_budget_latest_adapter_ended_at() {
  local telemetry_script

  telemetry_script="${SCRIPT_DIR}/telemetry-project.sh"
  [ -x "$telemetry_script" ] || return 0
  "$telemetry_script" query --project-root "$project_root" --runner "$runner_id" --limit 1 2>/dev/null |
    jq -r '.ended_at // empty' 2>/dev/null |
    head -n 1
}

runner_preflight_skip_is_repeatable() {
  case "${1:-}" in
    token_budget_exceeded|rate_limited|prompt_size_exceeded)
      return 0
      ;;
  esac
  return 1
}

runner_preflight_skip_threshold() {
  local threshold

  threshold="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value preflight_skip_circuit_breaker_threshold)")"
  [ -n "$threshold" ] || threshold="${AUTOFLOW_PREFLIGHT_SKIP_CIRCUIT_BREAKER_THRESHOLD:-3}"
  case "${threshold:-}" in
    ''|*[!0-9]*|0) threshold=3 ;;
  esac
  printf '%s' "$threshold"
}

runner_preflight_skip_cooldown_seconds() {
  local cooldown_seconds

  cooldown_seconds="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value preflight_skip_circuit_breaker_cooldown_seconds)")"
  [ -n "$cooldown_seconds" ] || cooldown_seconds="${AUTOFLOW_PREFLIGHT_SKIP_CIRCUIT_BREAKER_COOLDOWN_SECONDS:-300}"
  case "${cooldown_seconds:-}" in
    ''|*[!0-9]*|0) cooldown_seconds=300 ;;
  esac
  printf '%s' "$cooldown_seconds"
}

runner_active_ticket_id_or_empty() {
  local active_ticket_id

  active_ticket_id="$(runner_adapter_state_value "active_ticket_id")"
  if [ -n "$active_ticket_id" ]; then
    printf '%s' "$active_ticket_id"
    return 0
  fi
  runner_state_field "$runner_id" "active_ticket_id" 2>/dev/null || true
}

runner_preflight_recovery_field_value() {
  local field="$1"
  local effective_reason="$2"
  local current_value="$3"

  if [ "$effective_reason" != "circuit_breaker_tripped" ]; then
    printf '%s' "$current_value"
    return 0
  fi
  if [ -z "$(runner_active_ticket_id_or_empty)" ]; then
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
  local previous_result previous_count next_count threshold cooldown_seconds until_epoch until_iso
  local now_epoch

  previous_result="$(runner_state_field "$runner_id" "consecutive_preflight_skip_result" 2>/dev/null || true)"
  previous_count="$(runner_state_field "$runner_id" "consecutive_preflight_skip_count" 2>/dev/null || true)"
  previous_count="$(telemetry_positive_integer_or_zero "$previous_count")"
  if [ "$previous_result" = "$reason" ]; then
    next_count=$((previous_count + 1))
  else
    next_count=1
  fi

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
  if [ "$next_count" -ge "$threshold" ]; then
    printf 'preflight_skip_circuit_breaker_tripped=true\n'
  else
    printf 'preflight_skip_circuit_breaker_tripped=false\n'
  fi
}

runner_budget_existing_preflight_circuit_or_exit() {
  local prompt_file="$1"
  local autocommit_before_status="$2"
  local adapter_stdout_path="$3"
  local adapter_stderr_path="$4"
  local adapter_last_message_path="${5:-}"
  local count result last_skip_at threshold cooldown_seconds now_iso now_epoch last_epoch until_epoch until_iso

  count="$(runner_state_field "$runner_id" "consecutive_preflight_skip_count" 2>/dev/null || true)"
  count="$(telemetry_positive_integer_or_zero "$count")"
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

  runner_budget_append_skip_log_and_state \
    "circuit_breaker_tripped" \
    "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
    "preflight_skip_result=${result}" \
    "consecutive_preflight_skip_result=${result}" \
    "consecutive_preflight_skip_count=${count}" \
    "last_preflight_skip_at=${last_skip_at}" \
    "preflight_skip_circuit_breaker_threshold=${threshold}" \
    "preflight_skip_circuit_breaker_cooldown_seconds=${cooldown_seconds}" \
    "preflight_skip_circuit_breaker_until=${until_iso}" \
    "preflight_skip_circuit_breaker_tripped=true" \
    "active_recovery_status=$(runner_preflight_recovery_field_value status circuit_breaker_tripped "${adapter_active_recovery_status}")" \
    "active_recovery_failure_class=$(runner_preflight_recovery_field_value failure_class circuit_breaker_tripped "${adapter_active_recovery_failure_class}")" \
    "active_recovery_reason=$(runner_preflight_recovery_field_value reason circuit_breaker_tripped "${adapter_active_recovery_reason}")"
}

runner_budget_append_skip_log_and_state() {
  local reason="$1"
  local prompt_file="$2"
  local autocommit_before_status="$3"
  local adapter_stdout_path="$4"
  local adapter_stderr_path="$5"
  local adapter_last_message_path="${6:-}"
  shift 6 || true
  local timestamp prompt_log_path preserved_consecutive_timeouts
  local effective_reason="$reason"
  local streak_metadata="" preflight_cause="" preflight_count="" preflight_threshold="" preflight_until=""
  local recovery_status recovery_failure_class recovery_reason

  timestamp="$(runner_now_iso)"
  prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
  preserved_consecutive_timeouts="$(runner_state_field "$runner_id" "consecutive_timeout_count" 2>/dev/null || true)"
  case "${preserved_consecutive_timeouts:-0}" in
    ''|*[!0-9]*) preserved_consecutive_timeouts=0 ;;
  esac
  if runner_preflight_skip_is_repeatable "$reason"; then
    streak_metadata="$(runner_preflight_skip_streak_metadata "$reason" "$timestamp")"
    preflight_cause="$reason"
    preflight_count="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "consecutive_preflight_skip_count" { print $2; exit }')"
    preflight_threshold="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "preflight_skip_circuit_breaker_threshold" { print $2; exit }')"
    preflight_until="$(printf '%s\n' "$streak_metadata" | awk -F= '$1 == "preflight_skip_circuit_breaker_until" { print $2; exit }')"
    if [ "${preflight_count:-0}" -ge "${preflight_threshold:-3}" ]; then
      effective_reason="circuit_breaker_tripped"
    fi
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
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
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
    "consecutive_timeout_count=${preserved_consecutive_timeouts}" \
    $streak_metadata \
    "$@"

  runner_append_log "$runner_id" "budget_preflight_skip" \
    "role=${public_role}" \
    "agent=${agent}" \
    "reason=${reason}" \
    "result=${effective_reason}" \
    "action=skip_adapter" \
    $streak_metadata \
    "$@"

  print_run_header "ok"
  printf 'runner_status=idle\n'
  printf 'reason=%s\n' "$effective_reason"
  if [ "$effective_reason" = "circuit_breaker_tripped" ]; then
    printf 'circuit_breaker_reason=%s\n' "${preflight_cause:-$reason}"
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
  while [ "$#" -gt 0 ]; do
    printf '%s\n' "$1"
    shift || true
  done
  rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path"
  exit 0
}

runner_budget_preflight_or_exit() {
  local prompt_file="$1"
  local autocommit_before_status="$2"
  local adapter_stdout_path="$3"
  local adapter_stderr_path="$4"
  local adapter_last_message_path="${5:-}"
  local now_iso now_epoch policy_path
  local daily_token_quota quota_window_seconds quota_since_epoch quota_since_iso token_usage telemetry_usage_output token_usage_trusted skipped_suspicious_token_rows
  local token_usage_source token_usage_fresh token_cache_status token_cache_age_seconds token_usage_max_data_age_seconds token_usage_telemetry_rows token_cache_rows token_cache_latest_at
  local minimum_interval_seconds latest_ended_at latest_epoch next_allowed_epoch next_allowed_at remaining_seconds
  local prompt_byte_cap prompt_bytes
  local threshold cooldown_seconds consecutive_count last_result last_event_at last_event_epoch until_epoch until_iso

  policy_path="$(runner_budget_policy_path)"
  [ -f "$policy_path" ] || return 0

  now_iso="$(runner_now_iso)"
  now_epoch="$(telemetry_timestamp_to_epoch "$now_iso" || true)"
  [ -n "$now_epoch" ] || now_epoch="$(date -u +%s)"

  runner_budget_existing_preflight_circuit_or_exit \
    "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path"

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
    token_usage_source="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage_source" { print $2; found=1; exit } END { if (!found) print "telemetry" }')"
    token_usage_fresh="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage_fresh" { print $2; found=1; exit } END { if (!found) print "true" }')"
    token_cache_status="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_cache_status" { print $2; found=1; exit } END { if (!found) print "" }')"
    token_cache_age_seconds="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_cache_age_seconds" { print $2; found=1; exit } END { if (!found) print "0" }')"
    token_usage_max_data_age_seconds="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage_max_data_age_seconds" { print $2; found=1; exit } END { if (!found) print "" }')"
    token_usage_telemetry_rows="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_usage_telemetry_rows" { print $2; found=1; exit } END { if (!found) print "" }')"
    token_cache_rows="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_cache_rows" { print $2; found=1; exit } END { if (!found) print "" }')"
    token_cache_latest_at="$(printf '%s\n' "$telemetry_usage_output" | awk -F= '$1 == "token_cache_latest_at" { print $2; found=1; exit } END { if (!found) print "" }')"
    if [ "$token_usage_fresh" != "true" ]; then
      runner_append_log "$runner_id" "budget_preflight_warning" \
        "role=${public_role}" \
        "agent=${agent}" \
        "reason=stale_token_usage_source" \
        "action=continue_adapter" \
        "budget_policy_path=${policy_path}" \
        "token_usage=${token_usage}" \
        "token_usage_source=${token_usage_source}" \
        "token_usage_fresh=${token_usage_fresh}" \
        "token_cache_status=${token_cache_status}" \
        "token_cache_age_seconds=${token_cache_age_seconds}" \
        "token_usage_max_data_age_seconds=${token_usage_max_data_age_seconds}" \
        "token_usage_telemetry_rows=${token_usage_telemetry_rows}" \
        "token_cache_rows=${token_cache_rows}" \
        "token_cache_latest_at=${token_cache_latest_at}"
      runner_replace_state_field_preserving "$runner_id" "last_budget_skip_reason" "stale_token_usage_source" || true
      runner_replace_state_field_preserving "$runner_id" "last_budget_source" "$token_usage_source" || true
      runner_replace_state_field_preserving "$runner_id" "last_budget_source_fresh" "$token_usage_fresh" || true
      runner_replace_state_field_preserving "$runner_id" "last_budget_source_age_seconds" "$token_cache_age_seconds" || true
    fi
    if [ "$token_usage" -ge "$daily_token_quota" ]; then
      if [ "$token_usage_trusted" != "true" ]; then
        runner_append_log "$runner_id" "budget_preflight_warning" \
          "role=${public_role}" \
          "agent=${agent}" \
          "reason=token_usage_suspicious" \
          "action=continue_adapter" \
          "budget_policy_path=${policy_path}" \
          "token_usage=${token_usage}" \
          "token_quota=${daily_token_quota}" \
          "token_quota_window_seconds=${quota_window_seconds}" \
          "token_quota_since=${quota_since_iso}" \
          "token_usage_source=${token_usage_source}" \
          "token_usage_fresh=${token_usage_fresh}" \
          "token_cache_status=${token_cache_status}" \
          "token_cache_age_seconds=${token_cache_age_seconds}" \
          "token_usage_max_data_age_seconds=${token_usage_max_data_age_seconds}" \
          "token_usage_trusted=${token_usage_trusted}" \
          "skipped_suspicious_token_rows=${skipped_suspicious_token_rows}"
      else
        runner_budget_append_skip_log_and_state \
          "token_budget_exceeded" \
          "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
          "budget_policy_path=${policy_path}" \
          "token_usage=${token_usage}" \
          "token_quota=${daily_token_quota}" \
          "token_quota_window_seconds=${quota_window_seconds}" \
          "token_quota_since=${quota_since_iso}" \
          "token_usage_source=${token_usage_source}" \
          "token_usage_fresh=${token_usage_fresh}" \
          "token_cache_status=${token_cache_status}" \
          "token_cache_age_seconds=${token_cache_age_seconds}" \
          "token_usage_max_data_age_seconds=${token_usage_max_data_age_seconds}"
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
        runner_budget_append_skip_log_and_state \
          "rate_limited" \
          "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
          "budget_policy_path=${policy_path}" \
          "minimum_interval_seconds=${minimum_interval_seconds}" \
          "last_adapter_ended_at=${latest_ended_at}" \
          "next_allowed_at=${next_allowed_at}" \
          "remaining_seconds=${remaining_seconds}"
      fi
    fi
  fi

  prompt_byte_cap="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value prompt_byte_cap)")"
  if [ -n "$prompt_byte_cap" ] && [ "$prompt_byte_cap" -gt 0 ]; then
    prompt_bytes="$(telemetry_file_size_bytes "$prompt_file")"
    prompt_bytes="$(telemetry_positive_integer_or_zero "$prompt_bytes")"
    if [ "$prompt_bytes" -gt "$prompt_byte_cap" ]; then
      runner_budget_append_skip_log_and_state \
        "prompt_size_exceeded" \
        "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
        "budget_policy_path=${policy_path}" \
        "prompt_bytes=${prompt_bytes}" \
        "prompt_byte_cap=${prompt_byte_cap}"
    fi
  fi

  threshold="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value timeout_circuit_breaker_threshold)")"
  cooldown_seconds="$(runner_policy_positive_integer_or_empty "$(runner_budget_policy_value timeout_circuit_breaker_cooldown_seconds)")"
  if [ -n "$threshold" ] && [ "$threshold" -gt 0 ] && [ -n "$cooldown_seconds" ] && [ "$cooldown_seconds" -gt 0 ]; then
    consecutive_count="$(runner_state_field "$runner_id" "consecutive_timeout_count" 2>/dev/null || true)"
    consecutive_count="$(telemetry_positive_integer_or_zero "$consecutive_count")"
    if [ "$consecutive_count" -ge "$threshold" ]; then
      last_result="$(runner_state_field "$runner_id" "last_result" 2>/dev/null || true)"
      case "$last_result" in
        adapter_timeout|adapter_timeout_fallback|circuit_breaker_tripped)
          last_event_at="$(runner_state_field "$runner_id" "last_event_at" 2>/dev/null || true)"
          last_event_epoch=""
          [ -z "$last_event_at" ] || last_event_epoch="$(telemetry_timestamp_to_epoch "$last_event_at" || true)"
          [ -n "$last_event_epoch" ] || last_event_epoch="$now_epoch"
          until_epoch=$((last_event_epoch + cooldown_seconds))
          if [ "$now_epoch" -lt "$until_epoch" ]; then
            until_iso="$(runner_epoch_to_iso "$until_epoch")"
            runner_budget_append_skip_log_and_state \
              "circuit_breaker_tripped" \
              "$prompt_file" "$autocommit_before_status" "$adapter_stdout_path" "$adapter_stderr_path" "$adapter_last_message_path" \
              "budget_policy_path=${policy_path}" \
              "consecutive_timeout_count=${consecutive_count}" \
              "timeout_circuit_breaker_threshold=${threshold}" \
              "timeout_circuit_breaker_cooldown_seconds=${cooldown_seconds}" \
              "circuit_breaker_until=${until_iso}"
          fi
          ;;
      esac
    fi
  fi
}

cleanup_stale_adapter_live_logs() {
  local stale_age_seconds stale_age_minutes
  local file cleaned_count=0

  stale_age_seconds="${AUTOFLOW_LIVE_LOG_STALE_AGE_SECONDS:-3600}"
  case "$stale_age_seconds" in
    ''|*[!0-9]*|0)
      stale_age_seconds=3600
      ;;
  esac

  stale_age_minutes=$(( (stale_age_seconds + 59) / 60 ))
  [ "$stale_age_minutes" -lt 1 ] && stale_age_minutes=1

  if [ ! -d "$(runner_log_dir)" ]; then
    return 0
  fi

  while IFS= read -r -d '' file; do
    [ -n "$file" ] || continue
    if [ "$file" = "$(runner_state_value "last_stdout_log")" ] || [ "$file" = "$(runner_state_value "last_stderr_log")" ]; then
      if [ "$(runner_state_value "status")" = "running" ] &&
         [ "$(runner_state_value "active_stage")" = "adapter_running" ] &&
         runner_pid_is_running "$(runner_state_value "pid")"; then
        continue
      fi
    fi
    rm -f "$file"
    cleaned_count=$((cleaned_count + 1))
  done < <(find "$(runner_log_dir)" -maxdepth 1 -type f \
    \( -name "${runner_id}_*_live_stdout.log" -o \
      -name "${runner_id}_*_live_stderr.log" -o \
      -name "${runner_id}_*_last_message.txt" \) \
    -mmin +"$stale_age_minutes" -print0 2>/dev/null)
  if [ "$cleaned_count" -gt 0 ]; then
    runner_append_log "$runner_id" "adapter_live_log_stale_cleanup" \
      "role=${public_role}" \
      "cleaned_count=${cleaned_count}" \
      "stale_age_seconds=${stale_age_seconds}"
  fi
}

cleanup_completed_adapter_live_logs() {
  local cleaned_count=0
  local path

  for path in "$@"; do
    [ -n "${path:-}" ] || continue
    [ -e "$path" ] || continue
    rm -f "$path"
    cleaned_count=$((cleaned_count + 1))
  done

  runner_append_log "$runner_id" "adapter_live_log_cleanup" \
    "reason=adapter_finished" \
    "cleaned_count=${cleaned_count}"
  printf 'adapter_live_log_cleanup=finished\n'
  printf 'adapter_live_log_cleaned_count=%s\n' "$cleaned_count"
}

prepare_adapter_live_logs() {
  local live_stamp

  cleanup_stale_adapter_live_logs

  runner_ensure_dirs
  live_stamp="$(artifact_stamp)"
  adapter_stdout="$(runner_log_dir)/${runner_id}_${live_stamp}_live_stdout.log"
  adapter_stderr="$(runner_log_dir)/${runner_id}_${live_stamp}_live_stderr.log"
  # AI 주도 sh 실행 원칙: Codex/Claude 같은 어댑터의 raw transcript 는 디버그용이고,
  # 사용자 view 에는 AI 의 narrative 만 surface 한다. 어댑터 실행 종료 후 이 파일에
  # AI 의 최종 메시지 (narrative) 만 담아 'narrative_text' envelope 으로 emit 한다.
  adapter_last_message="$(runner_log_dir)/${runner_id}_${live_stamp}_last_message.txt"
  : > "$adapter_stdout"
  : > "$adapter_stderr"
  : > "$adapter_last_message"
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
  clear_parked_or_stale_repairing_active_ticket_before_dispatch
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
    active_item="$(awk -F= '$1 == "order" || $1 == "spec" || $1 == "plan" || $1 == "reject_origin" || $1 == "todo_ticket" { sub(/^[^=]*=/, "", $0); print $0; exit }' "$preflight_output" 2>/dev/null || true)"
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
  maybe_skip_planner_parked_needs_user_preflight \
    "$preflight_status" \
    "$preflight_reason" \
    "$preflight_output" \
    "$preflight_log_path" || true

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
interval_seconds="$(runner_field "interval_seconds")"
realtime_enabled="$(runner_field "realtime_enabled")"
command_value="$(runner_field "command")"

[ -n "$agent" ] || agent="manual"
[ -n "$mode" ] || mode="one-shot"
[ -n "$enabled" ] || enabled="true"
[ -n "$realtime_enabled" ] || realtime_enabled="false"
interval_seconds="$(runner_normalize_interval_seconds "$interval_seconds")"
runner_config_fingerprint="$(runner_current_config_fingerprint)"
previous_applied_config_fingerprint="$(runner_state_field "$runner_id" "applied_config_fingerprint" 2>/dev/null || true)"
runner_config_applied_at="$(runner_state_field "$runner_id" "config_applied_at" 2>/dev/null || true)"
if [ -z "$runner_config_applied_at" ] || [ "$previous_applied_config_fingerprint" != "$runner_config_fingerprint" ]; then
  runner_config_applied_at="$(runner_now_iso)"
fi

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
  ticket:ticket-owner|ticket:owner|planner:planner|planner:plan|todo:todo|wiki:wiki-maintainer|wiki:wiki|wiki:coordinator|wiki:coord|wiki:doctor|wiki:diagnose|coordinator:coordinator|coordinator:coord|coordinator:doctor|coordinator:diagnose|self-improve:self-improve|self-improve:self_improve|self-improve:selfimprove)
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
elif [ "$public_role" = "coordinator" ]; then
  runtime_path="${SCRIPT_DIR}/coordinator-project.sh"
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
    maybe_skip_stale_planner_recovery_before_adapter || true

    started_at="$(runner_now_iso)"
    prompt_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-agent-prompt.XXXXXX")"
    autocommit_before_status="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-before-status.XXXXXX")"
    adapter_stdout=""
    adapter_stderr=""
    adapter_last_message=""
    ticket_goal_before_fingerprint="$(ticket_goal_progress_fingerprint_for_current_ticket || true)"
    prepare_adapter_live_logs
    role_autocommit_capture_status "$autocommit_before_status"
    wiki_pre_adapter_summary_output=""
    wiki_pre_adapter_summary_exit=0
    if [ "$public_role" = "wiki" ]; then
      set +e
      wiki_pre_adapter_summary_output="$("$runtime_path" summarize-telemetry "$project_root" "$board_dir_name" --slug-set telemetry-default --window 7d 2>&1)"
      wiki_pre_adapter_summary_exit=$?
      set -e
      if [ "$wiki_pre_adapter_summary_exit" -ne 0 ]; then
        printf '%s\n' "$wiki_pre_adapter_summary_output" > "$adapter_stderr"
        adapter_exit="$wiki_pre_adapter_summary_exit"
      fi
    fi
    write_agent_prompt "$instruction_file" > "$prompt_file"
    maybe_skip_stale_planner_recovery_before_adapter || true
    planner_differential_persist_after_prompt || true
    prompt_cap_applied="false"
    prompt_cap_original_bytes="0"
    prompt_cap_final_bytes="0"
    prompt_cap_capped_bytes="0"
    prompt_cap_byte_cap="0"
    prompt_cap_output="$(apply_role_prompt_byte_cap "$prompt_file")"
    prompt_cap_applied="$(printf '%s\n' "$prompt_cap_output" | sed -n 's/^applied=//p' | tail -n 1)"
    prompt_cap_original_bytes="$(printf '%s\n' "$prompt_cap_output" | sed -n 's/^original_bytes=//p' | tail -n 1)"
    prompt_cap_final_bytes="$(printf '%s\n' "$prompt_cap_output" | sed -n 's/^final_bytes=//p' | tail -n 1)"
    prompt_cap_capped_bytes="$(printf '%s\n' "$prompt_cap_output" | sed -n 's/^capped_bytes=//p' | tail -n 1)"
    prompt_cap_byte_cap="$(printf '%s\n' "$prompt_cap_output" | sed -n 's/^byte_cap=//p' | tail -n 1)"
    runner_budget_preflight_or_exit "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}" || true
    maybe_skip_stale_planner_recovery_before_adapter || true
    resolve_effective_reasoning_for_current_tick
    reasoning="$effective_reasoning"

    # tick 시작 시 status=running 으로 state 를 새로 쓰면 atomic mv 가 기존 필드를 모두 갈아엎는다.
    # consecutive_timeout_count 같은 누적 필드는 보존해야 하므로 미리 읽어서 다시 함께 써준다.
    preserved_consecutive_timeouts="$(runner_state_field "$runner_id" "consecutive_timeout_count" 2>/dev/null || true)"
    case "${preserved_consecutive_timeouts:-0}" in
      ''|*[!0-9]*) preserved_consecutive_timeouts=0 ;;
    esac

    runner_write_state "$runner_id" \
      "status=running" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "configured_reasoning=${configured_reasoning}" \
      $(runner_config_state_fields) \
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
      "consecutive_timeout_count=${preserved_consecutive_timeouts}" \
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
    if [ "$prompt_cap_applied" = "true" ]; then
      runner_append_log "$runner_id" "prompt_cap_applied" \
        "role=${public_role}" \
        "prompt_cap_env=$(role_prompt_byte_cap_env_name)" \
        "prompt_bytes_original=${prompt_cap_original_bytes}" \
        "prompt_bytes_final=${prompt_cap_final_bytes}" \
        "prompt_bytes_capped=${prompt_cap_capped_bytes}" \
        "prompt_byte_cap=${prompt_cap_byte_cap}"
    fi

    adapter_exit=0
    command_summary=""
    output_cap_applied="false"
    output_cap_target="none"
    output_cap_original_bytes="0"
    output_cap_final_bytes="0"
    output_cap_capped_bytes="0"
    output_cap_token_cap="0"
    output_cap_byte_cap="0"

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
        $(runner_config_state_fields) \
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
      printf 'dry_run=true\n'
      printf 'runner_status=idle\n'
      printf 'adapter=%s\n' "$agent"
      printf 'configured_reasoning=%s\n' "$configured_reasoning"
      printf 'effective_reasoning=%s\n' "$reasoning"
      printf 'reasoning_source=%s\n' "$reasoning_source"
      printf 'reasoning_complexity=%s\n' "$reasoning_complexity"
      printf 'reasoning_actionable_count=%s\n' "$reasoning_actionable_count"
      printf 'reasoning_reject_count=%s\n' "$reasoning_reject_count"
      printf 'runtime_script=%s\n' "$runtime_path"
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
      rm -f "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}"
      exit 0
    fi

    maybe_skip_adapter_for_process_pressure "$prompt_file" "$autocommit_before_status" "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}" || true

    adapter_heartbeat_pid=""
    start_adapter_heartbeat_monitor
    set +e
    if [ "${wiki_pre_adapter_summary_exit:-0}" -ne 0 ]; then
      :
    elif [ -n "$command_value" ]; then
      run_custom_adapter_command "$prompt_file"
      adapter_exit=$?
    else
      run_default_adapter_command "$prompt_file"
      adapter_exit=$?
    fi
    stop_adapter_heartbeat_monitor
    set -e

    output_cap_output="$(apply_role_output_token_cap)"
    output_cap_applied="$(printf '%s\n' "$output_cap_output" | sed -n 's/^applied=//p' | tail -n 1)"
    output_cap_target="$(printf '%s\n' "$output_cap_output" | sed -n 's/^target=//p' | tail -n 1)"
    output_cap_original_bytes="$(printf '%s\n' "$output_cap_output" | sed -n 's/^original_bytes=//p' | tail -n 1)"
    output_cap_final_bytes="$(printf '%s\n' "$output_cap_output" | sed -n 's/^final_bytes=//p' | tail -n 1)"
    output_cap_capped_bytes="$(printf '%s\n' "$output_cap_output" | sed -n 's/^capped_bytes=//p' | tail -n 1)"
    output_cap_token_cap="$(printf '%s\n' "$output_cap_output" | sed -n 's/^token_cap=//p' | tail -n 1)"
    output_cap_byte_cap="$(printf '%s\n' "$output_cap_output" | sed -n 's/^byte_cap=//p' | tail -n 1)"
    if [ "$output_cap_applied" = "true" ]; then
      runner_append_log "$runner_id" "output_cap_applied" \
        "role=${public_role}" \
        "output_cap_env=$(role_output_token_cap_env_name)" \
        "output_cap_target=${output_cap_target}" \
        "output_bytes_original=${output_cap_original_bytes}" \
        "output_bytes_final=${output_cap_final_bytes}" \
        "output_bytes_capped=${output_cap_capped_bytes}" \
        "output_token_cap=${output_cap_token_cap}" \
        "output_byte_cap=${output_cap_byte_cap}" \
        "output_truncated=true"
    fi

    if [ "$adapter_exit" -eq 0 ] && runner_file_has_adapter_start_failure "$adapter_stdout" "$adapter_stderr"; then
      adapter_exit=126
    fi

    finished_at="$(runner_now_iso)"
    run_role_record_worker_tick_telemetry "$started_at" "$finished_at" "$adapter_exit" "$adapter_stdout" "$adapter_stderr" "$prompt_file" || true
    planner_differential_finalize_after_run || true
    if [ "$adapter_exit" -eq 0 ]; then
      command_status="ok"
      runner_status="idle"
    elif [ "$adapter_exit" -eq 125 ]; then
      command_status="blocked"
      runner_status="blocked"
    elif [ "$adapter_exit" -eq 124 ]; then
      # adapter watchdog timeout (run_with_timeout). 다음 tick 에서 재시도하도록 idle 로 둔다.
      # 누적 timeout 처리는 consecutive_timeout_count 기반 fallback 에서 수행한다.
      command_status="timeout"
      runner_status="idle"
    elif [ "$adapter_exit" -eq 127 ]; then
      command_status="blocked"
      runner_status="blocked"
    elif [ "$adapter_exit" -eq 126 ]; then
      command_status="blocked"
      runner_status="blocked"
    elif runner_file_has_quota_limit "$adapter_stdout" "$adapter_stderr"; then
      command_status="blocked"
      runner_status="stopped"
    else
      command_status="failed"
      runner_status="failed"
    fi
    adapter_finish_classification="$(adapter_finish_class "$adapter_exit" "$runner_status" "${output_cap_applied:-false}")"

	    prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
	    stdout_log_path=""
	    stderr_log_path="$(persist_run_artifact "$adapter_stderr" "stderr")"
    autocommit_output="$(role_autocommit_after_adapter "$adapter_exit" "$autocommit_before_status" 2>&1)"
    if [ "$adapter_exit" -eq 124 ]; then
      timeout_cleanup_output="$(role_post_adapter_cleanup_on_timeout "$adapter_exit" 2>&1)"
      if [ -n "$timeout_cleanup_output" ]; then
        autocommit_output="${autocommit_output}${autocommit_output:+$'\n'}${timeout_cleanup_output}"
      fi
    fi
    if [ "$adapter_exit" -eq 0 ]; then
      wiki_record_inputs_fingerprint
    fi
    ticket_goal_record_adapter_result_for_current_ticket "$adapter_exit" "$ticket_goal_before_fingerprint" || true

    # 직전 state 의 consecutive_timeout_count 를 읽어 갱신.
    # adapter_exit==124 (timeout) 면 +1, 0 (성공) 이면 0 으로 reset, 그 외는 보존.
    prev_consecutive_timeouts="$(runner_state_field "$runner_id" "consecutive_timeout_count" 2>/dev/null || true)"
    case "${prev_consecutive_timeouts:-0}" in
      ''|*[!0-9]*) prev_consecutive_timeouts=0 ;;
    esac
    if [ "$adapter_exit" -eq 124 ]; then
      consecutive_timeout_count=$((prev_consecutive_timeouts + 1))
    elif [ "$adapter_exit" -eq 0 ]; then
      consecutive_timeout_count=0
    else
      consecutive_timeout_count="$prev_consecutive_timeouts"
    fi
    adapter_timeout_seconds_for_log="$(runner_resolve_int_env "AUTOFLOW_AGENT_TIMEOUT_SECONDS" 1200)"
    adapter_kill_after_seconds_for_log="$(runner_resolve_int_env "AUTOFLOW_AGENT_KILL_AFTER_SECONDS" 30)"
    adapter_timeout_fallback_threshold="$(runner_resolve_int_env "AUTOFLOW_AGENT_TIMEOUT_FALLBACK_THRESHOLD" 3)"
    finished_active_item="$(runner_adapter_state_value "active_item")"
    finished_active_ticket_id="$(runner_adapter_state_value "active_ticket_id")"
    finished_active_ticket_title="$(runner_adapter_state_value "active_ticket_title")"
    finished_active_stage="$(runner_adapter_state_value "active_stage")"
    finished_active_spec_ref="$(runner_adapter_state_value "active_spec_ref")"
    finished_active_recovery_reason="${adapter_active_recovery_reason}"
    finished_active_recovery_status="${adapter_active_recovery_status}"
    finished_active_recovery_failure_class="${adapter_active_recovery_failure_class}"
    finished_active_recovery_worktree_path="${adapter_active_recovery_worktree_path}"
    finished_active_recovery_worktree_status="${adapter_active_recovery_worktree_status}"
    finished_active_recovery_board_state="${adapter_active_recovery_board_state}"
    case "${public_role}:${runner_status}" in
      planner:idle|wiki:idle)
        finished_active_item=""
        finished_active_ticket_id=""
        finished_active_ticket_title=""
        finished_active_stage=""
        finished_active_spec_ref=""
        finished_active_recovery_reason=""
        finished_active_recovery_status=""
        finished_active_recovery_failure_class=""
        finished_active_recovery_worktree_path=""
        finished_active_recovery_worktree_status=""
        finished_active_recovery_board_state=""
        ;;
    esac
    clear_finished_ticket_active_state_if_resolved

    runner_write_state "$runner_id" \
      "status=${runner_status}" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "configured_reasoning=${configured_reasoning}" \
      $(runner_config_state_fields) \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "active_item=${finished_active_item}" \
      "active_ticket_id=${finished_active_ticket_id}" \
      "active_ticket_title=${finished_active_ticket_title}" \
      "active_stage=${finished_active_stage}" \
      "active_spec_ref=${finished_active_spec_ref}" \
      "active_recovery_reason=${finished_active_recovery_reason}" \
      "active_recovery_status=${finished_active_recovery_status}" \
      "active_recovery_failure_class=${finished_active_recovery_failure_class}" \
      "active_recovery_worktree_path=${finished_active_recovery_worktree_path}" \
      "active_recovery_worktree_status=${finished_active_recovery_worktree_status}" \
      "active_recovery_board_state=${finished_active_recovery_board_state}" \
      "pid=$([ "$runner_status" = "stopped" ] && printf '' || runner_state_pid_for_finish)" \
      "started_at=$(runner_state_started_at "$started_at")" \
      "last_event_at=${finished_at}" \
      "last_adapter_chunk_at=$(runner_state_field "$runner_id" "last_adapter_chunk_at" 2>/dev/null || true)" \
      "last_result=$(
        if [ "$runner_status" = "stopped" ]; then printf 'quota_limited';
        elif [ "$adapter_exit" -eq 125 ]; then printf 'adapter_auth_required';
        elif [ "$adapter_exit" -eq 126 ]; then printf 'adapter_start_failed';
        elif [ "$adapter_exit" -eq 0 ] && [ "$public_role" = "wiki" ]; then printf 'success';
        elif [ "$adapter_exit" -eq 124 ]; then
          if [ "$consecutive_timeout_count" -ge "$adapter_timeout_fallback_threshold" ]; then
            printf 'adapter_timeout_fallback';
          else
            printf 'adapter_timeout';
          fi
        else printf 'adapter_exit_%s' "$adapter_exit"; fi
      )" \
      "last_runtime_log=$(runner_adapter_preserved_state_value "last_runtime_log")" \
      "last_prompt_log=${prompt_log_path}" \
      "last_stdout_log=${stdout_log_path}" \
      "last_stderr_log=${stderr_log_path}" \
      "consecutive_timeout_count=${consecutive_timeout_count}" \
      "consecutive_preflight_skip_count=$([ "$adapter_exit" -eq 0 ] && printf '0' || runner_adapter_preserved_state_value "consecutive_preflight_skip_count")" \
      "consecutive_preflight_skip_result=$([ "$adapter_exit" -eq 0 ] && printf '' || runner_adapter_preserved_state_value "consecutive_preflight_skip_result")" \
      "last_preflight_skip_at=$([ "$adapter_exit" -eq 0 ] && printf '' || runner_adapter_preserved_state_value "last_preflight_skip_at")"
    runner_append_log "$runner_id" "adapter_finish" \
      "role=${public_role}" \
      "agent=${agent}" \
      "exit_code=${adapter_exit}" \
      "runner_status=${runner_status}" \
      "output_truncated=${output_cap_applied}" \
      "finish_class=${adapter_finish_classification}" \
      "watchdog_signal=$([ "$adapter_exit" -eq 124 ] && printf 'SIGTERM' || printf 'none')" \
      "timeout_cleanup=$([ "$adapter_exit" -eq 124 ] && printf 'true' || printf 'false')" \
      "output_cap_env=$(role_output_token_cap_env_name)" \
      "output_cap_target=${output_cap_target}" \
      "output_token_cap=${output_cap_token_cap}" \
      "configured_reasoning=${configured_reasoning}" \
      "effective_reasoning=${reasoning}" \
      "reasoning_source=${reasoning_source}" \
      "reasoning_complexity=${reasoning_complexity}" \
      "reasoning_actionable_count=${reasoning_actionable_count}" \
      "reasoning_reject_count=${reasoning_reject_count}" \
      "reason=$(
        if [ "$runner_status" = "stopped" ]; then printf 'quota_limited';
        elif [ "$adapter_exit" -eq 125 ]; then printf 'adapter_auth_required';
        elif [ "$adapter_exit" -eq 126 ]; then printf 'adapter_start_failed';
        elif [ "$adapter_exit" -eq 124 ]; then printf 'adapter_timeout';
        else true; fi
      )" \
      "consecutive_timeout_count=${consecutive_timeout_count}" \
      "command=${command_summary}"
    if [ "$adapter_exit" -eq 124 ]; then
      runner_append_log "$runner_id" "adapter_timeout" \
      "role=${public_role}" \
      "agent=${agent}" \
      "timeout_seconds=${adapter_timeout_seconds_for_log}" \
      "kill_after_seconds=${adapter_kill_after_seconds_for_log}" \
      "finish_class=${adapter_finish_classification}" \
      "watchdog_signal=SIGTERM" \
      "consecutive_count=${consecutive_timeout_count}" \
        "command=${command_summary}"
      if [ "$consecutive_timeout_count" -ge "$adapter_timeout_fallback_threshold" ]; then
        runner_append_log "$runner_id" "adapter_timeout_fallback" \
          "role=${public_role}" \
          "agent=${agent}" \
          "consecutive_count=${consecutive_timeout_count}" \
          "threshold=${adapter_timeout_fallback_threshold}" \
          "fallback_action=needs_user_marker" \
          "command=${command_summary}"
      fi
    fi

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
    if [ -n "${wiki_pre_adapter_summary_output:-}" ]; then
      printf 'wiki_pre_adapter_summary_begin\n'
      printf '%s\n' "$wiki_pre_adapter_summary_output"
      printf 'wiki_pre_adapter_summary_end\n'
    fi
    printf 'prompt_log_path=%s\n' "$prompt_log_path"
    printf 'stdout_log_path=%s\n' "$stdout_log_path"
    printf 'stderr_log_path=%s\n' "$stderr_log_path"
    if [ "$adapter_exit" -eq 127 ]; then
      printf 'reason=adapter_executable_missing\n'
    elif [ "$adapter_exit" -eq 125 ]; then
      printf 'reason=adapter_auth_required\n'
    elif [ "$adapter_exit" -eq 126 ]; then
      printf 'reason=adapter_start_failed\n'
    elif [ "$adapter_exit" -eq 124 ]; then
      printf 'reason=adapter_timeout\n'
      printf 'consecutive_timeout_count=%s\n' "${consecutive_timeout_count:-0}"
      if [ "${consecutive_timeout_count:-0}" -ge "${adapter_timeout_fallback_threshold:-3}" ]; then
        printf 'fallback=needs_user (consecutive_timeouts>=%s)\n' "${adapter_timeout_fallback_threshold:-3}"
      fi
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
    # AI 의 최종 메시지(narrative_text) 만 사용자 view 에 surface 한다.
    # renderer 는 adapter_stdout content 를 drop 하고 narrative_text content 를 keep.
    if [ -n "${adapter_last_message:-}" ] && [ -f "$adapter_last_message" ] && [ -s "$adapter_last_message" ]; then
      emit_file_block "narrative_text" "$adapter_last_message"
    fi
    cleanup_completed_adapter_live_logs "$adapter_stdout" "$adapter_stderr" "${adapter_last_message:-}"
    rm -f "$prompt_file" "$autocommit_before_status"
    if [ "$adapter_exit" -ne 0 ] && [ "$adapter_exit" -ne 124 ] && [ "$adapter_exit" -ne 127 ] && [ "$runner_status" != "stopped" ]; then
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
    printf 'dry_run=true\n'
    printf 'runner_status=idle\n'
    printf 'runtime_script=%s\n' "$runtime_path"
    printf 'adapter=%s\n' "$agent"
    printf 'reason=dry_run\n'
    printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
    printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  } > "$dry_run_output"

  runtime_output_log_path="$(persist_run_artifact "$dry_run_output" "dry-run")"
  if [ -n "$runtime_output_log_path" ]; then
    printf 'runtime_output_log_path=%s\n' "$runtime_output_log_path" >> "$runtime_output_log_path"
  fi

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

  if [ -n "$runtime_output_log_path" ]; then
    cat "$runtime_output_log_path"
  else
    cat "$dry_run_output"
  fi
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
  $(runner_config_state_fields) \
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
elif [ "$public_role" = "coordinator" ]; then
  runtime_command+=("$project_root" "$board_dir_name")
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

if [ "$runtime_exit" -eq 0 ] && [ "$runtime_status" = "blocked" ]; then
  command_status="blocked"
  runner_status="blocked"
elif [ "$runtime_exit" -eq 0 ] && [ "$runtime_status" = "idle" ]; then
  command_status="ok"
  runner_status="idle"
elif [ "$runtime_exit" -eq 0 ]; then
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
  $(runner_config_state_fields) \
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
