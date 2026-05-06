#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  monitor-project.sh scan [project-root] [board-dir-name]
  monitor-project.sh [project-root] [board-dir-name]   # scan alias
EOF
}

action="${1:-scan}"
if [ "$action" = "-h" ] || [ "$action" = "--help" ] || [ "$action" = "help" ]; then
  usage
  exit 0
fi
if [ "$action" = "scan" ]; then
  shift || true
else
  action="scan"
fi

project_root_input="${1:-.}"
board_dir_name="${2:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

state_dir="${board_root}/runners/state"
monitor_state_dir="${state_dir}/monitor"
mkdir -p "$monitor_state_dir"

now_epoch="$(date -u +%s)"
now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
signal_count=0
created_order=""
created_check=""
duplicate_suppressed="false"
duplicate_fingerprint=""
duplicate_order_file=""
auto_order_enabled="${AUTOFLOW_MONITOR_AUTO_ORDER_ENABLED:-1}"
repeat_threshold="${AUTOFLOW_MONITOR_REPEAT_FAIL_THRESHOLD:-3}"
stuck_threshold="${AUTOFLOW_MONITOR_STUCK_THRESHOLD_SECONDS:-600}"
cooldown_seconds="${AUTOFLOW_MONITOR_COOLDOWN_SECONDS:-900}"
queue_threshold="${AUTOFLOW_MONITOR_QUEUE_THRESHOLD:-10}"
dirty_threshold="${AUTOFLOW_MONITOR_DIRTY_THRESHOLD:-20}"
token_ratio_threshold="${AUTOFLOW_MONITOR_TOKEN_RATIO_THRESHOLD:-10}"

case "${AUTOFLOW_MONITOR_ENABLED:-1}" in
  0|false|off|no|FALSE|OFF|NO)
    printf 'status=idle\n'
    printf 'role=monitor\n'
    printf 'runtime_role=monitor\n'
    printf 'source=monitor-scan\n'
    printf 'monitor_disabled=true\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    printf 'signal_count=0\n'
    printf 'order_created=false\n'
    printf 'duplicate_suppressed=false\n'
    exit 0
    ;;
esac

case "$repeat_threshold" in ''|*[!0-9]*) repeat_threshold=3 ;; esac
case "$stuck_threshold" in ''|*[!0-9]*) stuck_threshold=600 ;; esac
case "$cooldown_seconds" in ''|*[!0-9]*) cooldown_seconds=900 ;; esac
case "$queue_threshold" in ''|*[!0-9]*) queue_threshold=10 ;; esac
case "$dirty_threshold" in ''|*[!0-9]*) dirty_threshold=20 ;; esac
case "$token_ratio_threshold" in ''|*[!0-9]*) token_ratio_threshold=10 ;; esac

hash_text() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    cksum | awk '{ print $1 ":" $2 }'
  fi
}

sanitize_key() {
  printf '%s' "$1" | sed 's/[^A-Za-z0-9_.-]/_/g'
}

next_order_id() {
  local max_id=0 file base id
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    base="$(basename "$file")"
    id="${base#order_}"
    id="${id%.md}"
    case "$id" in
      [0-9][0-9][0-9])
        [ "$((10#$id))" -gt "$max_id" ] && max_id="$((10#$id))"
        ;;
    esac
  done < <(find "${board_root}/tickets" -type f -name 'order_[0-9][0-9][0-9].md' 2>/dev/null | sort)
  printf '%03d' "$((max_id + 1))"
}

field_from_state_file() {
  local file="$1" key="$2"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; found=1; exit } END { exit(found ? 0 : 1) }' "$file" 2>/dev/null || true
}

append_signal() {
  local type="$1" severity="$2" confidence="$3" title="$4" detail="$5" action="$6"
  local fingerprint

  signal_count=$((signal_count + 1))
  fingerprint="$(printf '%s\n%s\n%s\n%s\n' "$type" "$severity" "$confidence" "$detail" | sed -E 's/repeat_count=[0-9]+; //g' | hash_text)"
  eval "signal_${signal_count}_type=\$type"
  eval "signal_${signal_count}_severity=\$severity"
  eval "signal_${signal_count}_confidence=\$confidence"
  eval "signal_${signal_count}_title=\$title"
  eval "signal_${signal_count}_detail=\$detail"
  eval "signal_${signal_count}_action=\$action"
  eval "signal_${signal_count}_fingerprint=\$fingerprint"
}

count_md_files() {
  local dir="$1"
  [ -d "$dir" ] || { printf '0'; return 0; }
  find "$dir" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d '[:space:]'
}

