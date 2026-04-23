#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/package-board-common.sh"

usage() {
  echo "Usage: $(basename "$0") /path/to/project [board-dir-name]" >&2
}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 1
fi

TARGET_PROJECT_ROOT="$1"
BOARD_DIR_NAME="${2:-autoflow}"
TARGET_PROJECT_ROOT="$(normalize_input_path "$TARGET_PROJECT_ROOT")"

if [ ! -d "$TARGET_PROJECT_ROOT" ]; then
  echo "Project root not found: $TARGET_PROJECT_ROOT" >&2
  exit 1
fi

TARGET_PROJECT_ROOT="$(cd "$TARGET_PROJECT_ROOT" && pwd)"
TARGET_BOARD_ROOT="${TARGET_PROJECT_ROOT}/${BOARD_DIR_NAME}"
HOST_AGENTS_PATH="${TARGET_PROJECT_ROOT}/AGENTS.md"

ensure_package_templates_present

if ! board_already_initialized "$TARGET_BOARD_ROOT"; then
  echo "Board is not initialized: $TARGET_BOARD_ROOT" >&2
  exit 1
fi

ensure_board_directories "$TARGET_BOARD_ROOT"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_root="${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups/${timestamp}"
previous_board_version="$(board_version_value "$TARGET_BOARD_ROOT" || true)"
if [ -z "$previous_board_version" ]; then
  previous_board_version="unknown"
fi

managed_created_count=0
managed_updated_count=0
managed_unchanged_count=0
backup_count=0

record_sync_action() {
  local action="$1"

  case "$action" in
    created) managed_created_count=$((managed_created_count + 1)) ;;
    updated) managed_updated_count=$((managed_updated_count + 1)) ;;
    unchanged) managed_unchanged_count=$((managed_unchanged_count + 1)) ;;
    *)
      echo "Unknown sync action: $action" >&2
      exit 1
      ;;
  esac

  if [ "${SYNC_BACKUP_CREATED:-0}" = "1" ]; then
    backup_count=$((backup_count + 1))
  fi
}

record_backup_once_for_path() {
  local path="$1"
  local backup_path="$path"

  case "$backup_path" in
    "${TARGET_BOARD_ROOT}/"*) ;;
    *) backup_path="${TARGET_BOARD_ROOT}/${backup_path}" ;;
  esac

  SYNC_BACKUP_CREATED=0
  backup_board_file_once "$TARGET_BOARD_ROOT" "$backup_path" "$backup_root"
  if [ "${SYNC_BACKUP_CREATED:-0}" = "1" ]; then
    backup_count=$((backup_count + 1))
  fi
}

board_relative_target_path() {
  local path="$1"

  case "$path" in
    "${TARGET_BOARD_ROOT}/"*)
      printf '%s' "${path#${TARGET_BOARD_ROOT}/}"
      ;;
    *)
      printf '%s' "$path"
      ;;
  esac
}

strip_markdown_code_ticks() {
  local raw

  raw="$(printf '%s' "${1:-}" | tr -d '\r\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

  if printf '%s' "$raw" | grep -qE '^\[[^]]+\]\([^)]+\)$'; then
    printf '%s' "$raw" | sed -E 's/^\[[^]]+\]\(([^)]+)\)$/\1/'
    return 0
  fi

  if printf '%s' "$raw" | grep -qE '^\[\[[^]]+\]\]$'; then
    printf '%s' "$raw" | sed -E 's/^\[\[([^]|]+)(\|[^]]+)?\]\]$/\1/'
    return 0
  fi

  printf '%s' "$raw" | sed 's/^`//; s/`$//'
}

