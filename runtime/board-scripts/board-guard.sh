#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

strict=false
for arg in "$@"; do
  case "$arg" in
    --strict)
      strict=true
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  board-guard.sh [--strict]

Validates Autoflow board invariants after AI-authored markdown changes.
EOF
      exit 0
      ;;
    *)
      echo "Unknown board-guard argument: $arg" >&2
      exit 2
      ;;
  esac
done

error_count=0
warning_count=0
check_output="$(autoflow_mktemp)"
detail_output="$(autoflow_mktemp)"

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

guard_ticket_files() {
  local dir

  for dir in todo inprogress ready-to-merge merge-blocked verifier reject; do
    [ -d "${BOARD_ROOT}/tickets/${dir}" ] || continue
    find "${BOARD_ROOT}/tickets/${dir}" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md'
  done

  if [ -d "${BOARD_ROOT}/tickets/done" ]; then
    find "${BOARD_ROOT}/tickets/done" -type f -name 'tickets_[0-9][0-9][0-9].md'
  fi
}

active_ticket_files() {
  local dir

  for dir in todo inprogress ready-to-merge merge-blocked verifier; do
    [ -d "${BOARD_ROOT}/tickets/${dir}" ] || continue
    find "${BOARD_ROOT}/tickets/${dir}" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md'
  done
}

ticket_file_for_id() {
  local ticket_ref="$1"
  local ticket_num="${ticket_ref#tickets_}"
  local file

  for file in \
    "${BOARD_ROOT}/tickets/todo/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/inprogress/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/ready-to-merge/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/merge-blocked/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/verifier/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/reject/${ticket_ref}.md" \
    "${BOARD_ROOT}/tickets/reject/reject_${ticket_num}.md"; do
    [ -f "$file" ] && {
      printf '%s' "$file"
      return 0
    }
  done

  if [ -d "${BOARD_ROOT}/tickets/done" ]; then
    find "${BOARD_ROOT}/tickets/done" -type f -name "${ticket_ref}.md" -print -quit
  fi
}

ticket_worktree_board_state() {
  local file="$1"

  case "$file" in
    "${BOARD_ROOT}/tickets/todo/"*|"${BOARD_ROOT}/tickets/inprogress/"*|"${BOARD_ROOT}/tickets/ready-to-merge/"*|"${BOARD_ROOT}/tickets/merge-blocked/"*|"${BOARD_ROOT}/tickets/verifier/"*)
      printf 'active'
      ;;
    "${BOARD_ROOT}/tickets/reject/"*)
      printf 'rejected'
      ;;
    "${BOARD_ROOT}/tickets/done/"*)
      printf 'done'
      ;;
    *)
      printf 'unknown'
      ;;
  esac
}

ticket_state_path() {
  local file="$1"
  case "$file" in
    "${BOARD_ROOT}/tickets/done/"*)
      printf 'done/%s' "$(basename "$(dirname "$file")")"
      ;;
    "${BOARD_ROOT}/tickets/"*)
      printf '%s' "${file#${BOARD_ROOT}/tickets/}" | awk -F/ '{ print $1 }'
      ;;
    *)
      printf 'unknown'
      ;;
  esac
}

section_exists() {
  local file="$1"
  local section="$2"

  grep -Fqx -- "## ${section}" "$file"
}

