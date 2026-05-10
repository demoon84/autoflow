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

write_handoff_list() {
  local handoffs_file="$1"
  local limit="${2:-12}"
  local count=0
  local file rel title

  if [ ! -s "$handoffs_file" ]; then
    printf -- '- No conversation handoffs archived.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$file")"
    title="$(awk 'NF { print; exit }' "$file" 2>/dev/null || true)"
    title="${title#\# }"
    [ -n "$title" ] || title="$(basename "$file")"
    printf -- '- %s. Source: `%s`.\n' "$title" "$rel"
  done < "$handoffs_file"
}

write_reject_list() {
  local rejects_file="$1"
  local limit="${2:-12}"
  local count=0
  local file rel reason

  if [ ! -s "$rejects_file" ]; then
    printf -- '- No reject records.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$file")"
    reason="$(awk '/^- Reason:/ { sub(/^- Reason:[[:space:]]*/, ""); print; exit }' "$file" 2>/dev/null || true)"
    if [ -n "$reason" ]; then
      printf -- '- %s Reason: %s. Source: `%s`.\n' "$(basename "$file" .md)" "$reason" "$rel"
    else
      printf -- '- %s. Source: `%s`.\n' "$(basename "$file" .md)" "$rel"
    fi
  done < "$rejects_file"
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
  local handoff_count="$7"
  local changed_count="$8"
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
    printf 'handoff_count=%s\n' "$handoff_count"
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

wiki_ttl_check() {
  local dry_run="${1:-false}"
  local ttl_days="${AUTOFLOW_WIKI_TTL_DAYS:-30}"
  local do_archive="${AUTOFLOW_WIKI_TTL_ARCHIVE:-0}"
  local learnings_dir="${BOARD_ROOT}/wiki/learnings"
  local archive_dir="${BOARD_ROOT}/wiki/_archive/learnings"
  local now_epoch checked=0 stale_count=0 archived_count=0 marked_count=0
  local file file_epoch age_days stale_header

  if [ ! -d "$learnings_dir" ]; then
    printf 'ttl_status=skipped\nttl_reason=learnings_dir_missing\n'
    return 0
  fi

  now_epoch="$(date +%s)"

  while IFS= read -r file; do
    [ -f "$file" ] || continue
    [ "$(basename "$file")" != "README.md" ] || continue
    [ "$(basename "$file")" != "index.md" ] || continue

    checked=$((checked + 1))
    if file_epoch="$(stat -f '%m' "$file" 2>/dev/null)"; then
      : # macOS
    elif file_epoch="$(stat -c '%Y' "$file" 2>/dev/null)"; then
      : # Linux
    else
      continue
    fi
    age_days=$(( (now_epoch - file_epoch) / 86400 ))
    [ "$age_days" -ge "$ttl_days" ] || continue

    stale_count=$((stale_count + 1))

    if [ "$dry_run" = "true" ]; then
      printf 'ttl_stale.%s=%s\n' "$stale_count" "$(relative_to_board "$file")"
      continue
    fi

    if [ "$do_archive" = "1" ]; then
      mkdir -p "$archive_dir"
      mv "$file" "${archive_dir}/$(basename "$file")"
      archived_count=$((archived_count + 1))
    else
      stale_header="## Status: stale"
      if ! grep -q "^## Status:" "$file" 2>/dev/null; then
        local tmp
        tmp="$(autoflow_mktemp)"
        { printf '%s\n\n' "$stale_header"; cat "$file"; } > "$tmp"
        mv "$tmp" "$file"
        marked_count=$((marked_count + 1))
      fi
    fi
  done < <(find "$learnings_dir" -maxdepth 1 -type f -name '*.md' | sort)

  printf 'ttl_status=ok\n'
  printf 'ttl_days=%s\n' "$ttl_days"
  printf 'ttl_checked=%s\n' "$checked"
  printf 'ttl_stale=%s\n' "$stale_count"
  printf 'ttl_archived=%s\n' "$archived_count"
  printf 'ttl_marked=%s\n' "$marked_count"
}

wiki_pattern_synthesis() {
  local dry_run="${1:-false}"
  local threshold="${AUTOFLOW_WIKI_PATTERN_THRESHOLD:-3}"
  local learnings_dir="${BOARD_ROOT}/wiki/learnings"
  local tmp_counts synthesized=0

  tmp_counts="$(autoflow_mktemp)"

  # Collect failure_class from retry orders and done ticket files
  {
    find "${BOARD_ROOT}/tickets/inbox" -maxdepth 1 -name 'order_*_retry_*.md' -type f 2>/dev/null | sort
    find "${BOARD_ROOT}/tickets/done" -maxdepth 2 -name 'order_*_retry_*.md' -type f 2>/dev/null | sort
  } | while IFS= read -r f; do
    grep -m1 '^failure_class:' "$f" 2>/dev/null | sed 's/^failure_class:[[:space:]]*//'
  done | sort | uniq -c | sort -rn > "$tmp_counts"

  if [ ! -s "$tmp_counts" ]; then
    printf 'pattern_status=ok\npattern_synthesized=0\npattern_reason=no_failure_class_data\n'
    rm -f "$tmp_counts"
    return 0
  fi

  mkdir -p "$learnings_dir"

  while read -r count class; do
    [ -n "$class" ] || continue
    [ "$count" -ge "$threshold" ] || continue

    local slug draft_file
    slug="pattern-$(printf '%s' "$class" | tr '_A-Z' '-a-z' | tr -cs 'a-z0-9-' '-' | sed 's/--*/-/g; s/^-//; s/-$//')"
    draft_file="${learnings_dir}/${slug}.md"

    if [ "$dry_run" = "true" ]; then
      synthesized=$((synthesized + 1))
      printf 'pattern_draft.%s=%s (count=%s)\n' "$synthesized" "$slug" "$count"
      continue
    fi

    if [ ! -f "$draft_file" ]; then
      cat > "$draft_file" <<EOF
# 패턴: ${class}

> **Draft** — Wiki AI 자동 생성 (발생 횟수: ${count}). 내용을 검토하고 구체적인 Cause / Fix 를 보완하세요.

## Symptom

\`failure_class=${class}\` 가 done 티켓 retry order 에서 **${count}회** 이상 발생했습니다.
구체적인 오류 메시지나 exit code 를 여기에 추가하세요.

## Cause

이 패턴의 근본 원인을 작성하세요.

- 원인: (티켓 파일 경로 또는 commit hash 를 인용하세요)

## Fix

재발 방지 또는 해결 절차를 작성하세요.

\`\`\`bash
# 수정 절차 예시
\`\`\`

## Verification

- Command: \`<검증 명령어>\`
- Pass: exits 0
- Fail indicator: exits 1, failure_class=${class}
EOF
      synthesized=$((synthesized + 1))
    fi
  done < "$tmp_counts"

  rm -f "$tmp_counts"
  printf 'pattern_status=ok\n'
  printf 'pattern_threshold=%s\n' "$threshold"
  printf 'pattern_synthesized=%s\n' "$synthesized"
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
  handoff_files="$(autoflow_mktemp)"
  collect_files "${BOARD_ROOT}/tickets/done" 'Todo-[0-9][0-9][0-9].md' "$done_tickets"
  collect_files "${BOARD_ROOT}/tickets" 'reject_[0-9][0-9][0-9].md' "$reject_files"
  collect_files "${BOARD_ROOT}/logs" '*.md' "$verifier_logs"
  collect_files "${BOARD_ROOT}/conversations" 'spec-handoff.md' "$handoff_files"

  done_count="$(count_lines "$done_tickets")"
  reject_count="$(count_lines "$reject_files")"
  log_count="$(count_lines "$verifier_logs")"
  handoff_count="$(count_lines "$handoff_files")"
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
    printf -- '- Conversation handoffs: %s\n' "$handoff_count"
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
    printf '\n### Reject Records\n\n'
    write_reject_list "$reject_files" 20
    printf '\n### Conversation Handoffs\n\n'
    write_handoff_list "$handoff_files" 20
  } > "$log_body"

  {
    printf '## Current Autoflow Summary\n\n'
    printf -- '- Project root: `%s`\n' "$PROJECT_ROOT"
    printf -- '- Board root: `%s`\n' "$BOARD_ROOT"
    printf -- '- Done tickets: %s\n' "$done_count"
    printf -- '- Reject records: %s\n' "$reject_count"
    printf -- '- Verifier logs: %s\n' "$log_count"
    printf -- '- Conversation handoffs: %s\n' "$handoff_count"
    printf -- '- Last updated: %s\n\n' "$timestamp"
    printf '## Latest Completed Work\n\n'
    write_ticket_list "$done_tickets" 8
    printf '\n## Recent Handoffs\n\n'
    write_handoff_list "$handoff_files" 5
  } > "$overview_body"

  if [ "$dry_run" = "true" ]; then
    printf 'status=dry_run\n'
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'wiki_root=%s\n' "$wiki_root"
    printf 'ticket_done_count=%s\n' "$done_count"
    printf 'reject_count=%s\n' "$reject_count"
    printf 'log_count=%s\n' "$log_count"
    printf 'handoff_count=%s\n' "$handoff_count"
    return 0
  fi

  mkdir -p "$wiki_root"
  acquire_wiki_baseline_lock "${BOARD_ROOT}/runners/state/wiki-baseline.lock"
  trap 'release_wiki_baseline_lock "${BOARD_ROOT}/runners/state/wiki-baseline.lock"' EXIT
  if replace_managed_section "${wiki_root}/index.md" "work-map" "$index_body" "$index_default"; then
    printf '%s\n' "${wiki_root}/index.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/log.md" "derived-timeline" "$log_body" "$log_default"; then
    printf '%s\n' "${wiki_root}/log.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/project-overview.md" "project-summary" "$overview_body" "$overview_default"; then
    printf '%s\n' "${wiki_root}/project-overview.md" >> "$changed_files_list"
  fi
  release_wiki_baseline_lock "${BOARD_ROOT}/runners/state/wiki-baseline.lock"
  trap - EXIT

  changed_count="$(count_lines "$changed_files_list")"
  if [ "$changed_count" -gt 0 ]; then
    status="updated"
  else
    status="unchanged"
  fi
  write_wiki_baseline_history "$wiki_root" "$status" "$timestamp" "$done_count" "$reject_count" "$log_count" "$handoff_count" "$changed_count"

  printf 'status=%s\n' "$status"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'checked_at=%s\n' "$timestamp"
  printf 'ticket_done_count=%s\n' "$done_count"
  printf 'reject_count=%s\n' "$reject_count"
  printf 'log_count=%s\n' "$log_count"
  printf 'handoff_count=%s\n' "$handoff_count"
  printf 'changed_file_count=%s\n' "$changed_count"
  printf 'history_file=%s\n' "${BOARD_ROOT}/runners/state/wiki-baseline.history"
  idx=0
  while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    idx="$((idx + 1))"
    printf 'updated_file.%s=%s\n' "$idx" "$changed_file"
  done < "$changed_files_list"

  wiki_ttl_check "$dry_run"
  wiki_pattern_synthesis "$dry_run"
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