extract_reference_in_section() {
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

done_spec_ref_for_upgrade() {
  local spec_ref="$1"
  local normalized base_name project_key

  normalized="$(strip_markdown_code_ticks "$spec_ref")"
  case "$normalized" in
    tickets/done/*)
      printf '%s' "$normalized"
      ;;
    tickets/backlog/project_[0-9][0-9][0-9].md|tickets/backlog/feature_[0-9][0-9][0-9].md|tickets/backlog/processed/project_[0-9][0-9][0-9].md|tickets/backlog/processed/feature_[0-9][0-9][0-9].md)
      base_name="$(basename "$normalized")"
      project_key="$(project_key_from_spec_ref_for_upgrade "$normalized")"
      printf 'tickets/done/%s/%s' "$project_key" "$base_name"
      ;;
    *)
      printf '%s' "$normalized"
      ;;
  esac
}

plan_id_from_ref_for_upgrade() {
  local plan_ref="$1"
  local note_name

  note_name="$(note_name_from_board_ref_for_upgrade "$plan_ref")"
  printf '%s' "$note_name" | sed -n 's/^plan_\([0-9][0-9][0-9]\)$/\1/p'
}

ticket_plan_id_for_upgrade() {
  local ticket_file="$1"
  local plan_ref

  plan_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$ticket_file" "References" "Plan Source")")"
  plan_id_from_ref_for_upgrade "$plan_ref"
}

project_key_from_spec_ref_for_upgrade() {
  local spec_ref="$1"
  local normalized base_name

  normalized="$(strip_markdown_code_ticks "$spec_ref")"
  normalized="${normalized##*/}"
  base_name="${normalized%.md}"

  if [ -n "$base_name" ]; then
    printf '%s' "$base_name"
    return 0
  fi

  printf 'unlinked-project'
}

project_key_from_ticket_for_upgrade() {
  local ticket_file="$1"
  local project_key project_ref

  project_key="$(strip_markdown_code_ticks "$(extract_reference_in_section "$ticket_file" "Ticket" "Project Key")")"
  if [ -n "$project_key" ]; then
    printf '%s' "$project_key"
    return 0
  fi

  project_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$ticket_file" "References" "Project Spec")")"
  printf '%s' "$(project_key_from_spec_ref_for_upgrade "$project_ref")"
}

note_name_from_board_ref_for_upgrade() {
  local board_ref="$1"
  local normalized

  normalized="$(strip_markdown_code_ticks "$board_ref")"
  normalized="${normalized##*/}"
  printf '%s' "${normalized%.md}"
}

