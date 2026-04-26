#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  run-role.sh ticket [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh planner [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh todo [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh verifier [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
  run-role.sh wiki [project-root] [board-dir-name] [--runner runner-id] [--dry-run]
EOF
}

requested_role="${1:-}"
if [ -z "$requested_role" ]; then
  usage
  exit 1
fi
shift || true

runner_id=""
dry_run="false"
positionals=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --runner)
      shift || true
      runner_id="${1:-}"
      if [ -z "$runner_id" ]; then
        echo "--runner requires a runner id" >&2
        exit 1
      fi
      ;;
    --runner=*)
      runner_id="${1#--runner=}"
      ;;
    --dry-run)
      dry_run="true"
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

case "$requested_role" in
  ticket|owner|ticket-owner)
    public_role="ticket"
    runtime_role="ticket-owner"
    default_runner_id="owner-1"
    runtime_script="start-ticket-owner.sh"
    ;;
  planner|plan)
    public_role="planner"
    runtime_role="plan"
    default_runner_id="planner-1"
    runtime_script="start-plan.sh"
    ;;
  todo)
    public_role="todo"
    runtime_role="todo"
    default_runner_id="todo-1"
    runtime_script="start-todo.sh"
    ;;
  verifier|veri)
    public_role="verifier"
    runtime_role="verifier"
    default_runner_id="verifier-1"
    runtime_script="start-verifier.sh"
    ;;
  wiki|wiki-maintainer)
    public_role="wiki"
    runtime_role="wiki"
    default_runner_id="wiki-1"
    runtime_script=""
    ;;
  *)
    echo "Unknown run role: ${requested_role}" >&2
    usage
    exit 1
    ;;
esac

if [ -z "$runner_id" ]; then
  runner_id="$default_runner_id"
fi

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
export AUTOFLOW_BOARD_ROOT="$board_root"
export AUTOFLOW_PROJECT_ROOT="$project_root"

config_path="$(runner_config_path)"

print_run_header() {
  local status="$1"
  printf 'status=%s\n' "$status"
  printf 'action=run\n'
  printf 'role=%s\n' "$public_role"
  printf 'runtime_role=%s\n' "$runtime_role"
  printf 'runner_id=%s\n' "$runner_id"
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'board_dir_name=%s\n' "$board_dir_name"
  printf 'config_path=%s\n' "$config_path"
}

command_summary_from_array() {
  local arg first

  first=1
  for arg in "$@"; do
    if [ "$first" -eq 0 ]; then
      printf ' '
    fi
    printf '%q' "$arg"
    first=0
  done
}

runner_field() {
  local field="$1"
  runner_config_field "$runner_id" "$field" "$config_path" 2>/dev/null || true
}

runner_state_value() {
  local field="$1"
  runner_state_field "$runner_id" "$field" 2>/dev/null || true
}

runner_active_state_value() {
  runner_state_value "$1"
}

runner_state_pid_for_start() {
  if [ "${mode:-}" = "loop" ]; then
    runner_state_value "pid"
    return 0
  fi

  printf '%s' "$$"
}

runner_state_pid_for_finish() {
  if [ "${mode:-}" = "loop" ]; then
    runner_state_value "pid"
  fi
}

runner_state_started_at() {
  local fallback="$1"
  local value=""

  if [ "${mode:-}" = "loop" ]; then
    value="$(runner_state_value "started_at")"
  fi

  printf '%s' "${value:-$fallback}"
}

write_blocked_state() {
  local reason="$1"
  local timestamp

  timestamp="$(runner_now_iso)"
  runner_write_state "$runner_id" \
    "status=blocked" \
    "role=${public_role}" \
    "agent=${agent:-}" \
    "mode=${mode:-}" \
    "model=${model:-}" \
    "reasoning=${reasoning:-}" \
    "active_item=" \
    "pid=" \
    "started_at=" \
    "last_event_at=${timestamp}" \
    "last_result=${reason}"
  runner_append_log "$runner_id" "run_blocked" \
    "role=${public_role}" \
    "reason=${reason}"
}