runner_status_scan() {
  local state_file runner_id status last_result last_event_at event_epoch age key history_file previous_result previous_count count
  [ -d "$state_dir" ] || return 0
  while IFS= read -r state_file; do
    [ -n "$state_file" ] || continue
    case "$(basename "$state_file")" in
      monitor*|*.pending|*.fingerprint|*.lock|*.history) continue ;;
    esac
    runner_id="${state_file##*/}"
    runner_id="${runner_id%.state}"
    status="$(field_from_state_file "$state_file" "status")"
    last_result="$(field_from_state_file "$state_file" "last_result")"
    last_event_at="$(field_from_state_file "$state_file" "last_event_at")"

    if [ -n "$last_result" ]; then
      key="$(sanitize_key "$runner_id")"
      history_file="${monitor_state_dir}/repeat.${key}.state"
      previous_result="$(field_from_state_file "$history_file" "last_result")"
      previous_count="$(field_from_state_file "$history_file" "count")"
      case "$previous_count" in ''|*[!0-9]*) previous_count=0 ;; esac
      if [ "$previous_result" = "$last_result" ]; then
        count=$((previous_count + 1))
      else
        count=1
      fi
      {
        printf 'runner_id=%s\n' "$runner_id"
        printf 'last_result=%s\n' "$last_result"
        printf 'count=%s\n' "$count"
        printf 'updated_at=%s\n' "$now_iso"
      } > "$history_file"
      if [ "$count" -ge "$repeat_threshold" ]; then
        append_signal \
          "runner_repeated_last_result" \
          "high" \
          "confirmed" \
          "Runner ${runner_id} repeated last_result=${last_result}" \
          "runner=${runner_id}; last_result=${last_result}; repeat_count=${count}; threshold=${repeat_threshold}; source=${state_file}" \
          "Inspect ${runner_id} runner log and create a narrow recovery ticket or fix the repeated state transition."
      fi
    fi

    if [ "$status" = "running" ] && [ -n "$last_event_at" ]; then
      event_epoch="$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_event_at" +%s 2>/dev/null || date -u -d "$last_event_at" +%s 2>/dev/null || true)"
      case "$event_epoch" in ''|*[!0-9]*) continue ;; esac
      age=$((now_epoch - event_epoch))
      if [ "$age" -ge "$stuck_threshold" ]; then
        append_signal \
          "runner_stale_event" \
          "high" \
          "hypothesis" \
          "Runner ${runner_id} event age exceeded monitor threshold" \
          "runner=${runner_id}; last_event_at=${last_event_at}; age_seconds=${age}; threshold=${stuck_threshold}; source=${state_file}" \
          "Cross-check live stdout/stderr before deciding whether the runner is actually stuck."
      fi
    fi
  done < <(find "$state_dir" -maxdepth 1 -type f -name '*.state' 2>/dev/null | sort)
}

board_queue_scan() {
  local inbox todo inprogress reject
  inbox="$(count_md_files "${board_root}/tickets/inbox")"
  todo="$(count_md_files "${board_root}/tickets/todo")"
  inprogress="$(count_md_files "${board_root}/tickets/inprogress")"
  reject="$(count_md_files "${board_root}/tickets/reject")"
  if [ "$inbox" -ge "$queue_threshold" ] || [ "$todo" -ge "$queue_threshold" ] || [ "$reject" -ge "$queue_threshold" ]; then
    append_signal \
      "board_queue_pressure" \
      "high" \
      "confirmed" \
      "Board queue exceeded monitor threshold" \
      "inbox=${inbox}; todo=${todo}; inprogress=${inprogress}; reject=${reject}; threshold=${queue_threshold}" \
      "Review runner throughput and split or prioritize queued work."
  fi
}

dirty_root_scan() {
  local dirty_count
  if ! git -C "$project_root" rev-parse --show-toplevel >/dev/null 2>&1; then
    return 0
  fi
  dirty_count="$(git -C "$project_root" status --porcelain --untracked-files=normal 2>/dev/null | wc -l | tr -d '[:space:]')"
  case "$dirty_count" in ''|*[!0-9]*) dirty_count=0 ;; esac
  if [ "$dirty_count" -ge "$dirty_threshold" ]; then
    append_signal \
      "dirty_root_pressure" \
      "high" \
      "hypothesis" \
      "Project root dirty path count exceeded monitor threshold" \
      "dirty_count=${dirty_count}; threshold=${dirty_threshold}; source=git_status_porcelain" \
      "Group dirty paths by active ticket Allowed Paths before creating cleanup work."
  fi
}