field_in_section_present() {
  local file="$1"
  local section="$2"
  local field="$3"

  awk -v section="$section" -v field="$field" '
    $0 == "## " section { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section {
      pattern = "^[[:space:]]*[-*][[:space:]]*" field ":"
      if ($0 ~ pattern) {
        found=1
        exit
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

markdown_scalar() {
  local file="$1"
  local section="$2"
  local field="$3"

  extract_scalar_field_in_section "$file" "$section" "$field" | tr -d '\r' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^`//; s/`$//'
}

value_in_list() {
  local value="$1"
  shift || true
  local candidate

  for candidate in "$@"; do
    [ "$value" = "$candidate" ] && return 0
  done

  return 1
}

check_duplicate_ticket_ids() {
  local tmp id locations duplicates=0
  tmp="$(autoflow_mktemp)"

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    id="$(basename "$file" .md)"
    printf '%s\t%s\n' "$id" "$file" >> "$tmp"
  done < <(guard_ticket_files | sort)

  while IFS= read -r id; do
    [ -n "$id" ] || continue
    locations="$(awk -F'\t' -v id="$id" '$1 == id { print $2 }' "$tmp" | sed "s#${BOARD_ROOT}/##" | paste -sd ',' -)"
    duplicates=$((duplicates + 1))
    record_error "${id} exists in multiple board states: ${locations}"
  done < <(awk -F'\t' '{ count[$1] += 1 } END { for (id in count) if (count[id] > 1) print id }' "$tmp" | sort)

  if [ "$duplicates" -gt 0 ]; then
    record_check "duplicate_ticket_ids" "error"
  else
    record_check "duplicate_ticket_ids" "ok"
  fi
}

check_todo_worktree_metadata() {
  local file rel path branch base_commit worktree_commit integration_status stale_count=0

  [ -d "${BOARD_ROOT}/tickets/todo" ] || {
    record_check "todo_worktree_metadata" "ok"
    return 0
  }

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    rel="${file#${BOARD_ROOT}/}"
    path="$(markdown_scalar "$file" "Worktree" "Path")"
    branch="$(markdown_scalar "$file" "Worktree" "Branch")"
    base_commit="$(markdown_scalar "$file" "Worktree" "Base Commit")"
    worktree_commit="$(markdown_scalar "$file" "Worktree" "Worktree Commit")"
    integration_status="$(markdown_scalar "$file" "Worktree" "Integration Status")"

    case "$integration_status" in
      ""|pending|pending_claim)
        ;;
      *)
        stale_count=$((stale_count + 1))
        record_error "${rel} is in todo but has Integration Status=${integration_status}"
        continue
        ;;
    esac

    if [ -n "$path" ] || [ -n "$branch" ] || [ -n "$base_commit" ] || [ -n "$worktree_commit" ]; then
      stale_count=$((stale_count + 1))
      record_error "${rel} is in todo but still has worktree metadata"
    fi
  done < <(find "${BOARD_ROOT}/tickets/todo" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' | sort)

  if [ "$stale_count" -gt 0 ]; then
    record_check "todo_worktree_metadata" "error"
  else
    record_check "todo_worktree_metadata" "ok"
  fi
}

check_active_sections() {
  local file rel missing=0 section
  local required_sections=("Ticket" "Goal" "Allowed Paths" "Worktree" "Goal Runtime" "Recovery State" "Done When" "Next Action" "Resume Context" "Verification" "Result")

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    rel="${file#${BOARD_ROOT}/}"
    for section in "${required_sections[@]}"; do
      if ! section_exists "$file" "$section"; then
        missing=$((missing + 1))
        record_warning "${rel} is missing section ## ${section}"
      fi
    done
  done < <(active_ticket_files | sort)

  if [ "$missing" -gt 0 ]; then
    record_check "active_ticket_sections" "warning"
  else
    record_check "active_ticket_sections" "ok"
  fi
}

check_recovery_state_fields() {
  local file rel missing=0 field
  local fields=("Status" "Detected By" "Failure Class" "Evidence" "Planner Decision" "Owner Resume Instruction" "Last Recovery At")

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    section_exists "$file" "Recovery State" || continue
    rel="${file#${BOARD_ROOT}/}"
    for field in "${fields[@]}"; do
      if ! field_in_section_present "$file" "Recovery State" "$field"; then
        missing=$((missing + 1))
        record_warning "${rel} Recovery State missing field ${field}"
      fi
    done
  done < <(active_ticket_files | sort)

  if [ "$missing" -gt 0 ]; then
    record_check "recovery_state_fields" "warning"
  else
    record_check "recovery_state_fields" "ok"
  fi
}

check_recovery_state_values() {
  local file rel status failure_class invalid=0
  local valid_statuses=(healthy stalled blocked repairing requeued needs_user)
  local valid_failure_classes=(
    adapter_no_progress
    stale_todo_worktree
    missing_worktree
    dirty_root
    dirty_project_root_conflict
    allowed_path_conflict
    shared_head_conflict
    verification_failed
    merge_conflict
    ambiguous_scope
    oversized_ticket
    tooling_failure
    retry_limit
    needs_user_decision
    leftover_worktree
  )

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    section_exists "$file" "Recovery State" || continue
    rel="${file#${BOARD_ROOT}/}"
    status="$(markdown_scalar "$file" "Recovery State" "Status")"
    failure_class="$(markdown_scalar "$file" "Recovery State" "Failure Class")"

    if ! value_in_list "$status" "${valid_statuses[@]}"; then
      invalid=$((invalid + 1))
      record_warning "${rel} Recovery State has invalid Status=${status:-<empty>}"
    fi

    if [ -n "$failure_class" ] && ! value_in_list "$failure_class" "${valid_failure_classes[@]}"; then
      invalid=$((invalid + 1))
      record_warning "${rel} Recovery State has invalid Failure Class=${failure_class}"
    fi
  done < <(active_ticket_files | sort)

  if [ "$invalid" -gt 0 ]; then
    record_check "recovery_state_values" "warning"
  else
    record_check "recovery_state_values" "ok"
  fi
}

check_resolved_ticket_worktrees() {
  local line worktree_path branch ticket_ref ticket_file board_state rel dirty_output stale_count=0

  if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    record_check "resolved_ticket_worktrees" "ok"
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      worktree\ *)
        worktree_path="${line#worktree }"
        branch=""
        ;;
      branch\ refs/heads/autoflow/tickets_[0-9][0-9][0-9])
        branch="${line#branch refs/heads/}"
        ticket_ref="${branch##*/}"
        ticket_file="$(ticket_file_for_id "$ticket_ref")"
        if [ -z "$ticket_file" ]; then
          stale_count=$((stale_count + 1))
          record_warning "${branch} has a ticket worktree but no board ticket: ${worktree_path}"
          continue
        fi

        board_state="$(ticket_worktree_board_state "$ticket_file")"
        rel="${ticket_file#${BOARD_ROOT}/}"
        case "$board_state" in
          active)
            ;;
          rejected|done)
            stale_count=$((stale_count + 1))
            dirty_output=""
            if [ -d "$worktree_path" ]; then
              dirty_output="$(git -C "$worktree_path" status --porcelain 2>/dev/null || true)"
            fi
            if [ -n "$dirty_output" ]; then
              record_warning "${branch} has dirty worktree for ${board_state} ticket ${rel}: ${worktree_path}"
            else
              record_warning "${branch} has leftover clean worktree for ${board_state} ticket ${rel}: ${worktree_path}"
            fi
            ;;
          *)
            stale_count=$((stale_count + 1))
            record_warning "${branch} has ticket worktree with unknown board state ${rel}: ${worktree_path}"
            ;;
        esac
        ;;
      "")
        worktree_path=""
        branch=""
        ;;
    esac
  done < <(git -C "$PROJECT_ROOT" worktree list --porcelain 2>/dev/null || true)

  if [ "$stale_count" -gt 0 ]; then
    record_check "resolved_ticket_worktrees" "warning"
  else
    record_check "resolved_ticket_worktrees" "ok"
  fi
}

check_duplicate_ticket_ids
check_todo_worktree_metadata
check_active_sections
check_recovery_state_fields
check_recovery_state_values
check_resolved_ticket_worktrees

if [ "$strict" = "true" ] && [ "$warning_count" -gt 0 ]; then
  strict_warning_output="$(autoflow_mktemp)"
  cp "$detail_output" "$strict_warning_output"
  while IFS= read -r warning; do
    [ -n "$warning" ] || continue
    record_error "strict mode: ${warning#warning.*=}"
  done < "$strict_warning_output"
fi

status="ok"
if [ "$error_count" -gt 0 ]; then
  status="error"
elif [ "$warning_count" -gt 0 ]; then
  status="warning"
fi

printf 'status=%s\n' "$status"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'strict=%s\n' "$strict"
printf 'error_count=%s\n' "$error_count"
printf 'warning_count=%s\n' "$warning_count"
cat "$check_output"
cat "$detail_output"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi
