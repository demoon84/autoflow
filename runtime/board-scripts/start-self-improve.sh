#!/usr/bin/env bash
#
# DEPRECATED: trial self-improvement runner.
#
# `self-improve-1` is shipped with `enabled = false` in the default
# `runners/config.toml` and is not part of the 3-runner topology
# (planner-1 + owner-1 + wiki-1). The script is a deterministic log
# scanner that emits low-risk PRD candidates from accumulated runner
# logs; it does not invoke an AI. It is kept reachable as a manual
# trial for users who want to experiment with operational
# self-improvement, but new boards should not enable it by default.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

ensure_expected_role "self-improve"

interval_seconds="${AUTOFLOW_SELF_IMPROVE_INTERVAL_SECONDS:-1800}"
max_duration_seconds="${AUTOFLOW_SELF_IMPROVE_MAX_DURATION_SECONDS:-10800}"
max_ticks="${AUTOFLOW_SELF_IMPROVE_MAX_TICKS:-6}"
threshold="${AUTOFLOW_SELF_IMPROVE_THRESHOLD:-3}"
lookback_days="${AUTOFLOW_SELF_IMPROVE_LOOKBACK_DAYS:-7}"

state_dir="${BOARD_ROOT}/logs/self-improve-state"
log_dir="${BOARD_ROOT}/logs"
mkdir -p "$state_dir" "$log_dir"

trial_state="${state_dir}/trial.env"
now_epoch="$(date -u +%s)"
timestamp="$(now_iso)"

started_at_epoch=""
tick_count="0"
if [ -f "$trial_state" ]; then
  started_at_epoch="$(awk -F= '$1 == "started_at_epoch" { print $2; exit }' "$trial_state" 2>/dev/null || true)"
  tick_count="$(awk -F= '$1 == "tick_count" { print $2; exit }' "$trial_state" 2>/dev/null || true)"
fi
[ -n "$started_at_epoch" ] || started_at_epoch="$now_epoch"
case "$tick_count" in ''|*[!0-9]*) tick_count="0" ;; esac
tick_count="$((tick_count + 1))"

write_trial_state() {
  {
    printf 'started_at_epoch=%s\n' "$started_at_epoch"
    printf 'tick_count=%s\n' "$tick_count"
    printf 'last_tick_at=%s\n' "$timestamp"
  } >"$trial_state"
}

hash_text() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum | awk '{print $1}'
  elif command -v sha1sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha1sum | awk '{print $1}'
  else
    printf '%s' "$1" | cksum | awk '{print $1}'
  fi
}

safe_slug() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c 1-48
}

status_log_path() {
  printf '%s/self-improve_%s_%03d.md' "$log_dir" "$(date -u +%Y%m%dT%H%M%SZ)" "$tick_count"
}

project_has_active_git_operation() {
  local git_dir

  git_dir="$(git -C "$PROJECT_ROOT" rev-parse --git-dir 2>/dev/null || true)"
  [ -n "$git_dir" ] || return 1
  case "$git_dir" in
    /*) ;;
    *) git_dir="${PROJECT_ROOT}/${git_dir}" ;;
  esac
  [ -d "${git_dir}/rebase-merge" ] || [ -d "${git_dir}/rebase-apply" ] ||
    [ -f "${git_dir}/MERGE_HEAD" ] || [ -f "${git_dir}/CHERRY_PICK_HEAD" ]
}

project_has_unsafe_dirty_state() {
  local dirty

  dirty="$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=all 2>/dev/null || true)"
  [ -n "$dirty" ] || return 1
  printf '%s\n' "$dirty" | awk '
    $2 == ".autoflow/logs/" { next }
    $2 ~ /^\.autoflow\/logs\/self-improve_/ { next }
    $2 ~ /^\.autoflow\/logs\/self-improve-state\// { next }
    $2 ~ /^\.autoflow\/runners\/logs\/self-improve-/ { next }
    $2 ~ /^\.autoflow\/runners\/state\/self-improve-/ { next }
    $2 == "node_modules" || $2 == "apps/desktop/node_modules" { next }
    { found=1 }
    END { exit(found ? 0 : 1) }
  '
}

active_conflicting_ticket_work() {
  local file stage

  for file in "${BOARD_ROOT}"/tickets/inprogress/tickets_*.md "${BOARD_ROOT}"/tickets/ready-to-merge/tickets_*.md "${BOARD_ROOT}"/tickets/merge-blocked/tickets_*.md; do
    [ -f "$file" ] || continue
    stage="$(awk -F: '$1 ~ /^- Stage$/ { sub(/^[[:space:]]*/, "", $2); print $2; exit }' "$file" 2>/dev/null || true)"
    case "$stage" in
      ""|done|rejected) ;;
      *) printf '%s:%s\n' "$(board_relative_path "$file")" "$stage"; return 0 ;;
    esac
  done
  return 1
}

