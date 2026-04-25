#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(cd "$(dirname "$0")" && pwd)/../runtime/runner-common.sh"

project_root_input="${1:-.}"
board_dir_name="${2:-autoflow}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
package_version="$(package_version_value)"

error_count=0
warning_count=0
check_output="$(mktemp)"
detail_output="$(mktemp)"
ticket_locations_output="$(mktemp)"
duplicate_ticket_ids_output="$(mktemp)"

cleanup() {
  rm -f "$check_output" "$detail_output" "$ticket_locations_output" "$duplicate_ticket_ids_output"
}
trap cleanup EXIT

record_check() {
  local check_id="$1"
  local result="$2"
  printf 'check.%s=%s\n' "$check_id" "$result" >> "$check_output"
}

record_error() {
  local message="$1"
  error_count=$((error_count + 1))
  printf 'error.%s=%s\n' "$error_count" "$message" >> "$detail_output"
}

record_warning() {
  local message="$1"
  warning_count=$((warning_count + 1))
  printf 'warning.%s=%s\n' "$warning_count" "$message" >> "$detail_output"
}

ticket_field_present() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    /^## Ticket/ { in_ticket=1; next }
    /^## / && in_ticket { in_ticket=0 }
    in_ticket && $0 ~ "^- " field ":" { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

check_id_fragment() {
  printf '%s' "$1" | sed 's/[^A-Za-z0-9_]/_/g'
}

record_runner_adapter_check() {
  local runner_id="$1"
  local role="$2"
  local agent="$3"
  local mode="$4"
  local enabled="$5"
  local command_value="$6"
  local interval_seconds="$7"
  local check_id adapter_path

  check_id="runner_$(check_id_fragment "$runner_id")"
  [ -n "$agent" ] || agent="manual"
  [ -n "$mode" ] || mode="one-shot"
  [ -n "$enabled" ] || enabled="true"
  [ -n "$interval_seconds" ] || interval_seconds="60"

  record_check "${check_id}_defined" "ok"
  printf 'runner.%s.role=%s\n' "$check_id" "$role" >> "$check_output"
  printf 'runner.%s.agent=%s\n' "$check_id" "$agent" >> "$check_output"
  printf 'runner.%s.interval_seconds=%s\n' "$check_id" "$interval_seconds" >> "$check_output"

  case "$role" in
    ticket-owner|owner|planner|todo|verifier|wiki-maintainer|watcher)
      record_check "${check_id}_role" "ok"
      ;;
    *)
      record_check "${check_id}_role" "warning"
      record_warning "runner ${runner_id} has unsupported role=${role:-empty}; expected ticket-owner, planner, todo, verifier, wiki-maintainer, or watcher"
      ;;
  esac

  case "$enabled" in
    true|false)
      record_check "${check_id}_enabled" "ok"
      ;;
    *)
      record_check "${check_id}_enabled" "warning"
      record_warning "runner ${runner_id} has invalid enabled=${enabled}; expected true or false"
      ;;
  esac

  if [ "$enabled" != "true" ]; then
    record_check "${check_id}_adapter" "disabled"
    record_check "${check_id}_interval" "disabled"
    return
  fi

  case "$mode" in
    one-shot|loop)
      record_check "${check_id}_mode" "ok"
      ;;
    watch)
      record_check "${check_id}_mode" "warning"
      record_warning "runner ${runner_id} uses mode=watch; use the file watcher controls until watcher runners are implemented"
      ;;
    *)
      record_check "${check_id}_mode" "warning"
      record_warning "runner ${runner_id} uses unsupported mode=${mode}; expected one-shot, loop, or watch"
      ;;
  esac

  if [ "$mode" = "loop" ]; then
    case "$interval_seconds" in
      ""|*[!0-9]*)
        record_check "${check_id}_interval" "warning"
        record_warning "runner ${runner_id} has invalid interval_seconds=${interval_seconds:-empty}; expected an integer between 1 and 86400"
        ;;
      *)
        if [ "$interval_seconds" -lt 1 ] || [ "$interval_seconds" -gt 86400 ]; then
          record_check "${check_id}_interval" "warning"
          record_warning "runner ${runner_id} has invalid interval_seconds=${interval_seconds}; expected an integer between 1 and 86400"
        else
          record_check "${check_id}_interval" "ok"
        fi
        ;;
    esac
  else
    record_check "${check_id}_interval" "not_applicable"
  fi

  case "$agent" in
    shell|manual)
      record_check "${check_id}_adapter" "ok"
      ;;
    codex|claude|opencode|gemini)
      if [ -n "$command_value" ]; then
        record_check "${check_id}_adapter" "custom_command"
      elif adapter_path="$(command -v "$agent" 2>/dev/null)"; then
        record_check "${check_id}_adapter" "ok"
        printf 'runner.%s.adapter_path=%s\n' "$check_id" "$adapter_path" >> "$check_output"
      else
        record_check "${check_id}_adapter" "warning"
        record_warning "runner ${runner_id} uses agent=${agent}, but ${agent} is not on PATH"
      fi
      ;;
    *)
      record_check "${check_id}_adapter" "warning"
      record_warning "runner ${runner_id} uses unsupported agent=${agent}; use shell, manual, codex, claude, opencode, or gemini"
      ;;
  esac
}

