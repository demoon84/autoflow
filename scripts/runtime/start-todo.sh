#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "todo"

if ! execution_pool_has_capacity; then
  fail_or_idle "No available execution slot for todo claim." "execution_pool_full"
fi

claim_one() {
  local source_file target_file id

  if [ -n "${1:-}" ]; then
    id="$(normalize_id "$1")"
    source_file="$(ticket_path "todo" "$id")"
    target_file="$(ticket_path "inprogress" "$id")"
    if mv "$source_file" "$target_file" 2>/dev/null; then
      printf '%s' "$target_file"
      return 0
    fi
    return 1
  fi

  while IFS= read -r source_file; do
    [ -n "$source_file" ] || continue
    id="$(extract_numeric_id "$source_file")"
    target_file="$(ticket_path "inprogress" "$id")"
    if mv "$source_file" "$target_file" 2>/dev/null; then
      printf '%s' "$target_file"
      return 0
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/todo" 'tickets_*.md')

  return 1
}

claimed="$(claim_one "${1:-}" || true)"
if [ -z "$claimed" ]; then
  fail_or_idle "No claimable todo ticket found." "no_todo_ticket"
fi

ticket_id="$(extract_numeric_id "$claimed")"
timestamp="$(now_iso)"
claimed_by="$(owner_id)"
execution_owner="$(resolve_execution_owner_for_claim)"
verifier_owner="$(resolve_verifier_owner_for_claim)"
primary_owner="$execution_owner"

if field_is_unassigned "$primary_owner"; then
  primary_owner="$claimed_by"
fi

replace_scalar_field_in_section "$claimed" "## Ticket" "Stage" "executing"
replace_scalar_field_in_section "$claimed" "## Ticket" "Owner" "$primary_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Claimed By" "$claimed_by"
replace_scalar_field_in_section "$claimed" "## Ticket" "Execution Owner" "$execution_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Verifier Owner" "$verifier_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$claimed" "Next Action" "- 다음에 바로 이어서 할 일: Allowed Paths 범위 안에서 Goal 을 구현하고, 완료되면 이 티켓 파일을 \`tickets/verifier/\` 로 mv 해서 검증 대기 상태로 넘긴다."
replace_section_block "$claimed" "Resume Context" "- 현재 상태 요약: todo 에서 점유되어 inprogress 로 이동. 같은 todo worker 가 구현까지 책임진다.
- 직전 작업: scripts/start-todo.sh 로 claim 완료
- 재개 시 먼저 볼 것: Goal, Allowed Paths, Done When, Notes 의 진행 로그"
append_note "$claimed" "Claimed by ${claimed_by} at ${timestamp}; execution=${execution_owner}; verifier=${verifier_owner}"

printf 'status=ok\n'
printf 'claimed=%s\n' "$claimed"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'claimed_by=%s\n' "$claimed_by"
printf 'execution_owner=%s\n' "$execution_owner"
printf 'verifier_owner=%s\n' "$verifier_owner"
printf 'stage=executing\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'next_action=Implement within Allowed Paths; when done, mv this ticket file to tickets/verifier/ for the verifier heartbeat to pick up.\n'
