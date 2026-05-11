#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

# Token metrics now come from `.autoflow/telemetry/runs.jsonl`, and commit/code
# volume metrics avoid per-ticket git log/show scans so desktop readBoard calls
# do not block on raw runner log or done-ticket history traversal.

usage() {
  cat <<'EOF' >&2
Usage:
  metrics-project.sh [project-root] [board-dir-name] [--write]

Examples:
  metrics-project.sh /path/to/project
  metrics-project.sh /path/to/project .autoflow --write
EOF
}

percent_value() {
  local numerator="$1"
  local denominator="$2"

  if [ "$denominator" -le 0 ]; then
    printf '0.0'
    return 0
  fi

  awk -v n="$numerator" -v d="$denominator" 'BEGIN { printf "%.1f", (n / d) * 100 }'
}

json_escape() {
  awk '
    BEGIN { ORS="" }
    {
      gsub(/\\/,"\\\\")
      gsub(/"/,"\\\"")
      gsub(/\t/,"\\t")
      gsub(/\r/,"\\r")
      gsub(/\n/,"\\n")
      print
    }
  '
}

file_size_bytes() {
  wc -c < "$1" | tr -d '[:space:]'
}

file_mtime_epoch() {
  stat -f '%m' "$1" 2>/dev/null || stat -c '%Y' "$1" 2>/dev/null || printf '0'
}

write_snapshot() {
  local metrics_root="$1"
  local snapshot_file="$2"
  local timestamp="$3"
  local project_root="$4"
  local board_root="$5"
  local spec_total="$6"
  local ticket_total="$7"
  local ticket_done_count="$8"
  local active_ticket_count="$9"
  local reject_count="${10}"
  local handoff_count="${11}"
  local runner_total_count="${12}"
  local runner_running_count="${13}"
  local runner_idle_count="${14}"
  local runner_stopped_count="${15}"
  local runner_blocked_count="${16}"
  local runner_enabled_count="${17}"
  local runner_disabled_count="${18}"
  local runner_invalid_config_count="${19}"
  local runner_artifact_ok_count="${20}"
  local runner_artifact_warning_count="${21}"
  local runner_artifact_not_applicable_count="${22}"
  local autoflow_commit_count="${23}"
  local autoflow_code_files_changed_count="${24}"
  local autoflow_code_insertions_count="${25}"
  local autoflow_code_deletions_count="${26}"
  local autoflow_code_volume_count="${27}"
  local autoflow_token_usage_count="${28}"
  local autoflow_token_report_count="${29}"
  local autoflow_avg_lead_seconds="${30}"
  local autoflow_avg_active_seconds="${31}"
  local autoflow_avg_ticks_per_done_ticket="${32}"
  local autoflow_duration_total_24h_seconds="${33}"
  local completion_rate_percent="${34}"
  local autoflow_code_net_delta_count="${35}"
  local autoflow_token_usage_1h_count="${36}"
  local autoflow_token_usage_24h_count="${37}"
  local autoflow_token_input_1h_count="${38}"
  local autoflow_token_output_1h_count="${39}"
  local autoflow_token_cache_1h_count="${40}"
  local autoflow_token_input_24h_count="${41}"
  local autoflow_token_output_24h_count="${42}"
  local autoflow_token_cache_24h_count="${43}"
  local autoflow_token_runner_breakdown_24h_json="${44}"
  local autoflow_token_model_breakdown_24h_json="${45}"
  local autoflow_runner_status_24h_json="${46}"
  local autoflow_commit_count_24h="${47}"
  local autoflow_commit_auto_count_24h="${48}"
  local autoflow_commit_manual_count_24h="${49}"
  local autoflow_commit_recent_subjects_json="${50}"
  local autoflow_code_daily_buckets_14d_json="${51}"
  local autoflow_code_dir_breakdown_json="${52}"
  local autoflow_commit_daily_buckets_14d_json="${53}"
  local autoflow_token_hourly_24h_json="${54}"
  local autoflow_runner_tick_timeline_24h_json="${55}"
  local autoflow_runner_avg_tick_seconds_json="${56}"
  local escaped_project escaped_board
  local escaped_runner_breakdown
  local escaped_model_breakdown
  local escaped_runner_status
  local escaped_commit_subjects
  local escaped_code_daily escaped_code_dir escaped_commit_daily
  local escaped_token_hourly escaped_runner_timeline escaped_runner_avg

  mkdir -p "$metrics_root"
  escaped_project="$(printf '%s' "$project_root" | json_escape)"
  escaped_board="$(printf '%s' "$board_root" | json_escape)"
  escaped_runner_breakdown="$(printf '%s' "$autoflow_token_runner_breakdown_24h_json" | json_escape)"
  escaped_model_breakdown="$(printf '%s' "$autoflow_token_model_breakdown_24h_json" | json_escape)"
  escaped_runner_status="$(printf '%s' "$autoflow_runner_status_24h_json" | json_escape)"
  escaped_commit_subjects="$(printf '%s' "$autoflow_commit_recent_subjects_json" | json_escape)"
  escaped_code_daily="$(printf '%s' "$autoflow_code_daily_buckets_14d_json" | json_escape)"
  escaped_code_dir="$(printf '%s' "$autoflow_code_dir_breakdown_json" | json_escape)"
  escaped_commit_daily="$(printf '%s' "$autoflow_commit_daily_buckets_14d_json" | json_escape)"
  escaped_token_hourly="$(printf '%s' "$autoflow_token_hourly_24h_json" | json_escape)"
  escaped_runner_timeline="$(printf '%s' "$autoflow_runner_tick_timeline_24h_json" | json_escape)"
  escaped_runner_avg="$(printf '%s' "$autoflow_runner_avg_tick_seconds_json" | json_escape)"
  printf '{"timestamp":"%s","project_root":"%s","board_root":"%s","spec_total":%s,"ticket_total":%s,"ticket_done_count":%s,"active_ticket_count":%s,"reject_count":%s,"handoff_count":%s,"runner_total_count":%s,"runner_running_count":%s,"runner_idle_count":%s,"runner_stopped_count":%s,"runner_blocked_count":%s,"runner_enabled_count":%s,"runner_disabled_count":%s,"runner_invalid_config_count":%s,"runner_artifact_ok_count":%s,"runner_artifact_warning_count":%s,"runner_artifact_not_applicable_count":%s,"autoflow_commit_count":%s,"autoflow_code_files_changed_count":%s,"autoflow_code_insertions_count":%s,"autoflow_code_deletions_count":%s,"autoflow_code_volume_count":%s,"autoflow_code_net_delta_count":%s,"autoflow_token_usage_count":%s,"autoflow_token_report_count":%s,"autoflow_token_usage_1h_count":%s,"autoflow_token_usage_24h_count":%s,"autoflow_token_input_1h_count":%s,"autoflow_token_output_1h_count":%s,"autoflow_token_cache_1h_count":%s,"autoflow_token_input_24h_count":%s,"autoflow_token_output_24h_count":%s,"autoflow_token_cache_24h_count":%s,"autoflow_token_runner_breakdown_24h_json":"%s","autoflow_token_model_breakdown_24h_json":"%s","autoflow_runner_status_24h_json":"%s","autoflow_commit_count_24h":%s,"autoflow_commit_auto_count_24h":%s,"autoflow_commit_manual_count_24h":%s,"autoflow_commit_recent_subjects_json":"%s","autoflow_code_daily_buckets_14d_json":"%s","autoflow_code_dir_breakdown_json":"%s","autoflow_commit_daily_buckets_14d_json":"%s","autoflow_token_hourly_24h_json":"%s","autoflow_runner_tick_timeline_24h_json":"%s","autoflow_runner_avg_tick_seconds_json":"%s","autoflow_avg_lead_seconds":%s,"autoflow_avg_active_seconds":%s,"autoflow_avg_ticks_per_done_ticket":%s,"autoflow_duration_total_24h_seconds":%s,"completion_rate_percent":%s}\n' \
    "$timestamp" \
    "$escaped_project" \
    "$escaped_board" \
    "$spec_total" \
    "$ticket_total" \
    "$ticket_done_count" \
    "$active_ticket_count" \
    "$reject_count" \
    "$handoff_count" \
    "$runner_total_count" \
    "$runner_running_count" \
    "$runner_idle_count" \
    "$runner_stopped_count" \
    "$runner_blocked_count" \
    "$runner_enabled_count" \
    "$runner_disabled_count" \
    "$runner_invalid_config_count" \
    "$runner_artifact_ok_count" \
    "$runner_artifact_warning_count" \
    "$runner_artifact_not_applicable_count" \
    "$autoflow_commit_count" \
    "$autoflow_code_files_changed_count" \
    "$autoflow_code_insertions_count" \
    "$autoflow_code_deletions_count" \
    "$autoflow_code_volume_count" \
    "$autoflow_code_net_delta_count" \
    "$autoflow_token_usage_count" \
    "$autoflow_token_report_count" \
    "$autoflow_token_usage_1h_count" \
    "$autoflow_token_usage_24h_count" \
    "$autoflow_token_input_1h_count" \
    "$autoflow_token_output_1h_count" \
    "$autoflow_token_cache_1h_count" \
    "$autoflow_token_input_24h_count" \
    "$autoflow_token_output_24h_count" \
    "$autoflow_token_cache_24h_count" \
    "$escaped_runner_breakdown" \
    "$escaped_model_breakdown" \
    "$escaped_runner_status" \
    "$autoflow_commit_count_24h" \
    "$autoflow_commit_auto_count_24h" \
    "$autoflow_commit_manual_count_24h" \
    "$escaped_commit_subjects" \
    "$escaped_code_daily" \
    "$escaped_code_dir" \
    "$escaped_commit_daily" \
    "$escaped_token_hourly" \
    "$escaped_runner_timeline" \
    "$escaped_runner_avg" \
    "$autoflow_avg_lead_seconds" \
    "$autoflow_avg_active_seconds" \
    "$autoflow_avg_ticks_per_done_ticket" \
    "$autoflow_duration_total_24h_seconds" \
    "$completion_rate_percent" >> "$snapshot_file"
}

