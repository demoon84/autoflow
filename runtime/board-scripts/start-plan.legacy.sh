#!/usr/bin/env bash

# Plan AI runtime (post-refactor 2026-04-27).
#
# Plan AI now owns three responsibilities — all purely board-side, no product
# code edits — and emits a ticket in tickets/todo/ as the only output:
#   1. Auto-replan rejected tickets back to todo (reject/ -> todo/).
#   2. Promote lightweight orders in tickets/inbox/ into PRD/todo work.
#   3. Convert populated PRDs in backlog/ into a fresh Todo-NNN.md in todo/.
# Legacy plan/ files (rules/plan or tickets/plan) are still consumed as a
# transitional fallback when neither (1), (2), nor (3) yields work, so older
# sample boards keep functioning.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "plan"

worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
set_thread_context_record "plan" "$worker_id" "" "" ""

requested_id="${1:-}"
requested_normalized=""
if [ -n "$requested_id" ]; then
  requested_normalized="$(normalize_id "$requested_id" || true)"
fi

# Reject queue + blocked-dirty orchestration were removed (refactor 2026-05-07).
# Single-worker + .gitignore separation means dirty PROJECT_ROOT no longer
# arises from autoflow itself, and all worker fails flow through inbox retry
# orders. emit_replan_skipped_metadata stays as a no-op so older callers do not
# crash.
emit_replan_skipped_metadata() {
  return 0
}
replan_skipped_file=""

extract_section_checklist() {
  local file="$1"
  local heading="$2"

  awk -v heading="$heading" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- \[[ xX]\]/ { print }
  ' "$file"
}

# --- Ralph loop guards (lint + iteration fingerprint) -------------------------

lint_ticket_enabled() {
  case "${AUTOFLOW_LINT_TICKET:-on}" in
    off|false|0|no) return 1 ;;
    *) return 0 ;;
  esac
}

iteration_fingerprint_enabled() {
  case "${AUTOFLOW_ITERATION_FINGERPRINT:-on}" in
    off|false|0|no) return 1 ;;
    *) return 0 ;;
  esac
}

# Wraps lint-ticket.js invocation. Captures exit code without tripping set -e
# and prints lint output keys to stdout via the caller's printf chain. Returns
# the lint exit code (0=ok|warn, 1=block).
#
# Fix (PRD 211 follow-up, 2026-05-09): the previous `set +e` / `set -e` toggle
# leaked the inner `set -e` back to the caller scope when the lint blocked, so
# `lint-ticket.js` returning 1 killed the planner runner with exit 1 before
# `promote_spec_to_todo_or_exit` could emit `source=vague-done-when`. Use the
# `cmd || rc=$?` pattern which captures the rc without tripping set -e and
# without manipulating the script-wide set state.
run_lint_ticket() {
  local target="$1"
  local lint_script="${SCRIPT_DIR}/lint-ticket.js"
  local rc

  [ -x "$lint_script" ] || return 0

  rc=0
  "$lint_script" "$target" || rc=$?
  return "$rc"
}

extract_spec_allowed_paths() {
  local file="$1"

  awk '
    /^## Allowed Paths/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*[-*] / {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      if ($0 != "" && $0 != "...") print "- " $0
    }
  ' "$file"
}

project_key_has_ticket() {
  local project_key="$1"
  local file current_project_key

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    current_project_key="$(project_key_from_ticket_file "$file")"
    [ "$current_project_key" = "$project_key" ] && return 0
  done < <(list_ticket_record_files_under "${BOARD_ROOT}/tickets")

  return 1
}

select_populated_spec() {
  local spec_file id

  if [ -n "$requested_normalized" ]; then
    for spec_file in \
      "${BOARD_ROOT}/tickets/backlog/prd_${requested_normalized}.md" \
      "${BOARD_ROOT}/tickets/backlog/project_${requested_normalized}.md"; do
      if [ -f "$spec_file" ] && ! spec_file_is_placeholder "$spec_file"; then
        printf '%s' "$spec_file"
        return 0
      fi
    done
    return 1
  fi

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    spec_file_is_placeholder "$spec_file" && continue
    id="$(extract_numeric_id "$spec_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$spec_file"
    return 0
  done < <(
    list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md' 'project_*.md'
  )

  return 1
}

order_ref_is_already_promoted() {
  local order_ref="$1"
  local spec_file

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    [ -f "$spec_file" ] || continue
    if grep -Fq -- "Source: \`${order_ref}\`" "$spec_file" || grep -Fq -- "Source: ${order_ref}" "$spec_file"; then
      return 0
    fi
  done < <(
    {
      list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md' 'project_*.md'
      if [ -d "${BOARD_ROOT}/tickets/done" ]; then
        find "${BOARD_ROOT}/tickets/done" -mindepth 2 -maxdepth 2 -type f \( -name 'prd_*.md' -o -name 'project_*.md' \)
      fi
    }
  )

  return 1
}

order_file_is_actionable() {
  local order_file="$1"
  local order_ref status

  [ -f "$order_file" ] || return 1
  order_ref="$(board_relative_path "$order_file")"
  if order_ref_is_already_promoted "$order_ref"; then
    return 1
  fi

  status="$(extract_scalar_field_in_section "$order_file" "Order" "Status")"
  status="$(trim_spaces "$status")"

  case "$status" in
    ""|inbox|ready|pending|needs-info)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

select_inbox_order() {
  local order_file id

  if [ -n "$requested_normalized" ]; then
    order_file="${BOARD_ROOT}/tickets/inbox/order_${requested_normalized}.md"
    if order_file_is_actionable "$order_file"; then
      printf '%s' "$order_file"
      return 0
    fi
    return 1
  fi

  while IFS= read -r order_file; do
    [ -n "$order_file" ] || continue
    order_file_is_actionable "$order_file" || continue
    id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$order_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inbox" 'order_*.md')

  return 1
}

# PRD 211 (2026-05-09): retry order (`order_*_retry_*.md`) 전용 selector. retry
# order 는 이미 backlog 의 PRD 와 묶여 있어 새 PRD 작성을 트리거하지 않고
# 기존 흐름을 그대로 따른다. 따라서 backlog-first 정책에서 제외하고 별도
# branch 에서 처리하기 위해 선별한다.
order_file_is_retry() {
  case "$(basename "${1:-}")" in
    order_*_retry_*.md) return 0 ;;
    *) return 1 ;;
  esac
}

select_inbox_retry_order() {
  local order_file id

  while IFS= read -r order_file; do
    [ -n "$order_file" ] || continue
    order_file_is_retry "$order_file" || continue
    order_file_is_actionable "$order_file" || continue
    id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$order_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inbox" 'order_*_retry_*.md')

  return 1
}

# PRD 211: non-retry inbox order 만 선별. retry 는 별도 branch 에서 처리한다.
select_inbox_nonretry_order() {
  local order_file id

  if [ -n "$requested_normalized" ]; then
    order_file="${BOARD_ROOT}/tickets/inbox/order_${requested_normalized}.md"
    if order_file_is_actionable "$order_file" && ! order_file_is_retry "$order_file"; then
      printf '%s' "$order_file"
      return 0
    fi
    return 1
  fi

  while IFS= read -r order_file; do
    [ -n "$order_file" ] || continue
    order_file_is_retry "$order_file" && continue
    order_file_is_actionable "$order_file" || continue
    id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$order_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inbox" 'order_*.md')

  return 1
}

# PRD 211: backlog-first starvation guard. 같은 backlog PRD 가 연속으로
# 선택만 되고 promote 가 안 되면 (vague-done-when, needs_user_secret,
# project_already_has_ticket 같은 block 으로) inbox order 가 영원히
# starve 한다. 같은 spec 이 AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT (기본 3)
# tick 연속 stuck 이면 그 tick 한정으로 inbox fallback. fire 되면 카운터를
# 0 으로 reset 해서 다음 라운드에 다시 backlog 우선이 회복된다.
backlog_first_stuck_state_path() {
  printf '%s/runners/state/backlog-first-stuck.json' "$BOARD_ROOT"
}

backlog_first_stuck_count() {
  local spec_file="$1"
  local state_file basename count
  state_file="$(backlog_first_stuck_state_path)"
  basename="$(basename "$spec_file")"
  count=0
  if [ -f "$state_file" ] && command -v jq >/dev/null 2>&1; then
    count="$(jq -r --arg key "$basename" '.[$key] // 0' "$state_file" 2>/dev/null || printf '0')"
    case "$count" in ''|*[!0-9]*) count=0 ;; esac
  fi
  printf '%s' "$count"
}

backlog_first_stuck_set() {
  local spec_file="$1"
  local new_count="$2"
  local state_file basename tmp
  state_file="$(backlog_first_stuck_state_path)"
  basename="$(basename "$spec_file")"
  mkdir -p "$(dirname "$state_file")"
  if ! command -v jq >/dev/null 2>&1; then
    return 0
  fi
  tmp="${state_file}.tmp.$$"
  if [ -f "$state_file" ]; then
    if ! jq --arg key "$basename" --argjson v "$new_count" '. + {($key): $v}' "$state_file" > "$tmp" 2>/dev/null; then
      printf '{"%s": %s}\n' "$basename" "$new_count" > "$tmp"
    fi
  else
    printf '{"%s": %s}\n' "$basename" "$new_count" > "$tmp"
  fi
  mv "$tmp" "$state_file" 2>/dev/null || rm -f "$tmp"
}

backlog_first_stuck_clear() {
  local spec_file="$1"
  local state_file basename tmp
  state_file="$(backlog_first_stuck_state_path)"
  basename="$(basename "$spec_file")"
  if [ ! -f "$state_file" ] || ! command -v jq >/dev/null 2>&1; then
    return 0
  fi
  tmp="${state_file}.tmp.$$"
  if jq --arg key "$basename" 'del(.[$key])' "$state_file" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$state_file" 2>/dev/null || rm -f "$tmp"
  else
    rm -f "$tmp"
  fi
}

# Returns 0 if guard fires (fallback to inbox), 1 otherwise. Side effect:
# bumps the counter for this spec, or resets it on guard fire so the next
# round starts fresh.
backlog_first_stuck_check_and_bump() {
  local spec_file="$1"
  local limit count
  limit="${AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT:-3}"
  case "$limit" in ''|*[!0-9]*) limit=3 ;; esac
  count="$(backlog_first_stuck_count "$spec_file")"
  count=$((count + 1))
  if [ "$count" -ge "$limit" ]; then
    backlog_first_stuck_clear "$spec_file"
    return 0
  fi
  backlog_first_stuck_set "$spec_file" "$count"
  return 1
}

select_order_generated_spec() {
  local spec_file order_ref

  while IFS= read -r spec_file; do
    [ -n "$spec_file" ] || continue
    [ -f "$spec_file" ] || continue
    spec_file_is_placeholder "$spec_file" && continue
    order_ref="$(extract_spec_source_order_ref "$spec_file")"
    case "$order_ref" in
      tickets/inbox/order_*.md)
        printf '%s' "$spec_file"
        return 0
        ;;
    esac
  done < <(
    list_matching_files "${BOARD_ROOT}/tickets/backlog" 'prd_*.md' 'project_*.md'
  )

  return 1
}

