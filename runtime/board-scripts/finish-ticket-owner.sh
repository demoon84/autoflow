#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"
source "$(cd "$(dirname "$0")" && pwd)/runner-common.sh"

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
display_id="$(display_worker_id "$worker_id")"
owner_pid="$(ticket_owner_lock_pid)"
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

  for state in inprogress ready-to-merge todo verifier; do
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

clear_runner_active_state() {
  local state_path temp_file

  state_path="${BOARD_ROOT}/runners/state/${worker_id}.state"
  [ -f "$state_path" ] || return 0

  temp_file="$(autoflow_mktemp)"
  awk -F= '
    BEGIN {
      order[1] = "active_item"
      order[2] = "active_ticket_id"
      order[3] = "active_ticket_title"
      order[4] = "active_stage"
      order[5] = "active_spec_ref"
      order[6] = "active_recovery_reason"
      order[7] = "active_recovery_status"
      order[8] = "active_recovery_failure_class"
      order[9] = "active_recovery_worktree_path"
      order[10] = "active_recovery_worktree_status"
      order[11] = "active_recovery_board_state"
      order[12] = "last_result"
      for (idx = 1; idx <= 12; idx += 1) {
        values[order[idx]] = ""
      }
    }
    {
      if ($1 in values) {
        print $1 "=" values[$1]
        seen[$1] = 1
        next
      }
      print $0
    }
    END {
      for (idx = 1; idx <= 12; idx += 1) {
        key = order[idx]
        if (!(key in seen)) {
          print key "=" values[key]
        }
      }
    }
  ' "$state_path" > "$temp_file"
  mv "$temp_file" "$state_path"
}

# Single fail finalize path: emit inbox retry order + rm inprogress ticket.
# All worker-pass blockers (sanity gate, dirty conflict, merge prep fail,
# inline merge blocked, shared path, missing reject reason) route here so
# inprogress never accumulates Stage=blocked tickets and planner re-plans
# every fail through the same lane.
#
# Uses outer-scope vars: ticket_file, ticket_id, message, timestamp,
#                       BOARD_ROOT, PROJECT_ROOT.
# Args: $1 = failure_class, $2 = reject_message (optional)
route_to_inbox_retry() {
  local _failure_class="$1"
  local _reject_msg="${2:-}"
  local _retry_prd_key _retry_title _retry_fp_input _retry_fingerprint
  local _retry_inbox_dir _retry_prior_count _retry_count _retry_max _retry_decision
  local _retry_iso_compact _retry_inbox_path _ticket_body_snapshot _wiki_output

  [ -n "$_reject_msg" ] && append_reject_reason "$ticket_file" "$_reject_msg" 2>/dev/null || true

  _retry_prd_key="$(awk '/^## Ticket/{flag=1; next} /^## /{flag=0} flag && /^- PRD Key:/{
      sub(/^- PRD Key:[[:space:]]*/, "")
      sub(/[[:space:]]+$/, "")
      print
      exit
    }' "$ticket_file" 2>/dev/null || true)"
  _retry_title="$(awk '/^## Ticket/{flag=1; next} /^## /{flag=0} flag && /^- Title:/{
      sub(/^- Title:[[:space:]]*/, "")
      sub(/[[:space:]]+$/, "")
      print
      exit
    }' "$ticket_file" 2>/dev/null || true)"

  _retry_fp_input="$(printf '%s|%s|%s|%s\n' "$_retry_prd_key" "$_retry_title" "$_failure_class" "$_reject_msg")"
  _retry_fingerprint=""
  if command -v sha256sum >/dev/null 2>&1; then
    _retry_fingerprint="$(printf '%s' "$_retry_fp_input" | sha256sum 2>/dev/null | cut -c1-12)"
  elif command -v shasum >/dev/null 2>&1; then
    _retry_fingerprint="$(printf '%s' "$_retry_fp_input" | shasum -a 256 2>/dev/null | cut -c1-12)"
  fi
  [ -n "$_retry_fingerprint" ] || _retry_fingerprint="unknown"

  _retry_inbox_dir="${BOARD_ROOT}/tickets/inbox"
  mkdir -p "$_retry_inbox_dir" 2>/dev/null || true
  _retry_prior_count=0
  if [ -d "$_retry_inbox_dir" ]; then
    # shopt -s nullglob via subshell so empty glob doesn't trip set -e
    _retry_prior_count="$(
      shopt -s nullglob
      _files=( "${_retry_inbox_dir}"/order_*_retry_*.md )
      if [ "${#_files[@]}" -gt 0 ]; then
        { grep -lF "retry_fingerprint: ${_retry_fingerprint}" "${_files[@]}" 2>/dev/null || true; } | awk 'END { print NR + 0 }'
      else
        printf '0'
      fi
    )"
  fi
  case "$_retry_prior_count" in ''|*[!0-9]*) _retry_prior_count=0 ;; esac
  _retry_count=$((_retry_prior_count + 1))

  _retry_max="${AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT:-3}"
  case "$_retry_max" in ''|*[!0-9]*|0) _retry_max=3 ;; esac

  _retry_decision="retry"
  if [ "$_retry_count" -ge "$_retry_max" ]; then
    _retry_decision="needs_user"
  fi

  _retry_iso_compact="$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null || printf 'unknown')"
  _retry_inbox_path="${_retry_inbox_dir}/order_${ticket_id}_retry_${_retry_count}_${_retry_iso_compact}.md"

  _ticket_body_snapshot=""
  if [ -f "$ticket_file" ]; then
    _ticket_body_snapshot="$(cat "$ticket_file" 2>/dev/null || true)"
  fi

  {
    printf '# Retry order from failed ticket %s\n\n' "$ticket_id"
    printf 'source: retry\n'
    printf 'retry_count: %s\n' "$_retry_count"
    printf 'retry_max: %s\n' "$_retry_max"
    printf 'retry_decision: %s\n' "$_retry_decision"
    printf 'retry_fingerprint: %s\n' "$_retry_fingerprint"
    printf 'origin_ticket: %s\n' "$ticket_id"
    printf 'origin_prd: %s\n' "${_retry_prd_key:-}"
    printf 'failure_class: %s\n' "$_failure_class"
    printf 'failed_at: %s\n\n' "$timestamp"
    printf '## Original Title\n- %s\n\n' "${_retry_title:-}"
    printf '## Reject Reason\n```\n%s\n```\n\n' "${_reject_msg:-(see ticket reject reason)}"
    printf '## Retry Decision\n- %s (retry_count=%s of retry_max=%s)\n\n' "$_retry_decision" "$_retry_count" "$_retry_max"
    printf '## Planner Hint\n'
    if [ "$_retry_decision" = "needs_user" ]; then
      printf -- '- Same fingerprint reached retry_max. Do NOT auto-create a new PRD/todo. Append a needs_user note so the user redirects the goal or relaxes Allowed Paths / Done When.\n\n'
    else
      printf -- '- Reuse the original PRD if possible. Adjust Allowed Paths or Done When to avoid the failure class above.\n'
      printf -- '- If failure_class starts with `shell_sanity_gate_`, tighten Done When checklist or produce a real diff in the worktree.\n'
      printf -- '- If failure_class is `dirty_project_root_conflict` or `merge_preparation_failed`, the worker tried to merge but PROJECT_ROOT had overlapping dirty paths; resolve those first.\n\n'
    fi
    if [ -n "$_ticket_body_snapshot" ]; then
      printf '## Original Ticket\n\n````markdown\n%s\n````\n' "$_ticket_body_snapshot"
    fi
  } > "$_retry_inbox_path" 2>/dev/null || _retry_inbox_path=""

  # Fire user notification on needs_user (best-effort; never blocks flow).
  if [ "$_retry_decision" = "needs_user" ]; then
    _notify_script="${BOARD_ROOT}/scripts/notify-user.ts"
    _tsx_bin="$(cd "${PROJECT_ROOT:-$BOARD_ROOT/..}" && node -e "process.stdout.write(require.resolve('.bin/tsx'))" 2>/dev/null || true)"
    if [ -f "$_notify_script" ] && [ -n "$_tsx_bin" ] && [ -x "$_tsx_bin" ]; then
      "$_tsx_bin" "$_notify_script" \
        --event needs_user \
        --ticket "$ticket_id" \
        --title "Autoflow needs_user: ${_retry_title:-ticket ${ticket_id}}" \
        --message "Same failure reached retry_max (${_retry_max}). Failure: ${_failure_class}. Board: ${BOARD_ROOT}" \
        2>/dev/null || true
    fi
  fi

  if [ -f "$ticket_file" ]; then
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" ""
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" ""
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    rm -f "$ticket_file"
  fi
  ticket_goal_block "$ticket_file" "failed" 2>/dev/null || true

  _wiki_output="$(wiki_ai_owned_notice)"
  clear_active_ticket_context_record || true
  clear_runner_active_state

  printf 'status=failed\n'
  printf 'outcome=fail\n'
  printf 'failure_class=%s\n' "$_failure_class"
  printf 'ticket=(removed; embedded in inbox retry order)\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf '%s\n' "$_wiki_output"
  printf 'commit_status=not_committed_failed_ticket\n'
  if [ -n "$_retry_inbox_path" ] && [ -f "$_retry_inbox_path" ]; then
    printf 'inbox_retry_order=%s\n' "$_retry_inbox_path"
    printf 'retry_count=%s\n' "$_retry_count"
    printf 'retry_decision=%s\n' "$_retry_decision"
    printf 'retry_fingerprint=%s\n' "$_retry_fingerprint"
  fi
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
}

