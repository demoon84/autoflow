#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "todo"
set_thread_context_record "todo" "$(owner_id)" "" "" ""

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
worktree_output=""

if field_is_unassigned "$primary_owner"; then
  primary_owner="$claimed_by"
fi

if ! worktree_output="$(ensure_ticket_worktree "$claimed" 2>&1)"; then
  replace_scalar_field_in_section "$claimed" "## Ticket" "Stage" "blocked"
  replace_scalar_field_in_section "$claimed" "## Ticket" "Owner" "$claimed_by"
  replace_scalar_field_in_section "$claimed" "## Ticket" "Claimed By" "$claimed_by"
  replace_scalar_field_in_section "$claimed" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$claimed" "Next Action" "- 다음에 바로 이어서 할 일: worktree 생성 실패를 확인하고, 안전한 티켓별 작업 루트를 확보한 뒤 구현을 재개"
  append_note "$claimed" "Worktree setup failed at ${timestamp}: ${worktree_output}"
  set_thread_context_record "todo" "$claimed_by" "$ticket_id" "blocked" "$(board_relative_path "$claimed")"
  printf 'status=blocked\n'
  printf 'reason=worktree_setup_failed\n'
  printf 'claimed=%s\n' "$claimed"
  printf '%s\n' "$worktree_output"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
fi

implementation_root="$(ticket_working_root "$claimed")"

replace_scalar_field_in_section "$claimed" "## Ticket" "Stage" "executing"
replace_scalar_field_in_section "$claimed" "## Ticket" "Owner" "$primary_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Claimed By" "$claimed_by"
replace_scalar_field_in_section "$claimed" "## Ticket" "Execution Owner" "$execution_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Verifier Owner" "$verifier_owner"
replace_scalar_field_in_section "$claimed" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$claimed" "Next Action" "- 다음에 바로 이어서 할 일: Worktree Path 의 작업 루트에서 Allowed Paths 범위 안으로 Goal 을 구현하고, 완료되면 \`scripts/handoff-todo.*\` 런타임으로 중앙 보드의 이 티켓 파일을 \`tickets/verifier/\` 로 넘긴다."
replace_section_block "$claimed" "Resume Context" "- 현재 상태 요약: todo 에서 점유되어 inprogress 로 이동. 같은 todo worker 가 구현까지 책임진다.
- 직전 작업: scripts/start-todo.sh 로 claim 완료
- 재개 시 먼저 볼 것: Worktree, Goal, Allowed Paths, Done When, Notes 의 진행 로그
- 구현 작업 루트: \`${implementation_root}\`"
append_note "$claimed" "Claimed by ${claimed_by} at ${timestamp}; execution=${execution_owner}; verifier=${verifier_owner}; worktree=${implementation_root}"
set_thread_context_record "todo" "$claimed_by" "$ticket_id" "executing" "$(board_relative_path "$claimed")"

printf 'status=ok\n'
printf 'claimed=%s\n' "$claimed"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'claimed_by=%s\n' "$claimed_by"
printf 'execution_owner=%s\n' "$execution_owner"
printf 'verifier_owner=%s\n' "$verifier_owner"
printf '%s\n' "$worktree_output"
printf 'implementation_root=%s\n' "$implementation_root"
printf 'stage=executing\n'
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'next_action=Implement inside implementation_root within Allowed Paths; when done, run scripts/handoff-todo.* for this central board ticket so verifier heartbeat can pick it up and active context is cleared.\n'