extract_spec_source_order_ref() {
  local file="$1"

  awk '
    $0 == "## Conversation Handoff" { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- Source:[[:space:]]*/ {
      sub(/^[[:space:]]*- Source:[[:space:]]*/, "", $0)
      gsub(/`/, "", $0)
      print
      exit
    }
  ' "$file"
}

# --- Express path: order -> todo (skips PRD authoring) -----------------------
# Read a scalar field under `## Order` (e.g. Title, Express, Priority).
extract_order_field() {
  local file="$1"
  local field="$2"
  extract_scalar_field_in_section "$file" "Order" "$field"
}

# Order is express-eligible iff (a) ## Order has `- Express: true|yes|1|on`,
# (b) ## Allowed Paths lists ≥1 concrete path, (c) ## Done When has ≥1 `- [ ]`.
# Returns 0 if eligible, 1 otherwise. No side effects.
order_is_express_eligible() {
  local file="$1"
  local express raw_paths raw_done_when

  [ -f "$file" ] || return 1

  express="$(trim_spaces "$(extract_order_field "$file" "Express" 2>/dev/null || true)")"
  case "$(printf '%s' "$express" | tr '[:upper:]' '[:lower:]')" in
    true|yes|1|on) ;;
    *) return 1 ;;
  esac

  raw_paths="$(awk '
    /^## Allowed Paths/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*[-*][[:space:]]+/ {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      if ($0 != "" && $0 != "...") print
    }
  ' "$file" 2>/dev/null || true)"
  [ -n "$raw_paths" ] || return 1

  raw_done_when="$(awk '
    /^## Done When/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- \[[ xX]\]/ { print }
  ' "$file" 2>/dev/null || true)"
  [ -n "$raw_done_when" ] || return 1

  return 0
}

select_express_inbox_order() {
  local order_file id

  if [ -n "$requested_normalized" ]; then
    order_file="${BOARD_ROOT}/tickets/inbox/order_${requested_normalized}.md"
    if order_file_is_actionable "$order_file" && order_is_express_eligible "$order_file"; then
      printf '%s' "$order_file"
      return 0
    fi
    return 1
  fi

  while IFS= read -r order_file; do
    [ -n "$order_file" ] || continue
    order_file_is_actionable "$order_file" || continue
    order_is_express_eligible "$order_file" || continue
    id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    printf '%s' "$order_file"
    return 0
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inbox" 'order_*.md')

  return 1
}

# Promote an express-eligible order directly to tickets/todo/ without a PRD.
# project_key = `express_<order_id>` so commits read [EXPRESS_NNN][ticket_NNN]
# via the existing finalizer code path. Returns the new ticket file path on
# stdout and archives the consumed order under done/<project_key>/.
create_express_todo_from_order() {
  local order_file="$1"
  local order_id project_key ticket_id ticket_file ticket_note project_note timestamp
  local title goal priority priority_lc allowed_paths done_when verification_command change_type request_body notes_body
  local order_archive_dir order_archive_path order_basename

  order_id="$(extract_numeric_id "$order_file" 2>/dev/null || true)"
  [ -n "$order_id" ] || return 1

  project_key="express_${order_id}"
  ticket_id="$(next_ticket_id)"
  ticket_file="$(ticket_path "todo" "$ticket_id")"
  ticket_note="[[Todo-${ticket_id}]]"
  project_note="[[${project_key}]]"
  timestamp="$(now_iso)"

  title="$(trim_spaces "$(extract_order_field "$order_file" "Title" 2>/dev/null || true)")"
  [ -n "$title" ] || title="Express order ${order_id}"

  priority="$(trim_spaces "$(extract_order_field "$order_file" "Priority" 2>/dev/null || true)")"
  priority_lc="$(printf '%s' "$priority" | tr '[:upper:]' '[:lower:]')"
  case "$(trim_spaces "$priority_lc")" in
    critical|crit|p0) priority="critical" ;;
    high|p1) priority="high" ;;
    low|p3) priority="low" ;;
    *) priority="normal" ;;
  esac

  change_type="$(trim_spaces "$(extract_order_field "$order_file" "Change Type" 2>/dev/null || true)")"
  case "$(printf '%s' "$change_type" | tr '[:upper:]' '[:lower:]')" in
    docs) change_type="docs" ;;
    cleanup) change_type="cleanup" ;;
    infra) change_type="infra" ;;
    *) change_type="code" ;;
  esac

  allowed_paths="$(awk '
    /^## Allowed Paths/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*[-*][[:space:]]+/ {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      if ($0 != "" && $0 != "...") print "- " $0
    }
  ' "$order_file" 2>/dev/null || true)"

  done_when="$(awk '
    /^## Done When/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*- \[[ xX]\]/ { print }
  ' "$order_file" 2>/dev/null || true)"

  verification_command="$(extract_scalar_field_in_section "$order_file" "Verification" "Command" 2>/dev/null || true)"

  request_body="$(awk '
    /^## Request/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section { print }
  ' "$order_file" 2>/dev/null || true)"

  goal="$(printf '%s\n' "$request_body" | awk 'NF { print; exit }' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$goal" ] || goal="Express 처리 대상: ${title}"

  notes_body="$(awk '
    /^## Notes/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && NF { print }
  ' "$order_file" 2>/dev/null || true)"

  order_basename="$(basename "$order_file")"

  mkdir -p "$(dirname "$ticket_file")"
  {
    cat <<TICKETHEADER
# Ticket

## Ticket

- ID: Todo-${ticket_id}
- PRD Key: ${project_key}
- Plan Candidate: Express promotion from tickets/inbox/${order_basename}
- Title: ${title}
- Priority: ${priority}
- Change Type: ${change_type}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: (express; no PRD authored)
- Order: tickets/done/${project_key}/${order_basename}
- Plan Source: express-skip-prd

## Reference Notes

- Project Note: ${project_note}
- Plan Note:
- Ticket Note: ${ticket_note}

## Allowed Paths

${allowed_paths}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

${done_when}

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 가 이 express 티켓을 todo 에서 claim 한 뒤, Allowed Paths 안에서 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다. PRD 단계는 의도적으로 생략됐다.

## Resume Context

- 현재 상태 요약: Express order ${order_id} 가 PRD 없이 todo 로 직접 승격된 직후.
- 직전 작업: scripts/start-plan.sh 의 express 분기가 order 파일을 읽어 todo 를 생성했다.
- 재개 시 먼저 볼 것: Order, Goal, Allowed Paths, Done When.

## Notes

- Created by ${display_id} (Plan AI, express path) from tickets/inbox/${order_basename} at ${timestamp}.
- Express promotion: order_${order_id} 의 Allowed Paths 와 Done When 이 모두 명시돼 있어 PRD 단계를 생략했다.
TICKETHEADER

    if [ -n "$notes_body" ]; then
      printf '\n### Order Notes\n\n'
      printf '%s\n' "$notes_body"
    fi

    cat <<TICKETFOOTER

### Original Request

${request_body}

## Verification

- Command: ${verification_command}
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
TICKETFOOTER
  } > "$ticket_file"

  order_archive_dir="${BOARD_ROOT}/tickets/done/${project_key}"
  mkdir -p "$order_archive_dir"
  order_archive_path="${order_archive_dir}/${order_basename}"
  if [ -f "$order_archive_path" ] && [ "$order_archive_path" != "$order_file" ]; then
    rm -f "$order_archive_path"
  fi
  mv "$order_file" "$order_archive_path"

  printf '%s' "$ticket_file"
}

