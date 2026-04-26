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
      for (idx = 1; idx <= 5; idx += 1) {
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
      for (idx = 1; idx <= 5; idx += 1) {
        key = order[idx]
        if (!(key in seen)) {
          print key "=" values[key]
        }
      }
    }
  ' "$state_path" > "$temp_file"
  mv "$temp_file" "$state_path"
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

integrate_ticket_worktree() {
  local ticket_file="$1"
  local ticket_id worktree_path worktree_commit integration_status timestamp git_root
  local allowed_paths add_paths allowed_path conflict_paths cherry_pick_output already_in_project_root

  ticket_id="$(extract_numeric_id "$ticket_file")"
  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  worktree_commit="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Worktree Commit")")"
  integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
  timestamp="$(now_iso)"

  if [ "$integration_status" = "integrated" ] && [ -n "$worktree_commit" ]; then
    printf 'status=already_integrated\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_commit=%s\n' "$worktree_commit"
    return 0
  fi

  if [ -z "$worktree_path" ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "no_worktree"
    append_note "$ticket_file" "No worktree path recorded at ${timestamp}; ticket-owner will commit board-only changes from PROJECT_ROOT."
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

  git_root="$(git_root_path || true)"
  if [ -z "$git_root" ]; then
    echo "PROJECT_ROOT is not inside a git repository: $PROJECT_ROOT" >&2
    return 1
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
  conflict_paths=()
  for allowed_path in "${allowed_paths[@]}"; do
    if [ -e "${worktree_path}/${allowed_path}" ] || git -C "$worktree_path" ls-files --error-unmatch -- "$allowed_path" >/dev/null 2>&1; then
      ticket_path_has_worktree_changes "$worktree_path" "$allowed_path" || continue
      add_paths+=("$allowed_path")
      if ticket_path_has_dirty_project_root_conflict "$ticket_file" "$allowed_path" "$git_root"; then
        conflict_paths+=("$allowed_path")
      fi
    else
      append_note "$ticket_file" "Allowed path was not present in worktree during integration at ${timestamp}, so it was skipped: ${allowed_path}"
    fi
  done

  if [ "${#conflict_paths[@]}" -gt 0 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_dirty_scope_conflict"
    append_note "$ticket_file" "Worktree integration blocked at ${timestamp}: PROJECT_ROOT has conflicting dirty changes in Allowed Paths (${conflict_paths[*]})."
    printf 'conflicting_allowed_path=%s\n' "${conflict_paths[@]}" >&2
    echo "PROJECT_ROOT has dirty changes that differ from the ticket worktree inside Allowed Paths. Resolve or isolate them before retrying finish." >&2
    return 1
  fi

  already_in_project_root=1
  if [ "${#add_paths[@]}" -eq 0 ]; then
    already_in_project_root=0
  fi
  for allowed_path in "${add_paths[@]}"; do
    if ! project_root_path_matches_worktree "$ticket_file" "$allowed_path"; then
      already_in_project_root=0
      break
    fi
  done
  if [ "$already_in_project_root" -eq 1 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "already_in_project_root"
    append_note "$ticket_file" "Skipped worktree cherry-pick at ${timestamp}: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes."
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
    append_note "$ticket_file" "No staged code changes found in worktree during integration at ${timestamp}."
    printf 'status=no_code_changes\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'worktree_path=%s\n' "$worktree_path"
    return 0
  fi

  git -C "$worktree_path" commit -m "autoflow ticket ${ticket_id} code snapshot" >/dev/null
  worktree_commit="$(git -C "$worktree_path" rev-parse --verify HEAD)"

  set +e
  cherry_pick_output="$(git -C "$git_root" cherry-pick --no-commit "$worktree_commit" 2>&1)"
  if [ "$?" -ne 0 ]; then
    set -e
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$worktree_commit"
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_cherry_pick_conflict"
    append_note "$ticket_file" "Worktree integration hit a cherry-pick conflict at ${timestamp}: ${worktree_commit}. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying."
    printf '%s\n' "$cherry_pick_output" >&2
    echo "Cherry-pick failed. Resolve or abort in PROJECT_ROOT before retrying." >&2
    return 1
  fi
  set -e

  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$worktree_commit"
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "integrated"
  append_note "$ticket_file" "Integrated worktree commit ${worktree_commit} into PROJECT_ROOT without committing at ${timestamp}; ticket-owner should now include board + code changes in one local commit."

  printf 'status=integrated\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'worktree_path=%s\n' "$worktree_path"
  printf 'worktree_commit=%s\n' "$worktree_commit"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
}

stage_ticket_commit_scope() {
  local git_root="$1"
  local ticket_file="$2"
  local run_file="$3"
  local allowed_path ticket_id project_key done_root spec_archive

  ticket_id="$(extract_numeric_id "$ticket_file")"
  project_key="$(project_key_from_ticket_file "$ticket_file" 2>/dev/null || true)"

  # Stage ONLY paths produced by this specific ticket — not the whole board.
  # This avoids pulling in other tickets' / logs' dirty changes when multiple
  # AIs share the same git working tree (worktree fallback).

  # 1. The ticket file itself (and its origin if it was moved to done/reject).
  stage_git_path_if_present "$git_root" "$ticket_file"
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

  # 5. Wiki managed sections updated by auto_update_wiki (index/log/overview).
  for wiki_file in index.md log.md project-overview.md; do
    stage_git_path_if_present "$git_root" "${BOARD_ROOT}/wiki/${wiki_file}"
  done

  # 6. Allowed Paths (product code under this ticket's scope).
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

  stage_ticket_commit_scope "$git_root" "$ticket_file" "$run_file"
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

prefix_wiki_maintainer_output() {
  awk '
    index($0, "=") > 0 {
      print "wiki_maintainer." $0
      next
    }
    NF > 0 {
      count += 1
      print "wiki_maintainer.output." count "=" $0
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

find_enabled_wiki_maintainer_runner() {
  local config_path runner_id runner_role runner_enabled

  config_path="${BOARD_ROOT}/runners/config.toml"
  [ -f "$config_path" ] || return 1

  while IFS= read -r line; do
    case "$line" in
      "[[runners]]")
        runner_id=""
        runner_role=""
        runner_enabled="true"
        ;;
      id\ =\ *)
        runner_id="${line#id = }"
        runner_id="${runner_id%\"}"
        runner_id="${runner_id#\"}"
        ;;
      role\ =\ *)
        runner_role="${line#role = }"
        runner_role="${runner_role%\"}"
        runner_role="${runner_role#\"}"
        ;;
      enabled\ =\ *)
        runner_enabled="${line#enabled = }"
        ;;
    esac

    case "$runner_role:$runner_enabled" in
      wiki-maintainer:true|wiki:true)
        if [ -n "$runner_id" ]; then
          printf '%s' "$runner_id"
          return 0
        fi
        ;;
    esac
  done < "$config_path"

  return 1
}