write_tick_log() {
  local status="$1"
  local reason="$2"
  local candidate_file="${3:-}"
  local action="${4:-none}"
  local evidence_summary="${5:-none}"
  local log_file

  log_file="$(status_log_path)"
  {
    printf '# Self Improve Tick\n\n'
    printf '## Meta\n\n'
    printf -- '- Status: %s\n' "$status"
    printf -- '- Reason: %s\n' "$reason"
    printf -- '- Tick: %s\n' "$tick_count"
    printf -- '- Started At Epoch: %s\n' "$started_at_epoch"
    printf -- '- Interval Seconds: %s\n' "$interval_seconds"
    printf -- '- Max Duration Seconds: %s\n' "$max_duration_seconds"
    printf -- '- Max Ticks: %s\n' "$max_ticks"
    printf -- '- Threshold: %s\n' "$threshold"
    printf -- '- Timestamp: %s\n\n' "$timestamp"
    printf '## Evidence Summary\n\n'
    printf '%s\n\n' "$evidence_summary"
    printf '## Action\n\n'
    printf -- '- Action: %s\n' "$action"
    [ -z "$candidate_file" ] || printf -- '- Candidate: `%s`\n' "$(board_relative_path "$candidate_file")"
  } >"$log_file"

  printf 'status=%s\n' "$status"
  printf 'reason=%s\n' "$reason"
  printf 'tick=%s\n' "$tick_count"
  printf 'log=%s\n' "$log_file"
  [ -z "$candidate_file" ] || printf 'candidate=%s\n' "$candidate_file"
}

next_prd_id() {
  local max_id id file

  max_id=0
  for file in "${BOARD_ROOT}"/tickets/backlog/prd_[0-9][0-9][0-9].md "${BOARD_ROOT}"/tickets/done/prd_[0-9][0-9][0-9] "${BOARD_ROOT}"/tickets/inprogress/tickets_[0-9][0-9][0-9].md "${BOARD_ROOT}"/tickets/todo/tickets_[0-9][0-9][0-9].md; do
    [ -e "$file" ] || continue
    id="$(extract_numeric_id "$file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    [ "$((10#$id))" -gt "$max_id" ] && max_id="$((10#$id))"
  done
  printf '%03d' "$((max_id + 1))"
}

normalize_issue_line() {
  printf '%s' "$1" |
    tr '[:upper:]' '[:lower:]' |
    sed -E \
      -e 's/[0-9]{4}-[0-9]{2}-[0-9]{2}t[0-9:.+-]+z?/ <time> /g' \
      -e 's/[0-9a-f]{7,40}/<hash>/g' \
      -e 's/(tickets|prd|verify|reject)_[0-9]+/\1_<id>/g' \
      -e 's#/[^[:space:]]+#<path>#g' \
      -e 's/[0-9]+/<n>/g' \
      -e 's/[[:space:]]+/ /g' \
      -e 's/^ //; s/ $//'
}

candidate_risk() {
  local normalized="$1"

  case "$normalized" in
    *"git push"*|*"reset --hard"*|*"delete"*|*"destructive"*|*"dependency upgrade"*|*"architecture rewrite"*|*"merge conflict"*|*"cherry-pick conflict"*|*"rebase conflict"*)
      printf 'high'
      ;;
    *)
      printf 'low'
      ;;
  esac
}