agent_instruction_path() {
  case "$public_role" in
    planner)
      printf '%s/agents/plan-to-ticket-agent.md' "$board_root"
      ;;
    ticket)
      printf '%s/agents/ticket-owner-agent.md' "$board_root"
      ;;
    todo)
      printf '%s/agents/todo-queue-agent.md' "$board_root"
      ;;
    verifier)
      printf '%s/agents/verifier-agent.md' "$board_root"
      ;;
    wiki)
      printf '%s/agents/wiki-maintainer-agent.md' "$board_root"
      ;;
  esac
}

write_agent_prompt() {
  local instruction_file="$1"

  cat <<EOF
Autoflow Local Runner Mode

You are running as a local Autoflow agent adapter. The file board is the source
of truth; chat history is not.

Context:
- Project root: ${project_root}
- Board root: ${board_root}
- Board dir name: ${board_dir_name}
- Runner id: ${runner_id}
- Public role: ${public_role}
- Runtime role: ${runtime_role}
- Runtime script: ${runtime_path}
- Role instruction file: ${instruction_file}
- Agent adapter: ${agent}
- Model: ${model:-}
- Reasoning: ${reasoning:-}

Required flow:
1. Read the role instruction file and the current board state.
2. Execute exactly one safe ${public_role} turn.
3. Use the runtime script when claiming or preparing board state if a runtime script is defined.
4. Keep durable progress in board files, runner logs, ticket Notes, Result, and Resume Context.
5. Do not rely on this prompt as future memory.
6. Never git push.

Role boundary:
- ticket: own one ticket from local planning through implementation, verification, evidence logging, and done/reject movement. Do not split the work across planner/todo/verifier runners. Never push.
- planner: create/update plans and todo ticket files only. Do not implement, verify, commit, or push.
- todo: claim/resume one todo ticket, implement within Allowed Paths, then hand off to verifier when done. Do not verify, commit, or push.
- verifier: verify one verifier ticket, record pass/fail evidence, move it to done or reject, and local commit only on pass. Never push.
- wiki: update derived wiki pages from done tickets, reject records, and logs. Never treat the wiki as proof of completion.

When there is no actionable work, leave the runner and board in an idle state
with a concise explanation.
EOF
}

run_custom_adapter_command() {
  local prompt_file="$1"

  command_summary="$command_value"
  AUTOFLOW_PROMPT_FILE="$prompt_file" bash -lc "$command_value" < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
}

run_default_adapter_command() {
  local prompt_file="$1"
  local prompt_text
  local cmd=()
  local command_exit codex_wrapper

  case "$agent" in
    codex)
      command -v codex >/dev/null 2>&1 || return 127
      cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$project_root")
      if [ -n "$model" ]; then
        cmd+=(-m "$model")
      fi
      if [ -n "$reasoning" ]; then
        cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
      fi
      cmd+=(-)
      command_summary="$(command_summary_from_array "${cmd[@]}")"
      if [ "$(uname -s 2>/dev/null || true)" = "Darwin" ] && command -v script >/dev/null 2>&1 && [ "${AUTOFLOW_CODEX_DISABLE_PTY:-}" != "1" ]; then
        codex_wrapper="$(mktemp "${TMPDIR:-/tmp}/autoflow-codex-wrapper.XXXXXX")"
        {
          printf '#!/usr/bin/env bash\n'
          printf 'exec'
          printf ' %q' "${cmd[@]}"
          printf ' < "$1"\n'
        } > "$codex_wrapper"
        chmod +x "$codex_wrapper"
        script -q /dev/null "$codex_wrapper" "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
        rm -f "$codex_wrapper"
      else
        "${cmd[@]}" < "$prompt_file" > "$adapter_stdout" 2> "$adapter_stderr"
        command_exit=$?
      fi
      return "$command_exit"
      ;;
    claude)
      command -v claude >/dev/null 2>&1 || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      if [ -n "$reasoning" ]; then
        cmd+=(--effort "$reasoning")
      fi
      cmd+=("$prompt_text")
      command_summary="$(command_summary_from_array "${cmd[@]:0:${#cmd[@]}-1}") prompt"
      "${cmd[@]}" > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    opencode)
      command -v opencode >/dev/null 2>&1 || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(opencode run)
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      if [ -n "$reasoning" ]; then
        cmd+=(--variant "$reasoning")
      fi
      cmd+=("$prompt_text")
      command_summary="$(command_summary_from_array "${cmd[@]:0:${#cmd[@]}-1}") prompt"
      "${cmd[@]}" > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    gemini)
      command -v gemini >/dev/null 2>&1 || return 127
      prompt_text="$(cat "$prompt_file")"
      cmd=(gemini --approval-mode auto_edit --prompt "$prompt_text")
      if [ -n "$model" ]; then
        cmd+=(--model "$model")
      fi
      command_summary="$(command_summary_from_array "${cmd[@]:0:3}") prompt"
      "${cmd[@]}" > "$adapter_stdout" 2> "$adapter_stderr"
      ;;
    *)
      return 127
      ;;
  esac
}