replace_scalar_field_in_section_in_file() {
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

replace_section_block_in_file() {
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

replace_board_literal_if_present() {
  local file="$1"
  local from_literal="$2"
  local to_literal="$3"
  local relative_file

  if ! grep -qsF -- "$from_literal" "$file"; then
    return 0
  fi

  relative_file="$(board_relative_target_path "$file")"
  record_backup_once_for_path "$relative_file"
  replace_literal_in_file "$file" "$from_literal" "$to_literal" || true
}

ticket_state_files_for_upgrade() {
  find "$TARGET_BOARD_ROOT/tickets" \
    \( -path "${TARGET_BOARD_ROOT}/tickets/backlog" -o -path "${TARGET_BOARD_ROOT}/tickets/backlog/*" -o -path "${TARGET_BOARD_ROOT}/tickets/plan" -o -path "${TARGET_BOARD_ROOT}/tickets/plan/*" -o -path "${TARGET_BOARD_ROOT}/tickets/runs" -o -path "${TARGET_BOARD_ROOT}/tickets/runs/*" \) -prune -o \
    -type f \( -name 'tickets_[0-9][0-9][0-9].md' -o -name 'reject_[0-9][0-9][0-9].md' \) -print | sort
}

plan_has_related_ticket() {
  local plan_id="$1"
  local ticket_file

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    if [ "$(ticket_plan_id_for_upgrade "$ticket_file")" = "$plan_id" ]; then
      return 0
    fi
  done < <(ticket_state_files_for_upgrade)

  return 1
}

migrate_spec_ref_to_done() {
  local spec_ref="$1"
  local done_spec_ref source_path target_path duplicate_path duplicate_ref

  spec_ref="$(strip_markdown_code_ticks "$spec_ref")"
  [ -n "$spec_ref" ] || return 0

  done_spec_ref="$(done_spec_ref_for_upgrade "$spec_ref")"
  source_path="${TARGET_BOARD_ROOT}/${spec_ref}"
  target_path="${TARGET_BOARD_ROOT}/${done_spec_ref}"

  if [ "$done_spec_ref" != "$spec_ref" ] && [ -f "$source_path" ]; then
    record_backup_once_for_path "$spec_ref"
    if [ -f "$target_path" ]; then
      record_backup_once_for_path "$done_spec_ref"
      if cmp -s "$source_path" "$target_path"; then
        rm -f "$source_path"
      else
        duplicate_path="${target_path%.md}.${timestamp}.duplicate.md"
        duplicate_ref="$(board_relative_target_path "$duplicate_path")"
        record_backup_once_for_path "$duplicate_ref"
        mv "$source_path" "$duplicate_path"
      fi
    else
      mkdir -p "$(dirname "$target_path")"
      mv "$source_path" "$target_path"
    fi
  fi

  printf '%s' "$done_spec_ref"
}

replace_plan_ref_for_related_tickets() {
  local plan_id="$1"
  local old_ref="$2"
  local new_ref="$3"
  local ticket_file

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    if [ "$(ticket_plan_id_for_upgrade "$ticket_file")" = "$plan_id" ]; then
      replace_board_literal_if_present "$ticket_file" "\`${old_ref}\`" "\`${new_ref}\`"
    fi
  done < <(ticket_state_files_for_upgrade)
}

archive_plan_to_done_for_upgrade() {
  local plan_file="$1"
  local project_key="$2"
  local plan_id old_ref new_ref target_path root_ref

  [ -f "$plan_file" ] || return 0
  plan_id="$(printf '%s' "$(basename "$plan_file")" | sed -n 's/^plan_\([0-9][0-9][0-9]\)\.md$/\1/p')"
  [ -n "$plan_id" ] || return 0

  old_ref="$(board_relative_target_path "$plan_file")"
  target_path="${TARGET_BOARD_ROOT}/tickets/done/${project_key}/plan_${plan_id}.md"
  new_ref="$(board_relative_target_path "$target_path")"

  record_backup_once_for_path "$old_ref"
  if [ -f "$target_path" ]; then
    record_backup_once_for_path "$new_ref"
    if cmp -s "$plan_file" "$target_path"; then
      rm -f "$plan_file"
    else
      mv "$plan_file" "${target_path%.md}.${timestamp}.duplicate.md"
    fi
  else
    mkdir -p "$(dirname "$target_path")"
    replace_scalar_field_in_section_in_file "$plan_file" "## Plan" "Status" "done"
    mv "$plan_file" "$target_path"
  fi

  replace_plan_ref_for_related_tickets "$plan_id" "$old_ref" "$new_ref"
  root_ref="tickets/plan/plan_${plan_id}.md"
  if [ "$root_ref" != "$old_ref" ]; then
    replace_plan_ref_for_related_tickets "$plan_id" "$root_ref" "$new_ref"
  fi
}

migrate_ticketed_specs_and_plans_to_done() {
  local plan_file plan_id project_spec_ref done_project_spec_ref
  local feature_spec_ref done_feature_spec_ref project_key ticket_file

  while IFS= read -r plan_file; do
    [ -n "$plan_file" ] || continue
    plan_id="$(printf '%s' "$(basename "$plan_file")" | sed -n 's/^plan_\([0-9][0-9][0-9]\)\.md$/\1/p')"
    [ -n "$plan_id" ] || continue

    if ! plan_has_related_ticket "$plan_id"; then
      continue
    fi

    project_spec_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$plan_file" "Spec References" "Project Spec")")"
    feature_spec_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$plan_file" "Spec References" "Feature Spec")")"
    project_key="$(project_key_from_spec_ref_for_upgrade "$project_spec_ref")"

    if [ -n "$project_spec_ref" ]; then
      done_project_spec_ref="$(migrate_spec_ref_to_done "$project_spec_ref")"
      replace_board_literal_if_present "$plan_file" "\`${project_spec_ref}\`" "\`${done_project_spec_ref}\`"
      while IFS= read -r ticket_file; do
        [ -n "$ticket_file" ] || continue
        if [ "$(ticket_plan_id_for_upgrade "$ticket_file")" = "$plan_id" ]; then
          replace_board_literal_if_present "$ticket_file" "\`${project_spec_ref}\`" "\`${done_project_spec_ref}\`"
        fi
      done < <(ticket_state_files_for_upgrade)
    fi

    if [ -n "$feature_spec_ref" ]; then
      done_feature_spec_ref="$(migrate_spec_ref_to_done "$feature_spec_ref")"
      replace_board_literal_if_present "$plan_file" "\`${feature_spec_ref}\`" "\`${done_feature_spec_ref}\`"
      while IFS= read -r ticket_file; do
        [ -n "$ticket_file" ] || continue
        if [ "$(ticket_plan_id_for_upgrade "$ticket_file")" = "$plan_id" ]; then
          replace_board_literal_if_present "$ticket_file" "\`${feature_spec_ref}\`" "\`${done_feature_spec_ref}\`"
        fi
      done < <(ticket_state_files_for_upgrade)
    fi

    archive_plan_to_done_for_upgrade "$plan_file" "$project_key"
  done < <(find "${TARGET_BOARD_ROOT}/tickets/plan" -type f -name 'plan_[0-9][0-9][0-9].md' | sort)
}