needs_user_scan() {
  local ticket_file status_line ticket_name
  [ -d "${board_root}/tickets" ] || return 0
  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    status_line="$(awk '
      /^## Recovery State/ { in_section=1; next }
      /^## / && in_section { in_section=0 }
      in_section && /^[[:space:]]*[-*][[:space:]]*Status:[[:space:]]*/ {
        sub(/^[[:space:]]*[-*][[:space:]]*Status:[[:space:]]*/, "", $0)
        print
        found=1
        exit
      }
      END { exit(found ? 0 : 1) }
    ' "$ticket_file" 2>/dev/null || true)"
    if [ "$status_line" = "needs_user" ]; then
      ticket_name="$(basename "$ticket_file")"
      append_signal \
        "needs_user_ticket" \
        "high" \
        "confirmed" \
        "Ticket ${ticket_name} has Recovery State needs_user" \
        "ticket=${ticket_file}; recovery_status=${status_line}; source=recovery_state_field" \
        "Inspect the parked decision and resolve or narrow the required human choice."
    fi
  done < <(find "${board_root}/tickets/inprogress" "${board_root}/tickets/reject" -type f -name 'tickets_*.md' 2>/dev/null | sort)
}

telemetry_token_scan() {
  local cache_path telemetry_path cache_total telemetry_total ratio_big ratio_small ratio
  cache_path="${board_root}/metrics/token-cache.tsv"
  telemetry_path="${board_root}/telemetry/runs.jsonl"
  [ -f "$cache_path" ] && [ -f "$telemetry_path" ] || return 0

  cache_total="$(awk -F'\t' 'NF >= 4 && $4 ~ /^[0-9]+$/ { total += $4 } END { print total + 0 }' "$cache_path" 2>/dev/null || printf '0')"
  telemetry_total="$(awk '
    match($0, /"token_input"[[:space:]]*:[[:space:]]*[0-9]+/) {
      v=substr($0, RSTART, RLENGTH); sub(/.*:/, "", v); input += v + 0
    }
    match($0, /"token_output"[[:space:]]*:[[:space:]]*[0-9]+/) {
      v=substr($0, RSTART, RLENGTH); sub(/.*:/, "", v); output += v + 0
    }
    END { print input + output + 0 }
  ' "$telemetry_path" 2>/dev/null || printf '0')"

  case "$cache_total" in ''|*[!0-9]*) cache_total=0 ;; esac
  case "$telemetry_total" in ''|*[!0-9]*) telemetry_total=0 ;; esac
  [ "$cache_total" -gt 0 ] && [ "$telemetry_total" -gt 0 ] || return 0

  if [ "$cache_total" -gt "$telemetry_total" ]; then
    ratio_big="$cache_total"; ratio_small="$telemetry_total"
  else
    ratio_big="$telemetry_total"; ratio_small="$cache_total"
  fi
  ratio=$((ratio_big / ratio_small))
  if [ "$ratio" -ge "$token_ratio_threshold" ]; then
    append_signal \
      "telemetry_token_cache_mismatch" \
      "critical" \
      "confirmed" \
      "Telemetry and token-cache totals diverged" \
      "source_a=metrics/token-cache.tsv; source_a_total=${cache_total}; source_b=telemetry/runs.jsonl; source_b_total=${telemetry_total}; ratio=${ratio}; threshold=${token_ratio_threshold}" \
      "Audit token unit conversion and aggregation source precedence before trusting usage metrics."
  fi
}