emit_file_block() {
  local label="$1"
  local file="$2"

  printf '%s_begin\n' "$label"
  if [ -f "$file" ]; then
    cat "$file"
  fi
  printf '%s_end\n' "$label"
}

artifact_stamp() {
  runner_now_iso | tr ':' '-'
}

persist_run_artifact() {
  local source_file="$1"
  local suffix="$2"
  local destination

  runner_ensure_dirs
  destination="$(runner_log_dir)/${runner_id}_$(artifact_stamp)_${suffix}.log"
  cp "$source_file" "$destination"
  printf '%s' "$destination"
}

agent_runtime_preflight_or_exit() {
  local preflight_output preflight_exit preflight_status preflight_reason preflight_log_path
  local started_at finished_at command_status runner_status last_result
  local active_item

  [ "$public_role" = "ticket" ] || return 0
  [ "$dry_run" = "true" ] && return 0

  preflight_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-preflight.XXXXXX")"
  started_at="$(runner_now_iso)"

  set +e
  AUTOFLOW_ROLE="$runtime_role" \
    AUTOFLOW_WORKER_ID="$runner_id" \
    AUTOFLOW_BACKGROUND=1 \
    AUTOFLOW_BOARD_ROOT="$board_root" \
    AUTOFLOW_PROJECT_ROOT="$project_root" \
    "$runtime_path" > "$preflight_output" 2>&1
  preflight_exit=$?
  set -e

  preflight_status="$(awk -F= '$1 == "status" { value=$2; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  preflight_reason="$(awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  active_item="$(awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); value=$0; found=1 } END { if (found) print value; exit(found ? 0 : 1) }' "$preflight_output" 2>/dev/null || true)"
  [ -n "$active_item" ] || active_item="$(runner_active_state_value "active_item")"
  preflight_log_path="$(persist_run_artifact "$preflight_output" "runtime")"

  if [ "$preflight_exit" -eq 0 ] && { [ "$preflight_status" = "ok" ] || [ "$preflight_status" = "resume" ]; }; then
    rm -f "$preflight_output"
    return 0
  fi

  finished_at="$(runner_now_iso)"
  if [ "$preflight_exit" -eq 0 ] && [ "$preflight_status" = "blocked" ]; then
    command_status="blocked"
    runner_status="blocked"
    last_result="${preflight_reason:-blocked}"
  elif [ "$preflight_exit" -eq 0 ]; then
    command_status="ok"
    runner_status="idle"
    last_result="${preflight_status:-idle}"
  else
    command_status="failed"
    runner_status="failed"
    last_result="${preflight_status:-exit_${preflight_exit}}"
  fi

  runner_write_state "$runner_id" \
    "status=${runner_status}" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=${active_item}" \
    "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$started_at")" \
    "last_event_at=${finished_at}" \
    "last_result=${last_result}" \
    "last_runtime_log=${preflight_log_path}"
  runner_append_log "$runner_id" "runtime_preflight_finish" \
    "role=${public_role}" \
    "runtime_status=${preflight_status:-}" \
    "exit_code=${preflight_exit}" \
    "runner_status=${runner_status}" \
    "reason=${preflight_reason:-}"

  print_run_header "$command_status"
  printf 'runner_status=%s\n' "$runner_status"
  printf 'runtime_script=%s\n' "$runtime_path"
  printf 'runtime_status=%s\n' "$preflight_status"
  printf 'runtime_exit_code=%s\n' "$preflight_exit"
  printf 'reason=%s\n' "$preflight_reason"
  printf 'active_item=%s\n' "$active_item"
  printf 'runtime_output_log_path=%s\n' "$preflight_log_path"
  printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
  printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  printf 'runtime_output_begin\n'
  cat "$preflight_output"
  printf 'runtime_output_end\n'
  rm -f "$preflight_output"

  if [ "$preflight_exit" -ne 0 ]; then
    exit "$preflight_exit"
  fi
  exit 0
}

if [ ! -f "$config_path" ]; then
  print_run_header "blocked"
  printf 'reason=runner_config_missing\n'
  exit 0
fi

if ! runner_validate_id "$runner_id"; then
  print_run_header "blocked"
  printf 'reason=invalid_runner_id\n'
  exit 0
fi

if ! runner_config_block "$runner_id" "$config_path" >/dev/null 2>&1; then
  print_run_header "blocked"
  printf 'reason=runner_not_found\n'
  exit 0
fi

configured_role="$(runner_field "role")"
agent="$(runner_field "agent")"
model="$(runner_field "model")"
reasoning="$(runner_field "reasoning")"
mode="$(runner_field "mode")"
enabled="$(runner_field "enabled")"
command_value="$(runner_field "command")"

[ -n "$agent" ] || agent="manual"
[ -n "$mode" ] || mode="one-shot"
[ -n "$enabled" ] || enabled="true"

if [ "$enabled" != "true" ]; then
  write_blocked_state "runner_disabled"
  print_run_header "blocked"
  printf 'reason=runner_disabled\n'
  printf 'configured_role=%s\n' "$configured_role"
  printf 'agent=%s\n' "$agent"
  printf 'mode=%s\n' "$mode"
  exit 0
fi

if [ "$mode" != "one-shot" ] && [ "${AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT:-}" != "1" ]; then
  write_blocked_state "runner_mode_not_supported_for_run"
  print_run_header "blocked"
  printf 'reason=runner_mode_not_supported_for_run\n'
  printf 'mode=%s\n' "$mode"
  exit 0
fi

case "$public_role:$configured_role" in
  ticket:ticket-owner|ticket:owner|planner:planner|planner:plan|todo:todo|verifier:verifier|wiki:wiki-maintainer|wiki:wiki)
    ;;
  *)
    write_blocked_state "runner_role_mismatch"
    print_run_header "blocked"
    printf 'reason=runner_role_mismatch\n'
    printf 'configured_role=%s\n' "$configured_role"
    exit 0
    ;;