process_is_alive() {
  local pid="$1"

  case "$pid" in
    ""|0|*[!0-9]*)
      return 1
      ;;
  esac

  kill -0 "$pid" >/dev/null 2>&1
}

record_runner_state_check() {
  local runner_id="$1"
  local check_id state_status pid state_path
  local last_runtime_log last_prompt_log last_stdout_log last_stderr_log artifact_path artifact_count artifact_issue_count artifact_label

  check_id="runner_$(check_id_fragment "$runner_id")"
  state_status="$(runner_state_field "$runner_id" "status" 2>/dev/null || true)"
  pid="$(runner_state_field "$runner_id" "pid" 2>/dev/null || true)"
  state_path="$(runner_state_path "$runner_id" 2>/dev/null || true)"

  if [ -z "$state_status" ]; then
    record_check "${check_id}_state" "missing"
    return
  fi

  record_check "${check_id}_state" "ok"
  printf 'runner.%s.state_status=%s\n' "$check_id" "$state_status" >> "$check_output"
  printf 'runner.%s.pid=%s\n' "$check_id" "$pid" >> "$check_output"
  printf 'runner.%s.state_path=%s\n' "$check_id" "$state_path" >> "$check_output"

  last_runtime_log="$(runner_state_field "$runner_id" "last_runtime_log" 2>/dev/null || true)"
  last_prompt_log="$(runner_state_field "$runner_id" "last_prompt_log" 2>/dev/null || true)"
  last_stdout_log="$(runner_state_field "$runner_id" "last_stdout_log" 2>/dev/null || true)"
  last_stderr_log="$(runner_state_field "$runner_id" "last_stderr_log" 2>/dev/null || true)"
  printf 'runner.%s.last_runtime_log=%s\n' "$check_id" "$last_runtime_log" >> "$check_output"
  printf 'runner.%s.last_prompt_log=%s\n' "$check_id" "$last_prompt_log" >> "$check_output"
  printf 'runner.%s.last_stdout_log=%s\n' "$check_id" "$last_stdout_log" >> "$check_output"
  printf 'runner.%s.last_stderr_log=%s\n' "$check_id" "$last_stderr_log" >> "$check_output"

  artifact_count=0
  artifact_issue_count=0
  for artifact_label in runtime prompt stdout stderr; do
    case "$artifact_label" in
      runtime) artifact_path="$last_runtime_log" ;;
      prompt) artifact_path="$last_prompt_log" ;;
      stdout) artifact_path="$last_stdout_log" ;;
      stderr) artifact_path="$last_stderr_log" ;;
    esac

    [ -n "$artifact_path" ] || continue
    artifact_count=$((artifact_count + 1))

    case "$artifact_path" in
      "${board_root}"/*)
        if [ ! -f "$artifact_path" ]; then
          artifact_issue_count=$((artifact_issue_count + 1))
          record_warning "runner ${runner_id} last ${artifact_label} artifact is missing: ${artifact_path}"
        fi
        ;;
      *)
        artifact_issue_count=$((artifact_issue_count + 1))
        record_warning "runner ${runner_id} last ${artifact_label} artifact is outside board root: ${artifact_path}"
        ;;
    esac
  done

  if [ "$artifact_count" -eq 0 ]; then
    record_check "${check_id}_artifacts" "not_applicable"
  elif [ "$artifact_issue_count" -eq 0 ]; then
    record_check "${check_id}_artifacts" "ok"
  else
    record_check "${check_id}_artifacts" "warning"
  fi

  if [ "$state_status" = "running" ] && [ -n "$pid" ] && ! process_is_alive "$pid"; then
    record_check "${check_id}_pid" "warning"
    record_warning "runner ${runner_id} state says running with stale pid=${pid}; run autoflow runners stop ${runner_id} or restart it"
  elif [ "$state_status" = "running" ] && [ -n "$pid" ]; then
    record_check "${check_id}_pid" "ok"
  else
    record_check "${check_id}_pid" "not_applicable"
  fi
}

record_watcher_state_check() {
  local pid_file pid

  pid_file="${board_root}/logs/hooks/watch-board.pid"
  printf 'watcher.pid_file=%s\n' "$pid_file" >> "$check_output"

  if [ ! -f "$pid_file" ]; then
    record_check "watcher_pid" "not_running"
    printf 'watcher.status=not_running\n' >> "$check_output"
    return
  fi

  pid="$(tr -d '\r\n' < "$pid_file")"
  printf 'watcher.pid=%s\n' "$pid" >> "$check_output"

  if process_is_alive "$pid"; then
    record_check "watcher_pid" "ok"
    printf 'watcher.status=running\n' >> "$check_output"
    return
  fi

  record_check "watcher_pid" "warning"
  printf 'watcher.status=stale_pid\n' >> "$check_output"
  record_warning "watcher pid file is stale or invalid: ${pid_file} pid=${pid:-empty}; run autoflow watch-stop to clean it up"
}

project_spec_exists_for_key() {
  local project_key="$1"

  [ -f "${board_root}/tickets/backlog/${project_key}.md" ] ||
    [ -f "${board_root}/tickets/done/${project_key}/${project_key}.md" ]
}

record_conversation_handoff_check() {
  local conversations_root handoff_count invalid_count handoff_file project_key

  conversations_root="${board_root}/conversations"
  if [ ! -d "$conversations_root" ]; then
    record_check "conversation_scaffold" "warning"
    record_warning "conversation scaffold is missing; run autoflow upgrade to add conversations/"
    return
  fi

  record_check "conversation_scaffold" "ok"
  handoff_count=0
  invalid_count=0

  while IFS= read -r handoff_file; do
    [ -n "$handoff_file" ] || continue
    handoff_count=$((handoff_count + 1))
    project_key="$(basename "$(dirname "$handoff_file")")"

    case "$project_key" in
      project_[0-9][0-9][0-9])
        if ! project_spec_exists_for_key "$project_key"; then
          invalid_count=$((invalid_count + 1))
          record_warning "handoff has no matching spec in backlog or done: ${handoff_file}"
        fi
        ;;
      *)
        invalid_count=$((invalid_count + 1))
        record_warning "handoff is not under conversations/project_NNN/: ${handoff_file}"
        ;;
    esac
  done < <(find "$conversations_root" -type f -name 'spec-handoff.md' | sort)

  printf 'conversation.handoff_count=%s\n' "$handoff_count" >> "$check_output"
  if [ "$invalid_count" -gt 0 ]; then
    record_check "conversation_handoffs" "warning"
  else
    record_check "conversation_handoffs" "ok"
  fi
}

if [ -d "$board_root" ]; then
  record_check "board_root_exists" "ok"
else
  record_check "board_root_exists" "error"
  record_error "board root does not exist: ${board_root}"
fi

if [ -f "${project_root}/AGENTS.md" ]; then
  record_check "host_agents" "ok"
else
  record_check "host_agents" "not_applicable"
fi

if [ -d "$board_root" ]; then
  if [ -f "${board_root}/AGENTS.md" ]; then
    record_check "board_agents" "ok"
  else
    record_check "board_agents" "error"
    record_error "board AGENTS.md is missing: ${board_root}/AGENTS.md"
  fi

  if [ -f "${board_root}/README.md" ]; then
    record_check "board_readme" "ok"
  else
    record_check "board_readme" "error"
    record_error "board README.md is missing: ${board_root}/README.md"
  fi

  for required_dir in agents automations reference rules scripts tickets logs; do
    if [ -d "${board_root}/${required_dir}" ]; then
      record_check "dir_${required_dir}" "ok"
    else
      record_check "dir_${required_dir}" "error"
      record_error "required board directory is missing: ${board_root}/${required_dir}"
    fi
  done

  for ticket_dir in todo inprogress verifier done reject; do
    if [ -d "${board_root}/tickets/${ticket_dir}" ]; then
      record_check "tickets_${ticket_dir}" "ok"
    else
      record_check "tickets_${ticket_dir}" "error"
      record_error "ticket state directory is missing: ${board_root}/tickets/${ticket_dir}"
    fi
  done

  for required_nested_dir in \
    "tickets/backlog" \
    "rules/verifier" \
    "logs/hooks" \
    "tickets/plan" \
    "automations/state" \
    "automations/state/threads"
  do
    if [ -d "${board_root}/${required_nested_dir}" ]; then
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "ok"
    else
      record_check "dir_$(printf '%s' "$required_nested_dir" | tr '/.-' '___')" "error"
      record_error "required nested board directory is missing: ${board_root}/${required_nested_dir}"
    fi
  done

  runner_scaffold_ok="true"
  for runner_scaffold_path in \
    "runners" \
    "runners/state" \
    "runners/logs" \
    "runners/config.toml"
  do
    if [ ! -e "${board_root}/${runner_scaffold_path}" ]; then
      runner_scaffold_ok="false"
    fi
  done
  if [ "$runner_scaffold_ok" = "true" ]; then
    record_check "runner_scaffold" "ok"
  else
    record_check "runner_scaffold" "warning"
    record_warning "runner scaffold is missing or incomplete; run autoflow upgrade to add runners/config.toml, runners/state, and runners/logs"
  fi

  runner_count=0
  if [ -f "${board_root}/runners/config.toml" ]; then
    export AUTOFLOW_BOARD_ROOT="$board_root"
    current_id=""
    current_role=""
    current_agent=""
    current_mode=""
    current_enabled="true"
    current_interval="60"
    current_command=""

    while IFS= read -r runner_line; do
      case "$runner_line" in
        runner_begin)
          current_id=""
          current_role=""
          current_agent=""
          current_mode=""
          current_enabled="true"
          current_interval="60"
          current_command=""
          ;;
        runner_end)
          if [ -n "$current_id" ]; then
            runner_count=$((runner_count + 1))
            record_runner_adapter_check "$current_id" "$current_role" "$current_agent" "$current_mode" "$current_enabled" "$current_command" "$current_interval"
            record_runner_state_check "$current_id"
          fi
          ;;
        id=*)
          current_id="${runner_line#id=}"
          ;;
        role=*)
          current_role="${runner_line#role=}"
          ;;
        agent=*)
          current_agent="${runner_line#agent=}"
          ;;
        mode=*)
          current_mode="${runner_line#mode=}"
          ;;
        interval_seconds=*)
          current_interval="${runner_line#interval_seconds=}"
          ;;
        enabled=*)
          current_enabled="${runner_line#enabled=}"
          ;;
        command=*)
          current_command="${runner_line#command=}"
          ;;
      esac
    done < <(runner_list_config "${board_root}/runners/config.toml")
  fi
  printf 'runner_count=%s\n' "$runner_count" >> "$check_output"
  record_watcher_state_check
  record_conversation_handoff_check

  wiki_scaffold_ok="true"
  for wiki_scaffold_path in \
    "wiki" \
    "wiki/index.md" \
    "wiki/log.md" \
    "wiki/project-overview.md" \
    "rules/wiki"
  do
    if [ ! -e "${board_root}/${wiki_scaffold_path}" ]; then
      wiki_scaffold_ok="false"
    fi
  done
  if [ "$wiki_scaffold_ok" = "true" ]; then
    record_check "wiki_scaffold" "ok"
  else
    record_check "wiki_scaffold" "warning"
    record_warning "wiki scaffold is missing or incomplete; run autoflow upgrade to add wiki pages and rules/wiki"
  fi

  metrics_scaffold_ok="true"
  for metrics_scaffold_path in \
    "metrics" \
    "metrics/README.md" \
    "metrics/.gitignore"
  do
    if [ ! -e "${board_root}/${metrics_scaffold_path}" ]; then
      metrics_scaffold_ok="false"
    fi
  done
  if [ "$metrics_scaffold_ok" = "true" ]; then
    record_check "metrics_scaffold" "ok"
  else
    record_check "metrics_scaffold" "warning"
    record_warning "metrics scaffold is missing or incomplete; run autoflow upgrade to add metrics/README.md and metrics/.gitignore"
  fi

  adapter_scaffold_ok="true"
  for adapter_scaffold_path in \
    "agents/adapters" \
    "agents/adapters/README.md" \
    "agents/adapters/shell.md" \
    "agents/adapters/codex-cli.md" \
    "agents/adapters/claude-cli.md" \
    "agents/adapters/opencode.md" \
    "agents/adapters/gemini-cli.md"
  do
    if [ ! -e "${board_root}/${adapter_scaffold_path}" ]; then
      adapter_scaffold_ok="false"
    fi
  done
  if [ "$adapter_scaffold_ok" = "true" ]; then
    record_check "adapter_scaffold" "ok"
  else
    record_check "adapter_scaffold" "warning"
    record_warning "adapter scaffold is missing or incomplete; run autoflow upgrade to add agents/adapters docs"
  fi

  for runtime_file in common.sh runner-common.sh check-stop.sh file-watch-common.sh install-stop-hook.sh run-hook.sh watch-board.sh set-thread-context.sh clear-thread-context.sh start-plan.sh start-todo.sh handoff-todo.sh start-verifier.sh start-spec.sh integrate-worktree.sh write-verifier-log.sh; do
    if [ -f "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}" "ok"
    else
      record_check "script_${runtime_file}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_file}"
      continue
    fi

    if [ -x "${board_root}/scripts/${runtime_file}" ]; then
      record_check "script_${runtime_file}_executable" "ok"
    else
      record_check "script_${runtime_file}_executable" "error"
      record_error "runtime script is not executable: ${board_root}/scripts/${runtime_file}"
    fi
  done

  for runtime_ps1 in invoke-runtime-sh.ps1 runner-common.ps1 codex-stop-hook.ps1 check-stop.ps1 install-stop-hook.ps1 set-thread-context.ps1 clear-thread-context.ps1 start-spec.ps1 start-plan.ps1 start-todo.ps1 handoff-todo.ps1 start-verifier.ps1 integrate-worktree.ps1 write-verifier-log.ps1 run-hook.ps1 watch-board.ps1; do
    if [ -f "${board_root}/scripts/${runtime_ps1}" ]; then
      record_check "script_${runtime_ps1}" "ok"
    else
      record_check "script_${runtime_ps1}" "error"
      record_error "runtime script is missing: ${board_root}/scripts/${runtime_ps1}"
    fi
  done

  if [ -f "${board_root}/.project-root" ]; then
    marker_value="$(project_root_marker_value "$board_root")"
    record_check "project_root_marker" "ok"
    printf 'project_root_marker_value=%s\n' "$marker_value" >> "$check_output"

    if resolved_project_root="$(resolve_project_root_from_board "$board_root" 2>/dev/null)"; then
      record_check "project_root_marker_resolves" "ok"
      printf 'project_root_marker_resolved=%s\n' "$resolved_project_root" >> "$check_output"
      if [ "$resolved_project_root" = "$project_root" ]; then
        record_check "project_root_marker_matches_host" "ok"
      else
        record_check "project_root_marker_matches_host" "error"
        record_error "project-root marker resolves to ${resolved_project_root}, expected ${project_root}"
      fi
    else
      record_check "project_root_marker_resolves" "error"
      record_error "project-root marker could not be resolved from ${board_root}/.project-root"
    fi
  else
    record_check "project_root_marker" "error"
    record_error "board project-root marker is missing: ${board_root}/.project-root"
  fi

  if board_version="$(board_version_value "$board_root" 2>/dev/null)"; then
    record_check "board_version_marker" "ok"
    printf 'board_version=%s\n' "$board_version" >> "$check_output"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"

    if [ "$board_version" = "$package_version" ]; then
      record_check "board_version_matches_package" "ok"
    else
      record_check "board_version_matches_package" "warning"
      record_warning "board version ${board_version} differs from package version ${package_version}; run autoflow upgrade"
    fi
  else
    record_check "board_version_marker" "warning"
    printf 'package_version=%s\n' "$package_version" >> "$check_output"
    record_warning "board version marker is missing: ${board_root}/.autoflow-version"
  fi

  for starter_file in \
    "automations/heartbeat-set.toml" \
    "automations/file-watch.psd1" \
    "automations/state/README.md" \
    "automations/state/.gitignore" \
    "reference/README.md" \
    "reference/backlog.md" \
    "reference/backlog-processed.md" \
    "reference/project-spec-template.md" \
    "reference/feature-spec-template.md" \
    "reference/plan.md" \
    "reference/plan-template.md" \
    "reference/roadmap.md" \
    "reference/tickets-board.md" \
    "reference/ticket-template.md" \
    "reference/logs.md" \
    "reference/hook-logs.md" \
    "automations/templates/heartbeat-set.template.toml" \
    "automations/templates/plan-heartbeat.template.toml" \
    "automations/templates/todo-heartbeat.template.toml" \
    "automations/templates/verifier-heartbeat.template.toml" \
    "rules/verifier/checklist-template.md" \
    "rules/verifier/verification-template.md"
  do
    if [ -f "${board_root}/${starter_file}" ]; then
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "ok"
    else
      record_check "starter_$(basename "$starter_file" | tr '.-' '__')" "error"
      record_error "starter file is missing: ${board_root}/${starter_file}"
    fi
  done

  for forbidden_state_file in \
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
    if [ -f "${board_root}/${forbidden_state_file}" ]; then
      record_check "state_doc_$(printf '%s' "$forbidden_state_file" | tr '/.-' '___')" "error"
      record_error "state folder contains reference/template file; move it under reference/: ${board_root}/${forbidden_state_file}"
    fi
  done

  if [ -d "${board_root}/tickets/plan/inprogress" ] && find "${board_root}/tickets/plan/inprogress" -maxdepth 1 -type f -name 'plan_*.md' -print -quit | grep -q .; then
    record_check "legacy_plan_inprogress_empty" "error"
    record_error "legacy plan inprogress folder still contains plan files; use tickets/inprogress instead: ${board_root}/tickets/plan/inprogress"
  fi

  if [ -d "${board_root}/tickets/reject" ] && find "${board_root}/tickets/reject" -maxdepth 1 -type f -name 'tickets_[0-9][0-9][0-9].md' -print -quit | grep -q .; then
    record_check "legacy_reject_ticket_names" "error"
    record_error "reject folder still contains tickets_NNN.md files; run autoflow upgrade so failed tickets use reject_NNN.md: ${board_root}/tickets/reject"
  else
    record_check "legacy_reject_ticket_names" "ok"
  fi

  : > "$ticket_locations_output"
  for ticket_state_dir in todo inprogress verifier done; do
    if [ ! -d "${board_root}/tickets/${ticket_state_dir}" ]; then
      continue
    fi
    maxdepth_arg="-maxdepth 1"
    if [ "$ticket_state_dir" = "done" ]; then
      maxdepth_arg=""
    fi
    # shellcheck disable=SC2086
    find "${board_root}/tickets/${ticket_state_dir}" $maxdepth_arg -type f -name 'tickets_[0-9][0-9][0-9].md' | sort |
      while IFS= read -r ticket_file; do
        [ -n "$ticket_file" ] || continue
        ticket_base="$(basename "$ticket_file")"
        ticket_rel="${ticket_file#${board_root}/}"
        printf '%s\t%s\n' "$ticket_base" "$ticket_rel" >> "$ticket_locations_output"
      done
  done

  if [ -s "$ticket_locations_output" ]; then
    cut -f1 "$ticket_locations_output" | sort | uniq -d > "$duplicate_ticket_ids_output"
  else
    : > "$duplicate_ticket_ids_output"
  fi

  if [ -s "$duplicate_ticket_ids_output" ]; then
    record_check "ticket_duplicate_ids" "error"
    while IFS= read -r duplicate_ticket_id; do
      [ -n "$duplicate_ticket_id" ] || continue
      duplicate_locations="$(awk -F '\t' -v id="$duplicate_ticket_id" '$1 == id { print $2 }' "$ticket_locations_output" | paste -sd ', ' -)"
      record_error "duplicate ticket id ${duplicate_ticket_id} exists in multiple state folders: ${duplicate_locations}"
    done < "$duplicate_ticket_ids_output"
  else
    record_check "ticket_duplicate_ids" "ok"
  fi

  if [ -f "${board_root}/reference/ticket-template.md" ]; then
    for required_ticket_field in "Plan Candidate" "Stage" "Claimed By" "Execution Owner" "Verifier Owner"; do
      check_field_id="$(printf '%s' "$required_ticket_field" | tr ' ' '_')"
      if ticket_field_present "${board_root}/reference/ticket-template.md" "$required_ticket_field"; then
        record_check "ticket_template_${check_field_id}" "ok"
      else
        record_check "ticket_template_${check_field_id}" "error"
        record_error "ticket template is missing field ${required_ticket_field}: ${board_root}/reference/ticket-template.md"
      fi
    done
  fi

  if [ -d "${board_root}/tickets/inprogress" ]; then
    while IFS= read -r live_ticket; do
      [ -n "$live_ticket" ] || continue
      for required_live_field in "Stage" "Execution Owner" "Verifier Owner"; do
        if ticket_field_present "$live_ticket" "$required_live_field"; then
          continue
        fi
        record_warning "live inprogress ticket is missing field ${required_live_field}: ${live_ticket}"
      done
    done < <(find "${board_root}/tickets/inprogress" -maxdepth 1 -type f -name 'tickets_*.md' | sort)
  fi

  if board_is_initialized "$board_root"; then
    record_check "board_initialized" "ok"
  else
    record_check "board_initialized" "warning"
    record_warning "board root exists but does not look fully initialized"
  fi
fi

status="ok"
if [ "$error_count" -gt 0 ]; then
  status="fail"
fi

printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'status=%s\n' "$status"
printf 'package_version=%s\n' "$package_version"
printf 'error_count=%s\n' "$error_count"
printf 'warning_count=%s\n' "$warning_count"
cat "$check_output"
cat "$detail_output"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi
