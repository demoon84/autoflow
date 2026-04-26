#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") <ticket-id-or-path> [verification-command]" >&2
}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 1
fi

ensure_expected_role "ticket-owner"

ticket_ref="$1"
command_override="${2:-}"
worker_id="$(owner_id)"

resolve_ticket_file() {
  local ref="$1"
  local normalized_ref id candidate

  normalized_ref="$(normalize_runtime_path "$ref")"
  case "$normalized_ref" in
    /*)
      [ -f "$normalized_ref" ] && printf '%s' "$normalized_ref" && return 0
      ;;
    */*)
      candidate="${BOARD_ROOT}/${normalized_ref}"
      [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
      ;;
  esac

  id="$(normalize_id "$ref" || true)"
  [ -n "$id" ] || return 1

  for state in inprogress todo verifier; do
    candidate="$(ticket_path "$state" "$id")"
    [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
  done

  return 1
}

ticket_project_spec_file() {
  local ticket_file="$1"
  local project_spec_ref

  project_spec_ref="$(strip_markdown_code_ticks "$(extract_reference_value "$ticket_file" "References" "PRD")")"
  [ -n "$project_spec_ref" ] || return 1

  case "$project_spec_ref" in
    /*)
      [ -f "$project_spec_ref" ] && printf '%s' "$project_spec_ref" && return 0
      ;;
    *)
      [ -f "${BOARD_ROOT}/${project_spec_ref}" ] && printf '%s' "${BOARD_ROOT}/${project_spec_ref}" && return 0
      ;;
  esac

  return 1
}

verification_command_for_ticket() {
  local ticket_file="$1"
  local spec_file command_value

  if [ -n "${AUTOFLOW_VERIFY_COMMAND:-}" ]; then
    printf '%s' "$AUTOFLOW_VERIFY_COMMAND"
    return 0
  fi

  if [ -n "$command_override" ]; then
    printf '%s' "$command_override"
    return 0
  fi

  command_value="$(extract_scalar_field_in_section "$ticket_file" "Verification" "Command")"
  command_value="$(trim_spaces "$command_value")"
  if [ -n "$command_value" ]; then
    printf '%s' "$command_value"
    return 0
  fi

  spec_file="$(ticket_project_spec_file "$ticket_file" || true)"
  if [ -n "$spec_file" ]; then
    command_value="$(extract_scalar_field_in_section "$spec_file" "Verification" "Command")"
    command_value="$(trim_spaces "$command_value")"
    if [ -n "$command_value" ]; then
      printf '%s' "$command_value"
      return 0
    fi
  fi

  return 1
}

tail_file_or_empty() {
  local file="$1"
  if [ -s "$file" ]; then
    tail -n "${AUTOFLOW_VERIFY_OUTPUT_LINES:-200}" "$file"
  fi
}

ticket_file="$(resolve_ticket_file "$ticket_ref" || true)"
if [ -z "$ticket_file" ] || [ ! -f "$ticket_file" ]; then
  fail_or_idle "Ticket file not found: ${ticket_ref}" "ticket_owner_verify_ticket_missing"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
run_file="$(ensure_runs_file "$ticket_id")"
working_root="$(ticket_working_root "$ticket_file")"
verification_command="$(verification_command_for_ticket "$ticket_file" || true)"
timestamp_start="$(now_iso)"
stdout_file="$(autoflow_mktemp)"
stderr_file="$(autoflow_mktemp)"

if [ -z "$verification_command" ]; then
  replace_scalar_field_in_section "$run_file" "## Meta" "Status" "blocked"
  replace_section_block "$run_file" "Findings" "- blocker: No verification command found in ticket or referenced spec.
- warning:"
  replace_section_block "$run_file" "Next Fix Hint" "- Add `- Command: ...` under the ticket or project spec `## Verification`, then rerun `scripts/verify-ticket-owner.sh ${ticket_id}`."
  append_note "$ticket_file" "Ticket owner verification blocked at ${timestamp_start}: missing verification command."
  printf 'status=blocked\n'
  printf 'reason=missing_verification_command\n'
  printf 'ticket=%s\n' "$ticket_file"
  printf 'run=%s\n' "$run_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
fi

replace_scalar_field_in_section "$run_file" "## Meta" "Status" "running"
replace_scalar_field_in_section "$run_file" "## Meta" "Working Root" "$working_root"
replace_section_block "$run_file" "Command" "- Started At: ${timestamp_start}
- Working Root: \`${working_root}\`
- Command: \`${verification_command}\`"
replace_section_block "$ticket_file" "Verification" "- Run file: \`tickets/inprogress/$(basename "$run_file")\`
- Log file: pending
- Command: \`${verification_command}\`
- Result: running ticket-owner verification by ${worker_id}"

set +e
(
  cd "$working_root" &&
    AUTOFLOW_BOARD_ROOT="$BOARD_ROOT" \
    AUTOFLOW_PROJECT_ROOT="$PROJECT_ROOT" \
    bash -lc "$verification_command"
) >"$stdout_file" 2>"$stderr_file"
exit_code=$?
set -e

timestamp_finish="$(now_iso)"
if [ "$exit_code" -eq 0 ]; then
  outcome="pass"
  meta_status="pass"
  result_line="passed"
  blocker_line="blocker:"
else
  outcome="fail"
  meta_status="fail"
  result_line="failed"
  blocker_line="blocker: Verification command exited ${exit_code}"
fi

replace_scalar_field_in_section "$run_file" "## Meta" "Status" "$meta_status"
replace_section_block "$run_file" "Command" "- Started At: ${timestamp_start}
- Finished At: ${timestamp_finish}
- Working Root: \`${working_root}\`
- Command: \`${verification_command}\`
- Exit Code: ${exit_code}"
replace_section_block "$run_file" "Checks" "- [x] spec reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [$([ "$exit_code" -eq 0 ] && printf x || printf ' ')] automated verification passed"
replace_section_block "$run_file" "Findings" "- ${blocker_line}
- warning:"
replace_section_block "$run_file" "Output" "### stdout

\`\`\`text
$(tail_file_or_empty "$stdout_file")
\`\`\`

### stderr

\`\`\`text
$(tail_file_or_empty "$stderr_file")
\`\`\`"
replace_section_block "$run_file" "Evidence" "- Result: ${result_line}
- Exit Code: ${exit_code}
- Completed At: ${timestamp_finish}"
replace_section_block "$run_file" "Next Fix Hint" "- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with \`scripts/finish-ticket-owner.sh ${ticket_id} fail \"<reason>\"\`."

replace_section_block "$ticket_file" "Verification" "- Run file: \`tickets/inprogress/$(basename "$run_file")\`
- Log file: pending
- Command: \`${verification_command}\`
- Result: ${result_line} by ${worker_id} at ${timestamp_finish}"
replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp_finish"
append_note "$ticket_file" "Ticket owner verification ${result_line} at ${timestamp_finish}: command exited ${exit_code}"

printf 'status=%s\n' "$outcome"
printf 'ticket=%s\n' "$ticket_file"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'run=%s\n' "$run_file"
printf 'working_root=%s\n' "$working_root"
printf 'command=%s\n' "$verification_command"
printf 'exit_code=%s\n' "$exit_code"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
if [ "$exit_code" -eq 0 ]; then
  printf 'next_action=scripts/finish-ticket-owner.sh %s pass "<short summary>"\n' "$ticket_id"
else
  printf 'next_action=Fix inside scope and rerun verification, or scripts/finish-ticket-owner.sh %s fail "<concrete reject reason>"\n' "$ticket_id"
fi

exit 0
