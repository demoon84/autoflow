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
  local verifier_pass_count="${11}"
  local verifier_fail_count="${12}"
  local handoff_count="${13}"
  local runner_total_count="${14}"
  local runner_running_count="${15}"
  local runner_idle_count="${16}"
  local runner_stopped_count="${17}"
  local runner_blocked_count="${18}"
  local runner_enabled_count="${19}"
  local runner_disabled_count="${20}"
  local runner_invalid_config_count="${21}"
  local runner_artifact_ok_count="${22}"
  local runner_artifact_warning_count="${23}"
  local runner_artifact_not_applicable_count="${24}"
  local autoflow_commit_count="${25}"
  local autoflow_code_files_changed_count="${26}"
  local autoflow_code_insertions_count="${27}"
  local autoflow_code_deletions_count="${28}"
  local autoflow_code_volume_count="${29}"
  local autoflow_token_usage_count="${30}"
  local autoflow_token_report_count="${31}"
  local verification_pass_rate_percent="${32}"
  local completion_rate_percent="${33}"
  local escaped_project escaped_board

  mkdir -p "$metrics_root"
  escaped_project="$(printf '%s' "$project_root" | json_escape)"
  escaped_board="$(printf '%s' "$board_root" | json_escape)"
  printf '{"timestamp":"%s","project_root":"%s","board_root":"%s","spec_total":%s,"ticket_total":%s,"ticket_done_count":%s,"active_ticket_count":%s,"reject_count":%s,"verifier_pass_count":%s,"verifier_fail_count":%s,"handoff_count":%s,"runner_total_count":%s,"runner_running_count":%s,"runner_idle_count":%s,"runner_stopped_count":%s,"runner_blocked_count":%s,"runner_enabled_count":%s,"runner_disabled_count":%s,"runner_invalid_config_count":%s,"runner_artifact_ok_count":%s,"runner_artifact_warning_count":%s,"runner_artifact_not_applicable_count":%s,"autoflow_commit_count":%s,"autoflow_code_files_changed_count":%s,"autoflow_code_insertions_count":%s,"autoflow_code_deletions_count":%s,"autoflow_code_volume_count":%s,"autoflow_token_usage_count":%s,"autoflow_token_report_count":%s,"verification_pass_rate_percent":%s,"completion_rate_percent":%s}\n' \
    "$timestamp" \
    "$escaped_project" \
    "$escaped_board" \
    "$spec_total" \
    "$ticket_total" \
    "$ticket_done_count" \
    "$active_ticket_count" \
    "$reject_count" \
    "$verifier_pass_count" \
    "$verifier_fail_count" \
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
    "$autoflow_token_usage_count" \
    "$autoflow_token_report_count" \
    "$verification_pass_rate_percent" \
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
            ticket-owner|owner|ticket|planner|plan|todo|verifier|wiki-maintainer|wiki|merge|merge-bot|coordinator|coord|doctor|diagnose|watcher|self-improve|self_improve|selfimprove) ;;
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
  local git_root done_ticket_paths commit_hashes commit_hash added removed file_path board_root_relative
  local numstat_stream in_commit

  autoflow_commit_count=0
  autoflow_code_files_changed_count=0
  autoflow_code_insertions_count=0
  autoflow_code_deletions_count=0
  autoflow_code_volume_count=0

  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$git_root" ] || return 0
  [ -d "${board_root}/tickets/done" ] || return 0

  board_root_relative="${board_root#${git_root}/}"
  done_ticket_paths="$(find "${board_root}/tickets/done" -type f -name 'tickets_*.md' -print | sort)"
  [ -n "$done_ticket_paths" ] || return 0

  commit_hashes="$(git -C "$git_root" log --diff-filter=A --format='%H' -- $done_ticket_paths 2>/dev/null | awk 'NF && !seen[$0]++')"
  [ -n "$commit_hashes" ] || return 0

  autoflow_commit_count="$(printf '%s\n' "$commit_hashes" | awk 'NF { count += 1 } END { print count + 0 }')"
  numstat_stream="$(git -C "$git_root" show --numstat --format='commit %H' $commit_hashes 2>/dev/null || true)"

  in_commit=0
  while IFS=$'\t' read -r added removed file_path; do
    case "$added" in
      commit\ *)
        commit_hash="${added#commit }"
        case "$commit_hashes" in
          *"$commit_hash"*) in_commit=1 ;;
          *) in_commit=0 ;;
        esac
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
  done <<EOF
$numstat_stream
EOF

  autoflow_code_volume_count=$((autoflow_code_insertions_count + autoflow_code_deletions_count))
}

count_autoflow_token_metrics() {
  local telemetry_runs_file token_result

  autoflow_token_usage_count=0
  autoflow_token_report_count=0

  command -v jq >/dev/null 2>&1 || return 0
  telemetry_runs_file="$(telemetry_runs_jsonl_path "$project_root")"
  [ -f "$telemetry_runs_file" ] || return 0

  token_result="$(
    jq -rs '
      reduce .[] as $row (
        {usage: 0, reports: 0};
        if ($row | type) == "object" then
          .usage += (($row.token_input // 0) + ($row.token_output // 0) | tonumber? // 0)
          | .reports += (if ($row | has("token_input") or has("token_output")) then 1 else 0 end)
        else
          .
        end
      )
      | "\(.usage) \(.reports)"
    ' "$telemetry_runs_file" 2>/dev/null || printf '0 0'
  )"
  autoflow_token_usage_count="${token_result%% *}"
  autoflow_token_report_count="${token_result##* }"
  case "$autoflow_token_usage_count" in
    ''|*[!0-9]*) autoflow_token_usage_count=0 ;;
  esac
  case "$autoflow_token_report_count" in
    ''|*[!0-9]*) autoflow_token_report_count=0 ;;
  esac
}

