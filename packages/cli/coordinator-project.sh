#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

source "${SCRIPT_DIR}/cli-common.sh"

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
doctor_output="$(mktemp)"
merge_output="$(mktemp)"

cleanup() {
  rm -f "$doctor_output" "$merge_output"
}
trap cleanup EXIT

export AUTOFLOW_PROJECT_ROOT="$project_root"
export AUTOFLOW_BOARD_ROOT="$board_root"

count_matching_files() {
  local root="$1"
  local pattern="$2"

  if [ ! -d "$root" ]; then
    printf '0'
    return 0
  fi

  find "$root" -maxdepth 1 -type f -name "$pattern" | wc -l | tr -d '[:space:]'
}

list_matching_basenames() {
  local root="$1"
  local pattern="$2"

  if [ ! -d "$root" ]; then
    return 0
  fi

  find "$root" -maxdepth 1 -type f -name "$pattern" -exec basename {} \; | sort | paste -sd, -
}

ready_ticket_count() {
  count_matching_files "${board_root}/tickets/ready-to-merge" 'tickets_[0-9][0-9][0-9].md'
}

first_ready_ticket() {
  if [ ! -d "${board_root}/tickets/ready-to-merge" ]; then
    return 1
  fi
  find "${board_root}/tickets/ready-to-merge" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' | sort | head -n 1
}

ticket_id_from_path() {
  local path="$1"
  local base

  base="$(basename "$path")"
  printf '%s' "${base#tickets_}" | sed 's/\.md$//'
}

ticket_stage() {
  local file="$1"

  awk '
    /^- Stage:[[:space:]]*/ {
      line=$0
      sub(/^- Stage:[[:space:]]*/, "", line)
      print line
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

active_blocked_ticket_count() {
  local count file stage

  count=0
  if [ -d "${board_root}/tickets/inprogress" ]; then
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      stage="$(ticket_stage "$file")"
      if [ "$stage" = "blocked" ]; then
        count=$((count + 1))
      fi
    done < <(find "${board_root}/tickets/inprogress" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' | sort)
  fi

  printf '%s' "$count"
}

active_blocked_ticket_ids() {
  local file stage

  if [ -d "${board_root}/tickets/inprogress" ]; then
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      stage="$(ticket_stage "$file")"
      if [ "$stage" = "blocked" ]; then
        basename "$file" .md
      fi
    done < <(find "${board_root}/tickets/inprogress" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' | sort)
  fi | paste -sd, -
}

runner_problem_state_count() {
  local count file runner_id runner_status

  count=0
  if [ -d "${board_root}/runners/state" ]; then
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      runner_id="$(basename "$file" .state)"
      if [ -n "${AUTOFLOW_WORKER_ID:-}" ] && [ "$runner_id" = "$AUTOFLOW_WORKER_ID" ]; then
        continue
      fi
      runner_status="$(awk -F= '$1 == "status" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$file" 2>/dev/null || true)"
      case "$runner_status" in
        blocked|failed)
          count=$((count + 1))
          ;;
      esac
    done < <(find "${board_root}/runners/state" -maxdepth 1 -type f -name '*.state' | sort)
  fi

  printf '%s' "$count"
}

runner_problem_state_ids() {
  local file runner_id runner_status

  if [ -d "${board_root}/runners/state" ]; then
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      runner_id="$(basename "$file" .state)"
      if [ -n "${AUTOFLOW_WORKER_ID:-}" ] && [ "$runner_id" = "$AUTOFLOW_WORKER_ID" ]; then
        continue
      fi
      runner_status="$(awk -F= '$1 == "status" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$file" 2>/dev/null || true)"
      case "$runner_status" in
        blocked|failed)
          printf '%s:%s\n' "$runner_id" "$runner_status"
          ;;
      esac
    done < <(find "${board_root}/runners/state" -maxdepth 1 -type f -name '*.state' | sort)
  fi | paste -sd, -
}