esac

if [ "$public_role" = "wiki" ]; then
  runtime_path="${SCRIPT_DIR}/wiki-project.sh"
elif [ -z "$runtime_script" ]; then
  write_blocked_state "role_run_not_implemented"
  print_run_header "blocked"
  printf 'reason=role_run_not_implemented\n'
  exit 0
else
  runtime_path="${board_root}/scripts/${runtime_script}"
fi

if [ ! -f "$runtime_path" ]; then
  write_blocked_state "runtime_script_missing"
  print_run_header "blocked"
  printf 'reason=runtime_script_missing\n'
  printf 'runtime_script=%s\n' "$runtime_path"
  exit 0
fi

case "$agent" in
  shell|manual)
    ;;
  codex|claude|opencode|gemini)
    instruction_file="$(agent_instruction_path)"
    if [ ! -f "$instruction_file" ]; then
      write_blocked_state "agent_instruction_missing"
      print_run_header "blocked"
      printf 'reason=agent_instruction_missing\n'
      printf 'agent=%s\n' "$agent"
      printf 'instruction_file=%s\n' "$instruction_file"
      exit 0
    fi

    agent_runtime_preflight_or_exit

    started_at="$(runner_now_iso)"
    prompt_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-agent-prompt.XXXXXX")"
    adapter_stdout="$(mktemp "${TMPDIR:-/tmp}/autoflow-agent-stdout.XXXXXX")"
    adapter_stderr="$(mktemp "${TMPDIR:-/tmp}/autoflow-agent-stderr.XXXXXX")"
    write_agent_prompt "$instruction_file" > "$prompt_file"

    runner_write_state "$runner_id" \
      "status=running" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=$(runner_active_state_value "active_item")" \
      "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
      "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
      "active_stage=$(runner_active_state_value "active_stage")" \
      "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
      "pid=$(runner_state_pid_for_start)" \
      "started_at=$(runner_state_started_at "$started_at")" \
      "last_event_at=${started_at}" \
      "last_result="
    runner_append_log "$runner_id" "adapter_start" \
      "role=${public_role}" \
      "runtime_role=${runtime_role}" \
      "agent=${agent}" \
      "mode=${mode}"

    adapter_exit=0
    command_summary=""

    if [ "$dry_run" = "true" ]; then
      if [ -n "$command_value" ]; then
        command_summary="$command_value"
      else
        case "$agent" in
          codex)
            dry_cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$project_root")
            [ -z "$model" ] || dry_cmd+=(-m "$model")
            [ -z "$reasoning" ] || dry_cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
            dry_cmd+=(-)
            command_summary="$(command_summary_from_array "${dry_cmd[@]}")"
            ;;
          claude)
            dry_cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            [ -z "$reasoning" ] || dry_cmd+=(--effort "$reasoning")
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
          opencode)
            dry_cmd=(opencode run)
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            [ -z "$reasoning" ] || dry_cmd+=(--variant "$reasoning")
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
          gemini)
            dry_cmd=(gemini --approval-mode auto_edit --prompt)
            [ -z "$model" ] || dry_cmd+=(--model "$model")
            command_summary="$(command_summary_from_array "${dry_cmd[@]}") prompt"
            ;;
        esac
      fi

      finished_at="$(runner_now_iso)"
      prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
      runner_write_state "$runner_id" \
        "status=idle" \
        "role=${public_role}" \
        "agent=${agent}" \
        "mode=${mode}" \
        "model=${model}" \
        "reasoning=${reasoning}" \
        "active_item=$(runner_active_state_value "active_item")" \
        "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
        "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
        "active_stage=$(runner_active_state_value "active_stage")" \
        "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
        "pid=$(runner_state_pid_for_finish)" \
        "started_at=$(runner_state_started_at "$started_at")" \
        "last_event_at=${finished_at}" \
        "last_result=dry_run" \
        "last_prompt_log=${prompt_log_path}"
      runner_append_log "$runner_id" "adapter_dry_run" \
        "role=${public_role}" \
        "agent=${agent}" \
        "command=${command_summary}"

      print_run_header "dry_run"
      printf 'runner_status=idle\n'
      printf 'adapter=%s\n' "$agent"
      printf 'adapter_command=%s\n' "$command_summary"
      printf 'prompt_file=%s\n' "$prompt_file"
      printf 'prompt_log_path=%s\n' "$prompt_log_path"
      printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
      printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
      emit_file_block "adapter_prompt" "$prompt_file"
      rm -f "$prompt_file" "$adapter_stdout" "$adapter_stderr"
      exit 0
    fi

    set +e
    if [ -n "$command_value" ]; then
      run_custom_adapter_command "$prompt_file"
    else
      run_default_adapter_command "$prompt_file"
    fi
    adapter_exit=$?
    set -e

    finished_at="$(runner_now_iso)"
    if [ "$adapter_exit" -eq 0 ]; then
      command_status="ok"
      runner_status="idle"
    elif [ "$adapter_exit" -eq 127 ]; then
      command_status="blocked"
      runner_status="blocked"
    else
      command_status="failed"
      runner_status="failed"
    fi

    prompt_log_path="$(persist_run_artifact "$prompt_file" "prompt")"
    stdout_log_path="$(persist_run_artifact "$adapter_stdout" "stdout")"
    stderr_log_path="$(persist_run_artifact "$adapter_stderr" "stderr")"

    runner_write_state "$runner_id" \
      "status=${runner_status}" \
      "role=${public_role}" \
      "agent=${agent}" \
      "mode=${mode}" \
      "model=${model}" \
      "reasoning=${reasoning}" \
      "active_item=$(runner_active_state_value "active_item")" \
      "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
      "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
      "active_stage=$(runner_active_state_value "active_stage")" \
      "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
      "pid=$(runner_state_pid_for_finish)" \
      "started_at=$(runner_state_started_at "$started_at")" \
      "last_event_at=${finished_at}" \
      "last_result=adapter_exit_${adapter_exit}" \
      "last_prompt_log=${prompt_log_path}" \
      "last_stdout_log=${stdout_log_path}" \
      "last_stderr_log=${stderr_log_path}"
    runner_append_log "$runner_id" "adapter_finish" \
      "role=${public_role}" \
      "agent=${agent}" \
      "exit_code=${adapter_exit}" \
      "runner_status=${runner_status}" \
      "command=${command_summary}"

    print_run_header "$command_status"
    printf 'runner_status=%s\n' "$runner_status"
    printf 'adapter=%s\n' "$agent"
    printf 'adapter_exit_code=%s\n' "$adapter_exit"
    printf 'adapter_command=%s\n' "$command_summary"
    printf 'prompt_log_path=%s\n' "$prompt_log_path"
    printf 'stdout_log_path=%s\n' "$stdout_log_path"
    printf 'stderr_log_path=%s\n' "$stderr_log_path"
    if [ "$adapter_exit" -eq 127 ]; then
      printf 'reason=adapter_executable_missing\n'
    fi
    printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
    printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
    emit_file_block "adapter_stdout" "$adapter_stdout"
    emit_file_block "adapter_stderr" "$adapter_stderr"
    rm -f "$prompt_file" "$adapter_stdout" "$adapter_stderr"
    if [ "$adapter_exit" -ne 0 ] && [ "$adapter_exit" -ne 127 ]; then
      exit "$adapter_exit"
    fi
    exit 0
    ;;
  *)
    write_blocked_state "agent_run_not_implemented"
    print_run_header "blocked"
    printf 'reason=agent_run_not_implemented\n'
    printf 'agent=%s\n' "$agent"
    exit 0
    ;;