migrate_legacy_plan_inprogress_to_ticket_inprogress() {
  local legacy_plan_inprogress="${TARGET_BOARD_ROOT}/tickets/plan/inprogress"
  local plan_file plan_id target_path old_ref new_ref

  [ -d "$legacy_plan_inprogress" ] || return 0

  while IFS= read -r plan_file; do
    [ -n "$plan_file" ] || continue
    plan_id="$(printf '%s' "$(basename "$plan_file")" | sed -n 's/^plan_\([0-9][0-9][0-9]\)\.md$/\1/p')"
    [ -n "$plan_id" ] || continue

    old_ref="$(board_relative_target_path "$plan_file")"
    target_path="${TARGET_BOARD_ROOT}/tickets/inprogress/plan_${plan_id}.md"
    if [ -f "$target_path" ]; then
      record_backup_once_for_path "$old_ref"
      record_backup_once_for_path "$(board_relative_target_path "$target_path")"
      if cmp -s "$plan_file" "$target_path"; then
        rm -f "$plan_file"
      else
        target_path="${TARGET_BOARD_ROOT}/tickets/inprogress/plan_${plan_id}.${timestamp}.duplicate.md"
        mv "$plan_file" "$target_path"
      fi
    else
      record_backup_once_for_path "$old_ref"
      mkdir -p "$(dirname "$target_path")"
      mv "$plan_file" "$target_path"
    fi

    new_ref="$(board_relative_target_path "$target_path")"
    replace_plan_ref_for_related_tickets "$plan_id" "$old_ref" "$new_ref"
  done < <(find "$legacy_plan_inprogress" -maxdepth 1 -type f -name 'plan_[0-9][0-9][0-9].md' | sort)

  rmdir "$legacy_plan_inprogress" 2>/dev/null || true
}

