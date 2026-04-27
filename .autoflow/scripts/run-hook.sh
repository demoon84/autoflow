#!/usr/bin/env bash

set -euo pipefail

requested_board_root=""
config_path=""
role=""
trigger_path=""
change_type=""
dry_run="false"

usage() {
  echo "Usage: run-hook.sh --role <ticket|plan|todo|verifier> [--board-root <path>] [--config-path <path>] [--trigger-path <path>] [--change-type <type>] [--dry-run]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --role)
      role="${2:-}"
      shift 2
      ;;
    --board-root)
      requested_board_root="${2:-}"
      shift 2
      ;;
    --config-path)
      config_path="${2:-}"
      shift 2
      ;;
    --trigger-path)
      trigger_path="${2:-}"
      shift 2
      ;;
    --change-type)
      change_type="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run="true"
      shift
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

case "$role" in
  ticket|ticket-owner|owner)
    role="ticket"
    ;;
  plan|todo|verifier)
    ;;
  *)
    usage
    exit 1
    ;;
esac

if [ -n "$requested_board_root" ]; then
  export AUTOFLOW_BOARD_ROOT="$requested_board_root"
fi

source "$(cd "$(dirname "$0")" && pwd)/common.sh"
source "$(cd "$(dirname "$0")" && pwd)/file-watch-common.sh"

if [ "$BOARD_ROOT" = "$PROJECT_ROOT" ]; then
  BOARD_PROMPT_ROOT="."
else
  case "${BOARD_ROOT}/" in
    "${PROJECT_ROOT}/"*) BOARD_PROMPT_ROOT="${BOARD_ROOT#${PROJECT_ROOT}/}" ;;
    *) BOARD_PROMPT_ROOT="$BOARD_ROOT" ;;
  esac
fi

if [ -z "$config_path" ]; then
  config_path="$(file_watch_default_config_path)"
else
  config_path="$(normalize_runtime_path "$config_path")"
fi

default_worker_id="${role}-hook"
[ "$role" = "ticket" ] && default_worker_id="owner-hook"

dispatch="$(file_watch_route_setting "$config_path" "$role" "Dispatch" "codex")"
worker_id="$(file_watch_route_setting "$config_path" "$role" "WorkerId" "$default_worker_id")"
model_name="$(file_watch_route_setting "$config_path" "$role" "Model" "")"
custom_command="$(file_watch_route_setting "$config_path" "$role" "Command" "")"

execution_pool=""
verifier_pool=""
max_load=""
if [ "$role" = "todo" ]; then
  execution_pool="$(file_watch_route_setting "$config_path" "$role" "ExecutionPool" "$worker_id")"
  verifier_pool="$(file_watch_route_setting "$config_path" "$role" "VerifierPool" "verify-hook")"
  max_load="$(file_watch_route_setting "$config_path" "$role" "MaxExecutionLoadPerWorker" "1")"
fi

if [ -n "$custom_command" ]; then
  dispatch="shell"
fi

trigger_line="- Trigger Path: ${trigger_path:-"(none)"}"
change_line="- Change Type: ${change_type:-"(unknown)"}"