esac

if [ "$dry_run" = "true" ]; then
  started_at="$(runner_now_iso)"
  finished_at="$started_at"
  dry_run_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-dry-run.XXXXXX")"

  {
    print_run_header "dry_run"
    printf 'runner_status=idle\n'
    printf 'runtime_script=%s\n' "$runtime_path"
    printf 'adapter=%s\n' "$agent"
    printf 'reason=dry_run\n'
    printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
    printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
  } > "$dry_run_output"

  runtime_output_log_path="$(persist_run_artifact "$dry_run_output" "dry-run")"
  printf 'runtime_output_log_path=%s\n' "$runtime_output_log_path" >> "$runtime_output_log_path"

  runner_write_state "$runner_id" \
    "status=idle" \
    "role=${public_role}" \
    "agent=${agent}" \
    "mode=${mode}" \
    "model=${model}" \
    "reasoning=${reasoning}" \
    "active_item=$(runner_active_state_value "active_item")" \
    "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
    "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
    "active_stage=$(runner_active_state_value "active_stage")" \
    "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
    "pid=$(runner_state_pid_for_finish)" \
    "started_at=$(runner_state_started_at "$started_at")" \
    "last_event_at=${finished_at}" \
    "last_result=dry_run" \
    "last_runtime_log=${runtime_output_log_path}"
  runner_append_log "$runner_id" "run_dry_run" \
    "role=${public_role}" \
    "runtime_role=${runtime_role}" \
    "agent=${agent}" \
    "runtime_script=${runtime_path}" \
    "runtime_output_log_path=${runtime_output_log_path}"

  cat "$runtime_output_log_path"
  rm -f "$dry_run_output"
  exit 0