archive_source_order_for_spec() {
  local project_key="$1"
  local spec_file="$2"
  local order_ref order_file target_file

  order_ref="$(extract_spec_source_order_ref "$spec_file")"
  case "$order_ref" in
    tickets/inbox/order_*.md)
      ;;
    *)
      return 0
      ;;
  esac

  order_file="${BOARD_ROOT}/${order_ref}"
  [ -f "$order_file" ] || return 0

  target_file="${BOARD_ROOT}/tickets/done/${project_key}/$(basename "$order_file")"
  if [ -f "$target_file" ]; then
    if cmp -s "$order_file" "$target_file"; then
      rm -f "$order_file"
    fi
    return 0
  fi

  mkdir -p "$(dirname "$target_file")"
  mv "$order_file" "$target_file"
}

create_todo_ticket_from_spec() {
  local spec_file="$1"
  local spec_ref project_key ticket_id ticket_file ticket_note project_note
  local archived_spec_ref archived_spec_file title goal priority priority_lc change_type allowed_paths done_when verification_command timestamp

  spec_ref="$(board_relative_path "$spec_file")"
  project_key="$(project_key_from_spec_ref "$spec_ref")"

  if project_key_has_ticket "$project_key"; then
    printf 'status=blocked\n'
    printf 'reason=project_already_has_ticket\n'
    printf 'project_key=%s\n' "$project_key"
    printf 'spec=%s\n' "$spec_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    exit 0
  fi

  archived_spec_ref="$(archive_spec_to_done_if_needed "$spec_ref")"
  archived_spec_file="${BOARD_ROOT}/${archived_spec_ref}"
  archive_source_order_for_spec "$project_key" "$archived_spec_file"
  ticket_id="$(next_ticket_id)"
  ticket_file="$(ticket_path "todo" "$ticket_id")"
  ticket_note="[[Todo-${ticket_id}]]"
  project_note="[[${project_key}]]"
  timestamp="$(now_iso)"

  title="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Name")"
  goal="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Goal")"
  priority="$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Priority")"
  priority_lc="$(printf '%s' "$priority" | tr '[:upper:]' '[:lower:]')"
  case "$(trim_spaces "$priority_lc")" in
    critical|crit|p0) priority="critical" ;;
    high|p1) priority="high" ;;
    low|p3) priority="low" ;;
    *) priority="normal" ;;
  esac
  change_type="$(trim_spaces "$(extract_scalar_field_in_section "$archived_spec_file" "Project" "Change Type" 2>/dev/null || true)")"
  case "$(printf '%s' "$change_type" | tr '[:upper:]' '[:lower:]')" in
    docs) change_type="docs" ;;
    cleanup) change_type="cleanup" ;;
    infra) change_type="infra" ;;
    *) change_type="code" ;;
  esac
  verification_command="$(extract_scalar_field_in_section "$archived_spec_file" "Verification" "Command")"
  allowed_paths="$(extract_spec_allowed_paths "$archived_spec_file")"
  done_when="$(extract_section_checklist "$archived_spec_file" "Global Acceptance Criteria")"

  [ -n "$title" ] || title="AI work for ${project_key}"
  [ -n "$goal" ] || goal="Implement the approved spec for ${project_key}."
  [ -n "$allowed_paths" ] || allowed_paths="- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims."
  [ -n "$done_when" ] || done_when="- [ ] Implementation stays inside Allowed Paths
