#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOARD_ROOT="${AUTOPILOT_BOARD_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

resolve_project_root() {
  local configured resolved

  if [ -n "${AUTOPILOT_PROJECT_ROOT:-}" ]; then
    cd "${AUTOPILOT_PROJECT_ROOT}" && pwd
    return 0
  fi

  if [ -f "${BOARD_ROOT}/.project-root" ]; then
    configured="$(tr -d '\r\n' < "${BOARD_ROOT}/.project-root")"
    if [ -z "${configured}" ]; then
      configured=".."
    fi
    case "${configured}" in
      /*) resolved="${configured}" ;;
      *) resolved="${BOARD_ROOT}/${configured}" ;;
    esac
    cd "${resolved}" && pwd
    return 0
  fi

  cd "${BOARD_ROOT}/.." && pwd
}

PROJECT_ROOT="$(resolve_project_root)"

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

owner_id() {
  if [ -n "${AUTOFLOW_WORKER_ID:-}" ]; then
    printf '%s' "${AUTOFLOW_WORKER_ID}"
    return 0
  fi
  if [ -n "${CODEX_AUTOMATION_ID:-}" ]; then
    printf '%s' "${CODEX_AUTOMATION_ID}"
    return 0
  fi
  if [ -n "${CODEX_THREAD_ID:-}" ]; then
    printf '%s' "${CODEX_THREAD_ID}"
    return 0
  fi
  printf '%s@%s:%s' "${USER:-unknown}" "${HOSTNAME:-localhost}" "$$"
}

worker_role() {
  printf '%s' "${AUTOFLOW_ROLE:-}"
}

background_mode_enabled() {
  case "${AUTOFLOW_BACKGROUND:-${AUTOFLOW_HEARTBEAT_MODE:-}}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_expected_role() {
  local expected_role="$1"
  local current_role

  current_role="$(worker_role)"
  if [ -n "$current_role" ] && [ "$current_role" != "$expected_role" ]; then
    echo "AUTOFLOW_ROLE=${current_role} cannot run ${expected_role} hook." >&2
    exit 1
  fi
}

idle_exit() {
  local reason="$1"
  printf 'status=idle\n'
  printf 'reason=%s\n' "$reason"
  printf 'worker_role=%s\n' "$(worker_role)"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
}

fail_or_idle() {
  local message="$1"
  local reason="$2"

  if background_mode_enabled; then
    idle_exit "$reason"
  fi

  echo "$message" >&2
  exit 1
}

trim_spaces() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

field_is_unassigned() {
  case "$(trim_spaces "${1:-}")" in
    ""|unassigned|unclaimed|none)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

normalize_id() {
  local raw="${1:-}"
  raw="${raw##*_}"
  raw="${raw%.md}"
  raw="${raw//[^0-9]/}"
  if [ -z "${raw}" ]; then
    return 1
  fi
  printf '%03d' "$((10#${raw}))"
}

extract_numeric_id() {
  local path="$1"
  local base
  base="$(basename "$path")"
  normalize_id "$base"
}

list_matching_files() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" | sort
}

lowest_matching_file() {
  local dir="$1"
  local pattern="$2"
  list_matching_files "$dir" "$pattern" | head -n 1
}

lowest_ready_plan() {
  local file
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if awk '
      /^## Plan/ { in_plan=1; next }
      /^## / && in_plan { in_plan=0 }
      in_plan && $0 == "- Status: ready" { found=1 }
      END { exit(found ? 0 : 1) }
    ' "$file"; then
      printf '%s' "$file"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/rules/plan" 'plan_[0-9][0-9][0-9].md')
  return 1
}

ticket_path() {
  local state_dir="$1"
  local id="$2"
  printf '%s/tickets/%s/tickets_%s.md' "$BOARD_ROOT" "$state_dir" "$id"
}

plan_path() {
  local id="$1"
  printf '%s/rules/plan/plan_%s.md' "$BOARD_ROOT" "$id"
}

next_ticket_id() {
  local max_id=0
  local path id
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    id="$(extract_numeric_id "$path")"
    if [ "$((10#$id))" -gt "$max_id" ]; then
      max_id="$((10#$id))"
    fi
  done < <(find "${BOARD_ROOT}/tickets" -type f -name 'tickets_*.md' | sort)
  printf '%03d' "$((max_id + 1))"
}

replace_scalar_field_in_section() {
  local file="$1"
  local heading="$2"
  local field="$3"
  local value="$4"
  local tmp
  tmp="$(mktemp)"
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
  tmp="$(mktemp)"
  block_file="$(mktemp)"
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
  tmp="$(mktemp)"
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

append_generated_ticket() {
  local file="$1"
  local entry="$2"
  local tmp
  tmp="$(mktemp)"
  awk -v entry="$entry" '
    BEGIN { insert_next=0; inserted=0 }
    $0 == "## Generated Tickets" {
      print
      print "- " entry
      insert_next=1
      inserted=1
      next
    }
    insert_next && $0 ~ /^- 아직 없음/ {
      insert_next=0
      next
    }
    { print }
    END {
      if (!inserted) {
        print ""
        print "## Generated Tickets"
        print "- " entry
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

extract_execution_candidates() {
  local file="$1"
  awk '
    /^## Execution Candidates/ { in_section=1; next }
    /^## / { in_section=0 }
    in_section && /^[[:space:]]*- \[ \]/ {
      sub(/^[[:space:]]*- \[ \] /, "", $0)
      print
    }
  ' "$file"
}

extract_allowed_paths_block() {
  local file="$1"
  awk '
    /^## Ticket Rules/ { in_rules=1; next }
    /^## / { in_rules=0 }
    in_rules && /^[[:space:]]*- Allowed Paths:/ { in_allowed=1; next }
    in_allowed && /^[[:space:]]*- Ticket split notes:/ { in_allowed=0 }
    in_allowed && /^[[:space:]]+[-*] / { print substr($0, 3) }
  ' "$file"
}

extract_reference_value() {
  local file="$1"
  local heading="$2"
  local field="$3"
  awk -v heading="$heading" -v field="$field" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && $0 ~ "^- " field ":" {
      sub("^- " field ": ?", "", $0)
      print
      exit
    }
  ' "$file"
}

extract_scalar_field_in_section() {
  local file="$1"
  local heading="$2"
  local field="$3"
  awk -v heading="$heading" -v field="$field" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && $0 ~ "^- " field ":" {
      sub("^- " field ": ?", "", $0)
      print
      exit
    }
  ' "$file"
}

ticket_scalar_field() {
  local file="$1"
  local field="$2"
  extract_scalar_field_in_section "$file" "Ticket" "$field"
}

ticket_stage() {
  ticket_scalar_field "$1" "Stage"
}

stage_is_execution_candidate() {
  case "${1:-}" in
    ""|claimed|executing|blocked)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

stage_is_verification_candidate() {
  case "${1:-}" in
    ready_for_verification|verifying)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

strip_markdown_code_ticks() {
  local raw="${1:-}"
  raw="${raw#\`}"
  raw="${raw%\`}"
  printf '%s' "$raw"
}

board_file_exists() {
  local rel="${1:-}"
  [ -n "$rel" ] || return 1
  [ -f "${BOARD_ROOT}/${rel}" ]
}

ticket_exists_for_plan_candidate() {
  local plan_id="$1"
  local candidate="$2"
  local ticket
  while IFS= read -r ticket; do
    [ -n "$ticket" ] || continue
    if grep -qsF -- "- Plan Source: \`rules/plan/plan_${plan_id}.md\`" "$ticket" && \
       grep -qsF -- "- 이번 작업의 목표: ${candidate}" "$ticket"; then
      return 0
    fi
  done < <(find "${BOARD_ROOT}/tickets" -type f -name 'tickets_*.md' | sort)
  return 1
}

ensure_runs_file() {
  local ticket_id="$1"
  local file="${BOARD_ROOT}/tickets/runs/verify_${ticket_id}.md"
  local template_file
  if [ ! -f "$file" ]; then
    mkdir -p "${BOARD_ROOT}/tickets/runs"
    template_file="${BOARD_ROOT}/rules/verifier/verification-template.md"
    if [ ! -f "$template_file" ]; then
      template_file="${BOARD_ROOT}/verifier/templates/verification-template.md"
    fi
    if [ ! -f "$template_file" ]; then
      template_file="${BOARD_ROOT}/runs/verification-template.md"
    fi
    cp "$template_file" "$file"
    replace_scalar_field_in_section "$file" "## Meta" "Ticket ID" "$ticket_id"
    replace_scalar_field_in_section "$file" "## Meta" "Target" "tickets_${ticket_id}.md"
    replace_scalar_field_in_section "$file" "## Meta" "Status" "pending"
  fi
  printf '%s' "$file"
}

count_execution_load_for_owner() {
  local wanted_owner="$1"
  local count=0
  local file stage execution_owner

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    execution_owner="$(ticket_scalar_field "$file" "Execution Owner")"
    [ "$execution_owner" = "$wanted_owner" ] || continue
    stage="$(ticket_stage "$file")"
    if stage_is_execution_candidate "$stage"; then
      count=$((count + 1))
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  printf '%s' "$count"
}

count_verification_load_for_owner() {
  local wanted_owner="$1"
  local count=0
  local file stage verifier_owner

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    verifier_owner="$(ticket_scalar_field "$file" "Verifier Owner")"
    [ "$verifier_owner" = "$wanted_owner" ] || continue
    stage="$(ticket_stage "$file")"
    case "${stage:-}" in
      ""|claimed|executing|ready_for_verification|verifying|blocked)
      count=$((count + 1))
      ;;
    esac
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  printf '%s' "$count"
}

pick_least_loaded_owner() {
  local owner_kind="$1"
  local pool_csv="$2"
  local best_owner=""
  local best_count=""
  local candidate trimmed count
  local IFS=','
  local pool_entries=()

  read -r -a pool_entries <<< "$pool_csv"
  for candidate in "${pool_entries[@]}"; do
    trimmed="$(trim_spaces "$candidate")"
    [ -n "$trimmed" ] || continue
    if [ "$owner_kind" = "execution" ]; then
      count="$(count_execution_load_for_owner "$trimmed")"
    else
      count="$(count_verification_load_for_owner "$trimmed")"
    fi

    if [ -z "$best_owner" ] || [ "$count" -lt "$best_count" ]; then
      best_owner="$trimmed"
      best_count="$count"
    fi
  done

  printf '%s' "$best_owner"
}

resolve_execution_owner_for_claim() {
  local selected_owner=""

  if [ -n "${AUTOFLOW_EXECUTION_OWNER:-}" ]; then
    selected_owner="$(trim_spaces "${AUTOFLOW_EXECUTION_OWNER}")"
  elif [ -n "${AUTOFLOW_EXECUTION_POOL:-}" ]; then
    selected_owner="$(pick_least_loaded_owner "execution" "${AUTOFLOW_EXECUTION_POOL}")"
  fi

  if [ -z "$selected_owner" ]; then
    selected_owner="unassigned"
  fi

  printf '%s' "$selected_owner"
}

execution_load_limit() {
  printf '%s' "${AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER:-1}"
}

execution_pool_has_capacity() {
  local limit pool_csv candidate trimmed count
  local IFS=','
  local pool_entries=()

  pool_csv="${AUTOFLOW_EXECUTION_POOL:-}"
  if [ -z "$pool_csv" ]; then
    return 0
  fi

  limit="$(execution_load_limit)"
  read -r -a pool_entries <<< "$pool_csv"
  for candidate in "${pool_entries[@]}"; do
    trimmed="$(trim_spaces "$candidate")"
    [ -n "$trimmed" ] || continue
    count="$(count_execution_load_for_owner "$trimmed")"
    if [ "$count" -lt "$limit" ]; then
      return 0
    fi
  done

  return 1
}

resolve_verifier_owner_for_claim() {
  local selected_owner=""

  if [ -n "${AUTOFLOW_VERIFIER_OWNER:-}" ]; then
    selected_owner="$(trim_spaces "${AUTOFLOW_VERIFIER_OWNER}")"
  elif [ -n "${AUTOFLOW_VERIFIER_POOL:-}" ]; then
    selected_owner="$(pick_least_loaded_owner "verification" "${AUTOFLOW_VERIFIER_POOL}")"
  fi

  if [ -z "$selected_owner" ]; then
    selected_owner="unassigned"
  fi

  printf '%s' "$selected_owner"
}