fi

started_at="$(runner_now_iso)"
runner_write_state "$runner_id" \
  "status=running" \
  "role=${public_role}" \
  "agent=${agent}" \
  "mode=${mode}" \
  "model=${model}" \
  "reasoning=${reasoning}" \
  "active_item=$(runner_active_state_value "active_item")" \
  "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
  "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
  "active_stage=$(runner_active_state_value "active_stage")" \
  "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
  "pid=$(runner_state_pid_for_start)" \
  "started_at=$(runner_state_started_at "$started_at")" \
  "last_event_at=${started_at}" \
  "last_result="
runner_append_log "$runner_id" "run_start" \
  "role=${public_role}" \
  "runtime_role=${runtime_role}" \
  "agent=${agent}" \
  "mode=${mode}"

runtime_output="$(mktemp "${TMPDIR:-/tmp}/autoflow-run-output.XXXXXX")"
runtime_command=("$runtime_path")
if [ "$public_role" = "wiki" ]; then
  runtime_command+=("update" "$project_root" "$board_dir_name")
fi
set +e
AUTOFLOW_ROLE="$runtime_role" \
  AUTOFLOW_WORKER_ID="$runner_id" \
  AUTOFLOW_BACKGROUND=1 \
  AUTOFLOW_BOARD_ROOT="$board_root" \
  AUTOFLOW_PROJECT_ROOT="$project_root" \
  "${runtime_command[@]}" > "$runtime_output" 2>&1