auto_run_wiki_maintainer() {
  local runner_id wiki_output wiki_exit board_dir_name

  if [ "${AUTOFLOW_WIKI_MAINTAINER_AUTO:-on}" = "off" ]; then
    printf 'wiki_maintainer.status=skipped_by_env\n'
    return 0
  fi

  runner_id="$(find_enabled_wiki_maintainer_runner || true)"
  if [ -z "$runner_id" ]; then
    printf 'wiki_maintainer.status=skipped_no_runner\n'
    return 0
  fi

  if [ ! -x "${PROJECT_ROOT}/bin/autoflow" ]; then
    printf 'wiki_maintainer.status=failed\n'
    printf 'wiki_maintainer.reason=autoflow_cli_missing\n'
    return 0
  fi

  board_dir_name="$(basename "$BOARD_ROOT")"
  set +e
  wiki_output="$("${PROJECT_ROOT}/bin/autoflow" run wiki "$PROJECT_ROOT" "$board_dir_name" --runner "$runner_id" 2>&1)"
  wiki_exit=$?
  set -e

  if [ "$wiki_exit" -eq 0 ]; then
    printf '%s\n' "$wiki_output" | prefix_wiki_maintainer_output
    return 0
  fi

  printf 'wiki_maintainer.status=failed\n'
  printf 'wiki_maintainer.runner_id=%s\n' "$runner_id"
  printf 'wiki_maintainer.exit_code=%s\n' "$wiki_exit"
  printf '%s\n' "$wiki_output" | prefix_wiki_maintainer_output
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

    shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
    if [ -n "$shared_blockers" ]; then
      blockers_summary="$(printf '%s\n' "$shared_blockers" | shared_allowed_path_blockers_summary)"
      replace_scalar_field_in_section "$run_file" "## Meta" "Status" "blocked"
      mark_ticket_shared_allowed_path_blocked "$ticket_file" "$worker_id" "$timestamp" "$shared_blockers"
      printf 'status=blocked\n'
      printf 'reason=shared_allowed_path_conflict\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf 'ticket_id=%s\n' "$ticket_id"
      printf 'blockers=%s\n' "$blockers_summary"
      printf 'next_action=Runtime is waiting for lower-number in-progress ticket(s) holding overlapping project-root fallback paths. The next tick will retry automatically.\n'
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    fi

    integration_output="$(integrate_ticket_worktree "$ticket_file" 2>&1)" || {
      integration_output_single_line="$(printf '%s' "$integration_output" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
      replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
      append_note "$ticket_file" "AI pass finish blocked during integration at ${timestamp}: ${integration_output_single_line}"
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
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- 완료됨: ticket-owner pass 처리와 evidence log 기록 완료."
    append_note "$ticket_file" "AI ${display_id} marked pass at ${timestamp}."
    if [ "$ticket_file" != "$done_target" ]; then
      mv "$ticket_file" "$done_target"
      ticket_file="$done_target"
    fi

    log_output="$("${BOARD_ROOT}/scripts/write-verifier-log.sh" "$ticket_file" "$run_file" pass)"
    wiki_output="$(auto_update_wiki)"
    wiki_maintainer_output="$(auto_run_wiki_maintainer)"
    commit_output="$(git_commit_if_possible "$ticket_file" "$run_file")"
    clear_active_ticket_context_record || true
    clear_runner_active_state

    printf 'status=done\n'
    printf 'outcome=pass\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'run=%s\n' "$(done_run_path_for_ticket_file "$ticket_file")"
    printf '%s\n' "$integration_output"
    printf '%s\n' "$log_output"
    printf '%s\n' "$wiki_output"
    printf '%s\n' "$wiki_maintainer_output"
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
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- reject 처리됨: Reject Reason 을 기준으로 재작업 범위를 정한다."
    append_note "$ticket_file" "AI ${display_id} marked fail at ${timestamp}."
    if [ "$ticket_file" != "$reject_target" ]; then
      mv "$ticket_file" "$reject_target"
      ticket_file="$reject_target"
    fi

    log_output="$("${BOARD_ROOT}/scripts/write-verifier-log.sh" "$ticket_file" "$run_file" fail)"
    wiki_output="$(auto_update_wiki)"
    clear_active_ticket_context_record || true
    clear_runner_active_state

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