- [ ] Verification evidence is recorded before done/reject"

  mkdir -p "$(dirname "$ticket_file")"
  cat > "$ticket_file" <<EOF
# Ticket

## Ticket

- ID: Todo-${ticket_id}
- PRD Key: ${project_key}
- Plan Candidate: Plan AI handoff from ${archived_spec_ref}
- Title: ${title}
- Priority: ${priority}
- Change Type: ${change_type}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: ${archived_spec_ref}
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: ${project_note}
- Plan Note:
- Ticket Note: ${ticket_note}

## Allowed Paths

${allowed_paths}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

${done_when}

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by ${display_id} (Plan AI) from ${archived_spec_ref} at ${timestamp}.

## Verification

- Command: ${verification_command}
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
EOF

  printf '%s' "$ticket_file"
}

promote_spec_to_todo_or_exit() {
  local spec_file="$1"
  local lint_status_value=""
  local lint_score_value=""
  local lint_terms_value=""
  local lint_output_file lint_rc created_ticket
  local required_secrets missing_secrets missing_secrets_csv spec_ref secret_note

  required_secrets="$(extract_prd_required_secret_names "$spec_file")"
  if [ -n "$required_secrets" ]; then
    missing_secrets="$(printf '%s\n' "$required_secrets" | missing_required_secret_names)"
    if [ -n "$missing_secrets" ]; then
      missing_secrets_csv="$(printf '%s\n' "$missing_secrets" | join_lines_csv)"
      spec_ref="$(board_relative_path "$spec_file")"
      secret_note="Planner secret preflight: missing_secrets=${missing_secrets_csv}; source=${spec_ref}; status=needs_user_secret"
      replace_scalar_field_in_section "$spec_file" "## Project" "Status" "needs_user_secret"
      append_note_once "$spec_file" "$secret_note"
      printf 'status=ok\n'
      printf 'source=needs-user-secret\n'
      printf 'spec=%s\n' "$spec_file"
      printf 'missing_secrets=%s\n' "$missing_secrets_csv"
      printf 'failure_class=needs_user_decision\n'
      printf 'recovery_state=needs_user\n'
      emit_replan_skipped_metadata "$replan_skipped_file"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      printf 'next_action=Set %s, then rerun planner to promote %s.\n' "$missing_secrets_csv" "$spec_ref"
      exit 0
    fi
  fi

  # Done When / Global Acceptance Criteria vagueness lint (Ralph loop pattern
  # (a)): if the PRD's Completion Promise is too vague to verify, do not promote
  # to todo. The planner orchestrator AI is expected to either rework the PRD
  # via spec-author-agent or override AUTOFLOW_LINT_TICKET=off after review.
  if lint_ticket_enabled; then
    lint_output_file="$(autoflow_mktemp)"
    set +e
    run_lint_ticket "$spec_file" > "$lint_output_file" 2>&1
    lint_rc=$?
    set -e
    lint_status_value="$(awk -F= '/^lint_status=/ { print $2; exit }' "$lint_output_file" 2>/dev/null || true)"
    lint_score_value="$(awk -F= '/^vagueness_score=/ { print $2; exit }' "$lint_output_file" 2>/dev/null || true)"
    lint_terms_value="$(awk -F= '/^vague_terms=/ { sub(/^vague_terms=/, ""); print; exit }' "$lint_output_file" 2>/dev/null || true)"
    if [ "$lint_rc" -ne 0 ] || [ "$lint_status_value" = "block" ]; then
      printf 'status=ok\n'
      printf 'source=vague-done-when\n'
      printf 'spec=%s\n' "$spec_file"
      printf 'lint_status=%s\n' "${lint_status_value:-block}"
      printf 'lint_vagueness_score=%s\n' "${lint_score_value:-unknown}"
      printf 'lint_vague_terms=%s\n' "${lint_terms_value:-}"
      printf 'failure_class=vague_completion_promise\n'
      printf 'recovery_state=needs_user\n'
      emit_replan_skipped_metadata "$replan_skipped_file"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      printf 'next_action=PRD %s has a vague Completion Promise (lint_status=%s, vagueness_score=%s). spec-author-agent must rework Done When / Global Acceptance Criteria with concrete signals (commands, file paths, exit codes, numeric metrics) before promoting to todo. Override only after review with AUTOFLOW_LINT_TICKET=off.\n' \
        "$(board_relative_path "$spec_file")" \
        "${lint_status_value:-block}" \
        "${lint_score_value:-unknown}"
      exit 0
    fi
  fi

  created_ticket="$(create_todo_ticket_from_spec "$spec_file")"
  if [ -n "$lint_status_value" ] && [ -f "$created_ticket" ]; then
    replace_scalar_field_in_section "$created_ticket" "## Goal Runtime" "Last Lint Status" "$lint_status_value"
    replace_scalar_field_in_section "$created_ticket" "## Goal Runtime" "Last Lint Vagueness Score" "${lint_score_value:-0}"
  fi
  printf 'status=ok\n'
  printf 'source=backlog-to-todo\n'
  printf 'spec=%s\n' "$spec_file"
  printf 'todo_ticket=%s\n' "$created_ticket"
  if [ -n "$lint_status_value" ]; then
    printf 'lint_status=%s\n' "$lint_status_value"
    printf 'lint_vagueness_score=%s\n' "${lint_score_value:-0}"
  fi
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Todo %s created from %s; hand off to ticket owner.\n' "$(basename "$created_ticket")" "$(board_relative_path "$spec_file")"
  exit 0
}