stage_git_path_if_present() {
  local git_root="$1"
  local path="$2"
  local normalized_git_root physical_git_root normalized_path physical_path rel_path path_dir path_base

  [ -n "$path" ] || return 0

  normalized_git_root="${git_root%/}"
  physical_git_root="$(cd "$git_root" && pwd -P)"
  physical_git_root="${physical_git_root%/}"
  normalized_path="${path//\\//}"
  if [ -e "$normalized_path" ]; then
    path_dir="$(dirname "$normalized_path")"
    path_base="$(basename "$normalized_path")"
    physical_path="$(cd "$path_dir" && pwd -P)/$path_base"
  else
    physical_path="$normalized_path"
  fi
  case "$normalized_path" in
    "${normalized_git_root}/"*)
      rel_path="${normalized_path#${normalized_git_root}/}"
      ;;
    "$normalized_git_root")
      rel_path="."
      ;;
    *)
      case "$physical_path" in
        "${physical_git_root}/"*)
          rel_path="${physical_path#${physical_git_root}/}"
          ;;
        "$physical_git_root")
          rel_path="."
          ;;
        /*)
          return 0
          ;;
        *)
          rel_path="$normalized_path"
          ;;
      esac
      ;;
  esac

  case "$rel_path" in
    ""|../*|*/../*)
      return 0
      ;;
  esac

  if [ -e "${git_root}/${rel_path}" ] || git -C "$git_root" ls-files --error-unmatch -- "$rel_path" >/dev/null 2>&1; then
    git -C "$git_root" add -A -- "$rel_path"
  fi
}

project_root_path_matches_worktree() {
  local ticket_file="$1"
  local repo_rel_path="$2"
  local worktree_path root_path

  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  [ -n "$worktree_path" ] || return 0

  root_path="${PROJECT_ROOT}/${repo_rel_path}"
  worktree_path="${worktree_path}/${repo_rel_path}"

  if [ ! -e "$root_path" ] && [ ! -e "$worktree_path" ]; then
    return 0
  fi

  if [ ! -e "$root_path" ] || [ ! -e "$worktree_path" ]; then
    return 1
  fi

  if [ -d "$root_path" ] && [ -d "$worktree_path" ]; then
    diff -qr "$root_path" "$worktree_path" >/dev/null 2>&1
    return $?
  fi

  cmp -s "$root_path" "$worktree_path"
}

ticket_path_has_dirty_project_root_conflict() {
  local ticket_file="$1"
  local repo_rel_path="$2"
  local git_root="${3:-$PROJECT_ROOT}"

  if ! git -C "$git_root" status --porcelain --untracked-files=all -- "$repo_rel_path" | grep -q .; then
    return 1
  fi

  project_root_path_matches_worktree "$ticket_file" "$repo_rel_path" && return 1
  return 0
}

ticket_path_has_worktree_changes() {
  local worktree_path="$1"
  local repo_rel_path="$2"

  git -C "$worktree_path" status --porcelain --untracked-files=all -- "$repo_rel_path" | grep -q .
}

prepare_ticket_worktree_for_merge() {
  local ticket_file="$1"
  local ticket_id worktree_path worktree_commit integration_status timestamp
  local -a allowed_paths=()
  local -a add_paths=()
  local -a dirty_project_root_paths=()
  local allowed_path already_in_project_root

  ticket_id="$(extract_numeric_id "$ticket_file")"
  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  worktree_commit="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Worktree Commit")")"
  integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
  timestamp="$(now_iso)"

  if [ "$integration_status" = "ready_to_merge" ] && [ -n "$worktree_commit" ]; then
    printf 'status=ready_to_merge\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_commit=%s\n' "$worktree_commit"
    return 0
  fi

  if [ "$integration_status" = "integrated" ] && [ -n "$worktree_commit" ]; then
    printf 'status=already_integrated\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_commit=%s\n' "$worktree_commit"
    return 0
  fi

  if [ -z "$worktree_path" ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "no_worktree"
    append_note "$ticket_file" "No worktree path recorded at ${timestamp}; queued for board-only finalization (no product-code merge needed)."
    printf 'status=no_worktree\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    return 0
  fi

  if ! git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "worktree_missing"
    append_note "$ticket_file" "Worktree path was missing during integration at ${timestamp}: ${worktree_path}"
    echo "Worktree is not a git worktree: $worktree_path" >&2
    return 1
  fi

  local project_root_git project_root_head worktree_head
  project_root_git="$(git_root_path 2>/dev/null || true)"
  if [ -n "$project_root_git" ]; then
    project_root_head="$(git_head_commit "$project_root_git" 2>/dev/null || true)"
    worktree_head="$(git -C "$worktree_path" rev-parse --verify HEAD 2>/dev/null || true)"
    if [ -n "$project_root_head" ] && [ -n "$worktree_head" ] && [ "$project_root_head" != "$worktree_head" ]; then
      if ! git -C "$worktree_path" merge-base --is-ancestor "$project_root_head" "$worktree_head" 2>/dev/null; then
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "merging"
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
        replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "needs_ai_rebase"
        replace_section_block "$ticket_file" "Next Action" "- Next: the ticket-owner AI must rebase or otherwise merge the ticket worktree against PROJECT_ROOT HEAD, resolve conflicts, rerun verification, manually integrate into PROJECT_ROOT, and rerun finish. Runtime scripts must not perform the rebase."
        append_note "$ticket_file" "Finish paused at ${timestamp}: worktree HEAD ${worktree_head} does not contain PROJECT_ROOT HEAD ${project_root_head}. AI must perform the rebase/merge; script did not run git rebase."
        printf 'status=needs_ai_merge\n'
        printf 'reason=worktree_rebase_required\n'
        printf 'ticket_id=%s\n' "$ticket_id"
        printf 'project_root_head=%s\n' "$project_root_head"
        printf 'worktree_head=%s\n' "$worktree_head"
        return 1
      fi
    fi
  fi

  allowed_paths=()
  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_paths+=("$allowed_path")
  done < <(extract_ticket_allowed_paths "$ticket_file")
  if [ "${#allowed_paths[@]}" -eq 0 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_missing_allowed_paths"
    append_note "$ticket_file" "Worktree integration blocked at ${timestamp}: Allowed Paths was empty."
    echo "Allowed Paths is empty; refusing to stage the whole worktree implicitly." >&2
    return 1
  fi

  add_paths=()
  for allowed_path in "${allowed_paths[@]}"; do
    if [ -e "${worktree_path}/${allowed_path}" ] || git -C "$worktree_path" ls-files --error-unmatch -- "$allowed_path" >/dev/null 2>&1; then
      ticket_path_has_worktree_changes "$worktree_path" "$allowed_path" || continue
      add_paths+=("$allowed_path")
    else
      append_note "$ticket_file" "Allowed path was not present in worktree during merge preparation at ${timestamp}, so it was skipped: ${allowed_path}"
    fi
  done

  if [ "${#add_paths[@]}" -gt 0 ]; then
    for allowed_path in "${add_paths[@]}"; do
      if ticket_path_has_dirty_project_root_conflict "$ticket_file" "$allowed_path" "${project_root_git:-$PROJECT_ROOT}"; then
        dirty_project_root_paths+=("$allowed_path")
      fi
    done
  fi
  if [ "${#dirty_project_root_paths[@]}" -gt 0 ]; then
    mark_ticket_dirty_project_root_blocked "$ticket_file" "$worker_id" "$timestamp" "$(printf '%s\n' "${dirty_project_root_paths[@]}")"
    printf 'status=blocked\n'
    printf 'reason=dirty_project_root_conflict\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'dirty_path=%s\n' "${dirty_project_root_paths[@]}"
    return 1
  fi

  already_in_project_root=1
  if [ "${#add_paths[@]}" -eq 0 ]; then
    already_in_project_root=0
  fi
  if [ "${#add_paths[@]}" -gt 0 ]; then
    for allowed_path in "${add_paths[@]}"; do
      if ! project_root_path_matches_worktree "$ticket_file" "$allowed_path"; then
        already_in_project_root=0
        break
      fi
    done
  fi
  if [ "$already_in_project_root" -eq 1 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "already_in_project_root"
    append_note "$ticket_file" "Queued without worktree commit at ${timestamp}: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes."
    printf 'status=already_in_project_root\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_path=%s\n' "$worktree_path"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    return 0
  fi

  if [ "${#add_paths[@]}" -gt 0 ]; then
    git -C "$worktree_path" add -A -- "${add_paths[@]}"
  fi

  if git -C "$worktree_path" diff --cached --quiet; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "no_code_changes"
    append_note "$ticket_file" "No staged code changes found in worktree during merge preparation at ${timestamp}."
    printf 'status=no_code_changes\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_path=%s\n' "$worktree_path"
    return 0
  fi

  git -C "$worktree_path" commit -m "autoflow ticket ${ticket_id} code snapshot" >/dev/null
  worktree_commit="$(git -C "$worktree_path" rev-parse --verify HEAD)"

  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$worktree_commit"
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "ready_to_merge"
  append_note "$ticket_file" "Prepared worktree commit ${worktree_commit} at ${timestamp}; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit."

  printf 'status=ready_to_merge\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'worktree_path=%s\n' "$worktree_path"
  printf 'worktree_commit=%s\n' "$worktree_commit"
}

stage_ticket_commit_scope() {
  local git_root="$1"
  local ticket_file="$2"
  local run_file="$3"
  local allowed_path ticket_id project_key done_root lifecycle_path board_abs_root

  ticket_id="$(extract_numeric_id "$ticket_file")"
  project_key="$(project_key_from_ticket_file "$ticket_file" 2>/dev/null || true)"
  board_abs_root="$(cd "$BOARD_ROOT" && pwd -P)"

  # Stage ONLY paths produced by this specific ticket — not the whole board.
  # This avoids pulling in other tickets' / logs' dirty changes when multiple
  # AIs share the same git working tree (worktree fallback).

  # 1. The ticket file itself plus all same-id lifecycle source paths. A
  # completed ticket may have moved todo -> inprogress -> done during one owner
  # turn; staging only the final done path leaves tracked todo deletions dirty.
  stage_git_path_if_present "$git_root" "$ticket_file"
  if [ -n "$ticket_id" ]; then
    for lifecycle_path in \
      "${board_abs_root}/tickets/todo/Todo-${ticket_id}.md" \
      "${board_abs_root}/tickets/inprogress/Todo-${ticket_id}.md" \
      "${board_abs_root}/tickets/verifier/Todo-${ticket_id}.md" \
      "${board_abs_root}/tickets/ready-to-merge/Todo-${ticket_id}.md" \
      "${board_abs_root}/tickets/merge-blocked/Todo-${ticket_id}.md" \
      "${board_abs_root}/tickets/todo/tickets_${ticket_id}.md" \
      "${board_abs_root}/tickets/inprogress/tickets_${ticket_id}.md" \
      "${board_abs_root}/tickets/verifier/tickets_${ticket_id}.md" \
      "${board_abs_root}/tickets/ready-to-merge/tickets_${ticket_id}.md" \
      "${board_abs_root}/tickets/merge-blocked/tickets_${ticket_id}.md"
    do
      stage_git_path_if_present "$git_root" "$lifecycle_path"
    done
  fi
  if [ -n "${reject_target:-}" ]; then
    stage_git_path_if_present "$git_root" "$reject_target"
  fi
  if [ -n "${done_target:-}" ]; then
    stage_git_path_if_present "$git_root" "$done_target"
  fi

  # 2. Run / verify evidence file for this ticket.
  stage_git_path_if_present "$git_root" "$run_file"

  # 3. Done destination directory for this project key (spec + ticket archive).
  if [ -n "$project_key" ]; then
    done_root="${BOARD_ROOT}/tickets/done/${project_key}"
    stage_git_path_if_present "$git_root" "$done_root"
  fi

  # 4. Verifier completion log for this ticket id only.
  if [ -n "$ticket_id" ]; then
    while IFS= read -r log_file; do
      [ -n "$log_file" ] || continue
      stage_git_path_if_present "$git_root" "$log_file"
    done < <(find "${BOARD_ROOT}/logs" -maxdepth 1 -type f -name "verifier_${ticket_id}_*.md" 2>/dev/null)
  fi

  # 5. Allowed Paths (product code under this ticket's scope).
  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_path_is_concrete_repo_path "$allowed_path" || continue
    project_root_path_matches_worktree "$ticket_file" "$allowed_path" || continue
    stage_git_path_if_present "$git_root" "${PROJECT_ROOT}/${allowed_path}"
  done < <(extract_ticket_allowed_paths "$ticket_file")
}

git_commit_if_possible() {
  local ticket_file="$1"
  local run_file="${2:-}"
  local ticket_id project_key summary git_root commit_message commit_prefix

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
  project_key="$(ticket_scalar_field "$ticket_file" "PRD Key")"
  summary="$(extract_scalar_field_in_section "$ticket_file" "Result" "Summary")"
  project_key="$(printf '%s' "$project_key" | tr '\r\n' '  ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
  summary="$(printf '%s' "$summary" | tr '\r\n' '  ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
  [ -n "$summary" ] || summary="complete ticket-owner work"
  if [ -n "$project_key" ]; then
    project_key="$(printf '%s' "$project_key" | tr '[:lower:]' '[:upper:]')"
    commit_prefix="[${project_key}][ticket_${ticket_id}]"
  else
    commit_prefix="[ticket_${ticket_id}]"
  fi
  commit_message="${commit_prefix} ${summary}"

  stage_ticket_commit_scope "$git_root" "$ticket_file" "$run_file"
  if git -C "$git_root" diff --cached --quiet; then
    printf 'commit_status=no_changes\n'
    return 0
  fi

  git -C "$git_root" commit -m "$commit_message" >/dev/null
  printf 'commit_status=committed\n'
  printf 'commit_hash=%s\n' "$(git -C "$git_root" rev-parse --verify HEAD)"
}

wiki_ai_owned_notice() {
  printf 'wiki.status=ai_owned\n'
  printf 'wiki.next_action=Wiki AI inspects done/reject/log sources and runs scripts/update-wiki.sh only when material baseline drift exists.\n'
}

move_run_file_to_ready_to_merge() {
  local source_run_file="$1"
  local ticket_file="$2"
  local target_run_file timestamp_slug

  target_run_file="$(ready_to_merge_run_path_for_ticket_file "$ticket_file")"
  if [ "$source_run_file" = "$target_run_file" ]; then
    printf '%s' "$source_run_file"
    return 0
  fi

  mkdir -p "$(dirname "$target_run_file")"
  if [ -f "$target_run_file" ]; then
    if cmp -s "$source_run_file" "$target_run_file"; then
      rm -f "$source_run_file"
      printf '%s' "$target_run_file"
      return 0
    fi
    timestamp_slug="$(printf '%s' "$(now_iso)" | tr -d ':-')"
    target_run_file="${target_run_file%.md}.${timestamp_slug}.duplicate.md"
  fi

  mv "$source_run_file" "$target_run_file"
  printf '%s' "$target_run_file"
}

ticket_file="$(resolve_ticket_file "$ticket_ref" || true)"
if [ -z "$ticket_file" ] || [ ! -f "$ticket_file" ]; then
  fail_or_idle "Ticket file not found: ${ticket_ref}" "ticket_owner_finish_ticket_missing"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
# Legacy verify_NNN.md sidecar removed (refactor 2026-05-07). Verification
# evidence is captured directly in the ticket markdown's `## Verification`
# section. Existing pending/ready-to-merge sidecar files are still picked up
# so older boards can drain cleanly.
run_file=""
candidate_run_file="$(pending_run_path "$ticket_id" 2>/dev/null || true)"
if [ -f "$candidate_run_file" ]; then
  run_file="$candidate_run_file"
fi
if [ -z "$run_file" ]; then
  candidate_run_file="$(ready_to_merge_run_path_for_ticket_file "$ticket_file" 2>/dev/null || true)"
  if [ -f "$candidate_run_file" ]; then
    run_file="$candidate_run_file"
  fi
fi

if [ -n "$run_file" ] && [ -f "$run_file" ]; then
  replace_scalar_field_in_section "$run_file" "## Meta" "Status" "$outcome"
fi

case "$outcome" in
  pass)
    if [ -n "$message" ]; then
      replace_scalar_field_in_section "$ticket_file" "## Result" "Summary" "$message"
    fi

    # shared_allowed_path_conflict is impossible under single-worker topology;
    # if it ever surfaces, route to inbox retry like any other blocker.
    shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
    if [ -n "$shared_blockers" ]; then
      blockers_summary="$(printf '%s\n' "$shared_blockers" | shared_allowed_path_blockers_summary)"
      route_to_inbox_retry "shared_allowed_path_conflict" "$blockers_summary"
      exit 0
    fi

    # ── Shell-only sanity gate ──────────────────────────────────────────────
    # Mechanical checks that ignore any AI-written evidence and rely on shell
    # results only. Designed to catch worker AI false-pass patterns where:
    #   - mini-plan was made but no code changed (zero diff),
    #   - Verification Command actually fails when re-executed,
    #   - evidence file was edited to overwrite a non-zero exit.
    # If any check trips, the ticket is moved to blocked and pass is refused.
    sanity_worktree=""
    sanity_worktree="$(awk '/^## Worktree/{flag=1; next} /^## /{flag=0} flag && /^- Path:/{
        sub(/^- Path:[[:space:]]*/, "")
        gsub(/`/, "")
        sub(/[[:space:]]+$/, "")
        print
        exit
      }' "$ticket_file" 2>/dev/null || true)"
    sanity_base=""
    sanity_base="$(awk '/^## Worktree/{flag=1; next} /^## /{flag=0} flag && /^- Base Commit:/{
        sub(/^- Base Commit:[[:space:]]*/, "")
        sub(/[[:space:]]+$/, "")
        print
        exit
      }' "$ticket_file" 2>/dev/null || true)"
    sanity_target=""
    if [ -n "$sanity_worktree" ] && [ -d "$sanity_worktree" ]; then
      sanity_target="$sanity_worktree"
    fi

    sanity_failed=""
    sanity_detail=""

    # change_type matrix (PRD 2): docs / cleanup tickets may legitimately
    # produce no code diff (e.g. file moves) so zero_diff is allowed; infra
    # tickets get a higher threshold to flag trivial config tweaks; code
    # (default) keeps the original ≥1-line guard.
    sanity_change_type=""
    sanity_change_type="$(awk '/^## Ticket/{flag=1; next} /^## /{flag=0} flag && /^- Change Type:/{
        sub(/^- Change Type:[[:space:]]*/, "")
        sub(/[[:space:]]+$/, "")
        print
        exit
      }' "$ticket_file" 2>/dev/null || true)"
    sanity_change_type="$(printf '%s' "$sanity_change_type" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || true)"
    case "$sanity_change_type" in
      docs|cleanup|infra) ;;
      *) sanity_change_type="code" ;;
    esac

    sanity_min_diff_lines=1
    case "$sanity_change_type" in
      docs|cleanup)
        sanity_min_diff_lines=0
        ;;
      infra)
        sanity_min_diff_lines="${AUTOFLOW_INFRA_MIN_DIFF_LINES:-10}"
        case "$sanity_min_diff_lines" in
          ''|*[!0-9]*) sanity_min_diff_lines=10 ;;
        esac
        ;;
      *)
        sanity_min_diff_lines=1
        ;;
    esac

    # ① zero-diff guard: refuse pass when no code actually changed (skipped
    # for docs/cleanup change types).
    if [ -z "$sanity_failed" ] && [ -n "$sanity_target" ] && [ -n "$sanity_base" ] && [ "$sanity_min_diff_lines" -gt 0 ]; then
      sanity_diff_stat=""
      sanity_diff_stat="$(cd "$sanity_target" && git diff --shortstat "${sanity_base}..HEAD" 2>/dev/null || true)"
      if [ -z "$sanity_diff_stat" ]; then
        sanity_diff_stat="$(cd "$sanity_target" && git diff --shortstat 2>/dev/null || true)"
      fi
      sanity_diff_total="$(printf '%s\n' "$sanity_diff_stat" | awk '{s=0; for(i=1;i<=NF;i++) if ($i ~ /^[0-9]+$/) s+=$i+0; print s+0}')"
      if [ "${sanity_diff_total:-0}" -lt "$sanity_min_diff_lines" ] 2>/dev/null; then
        if [ "$sanity_change_type" = "infra" ]; then
          sanity_failed="zero_diff_infra"
          sanity_detail="infra change_type requires ≥${sanity_min_diff_lines} diff lines (saw ${sanity_diff_total:-0}); raise AUTOFLOW_INFRA_MIN_DIFF_LINES or split the ticket"
        else
          sanity_failed="zero_diff"
          sanity_detail="git diff against ${sanity_base:-HEAD} produced no changed lines (change_type=${sanity_change_type}); refusing pass on empty work"
        fi
      fi
    fi

    # ② Done When checklist gate: every `- [ ]` under `## Done When` must be
    # `- [x]`. Empty Done When is also a fail — a ticket cannot pass without
    # explicit completion criteria.
    if [ -z "$sanity_failed" ]; then
      done_when_items="$(awk '
        /^## Done When/ { in_section = 1; next }
        in_section && /^## / { in_section = 0 }
        in_section && /^[[:space:]]*- \[[ xX]\]/ { print }
      ' "$ticket_file" 2>/dev/null || true)"

      if [ -z "$done_when_items" ]; then
        sanity_failed="done_when_empty"
        sanity_detail="## Done When section has no checklist items; cannot mechanically verify completion"
      else
        done_when_unchecked="$(printf '%s\n' "$done_when_items" | grep -c '^[[:space:]]*- \[ \]' 2>/dev/null || printf '0')"
        if [ "${done_when_unchecked:-0}" -gt 0 ] 2>/dev/null; then
          done_when_total="$(printf '%s\n' "$done_when_items" | awk 'NF' | wc -l | tr -d '[:space:]')"
          sanity_failed="done_when_unchecked"
          sanity_detail="${done_when_unchecked} of ${done_when_total} Done When item(s) still unchecked; check every item or split the ticket scope"
        fi
      fi
    fi

    # ③ Allowed Paths cross-check (PRD_276): at least one changed file that
    # is NOT a board metadata path must match an Allowed Path. This prevents
    # the false-pass pattern where only the ticket markdown ([x] checkboxes)
    # was modified while no product code was changed.
    # Metadata paths always exempt: tickets/inprogress/Todo-*.md,
    # tickets/done/*/Todo-*.md. Skipped for Change Type=docs/cleanup.
    if [ -z "$sanity_failed" ] && \
       [ "$sanity_change_type" != "docs" ] && \
       [ "$sanity_change_type" != "cleanup" ] && \
       [ -n "$sanity_target" ] && [ -n "$sanity_base" ]; then
      sanity_ap_ok=0
      sanity_ap_names="$(cd "$sanity_target" && git diff --name-only "${sanity_base}..HEAD" 2>/dev/null || true)"
      [ -n "$sanity_ap_names" ] || sanity_ap_names="$(cd "$sanity_target" && git diff --name-only 2>/dev/null || true)"
      if [ -n "$sanity_ap_names" ]; then
        # Strip board metadata paths; only product-code changes count
        sanity_ap_product="$(printf '%s\n' "$sanity_ap_names" \
          | grep -v '^\.autoflow/tickets/inprogress/Todo-' \
          | grep -v '^\.autoflow/tickets/done/' \
          || true)"
        if [ -n "$sanity_ap_product" ]; then
          while IFS= read -r ap; do
            [ -n "$ap" ] || continue
            if printf '%s\n' "$sanity_ap_product" | grep -qF "$ap"; then
              sanity_ap_ok=1
              break
            fi
          done < <(extract_ticket_allowed_paths "$ticket_file")
        fi
      fi
      if [ "$sanity_ap_ok" -eq 0 ]; then
        sanity_failed="allowed_paths_no_diff"
        sanity_detail="no changed product file matches an Allowed Path (board metadata edits excluded); ensure real code changes exist within Allowed Paths (change_type=${sanity_change_type})"
      fi
    fi

    if [ -n "$sanity_failed" ]; then
      append_note "$ticket_file" "Shell sanity gate refused pass at ${timestamp}: ${sanity_failed}; ${sanity_detail}"
      route_to_inbox_retry "shell_sanity_gate_${sanity_failed}" "$sanity_detail"
      exit 0
    fi
    # ── end shell sanity gate ───────────────────────────────────────────────

    # ── Verifier hook (PRD_287, 2026-05-12) ────────────────────────────────
    # After sanity gate passes, delegate semantic verification to the Verifier
    # AI unless explicitly bypassed. The verifier checks that the diff matches
    # the ticket Title/Goal and Done When items are genuinely fulfilled.
    # Bypass: AUTOFLOW_SKIP_VERIFIER=1 (set by verifier itself on re-entry)
    #         or runners/state/verifier-ok-<ticket-id>.marker exists.
    _verifier_enabled="${AUTOFLOW_VERIFIER_ENABLED:-1}"
    _verifier_skip="${AUTOFLOW_SKIP_VERIFIER:-0}"
    _verifier_ok_marker="${BOARD_ROOT}/runners/state/verifier-ok-${ticket_id}.marker"
    if [ "$_verifier_enabled" = "1" ] && [ "$_verifier_skip" != "1" ] && [ ! -f "$_verifier_ok_marker" ]; then
      # Create tickets/verifier/ staging area and copy ticket there.
      _verifier_dir="${BOARD_ROOT}/tickets/verifier"
      mkdir -p "$_verifier_dir"
      _verifier_ticket="${_verifier_dir}/Todo-${ticket_id}.md"
      cp "$ticket_file" "$_verifier_ticket"
      replace_scalar_field_in_section "$_verifier_ticket" "## Ticket" "Stage" "verify_pending"

      # Trigger verifier runner wake via realtime marker.
      _verifier_wakeup_marker="${BOARD_ROOT}/runners/state/verifier.verifier-realtime-wakeup.pending"
      mkdir -p "${BOARD_ROOT}/runners/state"
      printf 'triggered_at=%s\nticket_id=%s\n' "$timestamp" "$ticket_id" > "$_verifier_wakeup_marker"

      # Also try the TypeScript wakeup helper (best-effort).
      _start_verifier="${BOARD_ROOT}/scripts/start-verifier.ts"
      if [ -f "$_start_verifier" ] && command -v npx >/dev/null 2>&1; then
        BOARD_ROOT="$BOARD_ROOT" npx tsx "$_start_verifier" >/dev/null 2>&1 || true
      fi

      printf 'status=verify_pending\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf 'ticket_id=%s\n' "$ticket_id"
      printf 'verifier_ticket=%s\n' "$_verifier_ticket"
      printf 'next_action=Verifier AI will inspect tickets/verifier/Todo-%s.md and either call finish-ticket-owner.sh pass (AUTOFLOW_SKIP_VERIFIER=1) or fail with verifier_semantic_mismatch.\n' "$ticket_id"
      exit 0
    fi
    # Clean up ok-marker if it was used for bypass.
    rm -f "$_verifier_ok_marker" 2>/dev/null || true
    # ── end verifier hook ───────────────────────────────────────────────────

    # PRD 8 (2026-05-09): best-effort project verify-post hook. Runs after
    # the sanity gate passes but before merge prep / commit. Non-fatal: any
    # failure prints to stderr and continues.
    project_hook="${BOARD_ROOT}/project/hooks/verify-post.sh"
    if [ -x "$project_hook" ]; then
      hook_prd_key="$(awk '/^## Ticket/{flag=1; next} /^## /{flag=0} flag && /^- PRD Key:/{
          sub(/^- PRD Key:[[:space:]]*/, "")
          sub(/[[:space:]]+$/, "")
          print
          exit
        }' "$ticket_file" 2>/dev/null || true)"
      AUTOFLOW_HOOK_TICKET_FILE="$ticket_file" \
      AUTOFLOW_HOOK_TICKET_ID="$ticket_id" \
      AUTOFLOW_HOOK_PRD_KEY="${hook_prd_key:-}" \
      AUTOFLOW_HOOK_CHANGE_TYPE="${sanity_change_type:-code}" \
        "$project_hook" 2>/dev/null || \
        echo "[verify-post] hook returned non-zero (non-fatal)" >&2
    fi

    merge_prep_output="$(prepare_ticket_worktree_for_merge "$ticket_file" 2>&1)" || {
      merge_prep_status="$(printf '%s\n' "$merge_prep_output" | awk -F= '$1 == "status" { sub(/^[^=]*=/, "", $0); print; exit }' 2>/dev/null || true)"
      merge_prep_reason="$(printf '%s\n' "$merge_prep_output" | awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print; exit }' 2>/dev/null || true)"
      if [ "$merge_prep_status" = "needs_ai_merge" ]; then
        ticket_goal_activate "$ticket_file" "needs_ai_merge"
        printf 'status=needs_ai_merge\n'
        [ -z "$merge_prep_reason" ] || printf 'reason=%s\n' "$merge_prep_reason"
        printf 'ticket=%s\n' "$ticket_file"
        printf 'ticket_id=%s\n' "$ticket_id"
        printf '%s\n' "$merge_prep_output"
        printf 'next_action=AI must complete the merge/rebase in the ticket worktree and PROJECT_ROOT, rerun verification itself, then rerun finish-ticket-owner pass. Runtime scripts will not perform the merge.\n'
        printf 'board_root=%s\n' "$BOARD_ROOT"
        printf 'project_root=%s\n' "$PROJECT_ROOT"
        exit 0
      fi
      if [ "$merge_prep_status" = "blocked" ]; then
        merge_prep_output_single_line="$(printf '%s' "$merge_prep_output" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
        append_note "$ticket_file" "AI pass finish refused at ${timestamp}: ${merge_prep_reason:-merge_preparation_failed}; ${merge_prep_output_single_line}"
        route_to_inbox_retry "${merge_prep_reason:-merge_preparation_failed}" "$merge_prep_output_single_line"
        exit 0
      fi
      merge_prep_output_single_line="$(printf '%s' "$merge_prep_output" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
      append_note "$ticket_file" "AI pass finish blocked during merge preparation at ${timestamp}: ${merge_prep_output_single_line}"
      route_to_inbox_retry "merge_preparation_failed" "$merge_prep_output_single_line"
      exit 0
    }

    # Ticket stays in tickets/inprogress/ while the AI owner performs merge.
    # The finalizer below only archives/logs/commits after PROJECT_ROOT already
    # contains the AI-merged result; it must not rebase or cherry-pick.
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "ready_to_merge"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$(ticket_owner_lock_value "$worker_id" "$owner_pid" "$timestamp")"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- Next: ticket-owner AI manually integrates verified worktree changes into PROJECT_ROOT if needed, reruns verification, then reruns finish. The runtime finalizer only archives/logs/commits an already AI-merged result."
    append_note "$ticket_file" "Impl AI ${display_id} marked verification pass at ${timestamp}; runtime finalizer will not perform merge operations."
    mark_ticket_done_when_checked "$ticket_file" "$run_file"
    replace_section_block "$ticket_file" "Verification" "- Result: passed by ${display_id} at ${timestamp}
