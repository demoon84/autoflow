#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
package_version="$(package_version_value)"

error_count=0
warning_count=0
check_output="$(mktemp)"
detail_output="$(mktemp)"
ticket_locations_output="$(mktemp)"
duplicate_ticket_ids_output="$(mktemp)"
worktree_heads_output="$(mktemp)"

cleanup() {
  rm -f "$check_output" "$detail_output" "$ticket_locations_output" "$duplicate_ticket_ids_output" "$worktree_heads_output"
}
trap cleanup EXIT

record_check() {
  local check_id="$1"
  local result="$2"
  printf 'check.%s=%s\n' "$check_id" "$result" >> "$check_output"
}

record_error() {
  local message="$1"
  error_count=$((error_count + 1))
  printf 'error.%s=%s\n' "$error_count" "$message" >> "$detail_output"
}

record_warning() {
  local message="$1"
  warning_count=$((warning_count + 1))
  printf 'warning.%s=%s\n' "$warning_count" "$message" >> "$detail_output"
}

ticket_field_present() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    /^## Ticket/ { in_ticket=1; next }
    /^## / && in_ticket { in_ticket=0 }
    in_ticket && $0 ~ "^- " field ":" { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

check_id_fragment() {
  printf '%s' "$1" | sed 's/[^A-Za-z0-9_]/_/g'
}

trim_markdown_value() {
  local raw="${1:-}"

  raw="$(printf '%s' "$raw" | tr -d '\r')"
  raw="$(printf '%s' "$raw" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  if printf '%s' "$raw" | grep -qE '^\[[^]]+\]\([^)]+\)$'; then
    raw="$(printf '%s' "$raw" | sed -E 's/^\[[^]]+\]\(([^)]+)\)$/\1/')"
  elif printf '%s' "$raw" | grep -qE '^\[\[[^]]+\]\]$'; then
    raw="$(printf '%s' "$raw" | sed -E 's/^\[\[([^]|]+)(\|[^]]+)?\]\]$/\1/')"
  else
    raw="${raw#\`}"
    raw="${raw%\`}"
  fi
  printf '%s' "$raw"
}

markdown_scalar_field() {
  local file="$1"
  local heading="$2"
  local field="$3"

  awk -v heading="$heading" -v field="$field" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section {
      pattern = "^[[:space:]]*[-*][[:space:]]*" field ":[[:space:]]*"
      if ($0 ~ pattern) {
        sub(pattern, "", $0)
        print
        found=1
        exit
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

ticket_scalar() {
  markdown_scalar_field "$1" "Ticket" "$2"
}

ticket_worktree_scalar() {
  trim_markdown_value "$(markdown_scalar_field "$1" "Worktree" "$2")"
}

ticket_numeric_id() {
  local file="$1"
  local base

  base="$(basename "$file")"
  case "$base" in
    tickets_[0-9][0-9][0-9].md)
      printf '%s' "${base#tickets_}" | sed 's/\.md$//'
      ;;
    *)
      return 1
      ;;
  esac
}

ticket_state_folder() {
  local file="$1"
  local rel

  rel="${file#${board_root}/tickets/}"
  printf '%s' "${rel%%/*}"
}

allowed_path_is_concrete() {
  local path="${1:-}"

  case "$path" in
    ""|TODO:*|TODO|todo:*|todo|/*|../*|*/../*|*"*"*|*"?"*|*"["*|*"]"*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

ticket_allowed_paths() {
  local file="$1"

  awk '
    /^## Allowed Paths/ { in_allowed=1; next }
    /^## / && in_allowed { in_allowed=0 }
    in_allowed && /^[[:space:]]*[-*] / {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      gsub(/`/, "", $0)
      sub(/^[[:space:]]+/, "", $0)
      sub(/[[:space:]]+$/, "", $0)
      if ($0 != "" && $0 != "...") print
    }
  ' "$file" 2>/dev/null
}

ticket_concrete_allowed_paths() {
  local ticket_file="$1"
  local allowed_path

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_path_is_concrete "$allowed_path" || continue
    printf '%s\n' "$allowed_path"
  done < <(ticket_allowed_paths "$ticket_file") | sort -u
}

join_lines_csv() {
  awk '
    NF > 0 {
      if (out != "") out = out ","
      out = out $0
    }
    END { print out }
  '
}

ticket_conflict_stage() {
  case "${1:-}" in
    planning|claimed|executing|ready_for_verification|verifying|blocked|ready-to-merge|merge-blocked)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

active_ticket_files() {
  local active_dir

  for active_dir in inprogress ready-to-merge merge-blocked; do
    [ -d "${board_root}/tickets/${active_dir}" ] || continue
    find "${board_root}/tickets/${active_dir}" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md'
  done | sort
}

shared_allowed_path_blockers() {
  local ticket_file="$1"
  local ticket_id ticket_num current_paths other_file other_id other_num other_stage
  local other_path found=false

  ticket_id="$(ticket_numeric_id "$ticket_file" 2>/dev/null || true)"
  [ -n "$ticket_id" ] || return 1
  ticket_num="$((10#$ticket_id))"
  current_paths="$(ticket_concrete_allowed_paths "$ticket_file")"
  [ -n "$current_paths" ] || return 1

  while IFS= read -r other_file; do
    [ -n "$other_file" ] || continue
    [ "$other_file" != "$ticket_file" ] || continue

    other_id="$(ticket_numeric_id "$other_file" 2>/dev/null || true)"
    [ -n "$other_id" ] || continue
    other_num="$((10#$other_id))"
    [ "$other_num" -lt "$ticket_num" ] || continue

    other_stage="$(trim_markdown_value "$(ticket_scalar "$other_file" "Stage")")"
    ticket_conflict_stage "$other_stage" || continue

    while IFS= read -r other_path; do
      [ -n "$other_path" ] || continue
      if printf '%s\n' "$current_paths" | grep -Fqx -- "$other_path"; then
        printf 'tickets_%s:%s\n' "$other_id" "$other_path"
        found=true
      fi
    done < <(ticket_concrete_allowed_paths "$other_file")
  done < <(active_ticket_files)

  [ "$found" = "true" ]
}

append_csv_value() {
  local current="$1"
  local value="$2"

  if [ -z "$current" ]; then
    printf '%s' "$value"
  else
    printf '%s,%s' "$current" "$value"
  fi
}

physical_path_equals() {
  local left="$1"
  local right="$2"
  local left_physical right_physical

  [ -d "$left" ] || return 1
  [ -d "$right" ] || return 1
  left_physical="$(cd "$left" && pwd -P)"
  right_physical="$(cd "$right" && pwd -P)"
  [ "$left_physical" = "$right_physical" ]
}

record_active_ticket_diagnostics() {
  local active_count=0
  local shared_blocked_count=0
  local worktree_issue_count=0
  local dirty_overlap_count=0
  local risk_hint_count=0
  local shared_head_group_count=0
  local operational_issue_count=0
  local project_is_git=false
  local ticket_file ticket_id check_id ticket_state stage allowed_paths allowed_summary
  local blockers blockers_summary dirty_paths allowed_path git_status
  local worktree_path worktree_branch_expected worktree_branch_actual worktree_head base_commit integration_status
  local worktree_status head duplicate_ids duplicate_count head_ticket_ids head_ticket_paths

  : > "$worktree_heads_output"

  if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    project_is_git=true
  fi

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    ticket_id="$(ticket_numeric_id "$ticket_file" 2>/dev/null || true)"
    [ -n "$ticket_id" ] || continue
    check_id="ticket_${ticket_id}"
    active_count=$((active_count + 1))
    ticket_state="$(ticket_state_folder "$ticket_file")"
    stage="$(trim_markdown_value "$(ticket_scalar "$ticket_file" "Stage")")"
    allowed_paths="$(ticket_concrete_allowed_paths "$ticket_file")"
    allowed_summary="$(printf '%s\n' "$allowed_paths" | join_lines_csv)"

    printf 'doctor.ticket.%s.file=%s\n' "$ticket_id" "$ticket_file" >> "$check_output"
    printf 'doctor.ticket.%s.state=%s\n' "$ticket_id" "$ticket_state" >> "$check_output"
    printf 'doctor.ticket.%s.stage=%s\n' "$ticket_id" "$stage" >> "$check_output"
    printf 'doctor.ticket.%s.allowed_paths=%s\n' "$ticket_id" "$allowed_summary" >> "$check_output"

    if [ -z "$allowed_summary" ]; then
      record_check "${check_id}_allowed_paths" "warning"
      record_warning "ticket ${ticket_id} has no concrete Allowed Paths; narrow it before editing product code"
      operational_issue_count=$((operational_issue_count + 1))
    else
      record_check "${check_id}_allowed_paths" "ok"
    fi

    blockers="$(shared_allowed_path_blockers "$ticket_file" || true)"
    if [ -n "$blockers" ]; then
      blockers_summary="$(printf '%s\n' "$blockers" | join_lines_csv)"
      shared_blocked_count=$((shared_blocked_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
      record_check "${check_id}_shared_path_blockers" "warning"
      printf 'doctor.ticket.%s.blockers=%s\n' "$ticket_id" "$blockers_summary" >> "$check_output"
      record_warning "ticket ${ticket_id} is blocked by lower-number active ticket Allowed Paths: ${blockers_summary}"
    else
      record_check "${check_id}_shared_path_blockers" "ok"
      printf 'doctor.ticket.%s.blockers=\n' "$ticket_id" >> "$check_output"
    fi

    dirty_paths=""
    if [ "$project_is_git" = "true" ]; then
      while IFS= read -r allowed_path; do
        [ -n "$allowed_path" ] || continue
        git_status="$(git -C "$project_root" status --porcelain --untracked-files=all -- "$allowed_path" 2>/dev/null || true)"
        if [ -n "$git_status" ]; then
          dirty_paths="$(append_csv_value "$dirty_paths" "$allowed_path")"
        fi
      done < <(printf '%s\n' "$allowed_paths")
    fi

    if [ -n "$dirty_paths" ]; then
      dirty_overlap_count=$((dirty_overlap_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
      record_check "${check_id}_project_root_dirty_allowed_paths" "warning"
      printf 'doctor.ticket.%s.project_root_dirty_allowed_paths=%s\n' "$ticket_id" "$dirty_paths" >> "$check_output"
      record_warning "ticket ${ticket_id} Allowed Paths overlap dirty PROJECT_ROOT paths: ${dirty_paths}"
    elif [ "$project_is_git" = "true" ] && [ -n "$allowed_summary" ]; then
      record_check "${check_id}_project_root_dirty_allowed_paths" "ok"
      printf 'doctor.ticket.%s.project_root_dirty_allowed_paths=\n' "$ticket_id" >> "$check_output"
    else
      record_check "${check_id}_project_root_dirty_allowed_paths" "not_applicable"
      printf 'doctor.ticket.%s.project_root_dirty_allowed_paths=\n' "$ticket_id" >> "$check_output"
    fi

    worktree_path="$(ticket_worktree_scalar "$ticket_file" "Path")"
    worktree_branch_expected="$(ticket_worktree_scalar "$ticket_file" "Branch")"
    base_commit="$(ticket_worktree_scalar "$ticket_file" "Base Commit")"
    integration_status="$(ticket_worktree_scalar "$ticket_file" "Integration Status")"
    printf 'doctor.ticket.%s.worktree_path=%s\n' "$ticket_id" "$worktree_path" >> "$check_output"
    printf 'doctor.ticket.%s.worktree_branch=%s\n' "$ticket_id" "$worktree_branch_expected" >> "$check_output"
    printf 'doctor.ticket.%s.worktree_base_commit=%s\n' "$ticket_id" "$base_commit" >> "$check_output"
    printf 'doctor.ticket.%s.integration_status=%s\n' "$ticket_id" "$integration_status" >> "$check_output"

    worktree_status="not_recorded"
    if [ -z "$worktree_path" ] && { [ "$integration_status" = "project_root_fallback" ] || [ "$integration_status" = "disabled" ] || [ "$integration_status" = "not_git_repo" ] || [ "$integration_status" = "no_head_commit" ]; }; then
      worktree_status="project_root_workspace"
      record_check "${check_id}_worktree" "warning"
      record_warning "ticket ${ticket_id} uses PROJECT_ROOT workspace through Integration Status ${integration_status}; overlapping active tickets will serialize on shared Allowed Paths"
      worktree_issue_count=$((worktree_issue_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
    elif [ -z "$worktree_path" ]; then
      record_check "${check_id}_worktree" "warning"
      record_warning "ticket ${ticket_id} has no Worktree Path recorded"
      worktree_issue_count=$((worktree_issue_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
    elif [ ! -d "$worktree_path" ]; then
      worktree_status="missing"
      record_check "${check_id}_worktree" "warning"
      record_warning "ticket ${ticket_id} Worktree Path is missing: ${worktree_path}"
      worktree_issue_count=$((worktree_issue_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
    elif ! git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      worktree_status="not_git_worktree"
      record_check "${check_id}_worktree" "warning"
      record_warning "ticket ${ticket_id} Worktree Path is not a git worktree: ${worktree_path}"
      worktree_issue_count=$((worktree_issue_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
    else
      worktree_status="ok"
      worktree_head="$(git -C "$worktree_path" rev-parse --verify HEAD 2>/dev/null || true)"
      worktree_branch_actual="$(git -C "$worktree_path" symbolic-ref --short HEAD 2>/dev/null || true)"
      printf 'doctor.ticket.%s.worktree_head=%s\n' "$ticket_id" "$worktree_head" >> "$check_output"
      printf 'doctor.ticket.%s.worktree_actual_branch=%s\n' "$ticket_id" "$worktree_branch_actual" >> "$check_output"
      if [ -n "$worktree_head" ]; then
        printf '%s\t%s\t%s\t%s\n' "$worktree_head" "$base_commit" "$ticket_id" "$worktree_path" >> "$worktree_heads_output"
      fi
      if [ -n "$worktree_branch_expected" ] && [ -n "$worktree_branch_actual" ] && [ "$worktree_branch_expected" != "$worktree_branch_actual" ]; then
        worktree_status="branch_mismatch"
        record_warning "ticket ${ticket_id} Worktree Branch ${worktree_branch_expected} does not match actual branch ${worktree_branch_actual}"
      fi
      if physical_path_equals "$worktree_path" "$project_root"; then
        worktree_status="project_root_workspace"
        record_warning "ticket ${ticket_id} uses PROJECT_ROOT as its worktree; overlapping active tickets will serialize on shared Allowed Paths"
      fi
      if [ "$worktree_status" = "ok" ]; then
        record_check "${check_id}_worktree" "ok"
      else
        record_check "${check_id}_worktree" "warning"
        worktree_issue_count=$((worktree_issue_count + 1))
        operational_issue_count=$((operational_issue_count + 1))
      fi
    fi
    printf 'doctor.ticket.%s.worktree_status=%s\n' "$ticket_id" "$worktree_status" >> "$check_output"

    if grep -Eiq 'out[- ]of[- ]scope|outside (this ticket'"'"'s )?Allowed Paths|wrong snapshot|shared[- ]head|project_root_fallback|not a git worktree' "$ticket_file"; then
      risk_hint_count=$((risk_hint_count + 1))
      operational_issue_count=$((operational_issue_count + 1))
      record_check "${check_id}_risk_hints" "warning"
      printf 'doctor.ticket.%s.blocker_hint=out_of_scope_or_snapshot_risk\n' "$ticket_id" >> "$check_output"
      record_warning "ticket ${ticket_id} contains notes that hint at out-of-scope, shared-head, project-root fallback, or worktree snapshot risk"
    else
      record_check "${check_id}_risk_hints" "ok"
      printf 'doctor.ticket.%s.blocker_hint=\n' "$ticket_id" >> "$check_output"
    fi
  done < <(active_ticket_files)

  if [ -s "$worktree_heads_output" ]; then
    while IFS= read -r head; do
      [ -n "$head" ] || continue
      duplicate_ids="$(awk -F '\t' -v head="$head" '$1 == head && $2 != head { print $3 }' "$worktree_heads_output" | join_lines_csv)"
      duplicate_count="$(awk -F '\t' -v head="$head" '$1 == head && $2 != head { count++ } END { print count + 0 }' "$worktree_heads_output")"
      if [ "$duplicate_count" -gt 1 ]; then
        shared_head_group_count=$((shared_head_group_count + 1))
        operational_issue_count=$((operational_issue_count + 1))
        head_ticket_paths="$(awk -F '\t' -v head="$head" '$1 == head && $2 != head { print "tickets_" $3 ":" $4 }' "$worktree_heads_output" | join_lines_csv)"
        printf 'doctor.worktree.shared_nonbase_head.%s.head=%s\n' "$shared_head_group_count" "$head" >> "$check_output"
        printf 'doctor.worktree.shared_nonbase_head.%s.tickets=%s\n' "$shared_head_group_count" "$duplicate_ids" >> "$check_output"
        printf 'doctor.worktree.shared_nonbase_head.%s.paths=%s\n' "$shared_head_group_count" "$head_ticket_paths" >> "$check_output"
        record_warning "multiple active ticket worktrees share non-base HEAD ${head}: ${duplicate_ids}"
      fi
    done < <(cut -f1 "$worktree_heads_output" | sort | uniq -d)
  fi

  printf 'doctor.active_ticket_count=%s\n' "$active_count" >> "$check_output"
  printf 'doctor.shared_path_blocked_ticket_count=%s\n' "$shared_blocked_count" >> "$check_output"
  printf 'doctor.worktree_issue_count=%s\n' "$worktree_issue_count" >> "$check_output"
  printf 'doctor.project_root_dirty_overlap_count=%s\n' "$dirty_overlap_count" >> "$check_output"
  printf 'doctor.risk_hint_ticket_count=%s\n' "$risk_hint_count" >> "$check_output"
  printf 'doctor.shared_nonbase_head_group_count=%s\n' "$shared_head_group_count" >> "$check_output"

  if [ "$active_count" -eq 0 ]; then
    record_check "operational_blockers" "no_active_tickets"
  elif [ "$operational_issue_count" -gt 0 ]; then
    record_check "operational_blockers" "warning"
  else
    record_check "operational_blockers" "ok"
  fi
}

record_runner_adapter_check() {
  local runner_id="$1"
  local role="$2"
  local agent="$3"
  local mode="$4"
  local enabled="$5"
  local command_value="$6"
  local interval_seconds="$7"
  local check_id adapter_path

  check_id="runner_$(check_id_fragment "$runner_id")"
  [ -n "$agent" ] || agent="manual"
  [ -n "$mode" ] || mode="one-shot"
  [ -n "$enabled" ] || enabled="true"
  [ -n "$interval_seconds" ] || interval_seconds="60"

  record_check "${check_id}_defined" "ok"
  printf 'runner.%s.role=%s\n' "$check_id" "$role" >> "$check_output"
  printf 'runner.%s.agent=%s\n' "$check_id" "$agent" >> "$check_output"
  printf 'runner.%s.interval_seconds=%s\n' "$check_id" "$interval_seconds" >> "$check_output"

  case "$role" in
      ticket-owner|owner|planner|todo|verifier|wiki-maintainer|coordinator|doctor|watcher)
      record_check "${check_id}_role" "ok"
      ;;
    *)
      record_check "${check_id}_role" "warning"
      record_warning "runner ${runner_id} has unsupported role=${role:-empty}; expected ticket-owner, planner, todo, verifier, wiki-maintainer, coordinator, doctor, or watcher"
      ;;
  esac

  case "$enabled" in
    true|false)
      record_check "${check_id}_enabled" "ok"
      ;;
    *)
      record_check "${check_id}_enabled" "warning"
      record_warning "runner ${runner_id} has invalid enabled=${enabled}; expected true or false"
      ;;
  esac

  if [ "$enabled" != "true" ]; then
    record_check "${check_id}_adapter" "disabled"
    record_check "${check_id}_interval" "disabled"
    return
  fi

  case "$mode" in
    one-shot|loop)
      record_check "${check_id}_mode" "ok"
      ;;
    watch)
      record_check "${check_id}_mode" "warning"
      record_warning "runner ${runner_id} uses mode=watch; use the file watcher controls until watcher runners are implemented"
      ;;
    *)
      record_check "${check_id}_mode" "warning"
      record_warning "runner ${runner_id} uses unsupported mode=${mode}; expected one-shot, loop, or watch"
      ;;
  esac

  if [ "$mode" = "loop" ]; then
    case "$interval_seconds" in
      ""|*[!0-9]*)
        record_check "${check_id}_interval" "warning"
        record_warning "runner ${runner_id} has invalid interval_seconds=${interval_seconds:-empty}; expected an integer between 1 and 86400"
        ;;
      *)
        if [ "$interval_seconds" -lt 1 ] || [ "$interval_seconds" -gt 86400 ]; then
          record_check "${check_id}_interval" "warning"
          record_warning "runner ${runner_id} has invalid interval_seconds=${interval_seconds}; expected an integer between 1 and 86400"
        else
          record_check "${check_id}_interval" "ok"
        fi
        ;;
    esac
  else
    record_check "${check_id}_interval" "not_applicable"
  fi

  case "$agent" in
    shell|manual)
      record_check "${check_id}_adapter" "ok"
      ;;
    codex|claude|opencode|gemini)
      if [ -n "$command_value" ]; then
        record_check "${check_id}_adapter" "custom_command"
      elif adapter_path="$(command -v "$agent" 2>/dev/null)"; then
        record_check "${check_id}_adapter" "ok"
        printf 'runner.%s.adapter_path=%s\n' "$check_id" "$adapter_path" >> "$check_output"
      else
        record_check "${check_id}_adapter" "warning"
        record_warning "runner ${runner_id} uses agent=${agent}, but ${agent} is not on PATH"
      fi
      ;;
    *)
      record_check "${check_id}_adapter" "warning"
      record_warning "runner ${runner_id} uses unsupported agent=${agent}; use shell, manual, codex, claude, opencode, or gemini"
      ;;
  esac
}

process_is_alive() {
  local pid="$1"

  case "$pid" in
    ""|0|*[!0-9]*)
      return 1
      ;;
  esac

  kill -0 "$pid" >/dev/null 2>&1
}

record_runner_state_check() {
  local runner_id="$1"
  local check_id state_status pid state_path
  local last_runtime_log last_prompt_log last_stdout_log last_stderr_log artifact_path artifact_count artifact_issue_count artifact_label

  check_id="runner_$(check_id_fragment "$runner_id")"
  state_status="$(runner_state_field "$runner_id" "status" 2>/dev/null || true)"
  pid="$(runner_state_field "$runner_id" "pid" 2>/dev/null || true)"
  state_path="$(runner_state_path "$runner_id" 2>/dev/null || true)"

  if [ -z "$state_status" ]; then
    record_check "${check_id}_state" "missing"
    return
  fi

  record_check "${check_id}_state" "ok"
  printf 'runner.%s.state_status=%s\n' "$check_id" "$state_status" >> "$check_output"
  printf 'runner.%s.pid=%s\n' "$check_id" "$pid" >> "$check_output"
  printf 'runner.%s.state_path=%s\n' "$check_id" "$state_path" >> "$check_output"

  last_runtime_log="$(runner_state_field "$runner_id" "last_runtime_log" 2>/dev/null || true)"
  last_prompt_log="$(runner_state_field "$runner_id" "last_prompt_log" 2>/dev/null || true)"
  last_stdout_log="$(runner_state_field "$runner_id" "last_stdout_log" 2>/dev/null || true)"
  last_stderr_log="$(runner_state_field "$runner_id" "last_stderr_log" 2>/dev/null || true)"
  printf 'runner.%s.last_runtime_log=%s\n' "$check_id" "$last_runtime_log" >> "$check_output"
  printf 'runner.%s.last_prompt_log=%s\n' "$check_id" "$last_prompt_log" >> "$check_output"
  printf 'runner.%s.last_stdout_log=%s\n' "$check_id" "$last_stdout_log" >> "$check_output"
  printf 'runner.%s.last_stderr_log=%s\n' "$check_id" "$last_stderr_log" >> "$check_output"

  artifact_count=0
  artifact_issue_count=0
  for artifact_label in runtime prompt stdout stderr; do
    case "$artifact_label" in
      runtime) artifact_path="$last_runtime_log" ;;
      prompt) artifact_path="$last_prompt_log" ;;
      stdout) artifact_path="$last_stdout_log" ;;
      stderr) artifact_path="$last_stderr_log" ;;
    esac

    [ -n "$artifact_path" ] || continue
    artifact_count=$((artifact_count + 1))

    case "$artifact_path" in
      "${board_root}"/*)
        if [ ! -f "$artifact_path" ]; then
          artifact_issue_count=$((artifact_issue_count + 1))
          record_warning "runner ${runner_id} last ${artifact_label} artifact is missing: ${artifact_path}"
        fi
        ;;
      *)
        artifact_issue_count=$((artifact_issue_count + 1))
        record_warning "runner ${runner_id} last ${artifact_label} artifact is outside board root: ${artifact_path}"
        ;;
    esac
  done

  if [ "$artifact_count" -eq 0 ]; then
    record_check "${check_id}_artifacts" "not_applicable"
  elif [ "$artifact_issue_count" -eq 0 ]; then
    record_check "${check_id}_artifacts" "ok"
  else
    record_check "${check_id}_artifacts" "warning"
  fi

  if [ "$state_status" = "running" ] && [ -n "$pid" ] && ! process_is_alive "$pid"; then
    record_check "${check_id}_pid" "warning"
    record_warning "runner ${runner_id} state says running with stale pid=${pid}; run autoflow runners stop ${runner_id} or restart it"
  elif [ "$state_status" = "running" ] && [ -n "$pid" ]; then
    record_check "${check_id}_pid" "ok"
  else
    record_check "${check_id}_pid" "not_applicable"
  fi
}

record_watcher_state_check() {
  local pid_file pid

  pid_file="${board_root}/logs/hooks/watch-board.pid"
  printf 'watcher.pid_file=%s\n' "$pid_file" >> "$check_output"

  if [ ! -f "$pid_file" ]; then
    record_check "watcher_pid" "not_running"
    printf 'watcher.status=not_running\n' >> "$check_output"
    return
  fi

  pid="$(tr -d '\r\n' < "$pid_file")"
  printf 'watcher.pid=%s\n' "$pid" >> "$check_output"

  if process_is_alive "$pid"; then
    record_check "watcher_pid" "ok"
    printf 'watcher.status=running\n' >> "$check_output"
    return
  fi

  record_check "watcher_pid" "warning"
  printf 'watcher.status=stale_pid\n' >> "$check_output"
  record_warning "watcher pid file is stale or invalid: ${pid_file} pid=${pid:-empty}; run autoflow watch-stop to clean it up"
}

project_spec_exists_for_key() {
  local project_key="$1"

  [ -f "${board_root}/tickets/backlog/${project_key}.md" ] ||
    [ -f "${board_root}/tickets/done/${project_key}/${project_key}.md" ]
}

record_conversation_handoff_check() {
  local conversations_root handoff_count invalid_count handoff_file project_key

  conversations_root="${board_root}/conversations"
  if [ ! -d "$conversations_root" ]; then
    record_check "conversation_scaffold" "warning"
    record_warning "conversation scaffold is missing; run autoflow upgrade to add conversations/"
    return
  fi

  record_check "conversation_scaffold" "ok"
  handoff_count=0
  invalid_count=0

  while IFS= read -r handoff_file; do
    [ -n "$handoff_file" ] || continue
    handoff_count=$((handoff_count + 1))
    project_key="$(basename "$(dirname "$handoff_file")")"

    case "$project_key" in
      project_[0-9][0-9][0-9])
        if ! project_spec_exists_for_key "$project_key"; then
          invalid_count=$((invalid_count + 1))
          record_warning "handoff has no matching spec in backlog or done: ${handoff_file}"
        fi
        ;;
      *)
        invalid_count=$((invalid_count + 1))
        record_warning "handoff is not under conversations/prd_NNN/: ${handoff_file}"
        ;;
    esac
  done < <(find "$conversations_root" -type f -name 'spec-handoff.md' | sort)

  printf 'conversation.handoff_count=%s\n' "$handoff_count" >> "$check_output"
  if [ "$invalid_count" -gt 0 ]; then
    record_check "conversation_handoffs" "warning"
  else
    record_check "conversation_handoffs" "ok"
  fi
}

if [ -d "$board_root" ]; then
  record_check "board_root_exists" "ok"
else
  record_check "board_root_exists" "error"
  record_error "board root does not exist: ${board_root}"
fi

if [ -f "${project_root}/AGENTS.md" ]; then
  record_check "host_agents" "ok"
else
  record_check "host_agents" "not_applicable"
fi

if [ -d "$board_root" ]; then
  if [ -f "${board_root}/AGENTS.md" ]; then
    record_check "board_agents" "ok"
  else
    record_check "board_agents" "error"
    record_error "board AGENTS.md is missing: ${board_root}/AGENTS.md"
  fi

  if [ -f "${board_root}/README.md" ]; then
    record_check "board_readme" "ok"
  else
    record_check "board_readme" "error"
    record_error "board README.md is missing: ${board_root}/README.md"
  fi

  for required_dir in agents automations reference rules scripts tickets logs; do
    if [ -d "${board_root}/${required_dir}" ]; then
      record_check "dir_${required_dir}" "ok"
    else
      record_check "dir_${required_dir}" "error"
      record_error "required board directory is missing: ${board_root}/${required_dir}"
    fi
  done

  for ticket_dir in todo inprogress ready-to-merge merge-blocked verifier done reject; do
    if [ -d "${board_root}/tickets/${ticket_dir}" ]; then
      record_check "tickets_${ticket_dir}" "ok"
    else
      record_check "tickets_${ticket_dir}" "error"
      record_error "ticket state directory is missing: ${board_root}/tickets/${ticket_dir}"
    fi
  done

  for required_nested_dir in \
    "tickets/backlog" \
    "rules/verifier" \
    "logs/hooks" \
    "tickets/plan" \
    "automations/state" \
    "automations/state/threads"
  do
    if [ -d "${board_root}/${required_nested_dir}" ]; then
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "ok"
    else
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "error"
      record_error "required nested board directory is missing: ${board_root}/${required_nested_dir}"
    fi
  done

  runner_scaffold_ok="true"
  for runner_scaffold_path in \
    "runners" \
    "runners/state" \
    "runners/logs" \
    "runners/config.toml"
  do
    if [ ! -e "${board_root}/${runner_scaffold_path}" ]; then
      runner_scaffold_ok="false"
    fi
  done
  if [ "$runner_scaffold_ok" = "true" ]; then
    record_check "runner_scaffold" "ok"
  else
    record_check "runner_scaffold" "warning"
    record_warning "runner scaffold is missing or incomplete; run autoflow upgrade to add runners/config.toml, runners/state, and runners/logs"
  fi

  runner_count=0
  if [ -f "${board_root}/runners/config.toml" ]; then
    export AUTOFLOW_BOARD_ROOT="$board_root"
    current_id=""
    current_role=""
    current_agent=""
    current_mode=""
    current_enabled="true"
    current_interval="60"
    current_command=""

    while IFS= read -r runner_line; do
      case "$runner_line" in
        runner_begin)
          current_id=""
          current_role=""
          current_agent=""
          current_mode=""
          current_enabled="true"
          current_interval="60"
          current_command=""
          ;;
        runner_end)
          if [ -n "$current_id" ]; then
            runner_count=$((runner_count + 1))
            record_runner_adapter_check "$current_id" "$current_role" "$current_agent" "$current_mode" "$current_enabled" "$current_command" "$current_interval"
            record_runner_state_check "$current_id"
          fi
          ;;
        id=*)
          current_id="${runner_line#id=}"
          ;;
        role=*)
          current_role="${runner_line#role=}"
          ;;
        agent=*)
          current_agent="${runner_line#agent=}"
          ;;
        mode=*)
          current_mode="${runner_line#mode=}"
          ;;
        interval_seconds=*)
          current_interval="${runner_line#interval_seconds=}"
          ;;
        enabled=*)
          current_enabled="${runner_line#enabled=}"
          ;;
        command=*)
          current_command="${runner_line#command=}"
          ;;
      esac
    done < <(runner_list_config "${board_root}/runners/config.toml")
  fi
  printf 'runner_count=%s\n' "$runner_count" >> "$check_output"
  record_watcher_state_check
  record_conversation_handoff_check

  wiki_scaffold_ok="true"
  for wiki_scaffold_path in \
    "wiki" \
    "wiki/index.md" \
    "wiki/log.md" \
    "wiki/project-overview.md" \
    "rules/wiki"
  do
    if [ ! -e "${board_root}/${wiki_scaffold_path}" ]; then
      wiki_scaffold_ok="false"
    fi
  done
  if [ "$wiki_scaffold_ok" = "true" ]; then
    record_check "wiki_scaffold" "ok"
  else
    record_check "wiki_scaffold" "warning"
    record_warning "wiki scaffold is missing or incomplete; run autoflow upgrade to add wiki pages and rules/wiki"
  fi

  metrics_scaffold_ok="true"
  for metrics_scaffold_path in \
    "metrics" \
    "metrics/README.md" \
    "metrics/.gitignore"
  do
    if [ ! -e "${board_root}/${metrics_scaffold_path}" ]; then
      metrics_scaffold_ok="false"
    fi
  done
  if [ "$metrics_scaffold_ok" = "true" ]; then
    record_check "metrics_scaffold" "ok"
  else
    record_check "metrics_scaffold" "warning"
    record_warning "metrics scaffold is missing or incomplete; run autoflow upgrade to add metrics/README.md and metrics/.gitignore"
  fi

  adapter_scaffold_ok="true"
  for adapter_scaffold_path in \
    "agents/adapters" \
    "agents/adapters/README.md" \
    "agents/adapters/shell.md" \
    "agents/adapters/codex-cli.md" \
    "agents/adapters/claude-cli.md" \
    "agents/adapters/opencode.md" \
    "agents/adapters/gemini-cli.md"
  do
    if [ ! -e "${board_root}/${adapter_scaffold_path}" ]; then
      adapter_scaffold_ok="false"
    fi
  done
  if [ "$adapter_scaffold_ok" = "true" ]; then
    record_check "adapter_scaffold" "ok"
  else
    record_check "adapter_scaffold" "warning"
    record_warning "adapter scaffold is missing or incomplete; run autoflow upgrade to add agents/adapters docs"
  fi

  for runtime_file in common.sh runner-common.sh check-stop.sh file-watch-common.sh install-stop-hook.sh run-hook.sh watch-board.sh set-thread-context.sh clear-thread-context.sh start-ticket-owner.sh verify-ticket-owner.sh finish-ticket-owner.sh merge-ready-ticket.sh update-wiki.sh start-plan.sh start-todo.sh handoff-todo.sh start-verifier.sh start-spec.sh integrate-worktree.sh write-verifier-log.sh; do
    if [ -f "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}" "ok"
    else
      record_check "script_${runtime_file}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_file}"
      continue
    fi

    if [ -x "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}_executable" "ok"
    else
      record_check "script_${runtime_file}_executable" "error"
      record_error "runtime script is not executable: ${board_root}/scripts/${runtime_file}"
    fi
  done

  for runtime_ps1 in invoke-runtime-sh.ps1 runner-common.ps1 codex-stop-hook.ps1 check-stop.ps1 install-stop-hook.ps1 set-thread-context.ps1 clear-thread-context.ps1 start-ticket-owner.ps1 verify-ticket-owner.ps1 finish-ticket-owner.ps1 merge-ready-ticket.ps1 start-spec.ps1 start-plan.ps1 start-todo.ps1 handoff-todo.ps1 start-verifier.ps1 integrate-worktree.ps1 write-verifier-log.ps1 run-hook.ps1 watch-board.ps1; do
    if [ -f "${board_root}/scripts/${runtime_ps1}" ]; then
      record_check "script_${runtime_ps1}" "ok"
    else
      record_check "script_${runtime_ps1}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_ps1}"
    fi
  done

  if [ -f "${board_root}/.project-root" ]; then
    marker_value="$(project_root_marker_value "$board_root")"
    record_check "project_root_marker" "ok"
    printf 'project_root_marker_value=%s\n' "$marker_value" >> "$check_output"

    if resolved_project_root="$(resolve_project_root_from_board "$board_root" 2>/dev/null)"; then
      record_check "project_root_marker_resolves" "ok"
      printf 'project_root_marker_resolved=%s\n' "$resolved_project_root" >> "$check_output"
      if [ "$resolved_project_root" = "$project_root" ]; then
        record_check "project_root_marker_matches_host" "ok"
      else
        record_check "project_root_marker_matches_host" "error"
        record_error "project-root marker resolves to ${resolved_project_root}, expected ${project_root}"
      fi
    else
      record_check "project_root_marker_resolves" "error"
      record_error "project-root marker could not be resolved from ${board_root}/.project-root"
    fi
  else
    record_check "project_root_marker" "error"
    record_error "board project-root marker is missing: ${board_root}/.project-root"
  fi

  if board_version="$(board_version_value "$board_root" 2>/dev/null)"; then
    record_check "board_version_marker" "ok"
    printf 'board_version=%s\n' "$board_version" >> "$check_output"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"

    if [ "$board_version" = "$package_version" ]; then
      record_check "board_version_matches_package" "ok"
    else
      record_check "board_version_matches_package" "warning"
      record_warning "board version ${board_version} differs from package version ${package_version}; run autoflow upgrade"
    fi
  else
    record_check "board_version_marker" "warning"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"
    record_warning "board version marker is missing: ${board_root}/.autoflow-version"
  fi

  for starter_file in \
    "automations/heartbeat-set.toml" \
    "automations/file-watch.psd1" \
    "automations/state/README.md" \
    "automations/state/.gitignore" \
    "reference/README.md" \
    "reference/backlog.md" \
    "reference/backlog-processed.md" \
    "reference/project-spec-template.md" \
    "reference/feature-spec-template.md" \
    "reference/plan.md" \
    "reference/plan-template.md" \
    "reference/roadmap.md" \
    "reference/runner-harness.md" \
    "reference/wiki.md" \
    "reference/tickets-board.md" \
    "reference/ticket-template.md" \
    "reference/logs.md" \
    "reference/hook-logs.md" \
    "automations/templates/heartbeat-set.template.toml" \
    "automations/templates/ticket-owner-heartbeat.template.toml" \
    "automations/templates/plan-heartbeat.template.toml" \
    "automations/templates/todo-heartbeat.template.toml" \
    "automations/templates/verifier-heartbeat.template.toml" \
    "rules/verifier/checklist-template.md" \
    "rules/verifier/verification-template.md"
  do
    if [ -f "${board_root}/${starter_file}" ]; then
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "ok"
    else
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "error"
      record_error "starter file is missing: ${board_root}/${starter_file}"
    fi
  done

  for forbidden_state_file in \
    "tickets/backlog/README.md" \
    "tickets/backlog/project-spec-template.md" \
    "tickets/backlog/feature-spec-template.md" \
    "tickets/backlog/processed/README.md" \
    "tickets/plan/README.md" \
    "tickets/plan/plan_template.md" \
    "tickets/plan/roadmap.md" \
    "tickets/README.md" \
    "tickets/tickets_template.md" \
    "logs/README.md" \
    "logs/hooks/README.md"
  do
    if [ -f "${board_root}/${forbidden_state_file}" ]; then
      record_check "state_doc_$(printf '%s' "$forbidden_state_file" | tr '/.-' '___')" "error"
      record_error "state folder contains reference/template file; move it under reference/: ${board_root}/${forbidden_state_file}"
    fi
  done

  if [ -d "${board_root}/tickets/plan/inprogress" ] && find "${board_root}/tickets/plan/inprogress" -maxdepth 1 -type f -name 'plan_*.md' -print -quit | grep -q .; then
    record_check "legacy_plan_inprogress_empty" "error"
    record_error "legacy plan inprogress folder still contains plan files; use tickets/inprogress instead: ${board_root}/tickets/plan/inprogress"
  fi

  if [ -d "${board_root}/tickets/reject" ] && find "${board_root}/tickets/reject" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' -print -quit | grep -q .; then
    record_check "legacy_reject_ticket_names" "error"
    record_error "reject folder still contains tickets_NNN.md files; run autoflow upgrade so failed tickets use reject_NNN.md: ${board_root}/tickets/reject"
  else
    record_check "legacy_reject_ticket_names" "ok"
  fi

  : > "$ticket_locations_output"
  for ticket_state_dir in todo inprogress ready-to-merge merge-blocked verifier done; do
    if [ ! -d "${board_root}/tickets/${ticket_state_dir}" ]; then
      continue
    fi
    maxdepth_arg="-maxdepth 1"
    if [ "$ticket_state_dir" = "done" ]; then
      maxdepth_arg=""
    fi
    # shellcheck disable=SC2086
    find "${board_root}/tickets/${ticket_state_dir}" $maxdepth_arg -type f -name 'tickets_[0-9][0-9][0-9].md' | sort |
      while IFS= read -r ticket_file; do
        [ -n "$ticket_file" ] || continue
        ticket_base="$(basename "$ticket_file")"
        ticket_rel="${ticket_file#${board_root}/}"
        printf '%s\t%s\n' "$ticket_base" "$ticket_rel" >> "$ticket_locations_output"
      done
  done

  if [ -s "$ticket_locations_output" ]; then
    cut -f1 "$ticket_locations_output" | sort | uniq -d > "$duplicate_ticket_ids_output"
  else
    : > "$duplicate_ticket_ids_output"
  fi

  if [ -s "$duplicate_ticket_ids_output" ]; then
    record_check "ticket_duplicate_ids" "error"
    while IFS= read -r duplicate_ticket_id; do
      [ -n "$duplicate_ticket_id" ] || continue
      duplicate_locations="$(awk -F '\t' -v id="$duplicate_ticket_id" '$1 == id { print $2 }' "$ticket_locations_output" | paste -sd ', ' -)"
      record_error "duplicate ticket id ${duplicate_ticket_id} exists in multiple state folders: ${duplicate_locations}"
    done < "$duplicate_ticket_ids_output"
  else
    record_check "ticket_duplicate_ids" "ok"
  fi

  if [ -f "${board_root}/reference/ticket-template.md" ]; then
    for required_ticket_field in "Plan Candidate" "Stage" "Claimed By" "Execution AI" "Verifier AI"; do
      check_field_id="$(printf '%s' "$required_ticket_field" | tr ' ' '_')"
      if ticket_field_present "${board_root}/reference/ticket-template.md" "$required_ticket_field"; then
        record_check "ticket_template_${check_field_id}" "ok"
      else
        record_check "ticket_template_${check_field_id}" "error"
        record_error "ticket template is missing field ${required_ticket_field}: ${board_root}/reference/ticket-template.md"
      fi
    done
  fi

  if [ -d "${board_root}/tickets/inprogress" ]; then
    while IFS= read -r live_ticket; do
      [ -n "$live_ticket" ] || continue
      for required_live_field in "Stage" "Execution AI" "Verifier AI"; do
        if ticket_field_present "$live_ticket" "$required_live_field"; then
          continue
        fi
        record_warning "live inprogress ticket is missing field ${required_live_field}: ${live_ticket}"
      done
    done < <(find "${board_root}/tickets/inprogress" -maxdepth 1 -type f -name 'tickets_*.md' | sort)
  fi

  record_active_ticket_diagnostics

  if board_is_initialized "$board_root"; then
    record_check "board_initialized" "ok"
  else
    record_check "board_initialized" "warning"
    record_warning "board root exists but does not look fully initialized"
  fi
fi

status="ok"
if [ "$error_count" -gt 0 ]; then
  status="fail"
fi

printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'status=%s\n' "$status"
printf 'package_version=%s\n' "$package_version"
printf 'error_count=%s\n' "$error_count"
printf 'warning_count=%s\n' "$warning_count"
cat "$check_output"
cat "$detail_output"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi
