#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF2' >&2
Usage:
  cleanup-runner-logs.sh <project-root> <board-dir-name>

Outputs:
  deleted_count=<n>
  freed_bytes=<bytes>
EOF2
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
log_root="${board_root}/runners/logs"
state_root="${board_root}/runners/state"
outcome_log_root="${board_root}/logs"
outcome_archive_root="${outcome_log_root}/archive"

deleted_count=0
freed_bytes=0
outcome_archived_count=0
outcome_deleted_count=0

cleanup_patterns=(
  "${log_root}/*_stdout.log"
  "${log_root}/*_stderr.log"
  "${log_root}/*_prompt.log"
  "${log_root}/*_runtime.log"
  "${log_root}/*_dry-run.log"
  "${log_root}/*_live_*.log"
  "${log_root}/*_last_message.txt"
)
loop_patterns=(
  "${log_root}/*.loop.stdout.log"
  "${log_root}/*.loop.stderr.log"
)

file_for_cleanup() {
  local path="$1"
  local base

  base="${path##*/}"
  case "$base" in
    *.loop.stdout.log|*.loop.stdout.log.[0-9]|*.loop.stdout.log.[0-9][0-9]|*.loop.stderr.log|*.loop.stderr.log.[0-9]|*.loop.stderr.log.[0-9][0-9])
      return 1
      ;;
  esac

  return 0
}

size_of() {
  local path="$1"
  local bytes

  if [ ! -f "$path" ]; then
    printf '0'
    return 0
  fi

  bytes="$(wc -c < "$path" 2>/dev/null | tr -dc '0-9')"
  bytes="${bytes// /}"
  [ -n "$bytes" ] || bytes=0
  printf '%s' "$bytes"
}

size_of_tree() {
  local path="$1"
  local bytes=0
  local child child_bytes

  if [ -f "$path" ]; then
    size_of "$path"
    return 0
  fi

  if [ ! -d "$path" ]; then
    printf '0'
    return 0
  fi

  while IFS= read -r child; do
    child_bytes="$(size_of "$child")"
    child_bytes="${child_bytes// /}"
    [ -n "$child_bytes" ] || child_bytes=0
    bytes=$((bytes + child_bytes))
  done < <(find "$path" -type f -print 2>/dev/null)

  printf '%s' "$bytes"
}

positive_int_or_default() {
  local value="$1"
  local fallback="$2"

  case "$value" in
    ''|*[!0-9]*) printf '%s' "$fallback" ;;
    0) printf '%s' "$fallback" ;;
    *) printf '%s' "$value" ;;
  esac
}

outcome_root_markdown_limit() {
  positive_int_or_default "${AUTOFLOW_OUTCOME_ROOT_MD_LIMIT:-99}" "99"
}

outcome_verifier_root_limit() {
  positive_int_or_default "${AUTOFLOW_OUTCOME_VERIFIER_ROOT_LIMIT:-60}" "60"
}

outcome_verifier_max_age_days() {
  positive_int_or_default "${AUTOFLOW_OUTCOME_VERIFIER_MAX_AGE_DAYS:-7}" "7"
}

outcome_manual_max_age_days() {
  positive_int_or_default "${AUTOFLOW_OUTCOME_MANUAL_MAX_AGE_DAYS:-30}" "30"
}

outcome_archive_max_age_days() {
  positive_int_or_default "${AUTOFLOW_OUTCOME_ARCHIVE_MAX_AGE_DAYS:-90}" "90"
}

filename_timestamp_stamp() {
  local path="$1"
  local base

  base="${path##*/}"
  if [[ "$base" =~ ([0-9]{8})[T_]([0-9]{6})Z ]]; then
    printf '%s%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi

  return 1
}