field_from_output() {
  local file="$1"
  local key="$2"

  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

append_csv_value() {
  local current="${1:-}"
  local value="${2:-}"

  [ -n "$value" ] || {
    printf '%s' "$current"
    return 0
  }

  if [ -z "$current" ]; then
    printf '%s' "$value"
  else
    printf '%s,%s' "$current" "$value"
  fi
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

ticket_scalar_field() {
  markdown_scalar_field "$1" "Ticket" "$2"
}

ticket_worktree_field() {
  trim_markdown_value "$(markdown_scalar_field "$1" "Worktree" "$2")"
}

ticket_concrete_allowed_paths() {
  local file="$1"

  awk '
    /^## Allowed Paths/ { in_allowed=1; next }
    /^## / && in_allowed { in_allowed=0 }
    in_allowed && /^[[:space:]]*[-*] / {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      gsub(/`/, "", $0)
      sub(/^[[:space:]]+/, "", $0)
      sub(/[[:space:]]+$/, "", $0)
      if ($0 != "" && $0 != "...") {
        print
      }
    }
  ' "$file" 2>/dev/null
}

ticket_project_root_conflict_stage() {
  case "${1:-}" in
    planning|claimed|executing|ready_for_verification|verifying|blocked|ready-to-merge|merge-blocked)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

physical_path_equals_project_root() {
  local path="$1"
  local physical_path physical_project_root

  [ -d "$path" ] || return 1
  [ -d "$project_root" ] || return 1
  physical_path="$(cd "$path" && pwd -P)"
  physical_project_root="$(cd "$project_root" && pwd -P)"
  [ "$physical_path" = "$physical_project_root" ]
}

ticket_uses_project_root_workspace() {
  local ticket_file="$1"
  local integration_status worktree_path

  integration_status="$(ticket_worktree_field "$ticket_file" "Integration Status")"
  worktree_path="$(ticket_worktree_field "$ticket_file" "Path")"
  case "$integration_status" in
    project_root_fallback|disabled|not_git_repo|no_head_commit)
      return 0
      ;;
  esac

  [ -z "$worktree_path" ] && return 0
  physical_path_equals_project_root "$worktree_path"
}

ticket_latest_runtime_block_event() {
  local ticket_file="$1"

  [ -f "$ticket_file" ] || return 1
  awk '
    /Runtime auto-blocked: shared_allowed_path_conflict/ { event="runtime_shared_allowed" }
    /Runtime auto-blocked: shared_nonbase_head_conflict/ { event="runtime_shared_nonbase" }
    /Auto-recovery .*shared Allowed Path blockers cleared/ { event="auto_recovered_shared_allowed" }
    /Auto-recovery .*cleared blocked worktree fields/ { event="auto_recovered" }
    /Coordinator remediated shared_nonbase_head_conflict/ { event="coordinator_remediated_shared_nonbase" }
    END {
      if (event != "") {
        print event
        exit 0
      }
      exit 1
    }
  ' "$ticket_file" 2>/dev/null
}

runtime_shared_allowed_path_blockers() {
  local ticket_file="$1"
  local ticket_id ticket_num current_paths current_project_root_workspace=false
  local other_file other_id other_num other_stage other_path found=false

  [ -f "$ticket_file" ] || return 1
  ticket_id="$(ticket_id_from_path "$ticket_file")"
  [ -n "$ticket_id" ] || return 1
  ticket_num="$((10#$ticket_id))"
  current_paths="$(ticket_concrete_allowed_paths "$ticket_file")"
  [ -n "$current_paths" ] || return 1
  if ticket_uses_project_root_workspace "$ticket_file"; then
    current_project_root_workspace=true
  fi

  while IFS= read -r other_file; do
    [ -n "$other_file" ] || continue
    [ "$other_file" != "$ticket_file" ] || continue
    other_id="$(ticket_id_from_path "$other_file")"
    [ -n "$other_id" ] || continue
    other_num="$((10#$other_id))"
    [ "$other_num" -lt "$ticket_num" ] || continue
    other_stage="$(ticket_stage "$other_file")"
    ticket_project_root_conflict_stage "$other_stage" || continue
    if [ "$current_project_root_workspace" != "true" ] && ! ticket_uses_project_root_workspace "$other_file"; then
      continue
    fi

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

replace_scalar_field_in_section() {
  local file="$1"
  local heading="$2"
  local field="$3"
  local value="$4"
  local tmp

  tmp="$(autoflow_mktemp)"
  awk -v heading="$heading" -v field="$field" -v value="$value" '
    BEGIN {
      in_target = 0
      replaced = 0
    }
    $0 == heading {
      print
      in_target = 1
      next
    }
    in_target && /^## / {
      if (!replaced) {
        print "- " field ": " value
        replaced = 1
      }
      in_target = 0
      print
      next
    }
    in_target && $0 ~ "^- " field ":" {
      print "- " field ": " value
      replaced = 1
      next
    }
    { print }
    END {
      if (in_target && !replaced) {
        print "- " field ": " value
      } else if (!replaced) {
        print ""
        print heading
        print "- " field ": " value
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

replace_section_block() {
  local file="$1"
  local heading="$2"
  local block="$3"
  local tmp block_file

  tmp="$(autoflow_mktemp)"
  block_file="$(autoflow_mktemp)"
  printf '%s\n' "$block" > "$block_file"
  awk -v heading="$heading" -v block_file="$block_file" '
    BEGIN {
      while ((getline line < block_file) > 0) {
        lines[++line_count] = line
      }
      close(block_file)
      in_target = 0
      replaced = 0
    }
    $0 == "## " heading {
      print
      for (i = 1; i <= line_count; i++) {
        print lines[i]
      }
      in_target = 1
      replaced = 1
      next
    }
    in_target {
      if ($0 ~ /^## /) {
        in_target = 0
        print ""
        print
      }
      next
    }
    { print }
    END {
      if (!replaced) {
        print ""
        print "## " heading
        for (i = 1; i <= line_count; i++) {
          print lines[i]
        }
      }
    }
  ' "$file" > "$tmp"
  rm -f "$block_file"
  mv "$tmp" "$file"
}

append_note() {
  local file="$1"
  local note="$2"
  local tmp

  tmp="$(autoflow_mktemp)"
  awk -v note="$note" '
    BEGIN { in_notes=0; inserted=0 }
    $0 == "## Notes" {
      print
      in_notes=1
      next
    }
    in_notes && /^## / && !inserted {
      print "- " note
      inserted=1
      in_notes=0
      print
      next
    }
    { print }
    END {
      if (in_notes && !inserted) {
        print "- " note
      } else if (!inserted) {
        print ""
        print "## Notes"
        print "- " note
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

replace_state_field() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp

  tmp="$(autoflow_mktemp)"
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { replaced=0 }
    $1 == key {
      print key "=" value
      replaced=1
      next
    }
    { print }
    END {
      if (!replaced) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

update_runner_active_stage_for_ticket() {
  local ticket_id="$1"
  local stage="$2"
  local result="$3"
  local state_file active_ticket

  if [ ! -d "${board_root}/runners/state" ]; then
    return 0
  fi

  for state_file in "${board_root}"/runners/state/*.state; do
    [ -f "$state_file" ] || continue
    active_ticket="$(field_from_output "$state_file" "active_ticket_id")"
    [ "$active_ticket" = "tickets_${ticket_id}" ] || continue
    replace_state_field "$state_file" "active_stage" "$stage"
    replace_state_field "$state_file" "last_event_at" "$timestamp"
    replace_state_field "$state_file" "last_result" "$result"
  done
}

coordinator_blocked_processing_enabled() {
  case "${AUTOFLOW_COORDINATOR_PROCESS_BLOCKED:-1}" in
    0|false|FALSE|off|OFF|no|NO)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

coordinator_remediation_limit() {
  local raw="${AUTOFLOW_COORDINATOR_BLOCKED_REMEDIATION_LIMIT:-1}"

  case "$raw" in
    ''|*[!0-9]*)
      printf '1'
      ;;
    *)
      printf '%s' "$raw"
      ;;
  esac
}

coordinator_worktree_parent_root() {
  local parent_dir repo_name

  parent_dir="$(dirname "$project_root")"
  repo_name="$(basename "$project_root")"
  printf '%s/.autoflow-worktrees/%s' "$parent_dir" "$repo_name"
}

remediation_log_dir() {
  printf '%s/logs' "$board_root"
}

remediation_safe_token() {
  local raw="$1"
  printf '%s' "$raw" | LC_ALL=C tr -c '[:alnum:]_.-' '_' | sed 's/__*/_/g; s/^_//; s/_$//'
}

write_remediation_log_entry() {
  local kind="$1"           # canonical pattern label, e.g. claude_model_unavailable
  local subject="$2"        # owner-3 / tickets_005 / etc.
  local fingerprint="$3"    # offending value (model alias, head sha, ...)
  local source_path="$4"    # citation path (stderr log / ticket file / worktree path)
  local body="$5"           # markdown body (already formatted)
  local log_dir log_path stamp safe_kind safe_subject

  log_dir="$(remediation_log_dir)"
  mkdir -p "$log_dir" 2>/dev/null || return 1
  stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  safe_kind="$(remediation_safe_token "$kind")"
  safe_subject="$(remediation_safe_token "$subject")"
  log_path="${log_dir}/coordinator_${stamp}_remediation_${safe_kind}_${safe_subject}.md"

  {
    printf -- '---\n'
    printf 'type: coordinator_remediation\n'
    printf 'kind: %s\n' "$kind"
    printf 'subject: %s\n' "$subject"
    [ -n "$fingerprint" ] && printf 'fingerprint: %s\n' "$(printf '%s' "$fingerprint" | sed 's/"/\\"/g')"
    printf 'timestamp: %s\n' "$timestamp"
    [ -n "$source_path" ] && printf 'source: %s\n' "${source_path#${project_root}/}"
    printf 'project_root: %s\n' "$project_root"
    printf 'board_root: %s\n' "$board_root"
    printf -- '---\n\n'
    printf '%s\n' "$body"
  } > "$log_path"

  printf '%s' "$log_path"
}

extract_unavailable_model_token() {
  local log_path="$1"
  awk '
    /selected model \(/ {
      match($0, /selected model \([^)]*\)/)
      if (RSTART) {
        s = substr($0, RSTART + length("selected model ("), RLENGTH - length("selected model (") - 1)
        print s
        exit
      }
    }
  ' "$log_path" 2>/dev/null
}

latest_runner_log_for_suffix() {
  local runner_id="$1"
  local suffix="$2"
  find "${board_root}/runners/logs" -maxdepth 1 -type f -name "${runner_id}_*_${suffix}.log" 2>/dev/null \
    | sort -r | head -n 1
}

process_runner_failure_patterns() {
  local file runner_id runner_status stderr_log log_token body log_out

  runner_failure_pattern_attempted="false"
  runner_failure_pattern_detected_count=0
  runner_failure_pattern_log_paths=""
  runner_failure_pattern_summary=""

  [ -d "${board_root}/runners/state" ] || return 0
  [ -d "${board_root}/runners/logs" ] || return 0

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    runner_id="$(basename "$file" .state)"
    if [ -n "${AUTOFLOW_WORKER_ID:-}" ] && [ "$runner_id" = "$AUTOFLOW_WORKER_ID" ]; then
      continue
    fi
    runner_status="$(awk -F= '$1 == "status" { print $2; exit }' "$file" 2>/dev/null || true)"
    [ "$runner_status" = "failed" ] || continue

    runner_failure_pattern_attempted="true"

    stderr_log="$(latest_runner_log_for_suffix "$runner_id" "stderr")"
    [ -n "$stderr_log" ] && [ -f "$stderr_log" ] || continue

    if grep -q "There's an issue with the selected model" "$stderr_log" 2>/dev/null; then
      log_token="$(extract_unavailable_model_token "$stderr_log")"
      [ -n "$log_token" ] || log_token="unknown"

      body="$(printf '# Coordinator remediation: claude model unavailable\n\n- Runner `%s` (status `failed`) hit Claude CLI rejection for model alias `%s`.\n- The adapter at `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` normalizes known 1M aliases (`opus-1m` -> `claude-opus-4-7[1m]`, `sonnet-1m` -> `claude-sonnet-4-6[1m]`, `haiku-1m` -> `claude-haiku-4-5-20251001[1m]`) before invoking `claude --model`, so any alias matching that table is auto-resolved on the next runner tick without changing `runners/config.toml`.\n- If the alias is outside the table, the runner will keep failing until either (a) the alias is added to `normalize_claude_model_alias` or (b) the operator updates `runners/config.toml` to a valid Claude CLI alias.\n- Source stderr: `%s`\n' "$runner_id" "$log_token" "${stderr_log#${project_root}/}")"

      log_out="$(write_remediation_log_entry \
        "claude_model_unavailable" \
        "$runner_id" \
        "$log_token" \
        "$stderr_log" \
        "$body")"
      if [ -n "$log_out" ]; then
        runner_failure_pattern_detected_count=$((runner_failure_pattern_detected_count + 1))
        runner_failure_pattern_log_paths="$(append_csv_value "$runner_failure_pattern_log_paths" "${log_out#${project_root}/}")"
        runner_failure_pattern_summary="$(append_csv_value "$runner_failure_pattern_summary" "${runner_id}:claude_model_unavailable:${log_token}")"
      fi
    fi
  done < <(find "${board_root}/runners/state" -maxdepth 1 -type f -name '*.state' | sort)
}

ticket_file_for_id() {
  local ticket_id="$1"
  printf '%s/tickets/inprogress/tickets_%s.md' "$board_root" "$ticket_id"
}

worktree_branch_exists() {
  local branch="$1"
  git -C "$project_root" show-ref --verify --quiet "refs/heads/${branch}"
}

create_clean_replacement_worktree() {
  local ticket_id="$1"
  local ticket_file="$2"
  local old_head="$3"
  local old_path old_branch base_commit parent_root stamp branch path counter
  local add_output add_exit
  local remediation_body remediation_log_out

  old_path="$(ticket_worktree_field "$ticket_file" "Path")"
  old_branch="$(ticket_worktree_field "$ticket_file" "Branch")"
  base_commit="$(ticket_worktree_field "$ticket_file" "Base Commit")"
  if [ -z "$base_commit" ] || ! git -C "$project_root" rev-parse --verify "${base_commit}^{commit}" >/dev/null 2>&1; then
    base_commit="$(git -C "$project_root" rev-parse --verify HEAD 2>/dev/null || true)"
  fi
  [ -n "$base_commit" ] || return 1

  parent_root="$(coordinator_worktree_parent_root)"
  mkdir -p "$parent_root"

  stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  branch="autoflow/tickets_${ticket_id}-remediate-${stamp}"
  path="${parent_root}/tickets_${ticket_id}-remediate-${stamp}"
  counter=1
  while [ -e "$path" ] || worktree_branch_exists "$branch"; do
    branch="autoflow/tickets_${ticket_id}-remediate-${stamp}-${counter}"
    path="${parent_root}/tickets_${ticket_id}-remediate-${stamp}-${counter}"
    counter=$((counter + 1))
  done

  add_output="$(mktemp)"
  set +e
  git -C "$project_root" worktree add -b "$branch" "$path" "$base_commit" >"$add_output" 2>&1
  add_exit=$?
  set -e
  if [ "$add_exit" -ne 0 ]; then
    append_note "$ticket_file" "Coordinator remediation failed at ${timestamp}: could not create clean replacement worktree for shared_nonbase_head_conflict. git output: $(tr '\n' ' ' < "$add_output" | sed 's/[[:space:]]\+/ /g; s/[[:space:]]*$//')"
    rm -f "$add_output"
    return 1
  fi
  rm -f "$add_output"

  replace_section_block "$ticket_file" "Worktree" "- Path: \`${path}\`
- Branch: ${branch}
- Base Commit: ${base_commit}
- Worktree Commit:
- Integration Status: pending"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "executing"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Next Action" "- Coordinator remediated shared_nonbase_head_conflict by assigning a clean replacement worktree. Next ticket-owner tick must continue implementation in \`${path}\`."
  append_note "$ticket_file" "Coordinator remediated shared_nonbase_head_conflict at ${timestamp}: old worktree \`${old_path:-unknown}\` branch \`${old_branch:-unknown}\` head \`${old_head:-unknown}\` preserved; replacement worktree \`${path}\` branch \`${branch}\` starts at base \`${base_commit}\`."
  update_runner_active_stage_for_ticket "$ticket_id" "executing" "coordinator_remediated_shared_nonbase_head"

  remediation_body="$(printf '# Coordinator remediation: shared non-base HEAD repaired\n\n- Ticket `tickets_%s` worktree was contaminated by sharing non-base HEAD `%s` with peer ticket(s).\n- Old worktree path `%s` (branch `%s`, head `%s`) was preserved on disk for postmortem; nothing was deleted.\n- Replacement worktree was created at `%s` on branch `%s` starting from base commit `%s`.\n- Ticket markdown `Worktree`, `Stage`, and `Next Action` sections were updated to point at the clean snapshot. The next ticket-owner tick continues there.\n- Ticket file: `%s`\n' \
    "$ticket_id" \
    "${old_head:-unknown}" \
    "${old_path:-unknown}" \
    "${old_branch:-unknown}" \
    "${old_head:-unknown}" \
    "$path" \
    "$branch" \
    "$base_commit" \
    "${ticket_file#${project_root}/}")"
  remediation_log_out="$(write_remediation_log_entry \
    "shared_nonbase_head_repaired" \
    "tickets_${ticket_id}" \
    "${old_head:-unknown}" \
    "$ticket_file" \
    "$remediation_body")"
  if [ -n "$remediation_log_out" ]; then
    shared_head_remediation_log_paths="$(append_csv_value "${shared_head_remediation_log_paths:-}" "${remediation_log_out#${project_root}/}")"
  fi
  return 0
}

processed_ticket_already_seen() {
  local ticket_name="$1"

  case ",${blocked_processed_tickets},${blocked_processing_failed_tickets}," in
    *",${ticket_name},"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

process_shared_nonbase_head_blockers() {
  local limit idx group_head group_tickets old_ifs ticket_id ticket_file stage old_head

  blocked_processing_attempted="false"
  blocked_processed_count=0
  blocked_processed_tickets=""
  blocked_processing_failed_count=0
  blocked_processing_failed_tickets=""

  coordinator_blocked_processing_enabled || return 0
  [ "$diagnosis_attempted" = "true" ] || return 0
  [ "${shared_head_group_count:-0}" -gt 0 ] 2>/dev/null || return 0
  git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  blocked_processing_attempted="true"
  limit="$(coordinator_remediation_limit)"
  [ "$limit" -gt 0 ] 2>/dev/null || return 0

  idx=1
  while [ "$idx" -le "${shared_head_group_count:-0}" ]; do
    group_head="$(field_from_output "$doctor_output" "doctor.worktree.shared_nonbase_head.${idx}.head")"
    group_tickets="$(field_from_output "$doctor_output" "doctor.worktree.shared_nonbase_head.${idx}.tickets")"
    old_ifs="$IFS"
    IFS=,
    for ticket_id in $group_tickets; do
      IFS="$old_ifs"
      ticket_id="$(printf '%s' "$ticket_id" | sed 's/[^0-9]//g')"
      [ -n "$ticket_id" ] || continue
      processed_ticket_already_seen "tickets_${ticket_id}" && continue
      ticket_file="$(ticket_file_for_id "$ticket_id")"
      [ -f "$ticket_file" ] || continue
      stage="$(ticket_stage "$ticket_file")"
      case "$stage" in
        blocked|executing|pending|todo|"")
          ;;
        *)
          continue
          ;;
      esac

      old_head="$(field_from_output "$doctor_output" "doctor.ticket.${ticket_id}.worktree_head")"
      [ -n "$old_head" ] || old_head="$group_head"
      if create_clean_replacement_worktree "$ticket_id" "$ticket_file" "$old_head"; then
        blocked_processed_count=$((blocked_processed_count + 1))
        blocked_processed_tickets="$(append_csv_value "$blocked_processed_tickets" "tickets_${ticket_id}")"
      else
        blocked_processing_failed_count=$((blocked_processing_failed_count + 1))
        blocked_processing_failed_tickets="$(append_csv_value "$blocked_processing_failed_tickets" "tickets_${ticket_id}")"
      fi

      if [ "$blocked_processed_count" -ge "$limit" ]; then
        IFS="$old_ifs"
        return 0
      fi
      IFS=,
    done
    IFS="$old_ifs"
    idx=$((idx + 1))
  done
}

active_ticket_files() {
  local active_dir

  for active_dir in inprogress ready-to-merge merge-blocked; do
    [ -d "${board_root}/tickets/${active_dir}" ] || continue
    find "${board_root}/tickets/${active_dir}" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md'
  done | sort
}

repair_worktree_branch_mismatches() {
  local ticket_file ticket_id recorded_branch actual_branch worktree_path

  branch_repair_attempted="false"
  branch_repaired_count=0
  branch_repaired_tickets=""

  coordinator_blocked_processing_enabled || return 0
  [ "$diagnosis_attempted" = "true" ] || return 0
  [ "$doctor_exit" -eq 0 ] || return 0

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    ticket_id="$(ticket_id_from_path "$ticket_file")"
    recorded_branch="$(field_from_output "$doctor_output" "doctor.ticket.${ticket_id}.worktree_branch")"
    actual_branch="$(field_from_output "$doctor_output" "doctor.ticket.${ticket_id}.worktree_actual_branch")"
    worktree_path="$(field_from_output "$doctor_output" "doctor.ticket.${ticket_id}.worktree_path")"
    [ -n "$actual_branch" ] || continue
    [ -n "$recorded_branch" ] || continue
    [ "$recorded_branch" != "$actual_branch" ] || continue

    branch_repair_attempted="true"
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Branch" "$actual_branch"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    append_note "$ticket_file" "Coordinator repaired Worktree Branch metadata at ${timestamp}: recorded \`${recorded_branch}\` did not match actual branch \`${actual_branch}\` for \`${worktree_path}\`."
    branch_repaired_count=$((branch_repaired_count + 1))
    branch_repaired_tickets="$(append_csv_value "$branch_repaired_tickets" "tickets_${ticket_id}")"
  done < <(active_ticket_files)
}

release_cleared_shared_path_blockers() {
  local ticket_file ticket_id stage latest_event blockers

  shared_path_release_attempted="false"
  shared_path_released_count=0
  shared_path_released_tickets=""

  coordinator_blocked_processing_enabled || return 0
  [ "$diagnosis_attempted" = "true" ] || return 0
  [ "$doctor_exit" -eq 0 ] || return 0

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    ticket_id="$(ticket_id_from_path "$ticket_file")"
    [ -n "$ticket_id" ] || continue
    stage="$(ticket_stage "$ticket_file")"
    [ "$stage" = "blocked" ] || continue
    latest_event="$(ticket_latest_runtime_block_event "$ticket_file" || true)"
    case "$latest_event" in
      runtime_shared_nonbase)
        continue
        ;;
      runtime_shared_allowed|auto_recovered_shared_allowed|auto_recovered)
        ;;
      *)
        if ! grep -Eiq 'shared[_ -]?allowed|shared[_ -]?path|Allowed Paths|Allowed Path' "$ticket_file"; then
          continue
        fi
        ;;
    esac

    shared_path_release_attempted="true"
    blockers="$(runtime_shared_allowed_path_blockers "$ticket_file" || true)"
    [ -z "$blockers" ] || continue

    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "executing"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- Coordinator confirmed runtime shared Allowed Path blockers are clear. Next ticket-owner tick should resume implementation from the recorded worktree."
    append_note "$ticket_file" "Coordinator released shared_allowed_path_conflict at ${timestamp}: lower-number runtime blockers cleared."
    update_runner_active_stage_for_ticket "$ticket_id" "executing" "coordinator_released_shared_allowed_path"
    shared_path_released_count=$((shared_path_released_count + 1))
    shared_path_released_tickets="$(append_csv_value "$shared_path_released_tickets" "tickets_${ticket_id}")"
  done < <(active_ticket_files)
}

emit_file_block() {
  local label="$1"
  local file="$2"

  printf '%s_begin\n' "$label"
  [ -f "$file" ] && cat "$file"
  printf '%s_end\n' "$label"
}

precheck_state_path() {
  local worker_id="${AUTOFLOW_WORKER_ID:-coordinator}"

  printf '%s/runners/state/%s.coordinator-precheck' "$board_root" "$worker_id"
}

read_last_precheck_fingerprint() {
  local state_file="$1"

  [ -f "$state_file" ] || return 0
  awk -F= '$1 == "fingerprint" { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' "$state_file" 2>/dev/null || true
}

write_precheck_state() {
  local state_file="$1"
  local timestamp="$2"
  local fingerprint="$3"
  local reason="$4"
  local cached_doctor_status="${5:-}"
  local cached_operational_blockers="${6:-}"
  local cached_shared_path_blocked_count="${7:-}"
  local cached_worktree_issue_count="${8:-}"
  local cached_dirty_overlap_count="${9:-}"
  local cached_shared_head_group_count="${10:-}"
  local cached_branch_mismatch_count="${11:-}"

  mkdir -p "$(dirname "$state_file")"
  {
    printf 'updated_at=%s\n' "$timestamp"
    printf 'fingerprint=%s\n' "$fingerprint"
    printf 'problem_reason=%s\n' "$reason"
    if [ -n "$cached_doctor_status" ]; then
      printf 'doctor_status=%s\n' "$cached_doctor_status"
    fi
    if [ -n "$cached_operational_blockers" ]; then
      printf 'operational_blockers=%s\n' "$cached_operational_blockers"
    fi
    if [ -n "$cached_shared_path_blocked_count" ]; then
      printf 'shared_path_blocked_ticket_count=%s\n' "$cached_shared_path_blocked_count"
    fi
    if [ -n "$cached_worktree_issue_count" ]; then
      printf 'worktree_issue_count=%s\n' "$cached_worktree_issue_count"
    fi
    if [ -n "$cached_dirty_overlap_count" ]; then
      printf 'project_root_dirty_overlap_count=%s\n' "$cached_dirty_overlap_count"
    fi
    if [ -n "$cached_shared_head_group_count" ]; then
      printf 'shared_nonbase_head_group_count=%s\n' "$cached_shared_head_group_count"
    fi
    if [ -n "$cached_branch_mismatch_count" ]; then
      printf 'branch_mismatch_count=%s\n' "$cached_branch_mismatch_count"
    fi
  } > "$state_file"
}

branch_mismatch_count_from_output() {
  local file="$1"

  awk -F= '
    $1 ~ /^doctor\.ticket\.[0-9][0-9][0-9]\.worktree_branch$/ {
      split($1, parts, ".")
      branch[parts[3]]=$2
    }
    $1 ~ /^doctor\.ticket\.[0-9][0-9][0-9]\.worktree_actual_branch$/ {
      split($1, parts, ".")
      actual[parts[3]]=$2
    }
    END {
      count=0
      for (id in actual) {
        if (actual[id] != "" && branch[id] != "" && actual[id] != branch[id]) {
          count++
        }
      }
      print count + 0
    }
  ' "$file" 2>/dev/null || printf '0\n'
}

ready_count="$(ready_ticket_count)"
ready_ticket="$(first_ready_ticket || true)"
merge_blocked_count="$(count_matching_files "${board_root}/tickets/merge-blocked" 'tickets_[0-9][0-9][0-9].md')"
reject_count="$(count_matching_files "${board_root}/tickets/reject" 'reject_[0-9][0-9][0-9].md')"
active_blocked_count="$(active_blocked_ticket_count)"
runner_problem_count="$(runner_problem_state_count)"
ready_ticket_ids="$(list_matching_basenames "${board_root}/tickets/ready-to-merge" 'tickets_[0-9][0-9][0-9].md')"
merge_blocked_ids="$(list_matching_basenames "${board_root}/tickets/merge-blocked" 'tickets_[0-9][0-9][0-9].md')"
reject_ids="$(list_matching_basenames "${board_root}/tickets/reject" 'reject_[0-9][0-9][0-9].md')"
active_blocked_ids="$(active_blocked_ticket_ids)"
runner_problem_ids="$(runner_problem_state_ids)"
precheck_fingerprint="ready=${ready_ticket_ids}|merge_blocked=${merge_blocked_ids}|reject=${reject_ids}|active_blocked=${active_blocked_ids}|runner_problem=${runner_problem_ids}"
precheck_state="$(precheck_state_path)"
last_precheck_fingerprint="$(read_last_precheck_fingerprint "$precheck_state")"
cached_doctor_status="$(field_from_output "$precheck_state" "doctor_status")"
cached_operational_blockers="$(field_from_output "$precheck_state" "operational_blockers")"
cached_shared_path_blocked_count="$(field_from_output "$precheck_state" "shared_path_blocked_ticket_count")"
cached_worktree_issue_count="$(field_from_output "$precheck_state" "worktree_issue_count")"
cached_dirty_overlap_count="$(field_from_output "$precheck_state" "project_root_dirty_overlap_count")"
cached_shared_head_group_count="$(field_from_output "$precheck_state" "shared_nonbase_head_group_count")"
cached_branch_mismatch_count="$(field_from_output "$precheck_state" "branch_mismatch_count")"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
diagnosis_attempted="false"
diagnosis_cached="false"
diagnosis_skipped_reason=""
problem_reason=""
ready_ticket_id=""
merge_attempted="false"
merge_status="not_applicable"
merge_exit=0
doctor_exit=0
doctor_status="not_run"
operational_blockers="not_checked"
shared_path_blocked_count="0"
worktree_issue_count="0"
dirty_overlap_count="0"
shared_head_group_count="0"
branch_mismatch_count="0"
blocked_processing_attempted="false"
blocked_processed_count=0
blocked_processed_tickets=""
blocked_processing_failed_count=0
blocked_processing_failed_tickets=""
branch_repair_attempted="false"
branch_repaired_count=0
branch_repaired_tickets=""
shared_path_release_attempted="false"
shared_path_released_count=0
shared_path_released_tickets=""
shared_head_remediation_log_paths=""
runner_failure_pattern_attempted="false"
runner_failure_pattern_detected_count=0
runner_failure_pattern_log_paths=""
runner_failure_pattern_summary=""
needs_blocked_processing_diagnosis="false"

if [ "$ready_count" -gt 0 ]; then
  problem_reason="ready_to_merge"
elif [ "$merge_blocked_count" -gt 0 ]; then
  problem_reason="merge_blocked"
elif [ "$active_blocked_count" -gt 0 ]; then
  problem_reason="active_blocked_tickets"
elif [ "$reject_count" -gt 0 ]; then
  problem_reason="reject_records"
elif [ "$runner_problem_count" -gt 0 ]; then
  problem_reason="runner_problem_state"
fi

if [ "$active_blocked_count" -gt 0 ] && coordinator_blocked_processing_enabled && { [ "${cached_shared_path_blocked_count:-0}" -gt 0 ] 2>/dev/null || [ "${cached_shared_head_group_count:-0}" -gt 0 ] 2>/dev/null || [ "${cached_branch_mismatch_count:-0}" -gt 0 ] 2>/dev/null; }; then
  needs_blocked_processing_diagnosis="true"
fi

if [ -n "$problem_reason" ] && [ "$ready_count" -eq 0 ] && [ "$last_precheck_fingerprint" = "$precheck_fingerprint" ] && [ "${AUTOFLOW_COORDINATOR_DIAGNOSE_UNCHANGED:-}" != "1" ] && [ "$needs_blocked_processing_diagnosis" != "true" ] && [ -n "$cached_doctor_status" ] && [ "$cached_doctor_status" != "not_run" ] && [ -n "$cached_operational_blockers" ] && [ "$cached_operational_blockers" != "not_checked" ]; then
  diagnosis_skipped_reason="unchanged_problem"
  diagnosis_cached="true"
  doctor_status="$cached_doctor_status"
  operational_blockers="$cached_operational_blockers"
  shared_path_blocked_count="${cached_shared_path_blocked_count:-0}"
  worktree_issue_count="${cached_worktree_issue_count:-0}"
  dirty_overlap_count="${cached_dirty_overlap_count:-0}"
  shared_head_group_count="${cached_shared_head_group_count:-0}"
  branch_mismatch_count="${cached_branch_mismatch_count:-0}"
elif [ -n "$problem_reason" ]; then
  diagnosis_attempted="true"
  set +e
  "${SCRIPT_DIR}/doctor-project.sh" "$project_root" "$board_dir_name" > "$doctor_output" 2>&1
  doctor_exit=$?
  set -e

  doctor_status="$(field_from_output "$doctor_output" "status")"
  [ -n "$doctor_status" ] || doctor_status="exit_${doctor_exit}"
  operational_blockers="$(field_from_output "$doctor_output" "check.operational_blockers")"
  shared_path_blocked_count="$(field_from_output "$doctor_output" "doctor.shared_path_blocked_ticket_count")"
  worktree_issue_count="$(field_from_output "$doctor_output" "doctor.worktree_issue_count")"
  dirty_overlap_count="$(field_from_output "$doctor_output" "doctor.project_root_dirty_overlap_count")"
  shared_head_group_count="$(field_from_output "$doctor_output" "doctor.shared_nonbase_head_group_count")"
  branch_mismatch_count="$(branch_mismatch_count_from_output "$doctor_output")"
fi

if [ "$runner_problem_count" -gt 0 ]; then
  process_runner_failure_patterns
fi

if [ "$diagnosis_attempted" = "true" ] && [ "$doctor_exit" -eq 0 ]; then
  process_shared_nonbase_head_blockers
  repair_worktree_branch_mismatches
  release_cleared_shared_path_blockers
  if [ "$branch_repaired_count" -gt 0 ]; then
    branch_mismatch_count=0
  fi
  if [ "$blocked_processed_count" -gt 0 ] || [ "$shared_path_released_count" -gt 0 ]; then
    active_blocked_count="$(active_blocked_ticket_count)"
    active_blocked_ids="$(active_blocked_ticket_ids)"
    precheck_fingerprint="ready=${ready_ticket_ids}|merge_blocked=${merge_blocked_ids}|reject=${reject_ids}|active_blocked=${active_blocked_ids}|runner_problem=${runner_problem_ids}"
    if [ "$ready_count" -gt 0 ]; then
      problem_reason="ready_to_merge"
    elif [ "$merge_blocked_count" -gt 0 ]; then
      problem_reason="merge_blocked"
    elif [ "$active_blocked_count" -gt 0 ]; then
      problem_reason="active_blocked_tickets"
    elif [ "$reject_count" -gt 0 ]; then
      problem_reason="reject_records"
    elif [ "$runner_problem_count" -gt 0 ]; then
      problem_reason="runner_problem_state"
    else
      problem_reason=""
    fi
  fi
fi

write_precheck_state "$precheck_state" "$timestamp" "$precheck_fingerprint" "$problem_reason" "$doctor_status" "$operational_blockers" "$shared_path_blocked_count" "$worktree_issue_count" "$dirty_overlap_count" "$shared_head_group_count" "$branch_mismatch_count"

if [ "$diagnosis_attempted" = "true" ] && [ "$doctor_exit" -eq 0 ] && [ -n "$ready_ticket" ]; then
  ready_ticket_id="$(ticket_id_from_path "$ready_ticket")"
  merge_attempted="true"
  set +e
  AUTOFLOW_ROLE=merge \
    AUTOFLOW_WORKER_ID="${AUTOFLOW_WORKER_ID:-coordinator}" \
    AUTOFLOW_BACKGROUND="${AUTOFLOW_BACKGROUND:-1}" \
    AUTOFLOW_BOARD_ROOT="$board_root" \
    AUTOFLOW_PROJECT_ROOT="$project_root" \
    "${board_root}/scripts/merge-ready-ticket.sh" "$ready_ticket_id" > "$merge_output" 2>&1
  merge_exit=$?
  set -e
  merge_status="$(field_from_output "$merge_output" "status")"
  [ -n "$merge_status" ] || merge_status="exit_${merge_exit}"
fi

status="ok"
coordinator_reason=""
if [ "$doctor_exit" -ne 0 ] || [ "$merge_exit" -ne 0 ]; then
  status="failed"
elif [ "$blocked_processed_count" -gt 0 ]; then
  status="ok"
  coordinator_reason="blocked_processed"
elif [ "$branch_repaired_count" -gt 0 ]; then
  status="ok"
  coordinator_reason="flow_repaired"
elif [ "$shared_path_released_count" -gt 0 ]; then
  status="ok"
  coordinator_reason="blocked_released"
elif [ "$runner_failure_pattern_detected_count" -gt 0 ]; then
  status="ok"
  coordinator_reason="runner_failure_logged"
elif [ "$diagnosis_attempted" = "false" ] && [ -z "$problem_reason" ]; then
  status="idle"
  coordinator_reason="no_problem_detected"
elif [ "$diagnosis_attempted" = "false" ]; then
  status="blocked"
  coordinator_reason="${diagnosis_skipped_reason:-$problem_reason}"
elif [ "$merge_attempted" != "true" ] && [ "$operational_blockers" = "warning" ]; then
  status="blocked"
  coordinator_reason="operational_blockers"
elif [ "$merge_attempted" != "true" ] && [ "$ready_count" -eq 0 ]; then
  status="blocked"
  coordinator_reason="$problem_reason"
fi

printf 'status=%s\n' "$status"
printf 'role=coordinator\n'
printf 'reason=%s\n' "$coordinator_reason"
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'doctor_status=%s\n' "$doctor_status"
printf 'doctor_exit_code=%s\n' "$doctor_exit"
if [ -n "$problem_reason" ]; then
  printf 'coordinator.problem_detected=true\n'
else
  printf 'coordinator.problem_detected=false\n'
fi
printf 'coordinator.problem_reason=%s\n' "$problem_reason"
printf 'coordinator.diagnosis_attempted=%s\n' "$diagnosis_attempted"
printf 'coordinator.diagnosis_cached=%s\n' "$diagnosis_cached"
printf 'coordinator.diagnosis_skipped_reason=%s\n' "$diagnosis_skipped_reason"
printf 'coordinator.precheck_fingerprint=%s\n' "$precheck_fingerprint"
printf 'coordinator.precheck_ready_to_merge_count=%s\n' "$ready_count"
printf 'coordinator.precheck_merge_blocked_count=%s\n' "$merge_blocked_count"
printf 'coordinator.precheck_reject_count=%s\n' "$reject_count"
printf 'coordinator.precheck_active_blocked_ticket_count=%s\n' "$active_blocked_count"
printf 'coordinator.precheck_runner_problem_state_count=%s\n' "$runner_problem_count"
printf 'coordinator.precheck_active_blocked_tickets=%s\n' "$active_blocked_ids"
printf 'coordinator.precheck_runner_problem_states=%s\n' "$runner_problem_ids"
printf 'coordinator.operational_blockers=%s\n' "$operational_blockers"
printf 'coordinator.shared_path_blocked_ticket_count=%s\n' "$shared_path_blocked_count"
printf 'coordinator.worktree_issue_count=%s\n' "$worktree_issue_count"
printf 'coordinator.project_root_dirty_overlap_count=%s\n' "$dirty_overlap_count"
printf 'coordinator.shared_nonbase_head_group_count=%s\n' "$shared_head_group_count"
printf 'coordinator.branch_mismatch_count=%s\n' "$branch_mismatch_count"
printf 'coordinator.blocked_processing_attempted=%s\n' "$blocked_processing_attempted"
printf 'coordinator.blocked_processed_count=%s\n' "$blocked_processed_count"
printf 'coordinator.blocked_processed_tickets=%s\n' "$blocked_processed_tickets"
printf 'coordinator.blocked_processing_failed_count=%s\n' "$blocked_processing_failed_count"
printf 'coordinator.blocked_processing_failed_tickets=%s\n' "$blocked_processing_failed_tickets"
printf 'coordinator.branch_repair_attempted=%s\n' "$branch_repair_attempted"
printf 'coordinator.branch_repaired_count=%s\n' "$branch_repaired_count"
printf 'coordinator.branch_repaired_tickets=%s\n' "$branch_repaired_tickets"
printf 'coordinator.shared_path_release_attempted=%s\n' "$shared_path_release_attempted"
printf 'coordinator.shared_path_released_count=%s\n' "$shared_path_released_count"
printf 'coordinator.shared_path_released_tickets=%s\n' "$shared_path_released_tickets"
printf 'coordinator.shared_head_remediation_log_paths=%s\n' "$shared_head_remediation_log_paths"
printf 'coordinator.runner_failure_pattern_attempted=%s\n' "$runner_failure_pattern_attempted"
printf 'coordinator.runner_failure_pattern_detected_count=%s\n' "$runner_failure_pattern_detected_count"
printf 'coordinator.runner_failure_pattern_summary=%s\n' "$runner_failure_pattern_summary"
printf 'coordinator.runner_failure_pattern_log_paths=%s\n' "$runner_failure_pattern_log_paths"
printf 'coordinator.ready_to_merge_count=%s\n' "$ready_count"
printf 'coordinator.merge_attempted=%s\n' "$merge_attempted"
printf 'coordinator.merge_ticket=%s\n' "$ready_ticket"
printf 'coordinator.merge_ticket_id=%s\n' "$ready_ticket_id"
printf 'coordinator.merge_status=%s\n' "$merge_status"
printf 'coordinator.merge_exit_code=%s\n' "$merge_exit"
if [ "$merge_attempted" != "true" ]; then
  if [ "$blocked_processed_count" -gt 0 ]; then
    printf 'coordinator.next_action=%s\n' "Coordinator processed blocked ticket(s): ${blocked_processed_tickets}. The next owner tick should continue from the clean replacement worktree."
  elif [ "$branch_repaired_count" -gt 0 ]; then
    printf 'coordinator.next_action=%s\n' "Coordinator repaired worktree branch metadata for ticket(s): ${branch_repaired_tickets}. Re-run doctor on the next tick to continue blocker handling."
  elif [ "$shared_path_released_count" -gt 0 ]; then
    printf 'coordinator.next_action=%s\n' "Coordinator released shared-path blocked ticket(s): ${shared_path_released_tickets}. The next owner tick should resume them."
  elif [ "$runner_failure_pattern_detected_count" -gt 0 ]; then
    printf 'coordinator.next_action=%s\n' "Coordinator logged ${runner_failure_pattern_detected_count} runner failure pattern(s): ${runner_failure_pattern_summary}. Adapter normalization will resolve known model aliases on the next runner tick; remediation log(s): ${runner_failure_pattern_log_paths}."
  elif [ "$diagnosis_skipped_reason" = "unchanged_problem" ]; then
    printf 'coordinator.next_action=%s\n' "Problem precheck is unchanged since the previous coordinator tick; reuse cached diagnosis summary and skip full doctor until the board state changes."
  elif [ "$diagnosis_attempted" = "false" ]; then
    printf 'coordinator.next_action=%s\n' "No coordinator problem detected by cheap precheck; skip doctor until ready-to-merge, blockers, rejects, or failed runner state appear."
  elif [ "$status" = "blocked" ]; then
    printf 'coordinator.next_action=%s\n' "No ready-to-merge ticket found. Resolve the root blocker reported in doctor_output before downstream blocked tickets can move."
  else
    printf 'coordinator.next_action=%s\n' "No ready-to-merge ticket found; use doctor_output for blockers or idle health."
  fi
fi
if [ "$diagnosis_attempted" = "true" ]; then
  emit_file_block "doctor_output" "$doctor_output"
fi
if [ "$merge_attempted" = "true" ]; then
  emit_file_block "merge_output" "$merge_output"
fi

if [ "$status" = "failed" ]; then
  exit 1
fi