runtime_exit=$?
set -e

runtime_status="$(awk -F= '$1 == "status" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' "$runtime_output" 2>/dev/null || true)"
active_item="$(awk -F= '$1 == "claimed" || $1 == "verify" || $1 == "plan" { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' "$runtime_output" 2>/dev/null || true)"
[ -n "$active_item" ] || active_item="$(runner_active_state_value "active_item")"
finished_at="$(runner_now_iso)"
runtime_output_log_path="$(persist_run_artifact "$runtime_output" "runtime")"

if [ "$runtime_exit" -eq 0 ]; then
  command_status="ok"
  runner_status="idle"
else
  command_status="failed"
  runner_status="failed"
fi

runner_write_state "$runner_id" \
  "status=${runner_status}" \
  "role=${public_role}" \
  "agent=${agent}" \
  "mode=${mode}" \
  "model=${model}" \
  "reasoning=${reasoning}" \
  "active_item=${active_item}" \
  "active_ticket_id=$(runner_active_state_value "active_ticket_id")" \
  "active_ticket_title=$(runner_active_state_value "active_ticket_title")" \
  "active_stage=$(runner_active_state_value "active_stage")" \
  "active_spec_ref=$(runner_active_state_value "active_spec_ref")" \
  "pid=$(runner_state_pid_for_finish)" \
  "started_at=$(runner_state_started_at "$started_at")" \
  "last_event_at=${finished_at}" \
  "last_result=${runtime_status:-exit_${runtime_exit}}" \
  "last_runtime_log=${runtime_output_log_path}"
runner_append_log "$runner_id" "run_finish" \
  "role=${public_role}" \
  "runtime_status=${runtime_status:-}" \
  "exit_code=${runtime_exit}" \
  "runner_status=${runner_status}"

print_run_header "$command_status"
printf 'runner_status=%s\n' "$runner_status"
printf 'runtime_script=%s\n' "$runtime_path"
printf 'runtime_status=%s\n' "$runtime_status"
printf 'runtime_exit_code=%s\n' "$runtime_exit"
printf 'active_item=%s\n' "$active_item"
printf 'runtime_output_log_path=%s\n' "$runtime_output_log_path"
printf 'state_path=%s\n' "$(runner_state_path "$runner_id")"
printf 'log_path=%s\n' "$(runner_log_path "$runner_id")"
printf 'runtime_output_begin\n'
cat "$runtime_output"
printf 'runtime_output_end\n'
rm -f "$runtime_output"

if [ "$runtime_exit" -ne 0 ]; then
  exit "$runtime_exit"
fi
