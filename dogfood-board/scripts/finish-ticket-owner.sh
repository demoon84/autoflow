#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") <ticket-id-or-path> <pass|fail> [summary-or-reject-reason]" >&2
}

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  usage
  exit 1
fi

ensure_expected_role "ticket-owner"

ticket_ref="$1"
outcome="$2"
message="${3:-}"
worker_id="$(owner_id)"
timestamp="$(now_iso)"

case "$outcome" in
  pass|fail) ;;
  *)
    usage
    exit 1
    ;;
esac

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

reject_reason_exists() {
  local file="$1"
  awk '
    /^## Reject Reason/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && NF > 0 { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$file"
}

append_reject_reason() {
  local file="$1"
  local reason="$2"

  if reject_reason_exists "$file"; then
    return 0
  fi

  {
    printf '\n## Reject Reason\n\n'
    printf -- '- %s\n' "$reason"
  } >> "$file"
}

git_commit_if_possible() {
  local ticket_file="$1"
  local ticket_id title summary git_root commit_message

  if [ "${AUTOFLOW_OWNER_SKIP_COMMIT:-}" = "1" ]; then
    printf 'commit_status=skipped_by_env\n'
    return 0
  fi

  git_root="$(git_root_path || true)"
  if [ -z "$git_root" ]; then
    printf 'commit_status=not_git_repo\n'
    return 0
  fi

  ticket_id="$(extract_numeric_id "$ticket_file")"
  title="$(ticket_scalar_field "$ticket_file" "Title")"
  summary="$(extract_scalar_field_in_section "$ticket_file" "Result" "Summary")"
  [ -n "$title" ] || title="tickets_${ticket_id}"
  [ -n "$summary" ] || summary="complete ticket-owner work"
  commit_message="[$title] $summary"

  git -C "$git_root" add .
  if git -C "$git_root" diff --cached --quiet; then
    printf 'commit_status=no_changes\n'
    return 0
  fi

  git -C "$git_root" commit -m "$commit_message" >/dev/null
  printf 'commit_status=committed\n'
  printf 'commit_hash=%s\n' "$(git -C "$git_root" rev-parse --verify HEAD)"
}

prefix_wiki_output() {
  awk '
    index($0, "=") > 0 {
      print "wiki." $0
      next
    }
    NF > 0 {
      count += 1
      print "wiki.output." count "=" $0
    }
  '
}

auto_update_wiki() {
  local wiki_output wiki_exit

  if [ "${AUTOFLOW_SKIP_WIKI_UPDATE:-}" = "1" ]; then
    printf 'wiki.status=skipped_by_env\n'
    return 0
  fi

  if [ ! -x "${BOARD_ROOT}/scripts/update-wiki.sh" ]; then
    printf 'wiki.status=missing_runtime\n'
    printf 'wiki.script=%s\n' "${BOARD_ROOT}/scripts/update-wiki.sh"
    return 0
  fi

  set +e
  wiki_output="$("${BOARD_ROOT}/scripts/update-wiki.sh" 2>&1)"
  wiki_exit="$?"
  set -e

  if [ "$wiki_exit" -eq 0 ]; then
    printf '%s\n' "$wiki_output" | prefix_wiki_output
    return 0
  fi

  printf 'wiki.status=failed\n'
  printf 'wiki.exit_code=%s\n' "$wiki_exit"
  printf '%s\n' "$wiki_output" | prefix_wiki_output
}

ticket_file="$(resolve_ticket_file "$ticket_ref" || true)"
if [ -z "$ticket_file" ] || [ ! -f "$ticket_file" ]; then
  fail_or_idle "Ticket file not found: ${ticket_ref}" "ticket_owner_finish_ticket_missing"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
run_file="$(pending_run_path "$ticket_id")"
if [ ! -f "$run_file" ]; then
  run_file="$(ensure_runs_file "$ticket_id")"
fi

replace_scalar_field_in_section "$run_file" "## Meta" "Status" "$outcome"

case "$outcome" in
  pass)
    if [ -n "$message" ]; then
      replace_scalar_field_in_section "$ticket_file" "## Result" "Summary" "$message"
    fi

    integration_output="$("${BOARD_ROOT}/scripts/integrate-worktree.sh" "$ticket_file" 2>&1)" || {
      replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
      append_note "$ticket_file" "Ticket owner pass finish blocked during integration at ${timestamp}: ${integration_output}"
      printf 'status=blocked\n'
      printf 'reason=integration_failed\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf '%s\n' "$integration_output"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    }

    done_target="$(done_ticket_path_for_ticket_file "$ticket_file")"
    mkdir -p "$(dirname "$done_target")"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "done"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- 완료됨: ticket-owner pass 처리와 evidence log 기록 완료."
    append_note "$ticket_file" "Ticket owner ${worker_id} marked pass at ${timestamp}."
    if [ "$ticket_file" != "$done_target" ]; then
      mv "$ticket_file" "$done_target"
      ticket_file="$done_target"
    fi

    log_output="$("${BOARD_ROOT}/scripts/write-verifier-log.sh" "$ticket_file" "$run_file" pass)"
    wiki_output="$(auto_update_wiki)"
    commit_output="$(git_commit_if_possible "$ticket_file")"

    printf 'status=done\n'
    printf 'outcome=pass\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'run=%s\n' "$(done_run_path_for_ticket_file "$ticket_file")"
    printf '%s\n' "$integration_output"
    printf '%s\n' "$log_output"
    printf '%s\n' "$wiki_output"
    printf '%s\n' "$commit_output"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    ;;
  fail)
    if [ -z "$message" ] && ! reject_reason_exists "$ticket_file"; then
      printf 'status=blocked\n'
      printf 'reason=missing_reject_reason\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf 'next_action=Re-run with a concrete reject reason as the third argument or add a ## Reject Reason section to the ticket.\n'
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    fi

    [ -z "$message" ] || append_reject_reason "$ticket_file" "$message"

    reject_target="$(reject_ticket_path_for_ticket_file "$ticket_file")"
    mkdir -p "$(dirname "$reject_target")"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "rejected"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier Owner" "$worker_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- reject 처리됨: Reject Reason 을 기준으로 재작업 범위를 정한다."
    append_note "$ticket_file" "Ticket owner ${worker_id} marked fail at ${timestamp}."
    if [ "$ticket_file" != "$reject_target" ]; then
      mv "$ticket_file" "$reject_target"
      ticket_file="$reject_target"
    fi

    log_output="$("${BOARD_ROOT}/scripts/write-verifier-log.sh" "$ticket_file" "$run_file" fail)"
    wiki_output="$(auto_update_wiki)"

    printf 'status=rejected\n'
    printf 'outcome=fail\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'run=%s\n' "$(reject_run_path_for_ticket_file "$ticket_file")"
    printf '%s\n' "$log_output"
    printf '%s\n' "$wiki_output"
    printf 'commit_status=not_committed_failed_ticket\n'
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    ;;
esac