# --- Branch 1.5: express inbox order -> todo ticket (skips PRD) -------------
# Express orders carry their own Allowed Paths + Done When + Verification, so
# the planner promotes them straight to todo without spending an LLM tick on
# PRD authoring. Express is fail-safe: if the order is malformed, the eligibility
# check returns false and the standard inbox-order branch handles it.
express_order_file="$(select_express_inbox_order || true)"
if [ -n "$express_order_file" ]; then
  express_ticket_file="$(create_express_todo_from_order "$express_order_file" || true)"
  if [ -n "$express_ticket_file" ] && [ -f "$express_ticket_file" ]; then
    printf 'status=ok\n'
    printf 'source=express-order-to-todo\n'
    printf 'order=tickets/done/express_%s/%s\n' \
      "$(extract_numeric_id "$express_order_file")" \
      "$(basename "$express_order_file")"
    printf 'todo_ticket=%s\n' "$express_ticket_file"
    printf 'project_key=express_%s\n' "$(extract_numeric_id "$express_order_file")"
    printf 'path=express\n'
    emit_replan_skipped_metadata "$replan_skipped_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Express ticket %s ready for ticket owner; PRD authoring skipped.\n' "$(basename "$express_ticket_file")"
    exit 0
  fi
fi

# --- Branch 1.9: order-generated backlog PRD -> todo ticket ------------------
# If an earlier planner turn already promoted an order into backlog, finish that
# order pipeline before selecting another inbox order. This prevents generated
# order PRDs from starving behind a growing inbox queue.
spec_file="$(select_order_generated_spec || true)"
if [ -n "$spec_file" ]; then
  promote_spec_to_todo_or_exit "$spec_file"
