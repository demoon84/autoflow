#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(cd "$(dirname "$0")" && pwd)/../runtime/runner-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  metrics-project.sh [project-root] [board-dir-name] [--write]

Examples:
  metrics-project.sh /path/to/project
  metrics-project.sh /path/to/project autoflow --write
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
  local verification_pass_rate_percent="${25}"
  local completion_rate_percent="${26}"
  local escaped_project escaped_board

  mkdir -p "$metrics_root"
  escaped_project="$(printf '%s' "$project_root" | json_escape)"
  escaped_board="$(printf '%s' "$board_root" | json_escape)"
  printf '{"timestamp":"%s","project_root":"%s","board_root":"%s","spec_total":%s,"ticket_total":%s,"ticket_done_count":%s,"active_ticket_count":%s,"reject_count":%s,"verifier_pass_count":%s,"verifier_fail_count":%s,"handoff_count":%s,"runner_total_count":%s,"runner_running_count":%s,"runner_idle_count":%s,"runner_stopped_count":%s,"runner_blocked_count":%s,"runner_enabled_count":%s,"runner_disabled_count":%s,"runner_invalid_config_count":%s,"runner_artifact_ok_count":%s,"runner_artifact_warning_count":%s,"runner_artifact_not_applicable_count":%s,"verification_pass_rate_percent":%s,"completion_rate_percent":%s}\n' \
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
  local config_path="${board_root}/runners/config.toml"
  local config_stream line in_runner id role status enabled invalid_config artifact_status

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

  [ -f "$config_path" ] || return 0

  export AUTOFLOW_BOARD_ROOT="$board_root"
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
        enabled="true"
        invalid_config="false"
        ;;
      runner_end)
        if [ "$in_runner" -eq 1 ] && [ -n "$id" ]; then
          runner_total_count=$((runner_total_count + 1))
          case "$role" in
            planner|todo|verifier|wiki-maintainer|watcher) ;;
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
          [ -n "$status" ] || status="idle"
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
board_dir_name="${positionals[1]:-autoflow}"
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
spec_done_count="$(count_matching_files "${board_root}/tickets/done" 'project_*.md')"
spec_total="$((spec_backlog_count + spec_done_count))"

ticket_todo_count="$(count_matching_files "${board_root}/tickets/todo" 'tickets_*.md')"
ticket_inprogress_count="$(count_matching_files "${board_root}/tickets/inprogress" 'tickets_*.md')"
ticket_verifier_count="$(count_matching_files "${board_root}/tickets/verifier" 'tickets_*.md')"
ticket_done_count="$(count_matching_files "${board_root}/tickets/done" 'tickets_*.md')"
ticket_reject_count="$(count_matching_files "${board_root}/tickets/reject" 'reject_*.md')"
ticket_done_reject_count="$(count_matching_files "${board_root}/tickets/done" 'reject_*.md')"
reject_count="$((ticket_reject_count + ticket_done_reject_count))"
ticket_total="$((ticket_todo_count + ticket_inprogress_count + ticket_verifier_count + ticket_done_count + ticket_reject_count))"
active_ticket_count="$((ticket_todo_count + ticket_inprogress_count + ticket_verifier_count))"

verifier_pass_count="$(count_matching_files "${board_root}/logs" 'verifier_*_pass.md')"
verifier_fail_count="$(count_matching_files "${board_root}/logs" 'verifier_*_fail.md')"
verifier_total="$((verifier_pass_count + verifier_fail_count))"
handoff_count="$(count_matching_files "${board_root}/conversations" 'spec-handoff.md')"
verification_pass_rate_percent="$(percent_value "$verifier_pass_count" "$verifier_total")"
completion_rate_percent="$(percent_value "$ticket_done_count" "$ticket_total")"
count_runner_states

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
printf 'ticket_verifier_count=%s\n' "$ticket_verifier_count"
printf 'ticket_done_count=%s\n' "$ticket_done_count"
printf 'reject_count=%s\n' "$reject_count"
printf 'active_ticket_count=%s\n' "$active_ticket_count"
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
printf 'verification_pass_rate_percent=%s\n' "$verification_pass_rate_percent"
printf 'completion_rate_percent=%s\n' "$completion_rate_percent"