ticket_prompt() {
  cat <<EOF
Autoflow Hook Mode: ticket-owner

This run was triggered by the file watcher for the board at \`${BOARD_ROOT}\` (project root: \`${PROJECT_ROOT}\`).
Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn.

Language policy: write user-visible chat/terminal prose in Korean by default. Keep machine-readable keys, paths, commands, code, ticket fields, and required board formats unchanged.

Worker identity:
- Role: ticket-owner
- Worker Id: ${worker_id}
- Permission Mode: pre-authorized within the current project and board scope

Hook context:
${trigger_line}
${change_line}

Do exactly one current hook turn:
1. Read the repo instructions, \`${BOARD_PROMPT_ROOT}/agents/ticket-owner-agent.md\`, and the current board state.
2. Run \`${BOARD_PROMPT_ROOT}/scripts/start-ticket-owner.sh\` to resume an owned inprogress ticket, claim a ready ticket, adopt a legacy verifier ticket, or create one inprogress ticket from a populated backlog spec.
3. Keep the same owner responsible for mini-plan, implementation, verification command execution, evidence recording, and ready-to-merge/reject movement. Do not split the work across planner/todo/verifier roles.
4. Implement only within the ticket's Allowed Paths and record durable progress in Notes, Result, and Resume Context.
5. When ready, run \`${BOARD_PROMPT_ROOT}/scripts/verify-ticket-owner.sh <ticket-id>\` to write command/output/evidence, then \`${BOARD_PROMPT_ROOT}/scripts/finish-ticket-owner.sh <ticket-id> pass "<summary>"\` or \`fail "<concrete reason>"\`.
6. Treat board file moves, evidence recording, and worktree snapshot preparation as pre-authorized inside the current project/board. The AI owner must run and judge verification, manually merge into PROJECT_ROOT, and resolve conflicts; scripts only finalize/record after the AI-merged result exists. Never git push.
7. If there is no actionable work, leave the runner idle with a concise reason.
8. Exit after the current hook turn is complete.
EOF
}

plan_prompt() {
  cat <<EOF
Autoflow Hook Mode: plan

This run was triggered by the file watcher for the board at \`${BOARD_ROOT}\` (project root: \`${PROJECT_ROOT}\`).
Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn.

Language policy: write user-visible chat/terminal prose in Korean by default. Keep machine-readable keys, paths, commands, code, ticket fields, and required board formats unchanged.

Worker identity:
- Role: plan
- Worker Id: ${worker_id}

Hook context:
${trigger_line}
${change_line}

Do exactly one current hook turn:
1. Read the repo instructions and Autoflow board files.
2. Inspect \`${BOARD_PROMPT_ROOT}/tickets/backlog/\`, \`${BOARD_PROMPT_ROOT}/tickets/plan/\`, \`${BOARD_PROMPT_ROOT}/tickets/reject/\`, and the current ticket state.
3. If a populated spec has no real plan or only a placeholder plan, create or update the matching plan draft.
4. If a plan is actionable, generate todo tickets as appropriate.
5. If \`reject_NNN.md\` files exist, fold each \`## Reject Reason\` back into the matching plan as a new execution candidate; after the retry todo is created, archive the reject file under \`${BOARD_PROMPT_ROOT}/tickets/done/<project-key>/\`.
6. If this hook was triggered by a pass into \`${BOARD_PROMPT_ROOT}/tickets/done/<project-key>/\`, treat that as a signal to scan backlog again and continue with the next populated spec when one is waiting.
7. Do not stop at the first generated plan if another populated backlog spec still lacks a real plan or only has a placeholder plan. Drain the backlog for planning work as far as this current hook turn reasonably can.
8. Keep chat output short; durable context belongs in Obsidian links and board files, and the next hook turn should reload from \`${BOARD_PROMPT_ROOT}/\` rather than chat history.
9. Do not claim todo work, do not implement code, do not verify, do not commit, and do not push.
10. Exit after the current hook turn is complete.
EOF
}

todo_prompt() {
  cat <<EOF
Autoflow Hook Mode: todo

This run was triggered by the file watcher for the board at \`${BOARD_ROOT}\` (project root: \`${PROJECT_ROOT}\`).
Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn.

Language policy: write user-visible chat/terminal prose in Korean by default. Keep machine-readable keys, paths, commands, code, ticket fields, and required board formats unchanged.

Worker identity:
- Role: todo
- Worker Id: ${worker_id}

Hook context:
${trigger_line}
${change_line}

Do exactly one current hook turn:
1. Read the repo instructions and Autoflow board files.
2. Resume any existing inprogress ticket owned by \`${worker_id}\` if one exists; otherwise claim one todo ticket.
3. Implement only within each ticket's Allowed Paths.
4. If you resume an existing inprogress ticket, refresh the active ticket context with \`powershell -ExecutionPolicy Bypass -File ${BOARD_PROMPT_ROOT}/scripts/set-thread-context.ps1 todo <worker-id> <ticket-id> executing <ticket-path>\` on Windows, or \`${BOARD_PROMPT_ROOT}/scripts/set-thread-context.sh todo <worker-id> <ticket-id> executing <ticket-path>\` in Bash-only environments, before continuing.
5. Update Notes, Last Updated, Next Action, and Resume Context as you work.
6. Board stage is authoritative. If a ticket is in \`${BOARD_PROMPT_ROOT}/tickets/todo/\` or \`${BOARD_PROMPT_ROOT}/tickets/inprogress/\`, treat it as todo implementation work even when the Title, Goal, or Done When sounds like checking or verification.
7. If Done When is satisfied, fill Result.Summary and run \`powershell -ExecutionPolicy Bypass -File ${BOARD_PROMPT_ROOT}/scripts/handoff-todo.ps1 <ticket-id-or-path>\` on Windows, or \`${BOARD_PROMPT_ROOT}/scripts/handoff-todo.sh <ticket-id-or-path>\` in Bash-only environments. The handoff runtime moves the ticket to \`${BOARD_PROMPT_ROOT}/tickets/verifier/\`, marks Verification pending, and clears only the active ticket context so the todo role can continue with the next ticket.
8. Keep chat output short; durable context belongs in Resume Context, Notes, Result, and Obsidian links.
9. Do not verify, do not commit, and do not push.
10. Exit after the current hook turn is complete.
EOF
}

verifier_prompt() {
  cat <<EOF
Autoflow Hook Mode: verifier

This run was triggered by the file watcher for the board at \`${BOARD_ROOT}\` (project root: \`${PROJECT_ROOT}\`).
Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn.

Language policy: write user-visible chat/terminal prose in Korean by default. Keep machine-readable keys, paths, commands, code, ticket fields, and required board formats unchanged.

Worker identity:
- Role: verifier
- Worker Id: ${worker_id}
- Permission Mode: pre-authorized within the current project and board scope

Hook context:
${trigger_line}
${change_line}

Do exactly one current hook turn:
1. Read the repo instructions and Autoflow board files.
2. Pick one ticket from \`${BOARD_PROMPT_ROOT}/tickets/verifier/\`.
3. Verify it against the referenced spec and verifier rules.
4. Treat local verification commands, browser checks, ticket/log file moves, and local git commit inside the current project/board as pre-authorized. Do not ask the user for permission.
5. Browser policy: prefer non-browser checks; if rendering is required, do not use Playwright. Use the current agent browser tool instead: Codex uses the Codex browser tool, Claude uses the Claude browser tool. Close any opened browser tool tab before ending this turn unless the user explicitly asked to keep it open.
6. Write or update \`${BOARD_PROMPT_ROOT}/tickets/runs/verify_NNN.md\`.
7. Write a verifier completion log under \`${BOARD_PROMPT_ROOT}/logs/\`.
8. Pass: move the ticket to the matching \`${BOARD_PROMPT_ROOT}/tickets/done/<project-key>/\` folder and make a local git commit if the project uses git. Use commit message format \`[ticket title] concise change summary\`; take the bracket text from the ticket \`Title\` and keep the summary to one short line.
9. Fail: append \`## Reject Reason\` and move the ticket to \`${BOARD_PROMPT_ROOT}/tickets/reject/reject_NNN.md\`.
10. The write-verifier-log runtime clears the active runtime context after pass/fail logging; prefer \`write-verifier-log.ps1\` on Windows and use \`.sh\` only in Bash-only environments. Rely on Obsidian links and board files for the next verification target.
11. Never git push.
12. Exit after the current hook turn is complete.
EOF
}

build_shell_command() {
  case "$role" in
    ticket)
      printf 'cd %s && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=%s ./scripts/start-ticket-owner.sh' \
        "$(shell_quote "$BOARD_ROOT")" \
        "$(shell_quote "$worker_id")"
      ;;
    plan)
      printf 'cd %s && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=%s ./scripts/start-plan.sh' \
        "$(shell_quote "$BOARD_ROOT")" \
        "$(shell_quote "$worker_id")"
      ;;
    todo)
      printf 'cd %s && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=todo AUTOFLOW_WORKER_ID=%s AUTOFLOW_EXECUTION_POOL=%s AUTOFLOW_VERIFIER_POOL=%s AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=%s ./scripts/start-todo.sh' \
        "$(shell_quote "$BOARD_ROOT")" \
        "$(shell_quote "$worker_id")" \
        "$(shell_quote "$execution_pool")" \
        "$(shell_quote "$verifier_pool")" \
        "$(shell_quote "$max_load")"
      ;;
    verifier)
      printf 'cd %s && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=verifier AUTOFLOW_WORKER_ID=%s ./scripts/start-verifier.sh' \
        "$(shell_quote "$BOARD_ROOT")" \
        "$(shell_quote "$worker_id")"
      ;;
  esac
}

build_prompt() {
  case "$role" in
    ticket)
      ticket_prompt
      ;;
    plan)
      plan_prompt
      ;;
    todo)
      todo_prompt
      ;;
    verifier)
      verifier_prompt
      ;;
  esac
}

run_with_capture() {
  local stdout_file="$1"
  local stderr_file="$2"
  shift 2

  if "$@" >"$stdout_file" 2>"$stderr_file"; then
    return 0
  fi

  return $?
}

emit_capture_block() {
  local label="$1"
  local file="$2"

  printf '%s<<EOF\n' "$label"
  if [ -f "$file" ]; then
    cat "$file"
  fi
  printf 'EOF\n'
}

stdout_file="$(mktemp)"
stderr_file="$(mktemp)"
trap 'rm -f "$stdout_file" "$stderr_file"' EXIT

env_args=(
  "AUTOFLOW_ROLE=$( [ "$role" = "ticket" ] && printf 'ticket-owner' || printf '%s' "$role" )"
  "AUTOFLOW_WORKER_ID=$worker_id"
  "AUTOFLOW_BOARD_ROOT=$BOARD_ROOT"
  "AUTOFLOW_PROJECT_ROOT=$PROJECT_ROOT"
  "AUTOFLOW_BACKGROUND=1"
)

if [ "$role" = "todo" ]; then
  env_args+=(
    "AUTOFLOW_EXECUTION_POOL=$execution_pool"
    "AUTOFLOW_VERIFIER_POOL=$verifier_pool"
    "AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=$max_load"
  )
fi

command_summary=""
prompt_summary=""

if [ "$dispatch" = "shell" ]; then
  if [ -n "$custom_command" ]; then
    command_summary="$custom_command"
  else
    command_summary="$(build_shell_command)"
  fi

  if [ "$dry_run" = "true" ]; then
    printf 'status=dry_run\n'
    printf 'role=%s\n' "$role"
    printf 'dispatch=shell\n'
    printf 'command=%s\n' "$command_summary"
    exit 0
  fi

  if env "${env_args[@]}" bash -lc "$command_summary" >"$stdout_file" 2>"$stderr_file"; then
    exit_code=0
  else
    exit_code=$?
  fi

  printf 'status=%s\n' "$( [ "$exit_code" -eq 0 ] && printf 'ok' || printf 'fail' )"
  printf 'role=%s\n' "$role"
  printf 'dispatch=shell\n'
  printf 'command=%s\n' "$command_summary"
  [ -n "$trigger_path" ] && printf 'trigger_path=%s\n' "$trigger_path"
  [ -n "$change_type" ] && printf 'change_type=%s\n' "$change_type"
  emit_capture_block "stdout" "$stdout_file"
  emit_capture_block "stderr" "$stderr_file"
  exit "$exit_code"
fi

prompt_summary="$(build_prompt)"
codex_args=(exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$PROJECT_ROOT")
if [ -n "$model_name" ]; then
  codex_args+=(-m "$model_name")
fi
codex_args+=("$prompt_summary")

if [ "$dry_run" = "true" ]; then
  printf 'status=dry_run\n'
  printf 'role=%s\n' "$role"
  printf 'dispatch=codex\n'
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'prompt<<EOF\n%s\nEOF\n' "$prompt_summary"
  exit 0
fi

if env "${env_args[@]}" codex "${codex_args[@]}" >"$stdout_file" 2>"$stderr_file"; then
  exit_code=0
else
  exit_code=$?
fi

printf 'status=%s\n' "$( [ "$exit_code" -eq 0 ] && printf 'ok' || printf 'fail' )"
printf 'role=%s\n' "$role"
printf 'dispatch=codex\n'
printf 'project_root=%s\n' "$PROJECT_ROOT"
[ -n "$trigger_path" ] && printf 'trigger_path=%s\n' "$trigger_path"
[ -n "$change_type" ] && printf 'change_type=%s\n' "$change_type"
printf 'prompt<<EOF\n%s\nEOF\n' "$prompt_summary"
emit_capture_block "stdout" "$stdout_file"
emit_capture_block "stderr" "$stderr_file"
exit "$exit_code"