fi

# --- Branch 2.0: retry inbox order -> AI-generated PRD/todo (same flow) ------
# PRD 211 (2026-05-09): retry order 는 기존 PRD 와 묶여 있어 backlog-first
# 정책에서 제외하고 항상 우선 처리한다. 이렇게 해야 backlog 의 같은 PRD 와
# 자연스럽게 매칭된다.
retry_order_file="$(select_inbox_retry_order || true)"
if [ -n "$retry_order_file" ]; then
  printf 'status=ok\n'
  printf 'source=order-inbox-retry\n'
  printf 'order=%s\n' "$retry_order_file"
  printf 'order_id=%s\n' "$(extract_numeric_id "$retry_order_file")"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Promote retry order %s per plan-to-ticket-agent.md, then rerun start-plan.\n' "$(board_relative_path "$retry_order_file")"
  exit 0
fi

# --- Branch 2.5: priority + category policy (PRD 211, 2026-05-09) ------------
# 같은 priority 안에서 backlog PRD → todo 변환을 새 PRD 작성보다 우선한다.
# priority 가 다르면 priority enum (rule 20) 이 카테고리(backlog vs inbox)
# 보다 우선. 같은 backlog PRD 가 AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT 회 연속
# stuck 이면 그 tick 한정으로 inbox fallback (starvation guard).
nonretry_order_file="$(select_inbox_nonretry_order || true)"
spec_file="$(select_populated_spec || true)"

policy_pick=""
if [ -n "$nonretry_order_file" ] || [ -n "$spec_file" ]; then
  if [ -z "$nonretry_order_file" ]; then
    policy_pick="spec"
  elif [ -z "$spec_file" ]; then
    policy_pick="order"
  else
    order_rank="$(extract_priority_rank "$nonretry_order_file" 2>/dev/null || printf '2')"
    spec_rank="$(extract_priority_rank "$spec_file" 2>/dev/null || printf '2')"
    case "$order_rank" in ''|*[!0-9]*) order_rank=2 ;; esac
    case "$spec_rank" in ''|*[!0-9]*) spec_rank=2 ;; esac
    if [ "$order_rank" -lt "$spec_rank" ]; then
      policy_pick="order"
    elif [ "$spec_rank" -lt "$order_rank" ]; then
      policy_pick="spec"
    else
      if backlog_first_stuck_check_and_bump "$spec_file"; then
        policy_pick="order"
      else
        policy_pick="spec"
      fi
    fi
  fi
fi

if [ "$policy_pick" = "spec" ] && [ -n "$spec_file" ]; then
  promote_spec_to_todo_or_exit "$spec_file"
fi

if [ "$policy_pick" = "order" ] && [ -n "$nonretry_order_file" ]; then
  printf 'status=ok\n'
  printf 'source=order-inbox\n'
  printf 'order=%s\n' "$nonretry_order_file"
  printf 'order_id=%s\n' "$(extract_numeric_id "$nonretry_order_file")"
  emit_replan_skipped_metadata "$replan_skipped_file"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Promote order %s per plan-to-ticket-agent.md, then rerun start-plan.\n' "$(board_relative_path "$nonretry_order_file")"
  exit 0
fi

# --- Branch 4: legacy plan/ fallback -----------------------------------------
plan_root="$(plan_root_path 2>/dev/null || true)"
if [ -n "$plan_root" ] && [ -d "$plan_root" ]; then
  legacy_plan="$(lowest_matching_file "$plan_root" 'plan_[0-9][0-9][0-9].md' || true)"
  if [ -n "$legacy_plan" ] && ! plan_file_is_placeholder "$legacy_plan"; then
    printf 'status=ok\n'
    printf 'source=legacy-plan\n'
    printf 'plan=%s\n' "$legacy_plan"
    emit_replan_skipped_metadata "$replan_skipped_file"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Convert unticketed candidates from legacy plan %s.\n' "$legacy_plan"
    exit 0
  fi
fi

# --- Idle --------------------------------------------------------------------
printf 'status=idle\n'
printf 'reason=no_actionable_plan_input\n'
emit_replan_skipped_metadata "$replan_skipped_file"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'worker_role=%s\n' "$(worker_role)"