filename_timestamp_epoch() {
  local path="$1"
  local stamp date_part time_part

  stamp="$(filename_timestamp_stamp "$path")" || return 1
  date_part="${stamp:0:8}"
  time_part="${stamp:8:6}"

  if date -u -j -f '%Y%m%d%H%M%S' "$stamp" '+%s' >/dev/null 2>&1; then
    date -u -j -f '%Y%m%d%H%M%S' "$stamp" '+%s'
    return 0
  fi

  date -u -d "${date_part:0:4}-${date_part:4:2}-${date_part:6:2} ${time_part:0:2}:${time_part:2:2}:${time_part:4:2}" '+%s' 2>/dev/null
}

filename_timestamp_month() {
  local path="$1"
  local stamp

  stamp="$(filename_timestamp_stamp "$path")" || return 1
  printf '%s-%s' "${stamp:0:4}" "${stamp:4:2}"
}

path_age_days() {
  local path="$1"
  local epoch now

  epoch="$(filename_timestamp_epoch "$path")" || return 1
  now="$(date -u '+%s')"
  printf '%s' $(( (now - epoch) / 86400 ))
}

cleanup_path() {
  local path="$1"
  local size

  [ -e "$path" ] || return 0
  size="$(size_of_tree "$path")"
  size="${size// /}"
  [ -n "$size" ] || size=0
  rm -rf "$path"
  freed_bytes=$((freed_bytes + size))
  deleted_count=$((deleted_count + 1))
}

archive_outcome_file() {
  local path="$1"
  local month archive_dir target stem ext suffix

  [ -f "$path" ] || return 0
  month="$(filename_timestamp_month "$path" 2>/dev/null || true)"
  [ -n "$month" ] || month="unknown"
  archive_dir="${outcome_archive_root}/${month}"
  mkdir -p "$archive_dir"

  target="${archive_dir}/${path##*/}"
  if [ -e "$target" ]; then
    stem="${target%.*}"
    ext="${target##*.}"
    suffix=1
    while [ -e "${stem}.${suffix}.${ext}" ]; do
      suffix=$((suffix + 1))
    done
    target="${stem}.${suffix}.${ext}"
  fi

  mv "$path" "$target"
  outcome_archived_count=$((outcome_archived_count + 1))
}

cleanup_loop_log() {
  local path="$1"
  local max_size
  local before_size previous_size after_size
  local loop_previous_file
  local tmp_current tmp_previous tmp_prior
  local before_total after_total

  [ -f "$path" ] || return 0
  [ -f "${path}.1" ] || touch "${path}.1"
  [ -f "${path}.2" ] || touch "${path}.2"

  max_size="$(runner_loop_max_size_bytes)"
  before_size="$(size_of "$path")"
  before_total=$((before_size + $(size_of "${path}.1") + $(size_of "${path}.2")))

  if [ "$before_size" -le "$max_size" ] && [ "$before_total" -le $((3 * max_size)) ]; then
    return 0
  fi

  if [ "$before_size" -gt "$max_size" ] || [ "$before_total" -gt $((3 * max_size)) ]; then
    tmp_current="$(mktemp)"
    tmp_previous="$(mktemp)"
    tmp_prior="$(mktemp)"

    # Retain latest ring: current -> .1 -> .2, each capped by max size.
    tail -c "$max_size" "$path" > "$tmp_current"
    tail -c "$max_size" "${path}.1" > "$tmp_previous"
    tail -c "$max_size" "${path}.2" > "$tmp_prior"

    mv "$tmp_current" "$path"
    mv "$tmp_previous" "${path}.1"
    mv "$tmp_prior" "${path}.2"
  fi

  [ -f "${path}" ] || return 0
  previous_size="$(size_of "${path}.1")"
  loop_previous_file="$(size_of "${path}.2")"
  after_size="$(size_of "$path")"
  after_total=$((after_size + previous_size + loop_previous_file))

  if [ "$after_total" -lt "$before_total" ]; then
    freed_bytes=$((freed_bytes + before_total - after_total))
  fi
}

runner_loop_max_size_bytes() {
  local value="${AUTOFLOW_LOOP_LOG_MAX_SIZE_BYTES:-1048576}"
  case "$value" in
    ''|*[!0-9]*) printf '1048576' ;;
    *) printf '%s' "$value" ;;
  esac
}