migrate_legacy_reject_ticket_names() {
  local reject_root="${TARGET_BOARD_ROOT}/tickets/reject"
  local legacy_file reject_id target_file duplicate_file

  [ -d "$reject_root" ] || return 0

  while IFS= read -r legacy_file; do
    [ -n "$legacy_file" ] || continue
    reject_id="$(printf '%s' "$(basename "$legacy_file")" | sed -n 's/^tickets_\([0-9][0-9][0-9]\)\.md$/\1/p')"
    [ -n "$reject_id" ] || continue

    target_file="${reject_root}/reject_${reject_id}.md"
    record_backup_once_for_path "$legacy_file"

    if [ -f "$target_file" ]; then
      record_backup_once_for_path "$target_file"
      if cmp -s "$legacy_file" "$target_file"; then
        rm -f "$legacy_file"
      else
        duplicate_file="${reject_root}/reject_${reject_id}.${timestamp}.duplicate.md"
        mv "$legacy_file" "$duplicate_file"
      fi
      continue
    fi

    mv "$legacy_file" "$target_file"
  done < <(find "$reject_root" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' | sort)
}

migrate_processed_specs_to_done() {
  local processed_root="${TARGET_BOARD_ROOT}/tickets/backlog/processed"
  local spec_file spec_ref done_spec_ref ticket_file

  [ -d "$processed_root" ] || return 0

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    spec_ref="$(board_relative_target_path "$spec_file")"
    done_spec_ref="$(migrate_spec_ref_to_done "$spec_ref")"
    while IFS= read -r ticket_file; do
      [ -n "$ticket_file" ] || continue
      replace_board_literal_if_present "$ticket_file" "\`${spec_ref}\`" "\`${done_spec_ref}\`"
    done < <(ticket_state_files_for_upgrade)
  done < <(find "$processed_root" -maxdepth 1 -type f \( -name 'project_[0-9][0-9][0-9].md' -o -name 'feature_[0-9][0-9][0-9].md' \) | sort)

  rmdir "$processed_root" 2>/dev/null || true
}

remove_legacy_state_reference_files() {
  local legacy_file

  for legacy_file in \
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
    if [ -f "${TARGET_BOARD_ROOT}/${legacy_file}" ]; then
      record_backup_once_for_path "$legacy_file"
      rm -f "${TARGET_BOARD_ROOT}/${legacy_file}"
    fi
  done

  rmdir "${TARGET_BOARD_ROOT}/tickets/backlog/processed" 2>/dev/null || true
}

migrate_done_tickets_to_project_dirs() {
  local done_root="${TARGET_BOARD_ROOT}/tickets/done"
  local ticket_file project_key target_dir target_file

  [ -d "$done_root" ] || return 0

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    project_key="$(project_key_from_ticket_for_upgrade "$ticket_file")"
    target_dir="${done_root}/${project_key}"
    target_file="${target_dir}/$(basename "$ticket_file")"

    if [ "$ticket_file" = "$target_file" ]; then
      continue
    fi

    record_backup_once_for_path "$ticket_file"
    if [ -f "$target_file" ]; then
      record_backup_once_for_path "$target_file"
    fi

    mkdir -p "$target_dir"
    mv "$ticket_file" "$target_file"
  done < <(find "$done_root" -maxdepth 1 -type f -name 'tickets_*.md' | sort)
}

ticket_files_for_obsidian_upgrade() {
  find "$TARGET_BOARD_ROOT/tickets" \
    \( -path "${TARGET_BOARD_ROOT}/tickets/backlog" -o -path "${TARGET_BOARD_ROOT}/tickets/backlog/*" -o -path "${TARGET_BOARD_ROOT}/tickets/plan" -o -path "${TARGET_BOARD_ROOT}/tickets/plan/*" -o -path "${TARGET_BOARD_ROOT}/tickets/runs" -o -path "${TARGET_BOARD_ROOT}/tickets/runs/*" \) -prune -o \
    -type f \( -name 'tickets_[0-9][0-9][0-9].md' -o -name 'reject_[0-9][0-9][0-9].md' \) -print | sort
}

hydrate_plan_obsidian_links() {
  local plan_file project_ref project_key plan_note block relative_file temp_file

  while IFS= read -r plan_file; do
    [ -n "$plan_file" ] || continue
    project_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$plan_file" "Spec References" "Project Spec")")"
    project_key="$(project_key_from_spec_ref_for_upgrade "$project_ref")"
    plan_note="$(note_name_from_board_ref_for_upgrade "$plan_file")"
    block="- Project Note: [[${project_key}]]
- Plan Note: [[${plan_note}]]"
    temp_file="$(mktemp)"
    cp "$plan_file" "$temp_file"
    replace_section_block_in_file "$temp_file" "Obsidian Links" "$block"

    if ! cmp -s "$plan_file" "$temp_file"; then
      relative_file="$(board_relative_target_path "$plan_file")"
      record_backup_once_for_path "$relative_file"
      mv "$temp_file" "$plan_file"
    else
      rm -f "$temp_file"
    fi
  done < <(
    {
      find "${TARGET_BOARD_ROOT}/tickets/plan" -type f -name 'plan_[0-9][0-9][0-9].md' 2>/dev/null
      find "${TARGET_BOARD_ROOT}/tickets/done" -type f -name 'plan_[0-9][0-9][0-9].md' 2>/dev/null
    } | sort
  )
}

hydrate_ticket_obsidian_links() {
  local ticket_file project_key plan_ref plan_note ticket_note block relative_file temp_file

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    project_key="$(project_key_from_ticket_for_upgrade "$ticket_file")"
    plan_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$ticket_file" "References" "Plan Source")")"
    plan_note="$(note_name_from_board_ref_for_upgrade "$plan_ref")"
    ticket_note="$(note_name_from_board_ref_for_upgrade "$ticket_file")"
    block="- Project Note: [[${project_key}]]