scan_issues() {
  local root file rel

  for root in "${BOARD_ROOT}/logs" "${BOARD_ROOT}/runners/logs" "${BOARD_ROOT}/tickets/reject" "${BOARD_ROOT}/tickets/inprogress"; do
    [ -d "$root" ] || continue
    find "$root" -type f \( -name '*.md' -o -name '*.log' -o -name '*.txt' \) -mtime "-${lookback_days}" 2>/dev/null | sort
  done | while IFS= read -r file; do
    [ -f "$file" ] || continue
    [ "$(basename "$file")" != "README.md" ] || continue
    rel="$(board_relative_path "$file")"
    grep -Ein 'blocked|error|fail|failed|failure|timeout|memory|token|verification|reject|conflict' "$file" 2>/dev/null |
      while IFS= read -r line; do
        printf '%s\t%s\n' "$rel" "$line"
      done
  done
}

duplicate_exists() {
  local fingerprint="$1"
  local slug="$2"

  if grep -RqsF "Self Improve Fingerprint: ${fingerprint}" "${BOARD_ROOT}/tickets/backlog" "${BOARD_ROOT}/tickets/todo" "${BOARD_ROOT}/tickets/inprogress" "${BOARD_ROOT}/logs" 2>/dev/null; then
    return 0
  fi
  if grep -RqsF "$slug" "${BOARD_ROOT}/tickets/backlog" "${BOARD_ROOT}/tickets/todo" "${BOARD_ROOT}/tickets/inprogress" 2>/dev/null; then
    return 0
  fi
  return 1
}

create_prd_candidate() {
  local fingerprint="$1"
  local slug="$2"
  local normalized="$3"
  local count="$4"
  local sources="$5"
  local prd_id prd_file

  prd_id="$(next_prd_id)"
  prd_file="${BOARD_ROOT}/tickets/backlog/prd_${prd_id}.md"
  {
    printf '# Project PRD\n\n'
    printf '## Project\n\n'
    printf -- '- ID: prd_%s\n' "$prd_id"
    printf -- '- Title: Self-improvement candidate: %s\n' "$slug"
    printf -- '- AI: self-improve\n'
    printf -- '- Status: draft\n\n'
    printf '## Core Scope\n\n'
    printf -- '- Goal: Fix a repeated Autoflow operational issue detected from accumulated logs.\n'
    printf -- '- Self Improve Fingerprint: %s\n' "$fingerprint"
    printf -- '- Occurrence Count: %s\n' "$count"
    printf -- '- Risk Level: low\n'
    printf -- '- Impact: Repeated blocked, failed, timeout, token, memory, reject, or verification log entries reduce runner reliability.\n'
    printf -- '- Suspected Cause: %s\n' "$normalized"
    printf -- '- Proposed Allowed Paths:\n'
    printf '  - `.autoflow/`\n'
    printf '  - `runtime/board-scripts/`\n'
    printf '  - `packages/cli/`\n'
    printf '  - `tests/smoke/`\n\n'
    printf '## Evidence\n\n'
    printf -- '- Source Log Paths:\n'
    printf '%s\n\n' "$sources" | sed 's/^/  - /'
    printf '## Verification\n\n'
    printf -- '- Command: `bash tests/smoke/log-driven-self-improvement-smoke.sh`\n'
    printf -- '- Proposed Verification Command: `autoflow doctor .`\n\n'
    printf '## Notes\n\n'
    printf -- '- Created by self-improve runner at %s.\n' "$timestamp"
    printf -- '- No source evidence means no candidate; this candidate is evidence-backed by the source paths above.\n'
  } >"$prd_file"
  printf '%s' "$prd_file"
}

write_trial_state

if [ "$((now_epoch - started_at_epoch))" -ge "$max_duration_seconds" ] || [ "$tick_count" -gt "$max_ticks" ]; then
  write_tick_log "expired" "trial_expired" "" "none" "Trial reached max_duration_seconds=${max_duration_seconds} or max_ticks=${max_ticks}."
  exit 0
fi

if project_has_active_git_operation; then
  write_tick_log "skipped" "active_git_operation" "" "none" "Active merge, rebase, or cherry-pick state exists in PROJECT_ROOT."
  exit 0
fi

