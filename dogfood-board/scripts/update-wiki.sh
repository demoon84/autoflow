#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  update-wiki.sh [--dry-run]
EOF
}

relative_to_board() {
  local file="$1"

  case "$file" in
    "$BOARD_ROOT"/*)
      printf '%s' "${file#"$BOARD_ROOT"/}"
      ;;
    *)
      printf '%s' "$file"
      ;;
  esac
}

extract_md_field() {
  local file="$1"
  local field="$2"

  awk -v field="$field" '
    {
      line=$0
      gsub(/\r$/, "", line)
      prefix="- " field ":"
      if (index(line, prefix) == 1) {
        sub("^[-] " field ":[[:space:]]*", "", line)
        print line
        found=1
        exit
      }
      prefix=field ":"
      if (index(line, prefix) == 1) {
        sub("^" field ":[[:space:]]*", "", line)
        print line
        found=1
        exit
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

extract_result_summary() {
  local file="$1"

  awk '
    /^- Summary:[[:space:]]*/ {
      line=$0
      sub(/^- Summary:[[:space:]]*/, "", line)
      print line
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

collect_files() {
  local root="$1"
  local pattern="$2"
  local destination="$3"

  : > "$destination"
  if [ -d "$root" ]; then
    find "$root" -type f -name "$pattern" | sort > "$destination"
  fi
}

count_lines() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf '0'
    return 0
  fi

  wc -l < "$file" | tr -d '[:space:]'
}

write_ticket_list() {
  local tickets_file="$1"
  local limit="${2:-12}"
  local count=0
  local file id title summary rel

  if [ ! -s "$tickets_file" ]; then
    printf -- '- No completed tickets found.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    id="$(extract_md_field "$file" "ID")"
    [ -n "$id" ] || id="$(basename "$file" .md)"
    title="$(extract_md_field "$file" "Title")"
    [ -n "$title" ] || title="$id"
    summary="$(extract_result_summary "$file")"
    rel="$(relative_to_board "$file")"

    if [ -n "$summary" ]; then
      printf -- '- `%s` - %s. %s Source: `%s`.\n' "$id" "$title" "$summary" "$rel"
    else
      printf -- '- `%s` - %s. Source: `%s`.\n' "$id" "$title" "$rel"
    fi
  done < "$tickets_file"
}

write_log_list() {
  local logs_file="$1"
  local limit="${2:-12}"
  local count=0
  local file rel title

  if [ ! -s "$logs_file" ]; then
    printf -- '- No verifier logs found.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$file")"
    title="$(awk 'NF { print; exit }' "$file" 2>/dev/null || true)"
    [ -n "$title" ] || title="$(basename "$file")"
    printf -- '- %s Source: `%s`.\n' "$title" "$rel"
  done < "$logs_file"
}

replace_managed_section() {
  local file="$1"
  local section="$2"
  local body_file="$3"
  local default_file="$4"
  local begin="<!-- AUTOFLOW:BEGIN ${section} -->"
  local end="<!-- AUTOFLOW:END ${section} -->"
  local source_file
  local tmp

  source_file="$(autoflow_mktemp)"
  tmp="$(autoflow_mktemp)"

  if [ -f "$file" ]; then
    cp "$file" "$source_file"
  else
    cp "$default_file" "$source_file"
  fi

  awk -v begin="$begin" -v end="$end" -v body_file="$body_file" '
    BEGIN {
      while ((getline line < body_file) > 0) {
        body = body line "\n"
      }
      close(body_file)
    }
    $0 == begin {
      print
      printf "%s", body
      in_managed = 1
      replaced = 1
      next
    }
    $0 == end {
      in_managed = 0
      print
      next
    }
    !in_managed {
      print
    }
    END {
      if (!replaced) {
        print ""
        print begin
        printf "%s", body
        print end
      }
    }
  ' "$source_file" > "$tmp"

  if wiki_files_match_without_check_timestamps "$file" "$tmp"; then
    rm -f "$source_file" "$tmp"
    return 1
  fi

  mv "$tmp" "$file"
  rm -f "$source_file"
  return 0
}

wiki_files_match_without_check_timestamps() {
  local left="$1"
  local right="$2"
  local left_normalized right_normalized

  [ -f "$left" ] || return 1
  [ -f "$right" ] || return 1

  left_normalized="$(autoflow_mktemp)"
  right_normalized="$(autoflow_mktemp)"

  sed -E '/^- Last (updated|rebuilt): /d' "$left" > "$left_normalized"
  sed -E '/^- Last (updated|rebuilt): /d' "$right" > "$right_normalized"

  if cmp -s "$left_normalized" "$right_normalized"; then
    rm -f "$left_normalized" "$right_normalized"
    return 0
  fi

  rm -f "$left_normalized" "$right_normalized"
  return 1
}

write_wiki_baseline_history() {
  local wiki_root="$1"
  local status="$2"
  local timestamp="$3"
  local done_count="$4"
  local reject_count="$5"
  local log_count="$6"
  local changed_count="$7"
  local history_file="${BOARD_ROOT}/runners/state/wiki-baseline.history"

  mkdir -p "$(dirname "$history_file")"
  {
    printf -- '---\n'
    printf 'checked_at=%s\n' "$timestamp"
    printf 'status=%s\n' "$status"
    printf 'wiki_root=%s\n' "$wiki_root"
    printf 'changed_file_count=%s\n' "$changed_count"
    printf 'ticket_done_count=%s\n' "$done_count"
    printf 'reject_count=%s\n' "$reject_count"
    printf 'log_count=%s\n' "$log_count"
  } >> "$history_file"
}

write_default_pages() {
  local index_default="$1"
  local log_default="$2"
  local overview_default="$3"

  cat > "$index_default" <<'EOF'
# Wiki Index

This index catalogs wiki pages maintained from Autoflow work.

## Core Pages

- [[project-overview]]
- [[log]]
EOF

  cat > "$log_default" <<'EOF'
# Wiki Log

This page contains a derived Autoflow work timeline.
EOF

  cat > "$overview_default" <<'EOF'
# Project Overview

## Summary

- This page is maintained from Autoflow specs, tickets, verification records, logs, and approved conversation summaries.
EOF
}

update_wiki() {
  local dry_run="$1"
  local wiki_root="${BOARD_ROOT}/wiki"
  local done_tickets reject_files verifier_logs
  local done_count reject_count log_count timestamp
  local index_body log_body overview_body
  local index_default log_default overview_default
  local status changed_count=0 changed_files_list
  local changed_file idx

  if [ ! -d "${BOARD_ROOT}/tickets" ]; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    return 0
  fi

  done_tickets="$(autoflow_mktemp)"
  reject_files="$(autoflow_mktemp)"
  verifier_logs="$(autoflow_mktemp)"
  collect_files "${BOARD_ROOT}/tickets/done" 'tickets_[0-9][0-9][0-9].md' "$done_tickets"
  collect_files "${BOARD_ROOT}/tickets" 'reject_[0-9][0-9][0-9].md' "$reject_files"
  collect_files "${BOARD_ROOT}/logs" '*.md' "$verifier_logs"

  done_count="$(count_lines "$done_tickets")"
  reject_count="$(count_lines "$reject_files")"
  log_count="$(count_lines "$verifier_logs")"
  timestamp="$(now_iso)"

  index_body="$(autoflow_mktemp)"
  log_body="$(autoflow_mktemp)"
  overview_body="$(autoflow_mktemp)"
  index_default="$(autoflow_mktemp)"
  log_default="$(autoflow_mktemp)"
  overview_default="$(autoflow_mktemp)"
  changed_files_list="$(autoflow_mktemp)"
  : > "$changed_files_list"
  write_default_pages "$index_default" "$log_default" "$overview_default"

  {
    printf '## Autoflow Work Map\n\n'
    printf -- '- Done tickets: %s\n' "$done_count"
    printf -- '- Reject records: %s\n' "$reject_count"
    printf -- '- Verifier logs: %s\n' "$log_count"
    printf -- '- Last updated: %s\n\n' "$timestamp"
    printf '## Completed Tickets\n\n'
    write_ticket_list "$done_tickets" 20
  } > "$index_body"

  {
    printf '## Derived Timeline\n\n'
    printf -- '- Last rebuilt: %s\n\n' "$timestamp"
    printf '### Completed Tickets\n\n'
    write_ticket_list "$done_tickets" 20
    printf '\n### Verifier Logs\n\n'
    write_log_list "$verifier_logs" 20
  } > "$log_body"

  {
    printf '## Current Autoflow Summary\n\n'
    printf -- '- Project root: `%s`\n' "$PROJECT_ROOT"
    printf -- '- Board root: `%s`\n' "$BOARD_ROOT"
    printf -- '- Done tickets: %s\n' "$done_count"
    printf -- '- Reject records: %s\n' "$reject_count"
    printf -- '- Verifier logs: %s\n' "$log_count"
    printf -- '- Last updated: %s\n\n' "$timestamp"
    printf '## Latest Completed Work\n\n'
    write_ticket_list "$done_tickets" 8
  } > "$overview_body"

  if [ "$dry_run" = "true" ]; then
    printf 'status=dry_run\n'
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'wiki_root=%s\n' "$wiki_root"
    printf 'ticket_done_count=%s\n' "$done_count"
    printf 'reject_count=%s\n' "$reject_count"
    printf 'log_count=%s\n' "$log_count"
    return 0
  fi

  mkdir -p "$wiki_root"
  if replace_managed_section "${wiki_root}/index.md" "work-map" "$index_body" "$index_default"; then
    printf '%s\n' "${wiki_root}/index.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/log.md" "derived-timeline" "$log_body" "$log_default"; then
    printf '%s\n' "${wiki_root}/log.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/project-overview.md" "project-summary" "$overview_body" "$overview_default"; then
    printf '%s\n' "${wiki_root}/project-overview.md" >> "$changed_files_list"
  fi

  changed_count="$(count_lines "$changed_files_list")"
  if [ "$changed_count" -gt 0 ]; then
    status="updated"
  else
    status="unchanged"
  fi
  write_wiki_baseline_history "$wiki_root" "$status" "$timestamp" "$done_count" "$reject_count" "$log_count" "$changed_count"

  printf 'status=%s\n' "$status"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'checked_at=%s\n' "$timestamp"
  printf 'ticket_done_count=%s\n' "$done_count"
  printf 'reject_count=%s\n' "$reject_count"
  printf 'log_count=%s\n' "$log_count"
  printf 'changed_file_count=%s\n' "$changed_count"
  printf 'history_file=%s\n' "${BOARD_ROOT}/runners/state/wiki-baseline.history"
  idx=0
  while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    idx="$((idx + 1))"
    printf 'updated_file.%s=%s\n' "$idx" "$changed_file"
  done < "$changed_files_list"
}

dry_run="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
  shift || true
done

update_wiki "$dry_run"