- Plan Note: [[${plan_note}]]
- Ticket Note: [[${ticket_note}]]"
    temp_file="$(mktemp)"
    cp "$ticket_file" "$temp_file"
    replace_scalar_field_in_section_in_file "$temp_file" "## Ticket" "Project Key" "$project_key"
    replace_section_block_in_file "$temp_file" "Obsidian Links" "$block"

    if ! cmp -s "$ticket_file" "$temp_file"; then
      relative_file="$(board_relative_target_path "$ticket_file")"
      record_backup_once_for_path "$relative_file"
      mv "$temp_file" "$ticket_file"
    else
      rm -f "$temp_file"
    fi
  done < <(ticket_files_for_obsidian_upgrade)
}

ticket_file_for_id_for_upgrade() {
  local ticket_id="$1"

  find "${TARGET_BOARD_ROOT}/tickets" \
    \( -path "${TARGET_BOARD_ROOT}/tickets/backlog" -o -path "${TARGET_BOARD_ROOT}/tickets/backlog/*" -o -path "${TARGET_BOARD_ROOT}/tickets/plan" -o -path "${TARGET_BOARD_ROOT}/tickets/plan/*" -o -path "${TARGET_BOARD_ROOT}/tickets/runs" -o -path "${TARGET_BOARD_ROOT}/tickets/runs/*" \) -prune -o \
    -type f \( -name "tickets_${ticket_id}.md" -o -name "reject_${ticket_id}.md" \) -print | sort | head -n 1
}

hydrate_run_obsidian_links() {
  local run_file ticket_id ticket_file project_key plan_ref plan_note ticket_note verification_note block relative_file temp_file

  while IFS= read -r run_file; do
    [ -n "$run_file" ] || continue
    ticket_id="$(printf '%s' "$(basename "$run_file")" | sed -n 's/^verify_\([0-9][0-9][0-9]\)\.md$/\1/p')"
    [ -n "$ticket_id" ] || continue
    ticket_file="$(ticket_file_for_id_for_upgrade "$ticket_id")"
    if [ -z "$ticket_file" ]; then
      continue
    fi

    project_key="$(project_key_from_ticket_for_upgrade "$ticket_file")"
    plan_ref="$(strip_markdown_code_ticks "$(extract_reference_in_section "$ticket_file" "References" "Plan Source")")"
    plan_note="$(note_name_from_board_ref_for_upgrade "$plan_ref")"
    ticket_note="$(note_name_from_board_ref_for_upgrade "$ticket_file")"
    verification_note="$(note_name_from_board_ref_for_upgrade "$run_file")"
    block="- Project Note: [[${project_key}]]
- Plan Note: [[${plan_note}]]
- Ticket Note: [[${ticket_note}]]
- Verification Note: [[${verification_note}]]"
    temp_file="$(mktemp)"
    cp "$run_file" "$temp_file"
    replace_scalar_field_in_section_in_file "$temp_file" "## Meta" "Project Key" "$project_key"
    replace_section_block_in_file "$temp_file" "Obsidian Links" "$block"

    if ! cmp -s "$run_file" "$temp_file"; then
      relative_file="$(board_relative_target_path "$run_file")"
      record_backup_once_for_path "$relative_file"
      mv "$temp_file" "$run_file"
    else
      rm -f "$temp_file"
    fi
  done < <(find "${TARGET_BOARD_ROOT}/tickets/runs" -maxdepth 1 -type f -name 'verify_[0-9][0-9][0-9].md' | sort)
}

migrate_spec_root_to_backlog() {
  local legacy_spec_root="${TARGET_BOARD_ROOT}/rules/spec"
  local backlog_root="${TARGET_BOARD_ROOT}/tickets/backlog"
  local legacy_file target_file

  [ -d "$legacy_spec_root" ] || return 0

  mkdir -p "$backlog_root"

  while IFS= read -r legacy_file; do
    [ -n "$legacy_file" ] || continue
    target_file="${backlog_root}/$(basename "$legacy_file")"

    record_backup_once_for_path "$legacy_file"
    if [ -f "$target_file" ]; then
      record_backup_once_for_path "$target_file"
    fi

    mv "$legacy_file" "$target_file"
  done < <(find "$legacy_spec_root" -maxdepth 1 -type f -name '*.md' | sort)

  rmdir "$legacy_spec_root" 2>/dev/null || true
}