create_order_for_signal() {
  local index="$1"
  local type severity confidence title detail action fingerprint order_id order_file priority cooldown_file last_created last_order age tmp

  eval "type=\${signal_${index}_type}"
  eval "severity=\${signal_${index}_severity}"
  eval "confidence=\${signal_${index}_confidence}"
  eval "title=\${signal_${index}_title}"
  eval "detail=\${signal_${index}_detail}"
  eval "action=\${signal_${index}_action}"
  eval "fingerprint=\${signal_${index}_fingerprint}"

  cooldown_file="${monitor_state_dir}/fingerprint.${fingerprint}.state"
  last_created="$(field_from_state_file "$cooldown_file" "created_epoch")"
  last_order="$(field_from_state_file "$cooldown_file" "order_file")"
  case "$last_created" in ''|*[!0-9]*) last_created=0 ;; esac
  age=$((now_epoch - last_created))
  if [ "$last_created" -gt 0 ] && [ "$age" -lt "$cooldown_seconds" ]; then
    duplicate_suppressed="true"
    duplicate_fingerprint="$fingerprint"
    duplicate_order_file="$last_order"
    {
      printf 'fingerprint=%s\n' "$fingerprint"
      printf 'created_epoch=%s\n' "$last_created"
      printf 'last_duplicate_at=%s\n' "$now_iso"
      printf 'order_file=%s\n' "$last_order"
      printf 'duplicate_suppressed=true\n'
    } > "$cooldown_file"
    return 0
  fi

  case "$auto_order_enabled" in
    0|false|off|no|FALSE|OFF|NO)
      return 0
      ;;
  esac

  priority="high"
  [ "$severity" = "critical" ] && priority="critical"
  mkdir -p "${board_root}/tickets/inbox"
  order_id="$(next_order_id)"
  order_file="${board_root}/tickets/inbox/order_${order_id}.md"
  tmp="$(autoflow_mktemp)"
  {
    printf -- '---\n'
    printf 'source: autoflow-monitor-agent\n'
    printf 'priority: %s\n' "$priority"
    printf 'fingerprint: %s\n' "$fingerprint"
    printf 'signal_type: %s\n' "$type"
    printf 'confidence: %s\n' "$confidence"
    printf -- '---\n\n'
    printf '# Autoflow Order\n\n'
    printf '## Order\n\n'
    printf -- '- ID: order_%s\n' "$order_id"
    printf -- '- Title: %s\n' "$title"
    printf -- '- Status: inbox\n'
    printf -- '- Priority: %s\n' "$priority"
    printf -- '- Created At: %s\n' "$now_iso"
    printf -- '- Source: autoflow-monitor-agent\n\n'
    printf '## Request\n\n'
    printf 'Monitor detected `%s` with `%s` confidence.\n\n' "$type" "$confidence"
    printf -- '- Severity: %s\n' "$severity"
    printf -- '- Fingerprint: %s\n' "$fingerprint"
    printf -- '- Evidence: %s\n' "$detail"
    printf -- '- Suggested next action: %s\n\n' "$action"
    printf '## Hints\n\n'
    printf '### Scope\n\n'
    printf -- '- Plan AI should create the narrowest recovery or investigation ticket that addresses this monitor signal. The monitor must not stop, restart, kill, clean up, or push.\n\n'
    printf '### Allowed Paths\n\n'
    printf -- '- pending Plan AI inference\n\n'
    printf '### Verification\n\n'
    printf -- '- Command: pending Plan AI inference\n\n'
    printf '## Monitor Evidence\n\n'
    printf -- '- source: autoflow-monitor-agent\n'
    printf -- '- signal.type: %s\n' "$type"
    printf -- '- signal.severity: %s\n' "$severity"
    printf -- '- signal.confidence: %s\n' "$confidence"
    printf -- '- signal.fingerprint: %s\n' "$fingerprint"
    printf -- '- signal.detail: %s\n' "$detail"
    printf -- '- suggested_next_action: %s\n\n' "$action"
    printf '## Planner Contract\n\n'
    printf -- '- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.\n'
    printf -- '- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.\n'
  } > "$tmp"
  mv "$tmp" "$order_file"
  created_order="$order_file"
  {
    printf 'fingerprint=%s\n' "$fingerprint"
    printf 'created_epoch=%s\n' "$now_epoch"
    printf 'created_at=%s\n' "$now_iso"
    printf 'order_file=%s\n' "$order_file"
    printf 'duplicate_suppressed=false\n'
  } > "$cooldown_file"
}

runner_status_scan
board_queue_scan
dirty_root_scan
needs_user_scan
telemetry_token_scan

if [ "$signal_count" -gt 0 ]; then
  selected_index=1
  for index in $(seq 1 "$signal_count"); do
    eval "candidate=\${signal_${index}_severity}"
    if [ "$candidate" = "critical" ]; then
      selected_index="$index"
      break
    fi
  done
  create_order_for_signal "$selected_index"
fi

printf 'status=ok\n'
printf 'role=monitor\n'
printf 'runtime_role=monitor\n'
printf 'source=monitor-scan\n'
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'signal_count=%s\n' "$signal_count"
if [ "$signal_count" -gt 0 ]; then
  for index in $(seq 1 "$signal_count"); do
    eval "type=\${signal_${index}_type}"
    eval "severity=\${signal_${index}_severity}"
    eval "confidence=\${signal_${index}_confidence}"
    eval "fingerprint=\${signal_${index}_fingerprint}"
    printf 'signal.%s.type=%s\n' "$index" "$type"
    printf 'signal.%s.severity=%s\n' "$index" "$severity"
    printf 'signal.%s.confidence=%s\n' "$index" "$confidence"
    printf 'signal.%s.fingerprint=%s\n' "$index" "$fingerprint"
  done
fi
if [ -n "$created_order" ]; then
  printf 'order_created=true\n'
  printf 'order_file=%s\n' "$created_order"
else
  printf 'order_created=false\n'
fi
printf 'check_created=%s\n' "${created_check:-false}"
printf 'duplicate_suppressed=%s\n' "$duplicate_suppressed"
if [ -n "$duplicate_fingerprint" ]; then
  printf 'duplicate_fingerprint=%s\n' "$duplicate_fingerprint"
fi
if [ -n "$duplicate_order_file" ]; then
  printf 'duplicate_order_file=%s\n' "$duplicate_order_file"
fi