- Log file: pending AI merge finalization"
    ticket_goal_activate "$ticket_file" "pass_pending_finalizer"

    # Finalization call: verifies that AI already integrated the work into
    # PROJECT_ROOT, then archives evidence and creates the local commit.
    # It intentionally refuses to perform rebase, cherry-pick, or conflict
    # resolution.
    merge_script="$(cd "$(dirname "$0")" && pwd)/merge-ready-ticket.sh"
    inline_merge_output=""
    inline_merge_exit=0
    inline_merge_status=""
    inline_merge_reason=""
    if [ -x "$merge_script" ]; then
      if inline_merge_output="$(AUTOFLOW_ROLE=merge AUTOFLOW_INLINE_MERGE=1 "$merge_script" "$ticket_id" 2>&1)"; then
        inline_merge_exit=0
      else
        inline_merge_exit=$?
      fi
    else
      inline_merge_exit=127
      inline_merge_output="merge-ready-ticket.sh not found at ${merge_script}"
    fi
    inline_merge_status="$(printf '%s\n' "$inline_merge_output" | awk -F= '$1 == "status" { sub(/^[^=]*=/, "", $0); print; exit }' 2>/dev/null || true)"
    inline_merge_reason="$(printf '%s\n' "$inline_merge_output" | awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print; exit }' 2>/dev/null || true)"
    inline_ticket_file="$(printf '%s\n' "$inline_merge_output" | awk -F= '$1 == "ticket" { sub(/^[^=]*=/, "", $0); print; exit }' 2>/dev/null || true)"
    if [ -n "$inline_ticket_file" ] && [ -f "$inline_ticket_file" ]; then
      ticket_file="$inline_ticket_file"
    fi

    if [ "$inline_merge_exit" -eq 0 ] && [ "$inline_merge_status" = "done" ]; then
      if [ -f "$ticket_file" ]; then
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" ""
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" ""
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
      fi
      runner_id="${RUNNER_ID:-$worker_id}"
      if [ -x "${BOARD_ROOT}/scripts/runner-stage.js" ]; then
        node "${BOARD_ROOT}/scripts/runner-stage.js" idle --runner "$runner_id" >/dev/null 2>&1 || true
      fi
      printf 'status=done\n'
    elif [ "$inline_merge_status" = "needs_ai_merge" ]; then
      replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "merging"
      replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
      ticket_goal_activate "$ticket_file" "needs_ai_merge"
      printf 'status=needs_ai_merge\n'
      printf 'reason=%s\n' "${inline_merge_reason:-ai_merge_required}"
    elif [ "$inline_merge_status" = "blocked" ]; then
      append_note "$ticket_file" "Inline merge blocked at ${timestamp}: ${inline_merge_reason:-inline_merge_blocked}"
      if [ "${inline_merge_reason:-}" = "post_merge_cleanup_failed" ]; then
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
        replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_post_merge_cleanup"
        replace_section_block "$ticket_file" "Next Action" "- Fail: final merge cleanup failed after verification. AI/owner must rerun merge finalization only after cleanup is resolved; do not claim another ticket until this ticket is cleared by owner or planner."
        ticket_goal_block "$ticket_file" "post_merge_cleanup_failed"
        printf 'status=blocked\n'
        printf 'reason=post_merge_cleanup_failed\n'
      else
        route_to_inbox_retry "${inline_merge_reason:-inline_merge_blocked}" "${inline_merge_output:-inline merge blocked}"
        exit 0
      fi
    else
      ticket_goal_activate "$ticket_file" "inline_merge_failed_check_output"
      printf 'status=ready_to_merge\n'
    fi
    printf 'outcome=pass\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf '%s\n' "$merge_prep_output"
    printf 'inline_merge_exit=%s\n' "$inline_merge_exit"
    if [ "$inline_merge_exit" -eq 0 ] && [ "$inline_merge_status" = "done" ]; then
      printf 'inline_merge=done; log written; wiki deferred to Wiki AI\n'
      printf '%s\n' "$inline_merge_output" | awk '/^cleanup_status=/ || /^cleanup_detail=/ || /^wiki\.status=/ || /^wiki\.next_action=/'

      # PRD 6 (2026-05-09): write a PR body draft. With AUTOFLOW_AUTO_PUSH_AFTER_VERIFY=branch_only
      # this script will also push the feature branch and create a draft PR automatically.
      # master/main push is always blocked. Default is off (no push).
      draft_dir="${BOARD_ROOT}/runners/state/pr-drafts"
      draft_script="$(cd "$(dirname "$0")" && pwd)/draft-pr.sh"
      draft_file=""
      if [ -x "$draft_script" ] && [ -n "$ticket_id" ]; then
        mkdir -p "$draft_dir" 2>/dev/null || true
        draft_file="${draft_dir}/${ticket_id}.md"
        inline_commit_hash="$(printf '%s\n' "$inline_merge_output" | awk -F= '$1 == "commit_hash" { sub(/^[^=]*=/, ""); print; exit }' 2>/dev/null || true)"
        if "$draft_script" "$ticket_file" "$inline_commit_hash" > "$draft_file" 2>/dev/null; then
          printf 'pr_draft=%s\n' "$draft_file"
        else
          rm -f "$draft_file" 2>/dev/null || true
          draft_file=""
          printf 'pr_draft=draft_failed\n'
        fi
      fi

      # PRD_289: AUTOFLOW_AUTO_PUSH_AFTER_VERIFY=branch_only opt-in push.
      # Pushes the ticket feature branch to origin and creates a draft PR.
      # master/main is always blocked regardless of mode setting.
      _auto_push_mode="${AUTOFLOW_AUTO_PUSH_AFTER_VERIFY:-off}"
      if [ "$_auto_push_mode" = "branch_only" ]; then
        _wt_branch="$(ticket_worktree_field "$ticket_file" "Branch" 2>/dev/null | tr -d '`' | xargs 2>/dev/null || true)"
        if [ -z "$_wt_branch" ]; then
          _wt_path="$(ticket_worktree_path_from_file "$ticket_file" 2>/dev/null || true)"
          [ -d "$_wt_path" ] && _wt_branch="$(git -C "$_wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
        fi
        case "${_wt_branch:-}" in
          master|main|"")
            printf 'auto_push=blocked_master_or_empty branch=%s\n' "${_wt_branch:-empty}"
            ;;
          *)
            _push_rc=0
            git push origin "$_wt_branch" 2>/dev/null || _push_rc=$?
            if [ "$_push_rc" -eq 0 ]; then
              printf 'auto_push=pushed branch=%s\n' "$_wt_branch"
              if command -v gh >/dev/null 2>&1; then
                _pr_title="$(awk '/^## Ticket/{f=1;next}/^## /{f=0}f && /^- Title:/{sub(/^- Title:[[:space:]]*/,"");print;exit}' "$ticket_file" 2>/dev/null || echo "ticket $ticket_id")"
                if [ -n "$draft_file" ] && [ -f "$draft_file" ]; then
                  gh pr create --draft --head "$_wt_branch" --title "$_pr_title" --body-file "$draft_file" >/dev/null 2>&1 \
                    && printf 'auto_push=pr_created\n' \
                    || printf 'auto_push=pr_create_failed_skip\n'
                else
                  gh pr create --draft --head "$_wt_branch" --title "$_pr_title" >/dev/null 2>&1 \
                    && printf 'auto_push=pr_created\n' \
                    || printf 'auto_push=pr_create_failed_skip\n'
                fi
              else
                printf 'auto_push=gh_not_found_skip\n'
              fi
            else
              printf 'auto_push=push_failed_skip rc=%d\n' "$_push_rc"
            fi
            ;;
        esac
      fi
    elif [ -n "$inline_merge_output" ]; then
      printf 'inline_merge.output_begin\n%s\ninline_merge.output_end\n' "$inline_merge_output"
    fi
    if [ "$inline_merge_exit" -eq 0 ] && [ "$inline_merge_status" = "done" ]; then
      clear_active_ticket_context_record || true
      clear_runner_active_state
      printf 'commit_status=committed_via_inline_merge\n'
      printf 'next_action=AI merge finalization completed. Impl AI may pick the next todo ticket on the next tick.\n'
    elif [ "$inline_merge_status" = "needs_ai_merge" ]; then
      printf 'commit_status=ai_merge_required\n'
      printf 'next_action=AI must manually integrate the verified worktree changes into PROJECT_ROOT, resolve conflicts, rerun verification, and rerun finish. Runtime scripts will not perform the merge.\n'
    elif [ "$inline_merge_status" = "blocked" ]; then
      printf 'commit_status=inline_merge_blocked\n'
      printf 'next_action=Finalization is blocked (%s). AI must resolve the blocker before claiming the next ticket.\n' "${inline_merge_reason:-unknown}"
    else
      printf 'commit_status=inline_merge_failed_check_output\n'
      printf 'next_action=Finalization from finish-ticket-owner failed. Inspect inline_merge output before claiming the next ticket.\n'
    fi
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    ;;
  fail)
    # Fail can be invoked without a reject message only if the ticket already
    # carries one in `## Reject Reason`. Otherwise we synthesize a generic class.
    _failure_class="rejected"
    _ticket_failure_class="$(awk '/^## Recovery State/{flag=1; next} /^## /{flag=0} flag && /^- Failure Class:/{
        sub(/^- Failure Class:[[:space:]]*/, "")
        sub(/[[:space:]]+$/, "")
        print
        exit
      }' "$ticket_file" 2>/dev/null || true)"
    [ -n "$_ticket_failure_class" ] && _failure_class="$_ticket_failure_class"

    route_to_inbox_retry "$_failure_class" "$message"
    ;;
esac