cleanup_loop_logs() {
  local pattern path total_before total_after path_total_before path_total_after

  for pattern in "${loop_patterns[@]}"; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      file_for_cleanup "$path" || true
      path_total_before=$(( $(size_of "$path") + $(size_of "${path}.1") + $(size_of "${path}.2") ))
      if [ "$path_total_before" -gt 0 ]; then
        cleanup_loop_log "$path"
      fi
    done
  done
}

cleanup_logs() {
  local pattern path

  [ -d "$log_root" ] || return 0

  for pattern in "${cleanup_patterns[@]}"; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      file_for_cleanup "$path" || continue
      cleanup_path "$path"
    done
  done

  cleanup_loop_logs
}

runner_id_is_enabled() {
  local runner_id="$1"
  local config_output

  config_output="$(AUTOFLOW_BOARD_ROOT="$board_root" runner_list_config 2>/dev/null)" || return 1
  awk -v wanted_id="$runner_id" '
    /^runner_begin$/ {
      id = ""
      enabled = "true"
      next
    }
    /^id=/ {
      id = substr($0, 4)
      next
    }
    /^enabled=/ {
      enabled = substr($0, 9)
      next
    }
    /^runner_end$/ {
      if (id == wanted_id && enabled == "true") {
        found = 1
        exit
      }
    }
    END {
      exit(found ? 0 : 1)
    }
  ' <<< "$config_output"
}

