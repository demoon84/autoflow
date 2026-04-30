#!/usr/bin/env bash
# chat-once.sh — single-shot adapter call for the Autoflow Desktop chat surface.
#
# Reads a fully-built system+user prompt from a file and runs one of the
# configured CLI adapters (codex / claude / opencode / gemini) once. Writes the
# adapter's reply to stdout, diagnostics to stderr, and a final
# `status=ok|error` line to stderr so the caller can detect partial failures.
#
# This is intentionally a thin wrapper: the desktop main process is responsible
# for assembling the prompt (chat-prompts/*.txt + board snapshot + wiki answer
# excerpts + recent message window). chat-once.sh only invokes the CLI.

set -u
set -o pipefail

usage() {
  cat <<'USAGE' >&2
Usage:
  chat-once.sh --agent <codex|claude|opencode|gemini> --prompt-file <path>
               [--model <model>] [--reasoning <effort>]
               [--working-root <dir>] [--timeout-seconds <int>]

Reads the file at --prompt-file and runs one CLI adapter call.
Writes the adapter response to stdout. Writes diagnostic key=value lines to
stderr; the last stderr line is always either:
  status=ok
or
  status=error
  reason=<short reason>
USAGE
}

agent=""
model=""
reasoning=""
prompt_file=""
working_root="${PWD}"
timeout_seconds=""

while [ $# -gt 0 ]; do
  case "$1" in
    --agent)
      agent="${2:-}"
      shift 2
      ;;
    --model)
      model="${2:-}"
      shift 2
      ;;
    --reasoning)
      reasoning="${2:-}"
      shift 2
      ;;
    --prompt-file)
      prompt_file="${2:-}"
      shift 2
      ;;
    --working-root)
      working_root="${2:-}"
      shift 2
      ;;
    --timeout-seconds)
      timeout_seconds="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'status=error\n' >&2
      printf 'reason=unknown_option:%s\n' "$1" >&2
      usage
      exit 64
      ;;
  esac
done

if [ -z "$agent" ]; then
  printf 'status=error\nreason=missing_agent\n' >&2
  exit 64
fi
if [ -z "$prompt_file" ]; then
  printf 'status=error\nreason=missing_prompt_file\n' >&2
  exit 64
fi
if [ ! -r "$prompt_file" ]; then
  printf 'status=error\nreason=prompt_file_not_readable:%s\n' "$prompt_file" >&2
  exit 66
fi
if [ ! -d "$working_root" ]; then
  printf 'status=error\nreason=working_root_missing:%s\n' "$working_root" >&2
  exit 66
fi

ensure_agent_available() {
  local cli="$1"
  if ! command -v "$cli" >/dev/null 2>&1; then
    printf 'status=error\nreason=agent_cli_not_found:%s\n' "$cli" >&2
    return 127
  fi
  return 0
}

run_with_optional_timeout() {
  if [ -n "$timeout_seconds" ] && command -v timeout >/dev/null 2>&1; then
    timeout --foreground "$timeout_seconds" "$@"
  else
    "$@"
  fi
}

case "$agent" in
  codex)
    ensure_agent_available codex || exit $?
    cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$working_root")
    if [ -n "$model" ]; then
      cmd+=(-m "$model")
    fi
    if [ -n "$reasoning" ]; then
      cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
    fi
    cmd+=(-)
    if ! run_with_optional_timeout "${cmd[@]}" < "$prompt_file"; then
      rc=$?
      printf 'status=error\nreason=adapter_exit:%s\n' "$rc" >&2
      exit "$rc"
    fi
    ;;
  claude)
    ensure_agent_available claude || exit $?
    prompt_text="$(cat "$prompt_file")"
    cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
    if [ -n "$model" ]; then
      cmd+=(--model "$model")
    fi
    if [ -n "$reasoning" ] && claude --help 2>&1 | grep -q -- '--effort'; then
      cmd+=(--effort "$reasoning")
    fi
    cmd+=("$prompt_text")
    if ! (cd "$working_root" && run_with_optional_timeout "${cmd[@]}"); then
      rc=$?
      printf 'status=error\nreason=adapter_exit:%s\n' "$rc" >&2
      exit "$rc"
    fi
    ;;
  opencode)
    ensure_agent_available opencode || exit $?
    prompt_text="$(cat "$prompt_file")"
    cmd=(opencode run)
    if [ -n "$model" ]; then
      cmd+=(--model "$model")
    fi
    if [ -n "$reasoning" ]; then
      cmd+=(--variant "$reasoning")
    fi
    cmd+=("$prompt_text")
    if ! (cd "$working_root" && run_with_optional_timeout "${cmd[@]}"); then
      rc=$?
      printf 'status=error\nreason=adapter_exit:%s\n' "$rc" >&2
      exit "$rc"
    fi
    ;;
  gemini)
    ensure_agent_available gemini || exit $?
    prompt_text="$(cat "$prompt_file")"
    cmd=(gemini --approval-mode yolo --prompt "$prompt_text")
    if [ -n "$model" ]; then
      cmd+=(--model "$model")
    fi
    if ! (cd "$working_root" && run_with_optional_timeout "${cmd[@]}"); then
      rc=$?
      printf 'status=error\nreason=adapter_exit:%s\n' "$rc" >&2
      exit "$rc"
    fi
    ;;
  *)
    printf 'status=error\nreason=unsupported_agent:%s\n' "$agent" >&2
    exit 65
    ;;
esac

printf 'status=ok\n' >&2
exit 0
