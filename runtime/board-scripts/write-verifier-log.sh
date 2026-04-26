#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ticket_file="${1:-}"
run_file="${2:-}"
outcome="${3:-}"

if [ -z "$ticket_file" ] || [ -z "$run_file" ] || [ -z "$outcome" ]; then
  echo "Usage: write-verifier-log.sh <ticket-file> <run-file> <pass|fail>" >&2
  exit 1
fi

if [ ! -f "$ticket_file" ]; then
  echo "Ticket file not found: $ticket_file" >&2
  exit 1
fi

if [ ! -f "$run_file" ]; then
  echo "Run file not found: $run_file" >&2
  exit 1
fi

final_run_file="$(final_run_path_for_ticket_file "$ticket_file" "$outcome")"
if [ -n "$final_run_file" ] && [ "$final_run_file" != "$run_file" ]; then
  mkdir -p "$(dirname "$final_run_file")"
  if [ -f "$final_run_file" ]; then
    rm -f "$final_run_file"
  fi
  mv "$run_file" "$final_run_file"
  run_file="$final_run_file"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
ticket_title="$(ticket_scalar_field "$ticket_file" "Title")"
ticket_stage="$(ticket_scalar_field "$ticket_file" "Stage")"
verifier_owner="$(ticket_scalar_field "$ticket_file" "Verifier AI")"
display_verifier_owner="$(display_worker_id "$verifier_owner")"
result_summary="$(extract_scalar_field_in_section "$ticket_file" "Result" "Summary")"
project_key="$(project_key_from_ticket_file "$ticket_file")"
project_note="[[${project_key}]]"
plan_note_name="$(plan_note_name_from_ticket_file "$ticket_file")"
plan_note=""
if [ -n "$plan_note_name" ]; then
  plan_note="[[${plan_note_name}]]"
fi
ticket_note_name="$(ticket_note_name_from_ticket_file "$ticket_file")"
ticket_note="[[${ticket_note_name}]]"
verification_note_name="$(verification_note_name_for_ticket "$ticket_id")"
verification_note="[[${verification_note_name}]]"
timestamp="$(now_iso)"
timestamp_slug="$(printf '%s' "$timestamp" | tr -d ':-' | sed 's/T/_/' | sed 's/Z$//')Z"

log_dir="${BOARD_ROOT}/logs"
mkdir -p "$log_dir"
log_file="${log_dir}/verifier_${ticket_id}_${timestamp_slug}_${outcome}.md"

ticket_rel="$(board_relative_path "$ticket_file")"
run_rel="$(board_relative_path "$run_file")"
log_rel="$(board_relative_path "$log_file")"

case "$outcome" in
  pass) verification_result="passed" ;;
  fail) verification_result="failed" ;;
  *) verification_result="$outcome" ;;
esac

replace_section_block "$ticket_file" "Verification" "- Run file: \`${run_rel}\`
- Log file: \`${log_rel}\`
- Result: ${verification_result}"

{
  printf '# Verifier Completion Log\n\n'
  printf '## Meta\n\n'
  printf -- '- Ticket ID: %s\n' "$ticket_id"
  printf -- '- PRD Key: %s\n' "$project_key"
  printf -- '- Title: %s\n' "$ticket_title"
  printf -- '- Outcome: %s\n' "$outcome"
  printf -- '- Logged At: %s\n' "$timestamp"
  printf -- '- Verifier: %s\n' "${display_verifier_owner:-$verifier_owner}"
  printf -- '- Final Stage: %s\n' "$ticket_stage"
  printf -- '- Project Root: `%s`\n' "$PROJECT_ROOT"
  printf -- '- Board Root: `%s`\n' "$BOARD_ROOT"
  printf -- '- Ticket Path: `%s`\n' "$ticket_rel"
  printf -- '- Run File: `%s`\n' "$run_rel"
  printf '\n## Obsidian Links\n\n'
  printf -- '- Project Note: %s\n' "$project_note"
  printf -- '- Plan Note: %s\n' "$plan_note"
  printf -- '- Ticket Note: %s\n' "$ticket_note"
  printf -- '- Verification Note: %s\n' "$verification_note"
  printf '\n## Summary\n\n'
  printf -- '- Result Summary: %s\n' "${result_summary:-pending}"
  printf '\n## Ticket Snapshot\n\n```md\n'
  cat "$ticket_file"
  printf '\n```\n\n'
  printf '## Verification Record\n\n```md\n'
  cat "$run_file"
  printf '\n```\n'
} > "$log_file"

printf 'status=ok\n'
printf 'log=%s\n' "$log_file"
if clear_active_ticket_context_record 2>/dev/null; then
  printf 'context=active_cleared\n'
else
  printf 'context=no_context\n'
fi