cleanup_state_files() {
  local pattern path base runner_id

  [ -d "$state_root" ] || return 0

  # Legacy per-runner suffixes from pre-refactor ids. These are no longer
  # active runner state bodies in the default suffixless topology.
  for pattern in "${state_root}"/*-1.state "${state_root}"/*-1.*; do
    for path in $pattern; do
      [ -e "$path" ] || continue
      base="${path##*/}"
      runner_id="${base%%.*}"
      if runner_id_is_enabled "$runner_id"; then
        continue
      fi
      cleanup_path "$path"
    done
  done

  # Atomic write remnants from runner_write_state(), e.g. wiki.state.CWxbDK.
  # Preserve the suffixless *.state bodies; only files with an extra suffix are
  # considered stale temporary files.
  for path in "${state_root}"/*.state.??????; do
    [ -f "$path" ] || continue
    cleanup_path "$path"
  done
}

cleanup_outcome_archives() {
  local max_days path age before_deleted

  [ -d "$outcome_archive_root" ] || return 0
  max_days="$(outcome_archive_max_age_days)"
  while IFS= read -r -d '' path; do
    age="$(path_age_days "$path" 2>/dev/null || true)"
    [ -n "$age" ] || continue
    [ "$age" -ge "$max_days" ] || continue
    before_deleted="$deleted_count"
    cleanup_path "$path"
    if [ "$deleted_count" -gt "$before_deleted" ]; then
      outcome_deleted_count=$((outcome_deleted_count + 1))
    fi
  done < <(find "$outcome_archive_root" -type f -name '*.md' -print0 2>/dev/null)

  find "$outcome_archive_root" -type d -empty -delete 2>/dev/null || true
}

cleanup_deprecated_outcome_roots() {
  local path

  [ -d "$outcome_log_root" ] || return 0

  while IFS= read -r -d '' path; do
    archive_outcome_file "$path"
  done < <(find "$outcome_log_root" -maxdepth 1 -type f \( -name 'coordinator_*_blocked.md' -o -name 'owner_*_blocked.md' \) -print0 2>/dev/null)

  while IFS= read -r -d '' path; do
    cleanup_path "$path"
  done < <(find "$outcome_log_root" -maxdepth 1 -type d -name 'branch-cleanup_*' -print0 2>/dev/null)
}

cleanup_manual_outcome_logs() {
  local max_days path age

  [ -d "$outcome_log_root" ] || return 0
  max_days="$(outcome_manual_max_age_days)"
  while IFS= read -r -d '' path; do
    age="$(path_age_days "$path" 2>/dev/null || true)"
    [ -n "$age" ] || continue
    [ "$age" -ge "$max_days" ] || continue
    archive_outcome_file "$path"
  done < <(find "$outcome_log_root" -maxdepth 1 -type f -name 'manual_worktree_merge_*.md' -print0 2>/dev/null)
}

archive_outcome_logs_older_than() {
  local pattern="$1"
  local max_days="$2"
  local path age

  while IFS= read -r -d '' path; do
    age="$(path_age_days "$path" 2>/dev/null || true)"
    [ -n "$age" ] || continue
    [ "$age" -ge "$max_days" ] || continue
    archive_outcome_file "$path"
  done < <(find "$outcome_log_root" -maxdepth 1 -type f -name "$pattern" -print0 2>/dev/null)
}

limit_root_outcome_pattern() {
  local pattern="$1"
  local limit="$2"
  local tmp count archive_count path epoch archived=0

  tmp="$(mktemp)"
  while IFS= read -r -d '' path; do
    epoch="$(filename_timestamp_epoch "$path" 2>/dev/null || true)"
    [ -n "$epoch" ] || continue
    printf '%s\t%s\n' "$epoch" "$path" >> "$tmp"
  done < <(find "$outcome_log_root" -maxdepth 1 -type f -name "$pattern" -print0 2>/dev/null)

  count="$(wc -l < "$tmp" | tr -dc '0-9')"
  [ -n "$count" ] || count=0
  if [ "$count" -le "$limit" ]; then
    rm -f "$tmp"
    return 0
  fi

  archive_count=$((count - limit))
  while IFS="$(printf '\t')" read -r _ path; do
    [ "$archived" -lt "$archive_count" ] || break
    archive_outcome_file "$path"
    archived=$((archived + 1))
  done < <(sort -n "$tmp")
  rm -f "$tmp"
}

limit_root_outcome_markdown() {
  local limit count archive_count tmp path epoch archived=0

  [ -d "$outcome_log_root" ] || return 0
  limit="$(outcome_root_markdown_limit)"
  count="$(find "$outcome_log_root" -maxdepth 1 -type f -name '*.md' -print 2>/dev/null | wc -l | tr -dc '0-9')"
  [ -n "$count" ] || count=0
  [ "$count" -le "$limit" ] && return 0

  archive_count=$((count - limit))
  tmp="$(mktemp)"
  while IFS= read -r -d '' path; do
    epoch="$(filename_timestamp_epoch "$path" 2>/dev/null || true)"
    [ -n "$epoch" ] || continue
    printf '%s\t%s\n' "$epoch" "$path" >> "$tmp"
  done < <(find "$outcome_log_root" -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null)

  while IFS="$(printf '\t')" read -r _ path; do
    [ "$archived" -lt "$archive_count" ] || break
    archive_outcome_file "$path"
    archived=$((archived + 1))
  done < <(sort -n "$tmp")
  rm -f "$tmp"
}

cleanup_outcome_logs() {
  [ -d "$outcome_log_root" ] || return 0

  cleanup_outcome_archives
  cleanup_deprecated_outcome_roots
  cleanup_manual_outcome_logs
  archive_outcome_logs_older_than 'verifier_*_pass.md' "$(outcome_verifier_max_age_days)"
  archive_outcome_logs_older_than 'verifier_*_fail.md' "$(outcome_verifier_max_age_days)"
  limit_root_outcome_pattern 'verifier_*_pass.md' "$(outcome_verifier_root_limit)"
  limit_root_outcome_pattern 'verifier_*_fail.md' "$(outcome_verifier_root_limit)"
  limit_root_outcome_markdown
}

cleanup_logs
cleanup_state_files
cleanup_outcome_logs

printf 'deleted_count=%s\n' "$deleted_count"
printf 'freed_bytes=%s\n' "$freed_bytes"
printf 'outcome_archived_count=%s\n' "$outcome_archived_count"
printf 'outcome_deleted_count=%s\n' "$outcome_deleted_count"