count_latest_verifier_outcomes() {
  local logs_root="$1"

  if [ ! -d "$logs_root" ]; then
    printf '0 0\n'
    return 0
  fi

  find "$logs_root" -maxdepth 1 -type f \( -name 'verifier_*_pass.md' -o -name 'verifier_*_fail.md' \) -print | awk '
    {
      filename = $0
      sub(/^.*\//, "", filename)
      part_count = split(filename, parts, "_")
      if (part_count < 4) {
        next
      }

      ticket_id = parts[2]
      outcome = parts[part_count]
      sub(/\.md$/, "", outcome)
      if (outcome != "pass" && outcome != "fail") {
        next
      }

      outcome_timestamp = parts[3]
      for (part_index = 4; part_index < part_count; part_index += 1) {
        outcome_timestamp = outcome_timestamp "_" parts[part_index]
      }

      if (!(ticket_id in latest_timestamp) || outcome_timestamp > latest_timestamp[ticket_id]) {
        latest_timestamp[ticket_id] = outcome_timestamp
        latest_outcome[ticket_id] = outcome
      }
    }
    END {
      pass_count = 0
      fail_count = 0
      for (ticket_id in latest_outcome) {
        if (latest_outcome[ticket_id] == "pass") {
          pass_count += 1
        } else if (latest_outcome[ticket_id] == "fail") {
          fail_count += 1
        }
      }
      printf "%d %d\n", pass_count, fail_count
    }
  '
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
ticket_verifier_count="$(count_matching_files "${board_root}/tickets/verifier" 'tickets_*.md')"
ticket_done_count="$(count_matching_files "${board_root}/tickets/done" 'tickets_*.md')"
ticket_reject_count="$(count_matching_files "${board_root}/tickets/reject" 'reject_*.md')"
ticket_done_reject_count="$(count_matching_files "${board_root}/tickets/done" 'reject_*.md')"
reject_count="$((ticket_reject_count + ticket_done_reject_count))"
ticket_total="$((ticket_todo_count + ticket_inprogress_count + ticket_ready_to_merge_count + ticket_merge_blocked_count + ticket_verifier_count + ticket_done_count + ticket_reject_count))"
active_ticket_count="$((ticket_todo_count + ticket_inprogress_count + ticket_ready_to_merge_count + ticket_merge_blocked_count + ticket_verifier_count))"
ticket_owner_active_count="$ticket_inprogress_count"

verifier_outcome_counts="$(count_latest_verifier_outcomes "${board_root}/logs")"
verifier_pass_count="${verifier_outcome_counts%% *}"
verifier_fail_count="${verifier_outcome_counts##* }"
verifier_total="$((verifier_pass_count + verifier_fail_count))"
handoff_count="$(count_matching_files "${board_root}/conversations" 'spec-handoff.md')"
verification_pass_rate_percent="$(percent_value "$verifier_pass_count" "$verifier_total")"
completion_rate_percent="$(percent_value "$ticket_done_count" "$ticket_total")"
count_runner_states
count_autoflow_commit_metrics
count_autoflow_token_metrics

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
    "$verifier_pass_count" \
    "$verifier_fail_count" \
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
    "$autoflow_token_usage_count" \
    "$autoflow_token_report_count" \
    "$verification_pass_rate_percent" \
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
printf 'spec_backlog_count=%s\n' "$spec_backlog_count"
printf 'spec_done_count=%s\n' "$spec_done_count"
printf 'spec_total=%s\n' "$spec_total"
printf 'ticket_total=%s\n' "$ticket_total"
printf 'ticket_todo_count=%s\n' "$ticket_todo_count"
printf 'ticket_inprogress_count=%s\n' "$ticket_inprogress_count"
printf 'ticket_planning_count=%s\n' "$ticket_planning_count"
printf 'ticket_ready_to_merge_count=%s\n' "$ticket_ready_to_merge_count"
printf 'ticket_merge_blocked_count=%s\n' "$ticket_merge_blocked_count"
printf 'ticket_verifier_count=%s\n' "$ticket_verifier_count"
printf 'ticket_done_count=%s\n' "$ticket_done_count"
printf 'reject_count=%s\n' "$reject_count"
printf 'active_ticket_count=%s\n' "$active_ticket_count"
printf 'ticket_owner_active_count=%s\n' "$ticket_owner_active_count"
printf 'verifier_pass_count=%s\n' "$verifier_pass_count"
printf 'verifier_fail_count=%s\n' "$verifier_fail_count"
printf 'verifier_total=%s\n' "$verifier_total"
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
printf 'autoflow_token_usage_count=%s\n' "$autoflow_token_usage_count"
printf 'autoflow_token_report_count=%s\n' "$autoflow_token_report_count"
printf 'verification_pass_rate_percent=%s\n' "$verification_pass_rate_percent"
printf 'completion_rate_percent=%s\n' "$completion_rate_percent"