count_runner_artifact_status() {
  local target_runner_id="$1"
  local artifact_path artifact_count artifact_issue_count artifact_label

  artifact_count=0
  artifact_issue_count=0

  for artifact_label in runtime prompt stdout stderr; do
    artifact_path="$(runner_state_field "$target_runner_id" "last_${artifact_label}_log" 2>/dev/null || true)"
    [ -n "$artifact_path" ] || continue
    artifact_count=$((artifact_count + 1))

    case "$artifact_path" in
      "${board_root}"/*)
        [ -f "$artifact_path" ] || artifact_issue_count=$((artifact_issue_count + 1))
        ;;
      *)
        artifact_issue_count=$((artifact_issue_count + 1))
        ;;
    esac
  done

  if [ "$artifact_count" -eq 0 ]; then
    printf 'not_applicable'
  elif [ "$artifact_issue_count" -eq 0 ]; then
    printf 'ok'
  else
    printf 'warning'
  fi
}

count_runner_states() {
  local config_path
  local config_stream line in_runner id role mode status pid enabled invalid_config artifact_status

  runner_total_count=0
  runner_running_count=0
  runner_idle_count=0
  runner_stopped_count=0
  runner_blocked_count=0
  runner_enabled_count=0
  runner_disabled_count=0
  runner_invalid_config_count=0
  runner_artifact_ok_count=0
  runner_artifact_warning_count=0
  runner_artifact_not_applicable_count=0

  export AUTOFLOW_BOARD_ROOT="$board_root"
  config_path="$(runner_config_path)"
  [ -f "$config_path" ] || return 0

  config_stream="$(runner_list_config "$config_path" || true)"
  in_runner=0
  id=""
  role=""
  enabled="true"
  invalid_config="false"

  while IFS= read -r line; do
    case "$line" in
      runner_begin)
        in_runner=1
        id=""
        role=""
        mode=""
        enabled="true"
        invalid_config="false"
        ;;
      runner_end)
        if [ "$in_runner" -eq 1 ] && [ -n "$id" ]; then
          runner_total_count=$((runner_total_count + 1))
          case "$role" in
            # Mirrors runner_allowed_role in runners-project.sh and the
            # allowedRunnerRoles / allowedRunRoles sets in apps/desktop/
            # src/main.js. 3-runner active + their aliases, legacy/back-
            # compat roles, plus the self-improve trial.
            ticket-owner|owner|ticket|planner|plan|todo|wiki-maintainer|wiki|merge|merge-bot|coordinator|coord|doctor|diagnose|watcher|self-improve|self_improve|selfimprove) ;;
            *) invalid_config="true" ;;
          esac
          case "$enabled" in
            true)
              runner_enabled_count=$((runner_enabled_count + 1))
              ;;
            false)
              runner_disabled_count=$((runner_disabled_count + 1))
              ;;
            *)
              invalid_config="true"
              ;;
          esac
          if [ "$invalid_config" = "true" ]; then
            runner_invalid_config_count=$((runner_invalid_config_count + 1))
          fi
          status="$(runner_state_field "$id" "status" 2>/dev/null || true)"
          pid="$(runner_state_field "$id" "pid" 2>/dev/null || true)"
          status="$(runner_effective_state_status "$status" "$mode" "$pid")"
          case "$status" in
            running)
              runner_running_count=$((runner_running_count + 1))
              ;;
            stopped)
              runner_stopped_count=$((runner_stopped_count + 1))
              ;;
            blocked|failed)
              runner_blocked_count=$((runner_blocked_count + 1))
              ;;
            *)
              runner_idle_count=$((runner_idle_count + 1))
              ;;
          esac
          artifact_status="$(count_runner_artifact_status "$id")"
          case "$artifact_status" in
            ok)
              runner_artifact_ok_count=$((runner_artifact_ok_count + 1))
              ;;
            warning)
              runner_artifact_warning_count=$((runner_artifact_warning_count + 1))
              ;;
            *)
              runner_artifact_not_applicable_count=$((runner_artifact_not_applicable_count + 1))
              ;;
          esac
        fi
        in_runner=0
        ;;
      id=*)
        if [ "$in_runner" -eq 1 ]; then
          id="${line#id=}"
        fi
        ;;
      role=*)
        if [ "$in_runner" -eq 1 ]; then
          role="${line#role=}"
        fi
        ;;
      mode=*)
        if [ "$in_runner" -eq 1 ]; then
          mode="${line#mode=}"
        fi
        ;;
      enabled=*)
        if [ "$in_runner" -eq 1 ]; then
          enabled="${line#enabled=}"
        fi
        ;;
    esac
  done <<EOF
$config_stream
EOF
}

count_autoflow_commit_metrics() {
  local git_root done_ticket_paths
  local commit_lines commit_hash commit_epoch commit_subject
  local commit_subjects
  local now_epoch one_day_ago fourteen_days_ago
  local board_root_relative
  local added removed file_path
  local numstat_stream in_commit
  local i=0
  local -a commit_hash_arr
  local commit_meta_tsv numstat_tsv agg_output

  autoflow_commit_count=0
  autoflow_commit_count_24h=0
  autoflow_commit_auto_count_24h=0
  autoflow_commit_manual_count_24h=0
  autoflow_commit_recent_subjects_json='[]'
  autoflow_code_files_changed_count=0
  autoflow_code_insertions_count=0
  autoflow_code_deletions_count=0
  autoflow_code_volume_count=0
  autoflow_code_net_delta_count=0
  autoflow_code_daily_buckets_14d_json='[]'
  autoflow_code_dir_breakdown_json='{}'
  autoflow_commit_daily_buckets_14d_json='[]'

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$git_root" ] || return 0
  [ -d "${board_root}/tickets/done" ] || return 0

  board_root_relative="${board_root#${git_root}/}"
  # Read paths into an array so each path becomes its own pathspec arg.
  # Quoting the joined string as one arg made git treat the entire blob as a
  # single pathspec (which never matched), leaving every code volume metric
  # stuck at 0 even when 500+ done tickets had real commits.
  done_paths_arr=()
  while IFS= read -r _line; do
    [ -n "$_line" ] && done_paths_arr+=("$_line")
  done < <(find "${board_root}/tickets/done" -type f \( -name 'Todo-*.md' -o -name 'tickets_*.md' -o -name 'prd_*.md' \) -print | sort)
  [ "${#done_paths_arr[@]}" -gt 0 ] || return 0

  now_epoch="$(date -u +%s)"
  one_day_ago="$((now_epoch - 86400))"
  commit_lines="$(git -C "$git_root" log --format='%H|%at|%s' -- "${done_paths_arr[@]}" 2>/dev/null || true)"
  [ -n "$commit_lines" ] || return 0

  autoflow_commit_count="$(printf '%s\n' "$commit_lines" | awk 'NF && $1 != "- " { count += 1 } END { print count + 0 }')"
  commit_subjects=""
  commit_meta_tsv=""
  numstat_tsv=""
  if command -v python3 >/dev/null 2>&1; then
    commit_meta_tsv="$(mktemp 2>/dev/null || true)"
    numstat_tsv="$(mktemp 2>/dev/null || true)"
  fi
  while IFS='|' read -r commit_hash commit_epoch commit_subject; do
    [ -n "$commit_hash" ] || continue
    commit_hash_arr+=("$commit_hash")
    if [ -n "$commit_meta_tsv" ] && [ -f "$commit_meta_tsv" ]; then
      printf '%s\t%s\n' "$commit_hash" "$commit_epoch" >> "$commit_meta_tsv"
    fi

    case "$commit_epoch" in
      ''|*[!0-9]*) commit_epoch=0 ;;
    esac
    if [ "$commit_epoch" -ge "$one_day_ago" ]; then
      autoflow_commit_count_24h=$((autoflow_commit_count_24h + 1))
      if [[ "$commit_subject" =~ ^\[[^]]+\] ]]; then
        autoflow_commit_auto_count_24h=$((autoflow_commit_auto_count_24h + 1))
      else
        autoflow_commit_manual_count_24h=$((autoflow_commit_manual_count_24h + 1))
      fi
    fi

    if [ -n "$commit_subject" ] && [ "$i" -lt 5 ]; then
      i=$((i + 1))
      commit_subjects="${commit_subjects},$(printf '%s' "$commit_subject" | json_escape)"
    fi
  done <<EOF
$commit_lines
EOF

  if [ -n "$commit_subjects" ]; then
    commit_subjects="$(printf '%s' "$commit_subjects" | sed 's/^,//')"
    autoflow_commit_recent_subjects_json="$(printf '[%s]' "$commit_subjects")"
  fi

  numstat_stream=""
  if [ ${#commit_hash_arr[@]} -gt 0 ]; then
    numstat_stream="$(printf '%s\n' "${commit_hash_arr[@]}" | git -C "$git_root" show --numstat --format='commit %H' --stdin 2>/dev/null || true)"
  fi

  in_commit=0
  while IFS=$'\t' read -r added removed file_path; do
    case "$added" in
      commit\ *)
        commit_hash="${added#commit }"
        in_commit=0
        for commit_line in "${commit_hash_arr[@]}"; do
          if [ "$commit_line" = "$commit_hash" ]; then
            in_commit=1
            break
          fi
        done
        continue
        ;;
    esac
    [ "$in_commit" -eq 1 ] || continue
    [ -n "$file_path" ] || continue
    case "$file_path" in
      "${board_root_relative}"|"${board_root_relative}"/*) continue ;;
    esac

    autoflow_code_files_changed_count=$((autoflow_code_files_changed_count + 1))
    if [ "$added" != "-" ]; then
      autoflow_code_insertions_count=$((autoflow_code_insertions_count + added))
    fi
    if [ "$removed" != "-" ]; then
      autoflow_code_deletions_count=$((autoflow_code_deletions_count + removed))
    fi
    if [ -n "$numstat_tsv" ] && [ -f "$numstat_tsv" ]; then
      printf '%s\t%s\t%s\t%s\n' "$commit_hash" "$added" "$removed" "$file_path" >> "$numstat_tsv"
    fi
  done <<EOF
$numstat_stream
EOF

  autoflow_code_volume_count=$((autoflow_code_insertions_count + autoflow_code_deletions_count))
  autoflow_code_net_delta_count=$((autoflow_code_insertions_count - autoflow_code_deletions_count))

  if [ -n "$commit_meta_tsv" ] && [ -n "$numstat_tsv" ] \
      && [ -f "$commit_meta_tsv" ] && [ -f "$numstat_tsv" ] && [ -s "$commit_meta_tsv" ]; then
    agg_output="$(python3 - "$commit_meta_tsv" "$numstat_tsv" <<'PY' 2>/dev/null || true
import sys, json, datetime, collections
meta_path, numstat_path = sys.argv[1], sys.argv[2]
epoch = {}
with open(meta_path) as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 2 and parts[0]:
            try:
                epoch[parts[0]] = int(parts[1])
            except ValueError:
                pass

now_dt = datetime.datetime.now(datetime.timezone.utc)
fourteen_days_ago = int(now_dt.timestamp()) - 14 * 86400
bucket_dates = []
for i in range(13, -1, -1):
    bucket_dates.append((now_dt - datetime.timedelta(days=i)).strftime("%Y-%m-%d"))

code_daily = {d: {"date": d, "insertions": 0, "deletions": 0} for d in bucket_dates}
commit_daily_set = collections.defaultdict(set)
dir_breakdown = collections.defaultdict(lambda: {"insertions": 0, "deletions": 0, "files": 0})

with open(numstat_path) as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 4:
            continue
        h, added_s, removed_s, path = parts[0], parts[1], parts[2], parts[3]
        if not path:
            continue
        e = epoch.get(h)
        if e is None:
            continue
        try:
            added = 0 if added_s == "-" else int(added_s)
            removed = 0 if removed_s == "-" else int(removed_s)
        except ValueError:
            continue
        if e >= fourteen_days_ago:
            d = datetime.datetime.fromtimestamp(e, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
            if d in code_daily:
                code_daily[d]["insertions"] += added
                code_daily[d]["deletions"] += removed
                commit_daily_set[d].add(h)
        top = path.split("/", 1)[0] if "/" in path else path
        if top:
            dir_breakdown[top]["insertions"] += added
            dir_breakdown[top]["deletions"] += removed
            dir_breakdown[top]["files"] += 1

code_daily_arr = [code_daily[d] for d in bucket_dates]
commit_daily_arr = [{"date": d, "count": len(commit_daily_set.get(d, set()))} for d in bucket_dates]
dir_sorted = sorted(dir_breakdown.items(), key=lambda kv: kv[1]["insertions"] + kv[1]["deletions"], reverse=True)[:8]
dir_obj = {k: v for k, v in dir_sorted}

print(json.dumps(code_daily_arr, separators=(",", ":")))
print(json.dumps(dir_obj, separators=(",", ":")))
print(json.dumps(commit_daily_arr, separators=(",", ":")))
PY
)"
    if [ -n "$agg_output" ]; then
      autoflow_code_daily_buckets_14d_json="$(printf '%s' "$agg_output" | sed -n '1p')"
      autoflow_code_dir_breakdown_json="$(printf '%s' "$agg_output" | sed -n '2p')"
      autoflow_commit_daily_buckets_14d_json="$(printf '%s' "$agg_output" | sed -n '3p')"
      [ -n "$autoflow_code_daily_buckets_14d_json" ] || autoflow_code_daily_buckets_14d_json='[]'
      [ -n "$autoflow_code_dir_breakdown_json" ] || autoflow_code_dir_breakdown_json='{}'
      [ -n "$autoflow_commit_daily_buckets_14d_json" ] || autoflow_commit_daily_buckets_14d_json='[]'
    fi
  fi
  [ -z "$commit_meta_tsv" ] || rm -f "$commit_meta_tsv"
  [ -z "$numstat_tsv" ] || rm -f "$numstat_tsv"
}

count_autoflow_token_metrics() {
  local telemetry_runs_file token_result max_row_tokens max_data_age_seconds
  local now_epoch one_hour_ago token_result_json
  local now_epoch max_token_epoch

  autoflow_token_usage_count=0
  autoflow_token_report_count=0
  autoflow_token_usage_1h_count=0
  autoflow_token_usage_24h_count=0
  autoflow_token_input_1h_count=0
  autoflow_token_output_1h_count=0
  autoflow_token_cache_1h_count=0
  autoflow_token_input_24h_count=0
  autoflow_token_output_24h_count=0
  autoflow_token_cache_24h_count=0
  autoflow_token_runner_breakdown_24h_json='{}'
  autoflow_token_model_breakdown_24h_json='{}'
  autoflow_runner_status_24h_json='{}'
  autoflow_token_hourly_24h_json='[]'
  autoflow_runner_tick_timeline_24h_json='[]'
  autoflow_runner_avg_tick_seconds_json='{}'

  command -v jq >/dev/null 2>&1 || return 0
  telemetry_runs_file="$(telemetry_runs_jsonl_path "$project_root")"
  [ -f "$telemetry_runs_file" ] || return 0
  max_row_tokens="${AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS:-100000000}"
  case "$max_row_tokens" in
    ''|*[!0-9]*|0) max_row_tokens=100000000 ;;
  esac

  # Keep metric inflation bounded by summing only recent telemetry rows (default:
  # 1h) so a historical corrupted row is not repeatedly included in current
  # dashboard counts.
  max_data_age_seconds="${AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS:-3600}"
  case "$max_data_age_seconds" in
    ''|*[!0-9]*|0) max_data_age_seconds=3600 ;;
  esac
  now_epoch="$(date -u +%s)"
  max_token_epoch=$((now_epoch - max_data_age_seconds))
  one_hour_ago=$((now_epoch - 3600))
  local twenty_four_hours_ago
  twenty_four_hours_ago=$((now_epoch - 86400))

  token_result_json="$(
    jq -rs --argjson max_row_tokens "$max_row_tokens" --argjson max_token_epoch "$max_token_epoch" --argjson one_hour_ago "$one_hour_ago" --argjson twenty_four_hours_ago "$twenty_four_hours_ago" '
      reduce .[] as $row (
        {
          usage: 0,
          reports: 0,
          usage_1h: 0,
          usage_24h: 0,
          input_1h: 0,
          output_1h: 0,
          cache_1h: 0,
          input_24h: 0,
          output_24h: 0,
          cache_24h: 0,
          runner_24h: {},
          model_24h: {},
          runner_status_24h: {},
          hourly_24h: {},
          runner_timeline_24h: {},
          runner_duration_24h: {}
        };
        if ($row | type) == "object" then
          ($row.token_input // 0 | tonumber? // 0) as $input
          | ($row.token_output // 0 | tonumber? // 0) as $output
          | (($row.token_cache_input // 0 | tonumber? // 0)) as $cache
          | ($input + $output + $cache) as $total
          | (($row.ended_at // $row.started_at // "") | fromdateiso8601? // 0) as $row_ts
          | ($row.runner_id // "unknown") as $runner_id
          | ($row.model // "unknown") as $model
          | ($row.result // "success") as $result
          | if (($row | has("token_input") or has("token_output") or has("token_cache_input"))
              and ($row_ts >= $max_token_epoch)
              and ($input < $max_row_tokens)
              and ($output < $max_row_tokens)
              and ($cache < $max_row_tokens)
              and ($total < $max_row_tokens)) then
              .usage += ($input + $output)
              | .reports += 1
              | if ($row_ts >= $one_hour_ago) then
                  .usage_1h += ($input + $output + $cache)
                  | .input_1h += $input
                  | .output_1h += $output
                  | .cache_1h += $cache
                else
                  .
                end
              | .usage_24h += ($input + $output + $cache)
              | .input_24h += $input
              | .output_24h += $output
              | .cache_24h += $cache
              | .runner_24h[$runner_id] = (.runner_24h[$runner_id] // 0) + ($input + $output)
              | .model_24h[$model] = (.model_24h[$model] // 0) + ($input + $output)
              | if $result == "success" then
                  .runner_status_24h[$runner_id] = {
                    success: ((.runner_status_24h[$runner_id].success // 0) + 1),
                    failure: (.runner_status_24h[$runner_id].failure // 0),
                    timeout: (.runner_status_24h[$runner_id].timeout // 0),
                    last_activity: (if .runner_status_24h[$runner_id].last_activity == null then $row_ts elif $row_ts > .runner_status_24h[$runner_id].last_activity then $row_ts else .runner_status_24h[$runner_id].last_activity end)
                  }
                elif ($result == "failure" or $result == "failed" or $result == "error") then
                  .runner_status_24h[$runner_id] = {
                    success: (.runner_status_24h[$runner_id].success // 0),
                    failure: ((.runner_status_24h[$runner_id].failure // 0) + 1),
                    timeout: (.runner_status_24h[$runner_id].timeout // 0),
                    last_activity: (if .runner_status_24h[$runner_id].last_activity == null then $row_ts elif $row_ts > .runner_status_24h[$runner_id].last_activity then $row_ts else .runner_status_24h[$runner_id].last_activity end)
                  }
                elif $result == "timeout" then
                  .runner_status_24h[$runner_id] = {
                    success: (.runner_status_24h[$runner_id].success // 0),
                    failure: (.runner_status_24h[$runner_id].failure // 0),
                    timeout: ((.runner_status_24h[$runner_id].timeout // 0) + 1),
                    last_activity: (if .runner_status_24h[$runner_id].last_activity == null then $row_ts elif $row_ts > .runner_status_24h[$runner_id].last_activity then $row_ts else .runner_status_24h[$runner_id].last_activity end)
                  }
                else
                  .runner_status_24h[$runner_id] = {
                    success: (.runner_status_24h[$runner_id].success // 0),
                    failure: (.runner_status_24h[$runner_id].failure // 0),
                    timeout: (.runner_status_24h[$runner_id].timeout // 0),
                    last_activity: (if .runner_status_24h[$runner_id].last_activity == null then $row_ts elif $row_ts > .runner_status_24h[$runner_id].last_activity then $row_ts else .runner_status_24h[$runner_id].last_activity end)
                  }
                end
            else
              .
            end
          | (($row.duration_ms // 0 | tonumber? // 0) / 1000) as $duration_s
          | (($row_ts | tonumber? // 0) / 3600 | floor * 3600) as $hour_epoch
          | ($hour_epoch | tostring) as $hour_key
          | if $row_ts >= $twenty_four_hours_ago then
              .runner_duration_24h[$runner_id] = (
                (.runner_duration_24h[$runner_id] // {sum:0, count:0})
                | .sum = (.sum + (if $duration_s > 0 and $duration_s < 86400 then $duration_s else 0 end))
                | .count = (.count + (if $duration_s > 0 and $duration_s < 86400 then 1 else 0 end))
              )
              | (($hour_key + "|" + $runner_id)) as $tk
              | .runner_timeline_24h[$tk] = (
                  (.runner_timeline_24h[$tk] // {hour:$hour_epoch, runner_id:$runner_id, success:0, failure:0, timeout:0})
                  | if $result == "success" then .success = (.success + 1)
                    elif ($result == "failure" or $result == "failed" or $result == "error") then .failure = (.failure + 1)
                    elif $result == "timeout" then .timeout = (.timeout + 1)
                    else . end
                )
              | if (($row | has("token_input") or has("token_output") or has("token_cache_input"))
                  and ($input < $max_row_tokens)
                  and ($output < $max_row_tokens)
                  and ($cache < $max_row_tokens)
                  and ($total < $max_row_tokens)) then
                  .hourly_24h[$hour_key] = (
                    (.hourly_24h[$hour_key] // {hour:$hour_epoch, input:0, output:0, cache:0})
                    | .input = (.input + $input)
                    | .output = (.output + $output)
                    | .cache = (.cache + $cache)
                  )
                else . end
            else . end
        else
          .
        end
      )
      | {
          usage: .usage,
          reports: .reports,
          usage_1h: .usage_1h,
          usage_24h: .usage_24h,
          input_1h: .input_1h,
          output_1h: .output_1h,
          cache_1h: .cache_1h,
          input_24h: .input_24h,
          output_24h: .output_24h,
          cache_24h: .cache_24h,
          runner_24h: .runner_24h,
          model_24h: .model_24h,
          runner_status_24h: .runner_status_24h,
          hourly_24h_arr: (.hourly_24h | to_entries | map(.value) | sort_by(.hour)),
          runner_timeline_24h_arr: (.runner_timeline_24h | to_entries | map(.value) | sort_by(.hour, .runner_id)),
          runner_avg_tick_seconds: (.runner_duration_24h | with_entries(.value = (if .value.count > 0 then (.value.sum / .value.count) else 0 end)))
        }
      | @json
    ' "$telemetry_runs_file" 2>/dev/null || printf '{}'
  )"
  token_result="$(
    printf '%s' "$token_result_json" | jq -r '"\(.usage) \(.reports) \(.usage_1h) \(.usage_24h) \(.input_1h) \(.output_1h) \(.cache_1h) \(.input_24h) \(.output_24h) \(.cache_24h)"'
  )"
  autoflow_token_usage_count="$(printf '%s' "$token_result" | awk '{print $1}')"
  autoflow_token_report_count="$(printf '%s' "$token_result" | awk '{print $2}')"
  autoflow_token_usage_1h_count="$(printf '%s' "$token_result" | awk '{print $3}')"
  autoflow_token_usage_24h_count="$(printf '%s' "$token_result" | awk '{print $4}')"
  autoflow_token_input_1h_count="$(printf '%s' "$token_result" | awk '{print $5}')"
  autoflow_token_output_1h_count="$(printf '%s' "$token_result" | awk '{print $6}')"
  autoflow_token_cache_1h_count="$(printf '%s' "$token_result" | awk '{print $7}')"
  autoflow_token_input_24h_count="$(printf '%s' "$token_result" | awk '{print $8}')"
  autoflow_token_output_24h_count="$(printf '%s' "$token_result" | awk '{print $9}')"
  autoflow_token_cache_24h_count="$(printf '%s' "$token_result" | awk '{print $10}')"
  autoflow_token_runner_breakdown_24h_json="$(printf '%s' "$token_result_json" | jq -cr '.runner_24h')"
  autoflow_token_model_breakdown_24h_json="$(printf '%s' "$token_result_json" | jq -cr '.model_24h')"
  autoflow_runner_status_24h_json="$(printf '%s' "$token_result_json" | jq -c '
    .runner_status_24h // {}
    | with_entries(
        .value |= {
          success: (.success // 0),
          failure: (.failure // 0),
          timeout: (.timeout // 0),
          last_activity: (.last_activity // 0)
        }
      )
  ' 2>/dev/null || printf '{}')"
  case "$autoflow_token_usage_count" in
    ''|*[!0-9]*) autoflow_token_usage_count=0 ;;
  esac
  case "$autoflow_token_report_count" in
    ''|*[!0-9]*) autoflow_token_report_count=0 ;;
  esac
  case "$autoflow_token_usage_1h_count" in
    ''|*[!0-9]*) autoflow_token_usage_1h_count=0 ;;
  esac
  case "$autoflow_token_usage_24h_count" in
    ''|*[!0-9]*) autoflow_token_usage_24h_count=0 ;;
  esac
  case "$autoflow_token_input_1h_count" in
    ''|*[!0-9]*) autoflow_token_input_1h_count=0 ;;
  esac
  case "$autoflow_token_output_1h_count" in
    ''|*[!0-9]*) autoflow_token_output_1h_count=0 ;;
  esac
  case "$autoflow_token_cache_1h_count" in
    ''|*[!0-9]*) autoflow_token_cache_1h_count=0 ;;
  esac
  case "$autoflow_token_input_24h_count" in
    ''|*[!0-9]*) autoflow_token_input_24h_count=0 ;;
  esac
  case "$autoflow_token_output_24h_count" in
    ''|*[!0-9]*) autoflow_token_output_24h_count=0 ;;
  esac
  case "$autoflow_token_cache_24h_count" in
    ''|*[!0-9]*) autoflow_token_cache_24h_count=0 ;;
  esac
  [ -n "$autoflow_token_runner_breakdown_24h_json" ] || autoflow_token_runner_breakdown_24h_json='{}'
  [ -n "$autoflow_token_model_breakdown_24h_json" ] || autoflow_token_model_breakdown_24h_json='{}'
  [ -n "$autoflow_runner_status_24h_json" ] || autoflow_runner_status_24h_json='{}'
  autoflow_token_hourly_24h_json="$(printf '%s' "$token_result_json" | jq -cr '.hourly_24h_arr // []' 2>/dev/null || printf '[]')"
  autoflow_runner_tick_timeline_24h_json="$(printf '%s' "$token_result_json" | jq -cr '.runner_timeline_24h_arr // []' 2>/dev/null || printf '[]')"
  autoflow_runner_avg_tick_seconds_json="$(printf '%s' "$token_result_json" | jq -cr '.runner_avg_tick_seconds // {}' 2>/dev/null || printf '{}')"
  [ -n "$autoflow_token_hourly_24h_json" ] || autoflow_token_hourly_24h_json='[]'
  [ -n "$autoflow_runner_tick_timeline_24h_json" ] || autoflow_runner_tick_timeline_24h_json='[]'
  [ -n "$autoflow_runner_avg_tick_seconds_json" ] || autoflow_runner_avg_tick_seconds_json='{}'
}

sanitize_nonnegative_metric() {
  local value="$1"
  awk -v v="$value" 'BEGIN {
    if (v !~ /^[-+]?[0-9]+([.][0-9]+)?$/ || v != v || v < 0) {
      print 0
    } else {
      printf "%.0f\n", v
    }
  }'
}

sanitize_nonnegative_decimal_metric() {
  local value="$1"
  awk -v v="$value" 'BEGIN {
    if (v !~ /^[-+]?[0-9]+([.][0-9]+)?$/ || v != v || v < 0) {
      print "0.0"
    } else {
      printf "%.1f\n", v
    }
  }'
}

metric_iso_to_epoch() {
  local value="$1"

  [ -n "$value" ] || return 1
  date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$value" '+%s' 2>/dev/null \
    || date -u -d "$value" '+%s' 2>/dev/null
}

ticket_section_metric_field() {
  local file="$1"
  local section="$2"
  local field="$3"

  awk -v target_section="$section" -v target_field="$field" '
    $0 ~ "^## " {
      current = substr($0, 4)
      sub(/[[:space:]]+$/, "", current)
      next
    }
    current == target_section && index($0, "- " target_field ":") == 1 {
      value = substr($0, length("- " target_field ":") + 1)
      sub(/^[[:space:]]+/, "", value)
      print value
      exit
    }
  ' "$file"
}

count_duration_total_24h_metric() {
  local telemetry_runs_file now_epoch

  autoflow_duration_total_24h_seconds=0
  command -v jq >/dev/null 2>&1 || return 0
  telemetry_runs_file="$(telemetry_runs_jsonl_path "$project_root")"
  [ -f "$telemetry_runs_file" ] || return 0
  now_epoch="$(date -u '+%s')"

  autoflow_duration_total_24h_seconds="$(
    jq -rs --argjson since "$((now_epoch - 86400))" '
      reduce .[] as $row (
        0;
        if ($row | type) == "object" then
          (($row.ended_at // $row.started_at // "") | fromdateiso8601? // 0) as $ts
          | ($row.duration_ms // 0 | tonumber? // 0) as $duration_ms
          | if ($ts >= $since and $duration_ms >= 0 and $duration_ms < 86400000) then
              . + $duration_ms
            else
              .
            end
        else
          .
        end
      )
      | (. / 1000 | floor)
    ' "$telemetry_runs_file" 2>/dev/null || printf '0'
  )"
  autoflow_duration_total_24h_seconds="$(sanitize_nonnegative_metric "$autoflow_duration_total_24h_seconds")"
}

count_ticket_time_metrics_from_state_db() {
  local state_db="$1"
  local result lead active ticks rows

  [ -f "$state_db" ] || return 1
  command -v sqlite3 >/dev/null 2>&1 || return 1
  sqlite3 "$state_db" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='ticket_lifecycle'" >/dev/null 2>&1 || return 1

  result="$(
    sqlite3 -separator $'\t' "$state_db" "
      SELECT
        COALESCE(AVG(CASE WHEN lead_seconds IS NOT NULL AND lead_seconds >= 0 THEN lead_seconds END), 0),
        COALESCE(AVG(CASE WHEN active_seconds IS NOT NULL AND active_seconds >= 0 THEN active_seconds END), 0),
        COALESCE(AVG(CASE WHEN tick_count IS NOT NULL AND tick_count >= 0 THEN tick_count END), 0),
        COUNT(*)
      FROM ticket_lifecycle
      WHERE status = 'done';
    " 2>/dev/null || true
  )"
  [ -n "$result" ] || return 1
  IFS=$'\t' read -r lead active ticks rows <<EOF
$result
EOF
  case "$rows" in
    ''|*[!0-9]*|0) return 1 ;;
  esac

  autoflow_avg_lead_seconds="$(sanitize_nonnegative_metric "$lead")"
  autoflow_avg_active_seconds="$(sanitize_nonnegative_metric "$active")"
  autoflow_avg_ticks_per_done_ticket="$(sanitize_nonnegative_decimal_metric "$ticks")"
  return 0
}

count_ticket_time_metrics_from_markdown() {
  local done_root ticket_file lead_sum active_sum tick_sum lead_count active_count tick_count
  local active ticks started_epoch updated_epoch started_at updated_at lead

  lead_sum=0
  active_sum=0
  tick_sum=0
  lead_count=0
  active_count=0
  tick_count=0
  done_root="${board_root}/tickets/done"
  [ -d "$done_root" ] || return 0

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    active="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Time Used Seconds")"
    case "$active" in
      ''|*[!0-9]*) active=0 ;;
    esac
    active_sum=$((active_sum + active))
    active_count=$((active_count + 1))

    ticks="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Tick Count")"
    case "$ticks" in
      ''|*[!0-9]*) ticks=0 ;;
    esac
    tick_sum=$((tick_sum + ticks))
    tick_count=$((tick_count + 1))

    started_epoch="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Started Epoch")"
    updated_epoch="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Updated Epoch")"
    if [ -z "$updated_epoch" ]; then
      started_at="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Started At")"
      updated_at="$(ticket_section_metric_field "$ticket_file" "Goal Runtime" "Updated At")"
      case "$started_epoch" in
        ''|*[!0-9]*) started_epoch="$(metric_iso_to_epoch "$started_at" 2>/dev/null || true)" ;;
      esac
      updated_epoch="$(metric_iso_to_epoch "$updated_at" 2>/dev/null || true)"
    fi
    case "$started_epoch:$updated_epoch" in
      *[!0-9:]*|:*) ;;
      *)
        if [ "$updated_epoch" -ge "$started_epoch" ]; then
          lead=$((updated_epoch - started_epoch))
          lead_sum=$((lead_sum + lead))
          lead_count=$((lead_count + 1))
        fi
        ;;
    esac
  done <<EOF
$(find "$done_root" -type f \( -name 'Todo-*.md' -o -name 'tickets_*.md' \) -print 2>/dev/null | sort)
EOF

  if [ "$lead_count" -gt 0 ]; then
    autoflow_avg_lead_seconds="$((lead_sum / lead_count))"
  fi
  if [ "$active_count" -gt 0 ]; then
    autoflow_avg_active_seconds="$((active_sum / active_count))"
  fi
  if [ "$tick_count" -gt 0 ]; then
    autoflow_avg_ticks_per_done_ticket="$(awk -v n="$tick_sum" -v d="$tick_count" 'BEGIN { printf "%.1f", n / d }')"
  fi
}

count_ticket_time_metrics() {
  autoflow_avg_lead_seconds=0
  autoflow_avg_active_seconds=0
  autoflow_avg_ticks_per_done_ticket="0.0"
  autoflow_duration_total_24h_seconds=0

  if ! count_ticket_time_metrics_from_state_db "${board_root}/state.db"; then
    count_ticket_time_metrics_from_markdown
  fi
  count_duration_total_24h_metric

  autoflow_avg_lead_seconds="$(sanitize_nonnegative_metric "$autoflow_avg_lead_seconds")"
  autoflow_avg_active_seconds="$(sanitize_nonnegative_metric "$autoflow_avg_active_seconds")"
  autoflow_avg_ticks_per_done_ticket="$(sanitize_nonnegative_decimal_metric "$autoflow_avg_ticks_per_done_ticket")"
  autoflow_duration_total_24h_seconds="$(sanitize_nonnegative_metric "$autoflow_duration_total_24h_seconds")"
}

load_heavy_metrics_cache() {
  local cache_file="$1"
  local key value

  [ -f "$cache_file" ] || return 1
  while IFS='=' read -r key value; do
      case "$key" in
      autoflow_commit_count|autoflow_code_files_changed_count|autoflow_code_insertions_count|autoflow_code_deletions_count|autoflow_code_volume_count|autoflow_code_net_delta_count|autoflow_token_usage_count|autoflow_token_report_count|autoflow_token_usage_1h_count|autoflow_token_usage_24h_count|autoflow_token_input_1h_count|autoflow_token_output_1h_count|autoflow_token_cache_1h_count|autoflow_token_input_24h_count|autoflow_token_output_24h_count|autoflow_token_cache_24h_count|autoflow_commit_count_24h|autoflow_commit_auto_count_24h|autoflow_commit_manual_count_24h)
        case "$value" in
          ''|*[!0-9]*) value=0 ;;
        esac
        printf -v "$key" '%s' "$value"
        ;;
      autoflow_token_runner_breakdown_24h_json|autoflow_token_model_breakdown_24h_json|autoflow_runner_status_24h_json|autoflow_commit_recent_subjects_json|autoflow_code_daily_buckets_14d_json|autoflow_code_dir_breakdown_json|autoflow_commit_daily_buckets_14d_json|autoflow_token_hourly_24h_json|autoflow_runner_tick_timeline_24h_json|autoflow_runner_avg_tick_seconds_json)
        printf -v "$key" '%s' "$value"
        ;;
    esac
  done < "$cache_file"
}

write_heavy_metrics_cache() {
  local cache_file="$1"
  local tmp_file

  mkdir -p "$(dirname "$cache_file")"
  tmp_file="${cache_file}.$$"
  {
    printf 'autoflow_commit_count=%s\n' "$autoflow_commit_count"
    printf 'autoflow_code_files_changed_count=%s\n' "$autoflow_code_files_changed_count"
    printf 'autoflow_code_insertions_count=%s\n' "$autoflow_code_insertions_count"
    printf 'autoflow_code_deletions_count=%s\n' "$autoflow_code_deletions_count"
    printf 'autoflow_code_volume_count=%s\n' "$autoflow_code_volume_count"
    printf 'autoflow_code_net_delta_count=%s\n' "$autoflow_code_net_delta_count"
    printf 'autoflow_token_usage_count=%s\n' "$autoflow_token_usage_count"
    printf 'autoflow_token_report_count=%s\n' "$autoflow_token_report_count"
    printf 'autoflow_token_usage_1h_count=%s\n' "$autoflow_token_usage_1h_count"
    printf 'autoflow_token_usage_24h_count=%s\n' "$autoflow_token_usage_24h_count"
    printf 'autoflow_token_input_1h_count=%s\n' "$autoflow_token_input_1h_count"
    printf 'autoflow_token_output_1h_count=%s\n' "$autoflow_token_output_1h_count"
    printf 'autoflow_token_cache_1h_count=%s\n' "$autoflow_token_cache_1h_count"
    printf 'autoflow_token_input_24h_count=%s\n' "$autoflow_token_input_24h_count"
    printf 'autoflow_token_output_24h_count=%s\n' "$autoflow_token_output_24h_count"
    printf 'autoflow_token_cache_24h_count=%s\n' "$autoflow_token_cache_24h_count"
    printf 'autoflow_token_runner_breakdown_24h_json=%s\n' "$autoflow_token_runner_breakdown_24h_json"
    printf 'autoflow_token_model_breakdown_24h_json=%s\n' "$autoflow_token_model_breakdown_24h_json"
    printf 'autoflow_runner_status_24h_json=%s\n' "$autoflow_runner_status_24h_json"
    printf 'autoflow_commit_count_24h=%s\n' "$autoflow_commit_count_24h"
    printf 'autoflow_commit_auto_count_24h=%s\n' "$autoflow_commit_auto_count_24h"
    printf 'autoflow_commit_manual_count_24h=%s\n' "$autoflow_commit_manual_count_24h"
    printf 'autoflow_commit_recent_subjects_json=%s\n' "$autoflow_commit_recent_subjects_json"
    printf 'autoflow_code_daily_buckets_14d_json=%s\n' "$autoflow_code_daily_buckets_14d_json"
    printf 'autoflow_code_dir_breakdown_json=%s\n' "$autoflow_code_dir_breakdown_json"
    printf 'autoflow_commit_daily_buckets_14d_json=%s\n' "$autoflow_commit_daily_buckets_14d_json"
    printf 'autoflow_token_hourly_24h_json=%s\n' "$autoflow_token_hourly_24h_json"
    printf 'autoflow_runner_tick_timeline_24h_json=%s\n' "$autoflow_runner_tick_timeline_24h_json"
    printf 'autoflow_runner_avg_tick_seconds_json=%s\n' "$autoflow_runner_avg_tick_seconds_json"
  } > "$tmp_file"
  mv "$tmp_file" "$cache_file"
}

count_heavy_metrics_with_cache() {
  local cache_file lock_dir ttl_seconds lock_acquired=false

  cache_file="$(autoflow_cache_file "$board_root" "metrics-heavy")"
  lock_dir="$(autoflow_lock_dir "$board_root" "metrics-heavy")"
  ttl_seconds="${AUTOFLOW_METRICS_HEAVY_CACHE_TTL_SECONDS:-10}"
  metrics_heavy_cache_file="$cache_file"
  metrics_heavy_cache_age_seconds="$(autoflow_cache_age_seconds "$cache_file")"

  if autoflow_cache_is_fresh "$cache_file" "$ttl_seconds" && load_heavy_metrics_cache "$cache_file"; then
    metrics_heavy_cache_status="hit"
    metrics_heavy_cache_age_seconds="$(autoflow_cache_age_seconds "$cache_file")"
    return 0
  fi

  if autoflow_try_acquire_lock "$lock_dir"; then
    lock_acquired=true
    count_autoflow_commit_metrics
    count_autoflow_token_metrics
    write_heavy_metrics_cache "$cache_file"
    metrics_heavy_cache_status="refreshed"
    metrics_heavy_cache_age_seconds=0
    autoflow_release_lock "$lock_dir"
    return 0
  fi

  if [ -f "$cache_file" ] && load_heavy_metrics_cache "$cache_file"; then
    metrics_heavy_cache_status="stale_lock_busy"
    metrics_heavy_cache_age_seconds="$(autoflow_cache_age_seconds "$cache_file")"
    return 0
  fi

  metrics_heavy_cache_status="partial_lock_busy_no_cache"
  metrics_heavy_cache_age_seconds=999999
  autoflow_commit_count=0
  autoflow_code_files_changed_count=0
  autoflow_code_insertions_count=0
  autoflow_code_deletions_count=0
  autoflow_code_volume_count=0
  autoflow_code_net_delta_count=0
  autoflow_token_usage_count=0
  autoflow_token_report_count=0
  autoflow_token_usage_1h_count=0
  autoflow_token_usage_24h_count=0
  autoflow_token_input_1h_count=0
  autoflow_token_output_1h_count=0
  autoflow_token_cache_1h_count=0
  autoflow_token_input_24h_count=0
  autoflow_token_output_24h_count=0
  autoflow_token_cache_24h_count=0
  autoflow_token_runner_breakdown_24h_json='{}'
  autoflow_token_model_breakdown_24h_json='{}'
  autoflow_runner_status_24h_json='{}'
  autoflow_commit_count_24h=0
  autoflow_commit_auto_count_24h=0
  autoflow_commit_manual_count_24h=0
  autoflow_commit_recent_subjects_json='[]'
  autoflow_code_daily_buckets_14d_json='[]'
  autoflow_code_dir_breakdown_json='{}'
  autoflow_commit_daily_buckets_14d_json='[]'
  autoflow_token_hourly_24h_json='[]'
  autoflow_runner_tick_timeline_24h_json='[]'
  autoflow_runner_avg_tick_seconds_json='{}'
  [ "$lock_acquired" = "true" ] && autoflow_release_lock "$lock_dir"
}

write="false"
positionals=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --write)
      write="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      positionals+=("$1")
      ;;
  esac
  shift || true
done

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

if ! board_is_initialized "$board_root"; then
  printf 'status=blocked\n'
  printf 'reason=board_not_initialized\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  exit 0
fi

timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
metrics_root="${board_root}/metrics"
snapshot_file="${metrics_root}/daily.jsonl"

spec_backlog_count="$(count_active_specs "$(spec_root_path "$board_root")")"
spec_done_count="$(count_matching_files "${board_root}/tickets/done" 'prd_*.md')"
spec_total="$((spec_backlog_count + spec_done_count))"

ticket_todo_count="$(count_matching_files "${board_root}/tickets/todo" 'tickets_*.md')"
ticket_inprogress_count="$(count_matching_files "${board_root}/tickets/inprogress" 'tickets_*.md')"
ticket_planning_count="$(count_ticket_stage "${board_root}/tickets/inprogress" "planning")"
ticket_ready_to_merge_count="$(count_matching_files "${board_root}/tickets/ready-to-merge" 'tickets_*.md')"
ticket_merge_blocked_count="$(count_matching_files "${board_root}/tickets/merge-blocked" 'tickets_*.md')"
ticket_done_count="$(count_matching_files "${board_root}/tickets/done" 'tickets_*.md')"
# Fail flow embeds the full ticket body inside tickets/inbox/order_*_retry_*.md
# and removes the inprogress ticket. tickets/reject/ has been removed and
# done/<key>/ stays purely successful. Legacy done/<key>/reject_*.md history is
# still counted so older boards keep their historical reject_count.
ticket_done_reject_count="$(count_matching_files "${board_root}/tickets/done" 'reject_*.md')"
inbox_retry_pending_count="$(count_matching_files "${board_root}/tickets/inbox" 'order_*_retry_*.md')"
reject_count="$((ticket_done_reject_count + inbox_retry_pending_count))"
ticket_total="$((ticket_todo_count + ticket_inprogress_count + ticket_ready_to_merge_count + ticket_merge_blocked_count + ticket_done_count))"
active_ticket_count="$((ticket_todo_count + ticket_inprogress_count + ticket_ready_to_merge_count + ticket_merge_blocked_count))"
ticket_owner_active_count="$ticket_inprogress_count"

handoff_count="$(count_matching_files "${board_root}/conversations" 'spec-handoff.md')"
completion_rate_percent="$(percent_value "$ticket_done_count" "$ticket_total")"
count_runner_states

autoflow_commit_count=0
autoflow_code_files_changed_count=0
autoflow_code_insertions_count=0
autoflow_code_deletions_count=0
autoflow_code_volume_count=0
autoflow_code_net_delta_count=0
autoflow_token_usage_count=0
autoflow_token_report_count=0
autoflow_token_usage_1h_count=0
autoflow_token_usage_24h_count=0
autoflow_token_input_1h_count=0
autoflow_token_output_1h_count=0
autoflow_token_cache_1h_count=0
autoflow_token_input_24h_count=0
autoflow_token_output_24h_count=0
autoflow_token_cache_24h_count=0
autoflow_token_runner_breakdown_24h_json=""
autoflow_token_model_breakdown_24h_json=""
autoflow_runner_status_24h_json=""
autoflow_commit_count_24h=0
autoflow_commit_auto_count_24h=0
autoflow_commit_manual_count_24h=0
autoflow_commit_recent_subjects_json=""
autoflow_code_daily_buckets_14d_json=""
autoflow_code_dir_breakdown_json=""
autoflow_commit_daily_buckets_14d_json=""
autoflow_token_hourly_24h_json=""
autoflow_runner_tick_timeline_24h_json=""
autoflow_runner_avg_tick_seconds_json=""
metrics_heavy_cache_status="unknown"
metrics_heavy_cache_age_seconds=999999
metrics_heavy_cache_file=""
count_heavy_metrics_with_cache
count_ticket_time_metrics

if [ "$write" = "true" ]; then
  write_snapshot \
    "$metrics_root" \
    "$snapshot_file" \
    "$timestamp" \
    "$project_root" \
    "$board_root" \
    "$spec_total" \
    "$ticket_total" \
    "$ticket_done_count" \
    "$active_ticket_count" \
    "$reject_count" \
    "$handoff_count" \
    "$runner_total_count" \
    "$runner_running_count" \
    "$runner_idle_count" \
    "$runner_stopped_count" \
    "$runner_blocked_count" \
    "$runner_enabled_count" \
    "$runner_disabled_count" \
    "$runner_invalid_config_count" \
    "$runner_artifact_ok_count" \
    "$runner_artifact_warning_count" \
    "$runner_artifact_not_applicable_count" \
    "$autoflow_commit_count" \
    "$autoflow_code_files_changed_count" \
    "$autoflow_code_insertions_count" \
    "$autoflow_code_deletions_count" \
    "$autoflow_code_volume_count" \
    "$autoflow_code_net_delta_count" \
    "$autoflow_token_usage_count" \
    "$autoflow_token_report_count" \
    "$autoflow_token_usage_1h_count" \
    "$autoflow_token_usage_24h_count" \
    "$autoflow_token_input_1h_count" \
    "$autoflow_token_output_1h_count" \
    "$autoflow_token_cache_1h_count" \
    "$autoflow_token_input_24h_count" \
    "$autoflow_token_output_24h_count" \
    "$autoflow_token_cache_24h_count" \
    "$autoflow_token_runner_breakdown_24h_json" \
    "$autoflow_token_model_breakdown_24h_json" \
    "$autoflow_runner_status_24h_json" \
    "$autoflow_commit_count_24h" \
    "$autoflow_commit_auto_count_24h" \
    "$autoflow_commit_manual_count_24h" \
    "$autoflow_commit_recent_subjects_json" \
    "$autoflow_code_daily_buckets_14d_json" \
    "$autoflow_code_dir_breakdown_json" \
    "$autoflow_commit_daily_buckets_14d_json" \
    "$autoflow_token_hourly_24h_json" \
    "$autoflow_runner_tick_timeline_24h_json" \
    "$autoflow_runner_avg_tick_seconds_json" \
    "$autoflow_avg_lead_seconds" \
    "$autoflow_avg_active_seconds" \
    "$autoflow_avg_ticks_per_done_ticket" \
    "$autoflow_duration_total_24h_seconds" \
    "$completion_rate_percent"
fi

printf 'status=ok\n'
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'metrics_root=%s\n' "$metrics_root"
printf 'written=%s\n' "$write"
printf 'snapshot_file=%s\n' "$snapshot_file"
printf 'timestamp=%s\n' "$timestamp"
printf 'metrics_heavy_cache_status=%s\n' "$metrics_heavy_cache_status"
printf 'metrics_heavy_cache_age_seconds=%s\n' "$metrics_heavy_cache_age_seconds"
printf 'metrics_heavy_cache_file=%s\n' "$metrics_heavy_cache_file"
printf 'spec_backlog_count=%s\n' "$spec_backlog_count"
printf 'spec_done_count=%s\n' "$spec_done_count"
printf 'spec_total=%s\n' "$spec_total"
printf 'ticket_total=%s\n' "$ticket_total"
printf 'ticket_todo_count=%s\n' "$ticket_todo_count"
printf 'ticket_inprogress_count=%s\n' "$ticket_inprogress_count"
printf 'ticket_planning_count=%s\n' "$ticket_planning_count"
printf 'ticket_ready_to_merge_count=%s\n' "$ticket_ready_to_merge_count"
printf 'ticket_merge_blocked_count=%s\n' "$ticket_merge_blocked_count"
printf 'ticket_done_count=%s\n' "$ticket_done_count"
printf 'reject_count=%s\n' "$reject_count"
printf 'inbox_retry_pending_count=%s\n' "$inbox_retry_pending_count"
printf 'ticket_done_reject_count=%s\n' "$ticket_done_reject_count"
printf 'active_ticket_count=%s\n' "$active_ticket_count"
printf 'ticket_owner_active_count=%s\n' "$ticket_owner_active_count"
printf 'handoff_count=%s\n' "$handoff_count"
printf 'runner_total_count=%s\n' "$runner_total_count"
printf 'runner_running_count=%s\n' "$runner_running_count"
printf 'runner_idle_count=%s\n' "$runner_idle_count"
printf 'runner_stopped_count=%s\n' "$runner_stopped_count"
printf 'runner_blocked_count=%s\n' "$runner_blocked_count"
printf 'runner_enabled_count=%s\n' "$runner_enabled_count"
printf 'runner_disabled_count=%s\n' "$runner_disabled_count"
printf 'runner_invalid_config_count=%s\n' "$runner_invalid_config_count"
printf 'runner_artifact_ok_count=%s\n' "$runner_artifact_ok_count"
printf 'runner_artifact_warning_count=%s\n' "$runner_artifact_warning_count"
printf 'runner_artifact_not_applicable_count=%s\n' "$runner_artifact_not_applicable_count"
printf 'autoflow_commit_count=%s\n' "$autoflow_commit_count"
printf 'autoflow_code_files_changed_count=%s\n' "$autoflow_code_files_changed_count"
printf 'autoflow_code_insertions_count=%s\n' "$autoflow_code_insertions_count"
printf 'autoflow_code_deletions_count=%s\n' "$autoflow_code_deletions_count"
printf 'autoflow_code_volume_count=%s\n' "$autoflow_code_volume_count"
printf 'autoflow_code_net_delta_count=%s\n' "$autoflow_code_net_delta_count"
printf 'autoflow_token_usage_count=%s\n' "$autoflow_token_usage_count"
printf 'autoflow_token_report_count=%s\n' "$autoflow_token_report_count"
printf 'autoflow_token_usage_1h_count=%s\n' "$autoflow_token_usage_1h_count"
printf 'autoflow_token_usage_24h_count=%s\n' "$autoflow_token_usage_24h_count"
printf 'autoflow_token_input_1h_count=%s\n' "$autoflow_token_input_1h_count"
printf 'autoflow_token_output_1h_count=%s\n' "$autoflow_token_output_1h_count"
printf 'autoflow_token_cache_1h_count=%s\n' "$autoflow_token_cache_1h_count"
printf 'autoflow_token_input_24h_count=%s\n' "$autoflow_token_input_24h_count"
printf 'autoflow_token_output_24h_count=%s\n' "$autoflow_token_output_24h_count"
printf 'autoflow_token_cache_24h_count=%s\n' "$autoflow_token_cache_24h_count"
printf 'autoflow_token_runner_breakdown_24h_json=%s\n' "$autoflow_token_runner_breakdown_24h_json"
printf 'autoflow_token_model_breakdown_24h_json=%s\n' "$autoflow_token_model_breakdown_24h_json"
printf 'autoflow_runner_status_24h_json=%s\n' "$autoflow_runner_status_24h_json"
printf 'autoflow_commit_count_24h=%s\n' "$autoflow_commit_count_24h"
printf 'autoflow_commit_auto_count_24h=%s\n' "$autoflow_commit_auto_count_24h"
printf 'autoflow_commit_manual_count_24h=%s\n' "$autoflow_commit_manual_count_24h"
printf 'autoflow_commit_recent_subjects_json=%s\n' "$autoflow_commit_recent_subjects_json"
printf 'autoflow_code_daily_buckets_14d_json=%s\n' "$autoflow_code_daily_buckets_14d_json"
printf 'autoflow_code_dir_breakdown_json=%s\n' "$autoflow_code_dir_breakdown_json"
printf 'autoflow_commit_daily_buckets_14d_json=%s\n' "$autoflow_commit_daily_buckets_14d_json"
printf 'autoflow_token_hourly_24h_json=%s\n' "$autoflow_token_hourly_24h_json"
printf 'autoflow_runner_tick_timeline_24h_json=%s\n' "$autoflow_runner_tick_timeline_24h_json"
printf 'autoflow_runner_avg_tick_seconds_json=%s\n' "$autoflow_runner_avg_tick_seconds_json"
printf 'autoflow_avg_lead_seconds=%s\n' "$autoflow_avg_lead_seconds"
printf 'autoflow_avg_active_seconds=%s\n' "$autoflow_avg_active_seconds"
printf 'autoflow_avg_ticks_per_done_ticket=%s\n' "$autoflow_avg_ticks_per_done_ticket"
printf 'autoflow_duration_total_24h_seconds=%s\n' "$autoflow_duration_total_24h_seconds"
printf 'completion_rate_percent=%s\n' "$completion_rate_percent"