migrate_plan_root_to_ticket_plan() {
  local legacy_plan_root="${TARGET_BOARD_ROOT}/rules/plan"
  local ticket_plan_root="${TARGET_BOARD_ROOT}/tickets/plan"
  local legacy_file target_file base_name

  [ -d "$legacy_plan_root" ] || return 0

  mkdir -p "$ticket_plan_root"

  while IFS= read -r legacy_file; do
    [ -n "$legacy_file" ] || continue
    base_name="$(basename "$legacy_file")"

    case "$base_name" in
      README.md|plan_template.md)
        record_backup_once_for_path "$legacy_file"
        rm -f "$legacy_file"
        continue
        ;;
    esac

    target_file="${ticket_plan_root}/${base_name}"

    record_backup_once_for_path "$legacy_file"
    if [ -f "$target_file" ]; then
      record_backup_once_for_path "$target_file"
    fi

    mv "$legacy_file" "$target_file"
  done < <(find "$legacy_plan_root" -maxdepth 1 -type f -name '*.md' | sort)

  rmdir "$legacy_plan_root" 2>/dev/null || true
}

migrate_legacy_ticket_spec_view_to_backlog() {
  local legacy_ticket_spec_root="${TARGET_BOARD_ROOT}/tickets/spec"
  local backlog_root="${TARGET_BOARD_ROOT}/tickets/backlog"
  local legacy_file target_file base_name

  [ -d "$legacy_ticket_spec_root" ] || return 0

  mkdir -p "$backlog_root"

  while IFS= read -r legacy_file; do
    [ -n "$legacy_file" ] || continue
    base_name="$(basename "$legacy_file")"

    if [ "$base_name" = "README.md" ]; then
      record_backup_once_for_path "$legacy_file"
      rm -f "$legacy_file"
      continue
    fi

    target_file="${backlog_root}/${base_name}"

    record_backup_once_for_path "$legacy_file"
    if [ -f "$target_file" ]; then
      record_backup_once_for_path "$target_file"
    fi

    mv "$legacy_file" "$target_file"
  done < <(find "$legacy_ticket_spec_root" -maxdepth 1 -type f | sort)

  rmdir "$legacy_ticket_spec_root" 2>/dev/null || true
}

rewrite_spec_references_to_backlog() {
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue

    if grep -qsF -- "rules/spec/" "$file"; then
      record_backup_once_for_path "$file"
      replace_literal_in_file "$file" "rules/spec/" "tickets/backlog/" || true
    fi

    if grep -qsF -- "autoflow/rules/spec/" "$file"; then
      record_backup_once_for_path "$file"
      replace_literal_in_file "$file" "autoflow/rules/spec/" "autoflow/tickets/backlog/" || true
    fi

    if grep -qsF -- "tickets/spec/" "$file"; then
      record_backup_once_for_path "$file"
      replace_literal_in_file "$file" "tickets/spec/" "tickets/backlog/" || true
    fi
  done < <(
    find "$TARGET_BOARD_ROOT" \
      \( -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups" -o -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups/*" \) -prune -o \
      -type f \( -name '*.md' -o -name '*.toml' -o -name '*.ps1' -o -name '*.psd1' -o -name '*.sh' \) -print | sort
  )
}

rewrite_plan_references_to_ticket_plan() {
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue

    if grep -qsF -- "autoflow/rules/plan/" "$file"; then
      record_backup_once_for_path "$file"
      replace_literal_in_file "$file" "autoflow/rules/plan/" "autoflow/tickets/plan/" || true
    fi

    if grep -qsF -- "rules/plan/" "$file"; then
      record_backup_once_for_path "$file"
      replace_literal_in_file "$file" "rules/plan/" "tickets/plan/" || true
    fi
  done < <(
    find "$TARGET_BOARD_ROOT" \
      \( -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups" -o -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups/*" \) -prune -o \
      -type f \( -name '*.md' -o -name '*.toml' -o -name '*.ps1' -o -name '*.psd1' -o -name '*.sh' \) -print | sort
  )
}