if project_has_unsafe_dirty_state; then
  write_tick_log "skipped" "unsafe_dirty_state" "" "none" "PROJECT_ROOT has dirty changes outside self-improve log state; mutation skipped."
  exit 0
fi

conflicting_work="$(active_conflicting_ticket_work || true)"
if [ -n "$conflicting_work" ]; then
  write_tick_log "skipped" "active_conflicting_ticket_work" "" "none" "$conflicting_work"
  exit 0
fi

scan_tmp="$(autoflow_mktemp)"
scan_issues >"$scan_tmp" || true

if [ ! -s "$scan_tmp" ]; then
  write_tick_log "idle" "no_log_evidence" "" "none" "No matching recent log, runner, reject, or in-progress issue evidence found."
  exit 0
fi

candidate_tmp="$(autoflow_mktemp)"
while IFS=$'\t' read -r source line; do
  [ -n "$line" ] || continue
  normalized="$(normalize_issue_line "$line")"
  [ -n "$normalized" ] || continue
  fingerprint="$(hash_text "$normalized")"
  printf '%s\t%s\t%s\t%s\n' "$fingerprint" "$source" "$normalized" "$line"
done <"$scan_tmp" >"$candidate_tmp"

if [ ! -s "$candidate_tmp" ]; then
  write_tick_log "idle" "no_fingerprint_candidates" "" "none" "Issue evidence was present, but no stable fingerprints were produced."
  exit 0
fi

selected="$(cut -f1 "$candidate_tmp" | sort | uniq -c | sort -rn | awk -v threshold="$threshold" '$1 >= threshold { print $2; exit }' || true)"
if [ -z "$selected" ]; then
  top_summary="$(cut -f1 "$candidate_tmp" | sort | uniq -c | sort -rn | head -n 5 | sed 's/^/fingerprint_count: /')"
  write_tick_log "idle" "threshold_not_met" "" "none" "${top_summary:-No fingerprint crossed threshold=${threshold}.}"
  exit 0
fi

count="$(awk -F '\t' -v fp="$selected" '$1 == fp { count++ } END { print count+0 }' "$candidate_tmp")"
normalized="$(awk -F '\t' -v fp="$selected" '$1 == fp { print $3; exit }' "$candidate_tmp")"
sources="$(awk -F '\t' -v fp="$selected" '$1 == fp { print $2 }' "$candidate_tmp" | sort -u | head -n 10)"
slug="$(safe_slug "$normalized")"
risk="$(candidate_risk "$normalized")"

if duplicate_exists "$selected" "$slug"; then
  write_tick_log "deduped" "duplicate_candidate" "" "none" "Fingerprint ${selected} (${slug}) already exists in open PRDs/tickets or recent self-improve logs."
  exit 0
fi

if [ "$risk" = "high" ]; then
  state_file="${state_dir}/${selected}.env"
  {
    printf 'fingerprint=%s\n' "$selected"
    printf 'slug=%s\n' "$slug"
    printf 'count=%s\n' "$count"
    printf 'risk=high\n'
    printf 'action=recommend_only\n'
    printf 'last_seen_at=%s\n' "$timestamp"
  } >"$state_file"
  write_tick_log "recommend_only" "high_risk_candidate" "" "recommend_only" "fingerprint=${selected}
slug=${slug}
occurrence_count=${count}
risk_level=high
source_log_paths:
${sources}"
  exit 0
fi

candidate_file="$(create_prd_candidate "$selected" "$slug" "$normalized" "$count" "$sources")"
state_file="${state_dir}/${selected}.env"
{
  printf 'fingerprint=%s\n' "$selected"
  printf 'slug=%s\n' "$slug"
  printf 'count=%s\n' "$count"
  printf 'risk=low\n'
  printf 'action=created_prd\n'
  printf 'candidate=%s\n' "$(board_relative_path "$candidate_file")"
  printf 'last_seen_at=%s\n' "$timestamp"
} >"$state_file"

write_tick_log "candidate_created" "threshold_crossed" "$candidate_file" "created_prd" "fingerprint=${selected}
slug=${slug}
occurrence_count=${count}
risk_level=low
source_log_paths:
${sources}"