rewrite_legacy_browser_tool_references() {
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue

    replace_board_literal_if_present "$file" "비브라우저 확인 -> headless browser -> 필요한 경우만 visible browser/Chrome MCP" "비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구"
    replace_board_literal_if_present "$file" "visible browser / Chrome MCP / Playwright 탭" "Codex 브라우저 도구 / Claude browser tool 탭"
    replace_board_literal_if_present "$file" "Chrome MCP / Playwright 탭" "에이전트 브라우저 도구 탭"
    replace_board_literal_if_present "$file" "Playwright tab" "agent browser tool tab"
    replace_board_literal_if_present "$file" "Playwright 탭" "에이전트 브라우저 도구 탭"
    replace_board_literal_if_present "$file" "headless/visible browser" "에이전트 브라우저 도구"
    replace_board_literal_if_present "$file" "headless browser" "에이전트 브라우저 도구"
    replace_board_literal_if_present "$file" "visible browser" "에이전트 브라우저 도구"
    replace_board_literal_if_present "$file" "Chrome MCP" "에이전트 브라우저 도구"
  done < <(
    find "$TARGET_BOARD_ROOT" \
      \( -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups" -o -path "${TARGET_BOARD_ROOT}/.autoflow-upgrade-backups/*" \) -prune -o \
      -type f \( -name '*.md' -o -name '*.toml' -o -name '*.ps1' -o -name '*.psd1' -o -name '*.sh' \) -print | sort
  )
}

if [ -f "$HOST_AGENTS_PATH" ]; then
  host_agents_action="preserved"
  SYNC_ACTION_RESULT="unchanged"
else
  sync_host_agents_file "$HOST_AGENTS_PATH" "$BOARD_DIR_NAME" "$backup_root"
  host_agents_action="$SYNC_ACTION_RESULT"
fi
record_sync_action "$SYNC_ACTION_RESULT"

while IFS='|' read -r asset_kind source_rel target_rel; do
  [ -n "$asset_kind" ] || continue
  sync_board_asset "$TARGET_BOARD_ROOT" "$BOARD_DIR_NAME" "$asset_kind" "$source_rel" "$target_rel" "$backup_root"
  record_sync_action "$SYNC_ACTION_RESULT"
done < <(managed_board_asset_entries)

migrate_spec_root_to_backlog
migrate_plan_root_to_ticket_plan
migrate_legacy_ticket_spec_view_to_backlog
rewrite_spec_references_to_backlog
rewrite_plan_references_to_ticket_plan
rewrite_legacy_browser_tool_references
migrate_legacy_reject_ticket_names
migrate_ticketed_specs_and_plans_to_done
migrate_legacy_plan_inprogress_to_ticket_inprogress
migrate_processed_specs_to_done
remove_legacy_state_reference_files
migrate_done_tickets_to_project_dirs
hydrate_plan_obsidian_links
hydrate_ticket_obsidian_links
hydrate_run_obsidian_links

write_project_root_marker "$TARGET_BOARD_ROOT" "$backup_root"
record_sync_action "$SYNC_ACTION_RESULT"

write_board_version_marker "$TARGET_BOARD_ROOT" "$backup_root"
record_sync_action "$SYNC_ACTION_RESULT"

status="already_current"
if [ "$managed_created_count" -gt 0 ] || [ "$managed_updated_count" -gt 0 ]; then
  status="upgraded"
fi

if [ "$backup_count" -eq 0 ] && [ -d "$backup_root" ]; then
  rmdir "$backup_root" 2>/dev/null || true
  rmdir "$(dirname "$backup_root")" 2>/dev/null || true
fi

current_board_version="$(board_version_value "$TARGET_BOARD_ROOT" || package_version)"

printf 'project_root=%s\n' "$TARGET_PROJECT_ROOT"
printf 'board_root=%s\n' "$TARGET_BOARD_ROOT"
printf 'board_dir_name=%s\n' "$BOARD_DIR_NAME"
printf 'status=%s\n' "$status"
printf 'previous_board_version=%s\n' "$previous_board_version"
printf 'current_board_version=%s\n' "$current_board_version"
printf 'package_version=%s\n' "$(package_version)"
printf 'host_agents_action=%s\n' "$host_agents_action"
printf 'managed_files_created=%s\n' "$managed_created_count"
printf 'managed_files_updated=%s\n' "$managed_updated_count"
printf 'managed_files_unchanged=%s\n' "$managed_unchanged_count"
printf 'backups_created=%s\n' "$backup_count"
if [ "$backup_count" -gt 0 ]; then
  printf 'backup_root=%s\n' "$backup_root"
else
  printf 'backup_root=\n'
fi
