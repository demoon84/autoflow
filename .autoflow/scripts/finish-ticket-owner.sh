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

prepare_ticket_worktree_for_merge() {
  local ticket_file="$1"
  local ticket_id worktree_path worktree_commit integration_status timestamp
  local -a allowed_paths=()
  local -a add_paths=()
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
    append_note "$ticket_file" "No worktree path recorded at ${timestamp}; queued for coordinator board-only finalization."
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

  local project_root_git project_root_head worktree_head rebase_log_file rebase_tail
  project_root_git="$(git_root_path 2>/dev/null || true)"
  if [ -n "$project_root_git" ]; then
    project_root_head="$(git_head_commit "$project_root_git" 2>/dev/null || true)"
    worktree_head="$(git -C "$worktree_path" rev-parse --verify HEAD 2>/dev/null || true)"
    if [ -n "$project_root_head" ] && [ -n "$worktree_head" ] && [ "$project_root_head" != "$worktree_head" ]; then
      if git -C "$worktree_path" merge-base --is-ancestor "$project_root_head" "$worktree_head" 2>/dev/null; then
        :
      else
        rebase_log_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-prefinish-rebase.XXXXXX")"
        if git -C "$worktree_path" rebase --autostash "$project_root_head" >"$rebase_log_file" 2>&1; then
          append_note "$ticket_file" "Rebased worktree onto PROJECT_ROOT HEAD ${project_root_head} at ${timestamp} for clean merge."
        else
          git -C "$worktree_path" rebase --abort >/dev/null 2>&1 || true
          rebase_tail="$(tail -3 "$rebase_log_file" 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
          replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_rebase_conflict"
          append_note "$ticket_file" "Worktree rebase onto PROJECT_ROOT HEAD ${project_root_head} failed at ${timestamp}; ticket-owner must resolve conflicts in ${worktree_path} (e.g. \`git -C ${worktree_path} rebase ${project_root_head}\`) and re-run finish. Tail: ${rebase_tail}"
          rm -f "$rebase_log_file"
          echo "Worktree rebase failed for ticket ${ticket_id}; see ticket Notes for resolution path." >&2
          printf 'status=blocked_rebase_conflict\n'
          printf 'reason=rebase_against_project_root\n'
          printf 'ticket_id=%s\n' "$ticket_id"
          printf 'project_root_head=%s\n' "$project_root_head"
          return 1
        fi
        rm -f "$rebase_log_file"
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
  append_note "$ticket_file" "Prepared worktree commit ${worktree_commit} at ${timestamp}; coordinator should integrate it into PROJECT_ROOT and create the local completion commit."

  printf 'status=ready_to_merge\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'worktree_path=%s\n' "$worktree_path"
  printf 'worktree_commit=%s\n' "$worktree_commit"
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
  local config_path runner_id runner_role runner_enabled fallback_runner_id

  config_path="${BOARD_ROOT}/runners/config.toml"
  [ -f "$config_path" ] || return 1

  consider_wiki_runner() {
    case "$runner_role:$runner_enabled" in
      wiki-maintainer:true|wiki:true)
        if [ -n "$runner_id" ]; then
          printf '%s' "$runner_id"
          return 0
        fi
        ;;
      coordinator:true|coord:true|doctor:true|diagnose:true)
        if [ -n "$runner_id" ] && [ -z "${fallback_runner_id:-}" ]; then
          fallback_runner_id="$runner_id"
        fi
        ;;
    esac
    return 1
  }

  while IFS= read -r line; do
    case "$line" in
      "[[runners]]")
        consider_wiki_runner && return 0
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
  done < "$config_path"

  consider_wiki_runner && return 0

  if [ -n "${fallback_runner_id:-}" ]; then
    printf '%s' "$fallback_runner_id"
    return 0
  fi

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
  wiki_output="$(AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT=1 "${PROJECT_ROOT}/bin/autoflow" run wiki "$PROJECT_ROOT" "$board_dir_name" --runner "$runner_id" 2>&1)"
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
run_file="$(pending_run_path "$ticket_id")"
ready_run_file="$(ready_to_merge_run_path_for_ticket_file "$ticket_file")"
if [ ! -f "$run_file" ] && [ -f "$ready_run_file" ]; then
  run_file="$ready_run_file"
fi
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

    merge_prep_output="$(prepare_ticket_worktree_for_merge "$ticket_file" 2>&1)" || {
      merge_prep_output_single_line="$(printf '%s' "$merge_prep_output" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
      replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
      append_note "$ticket_file" "AI pass finish blocked during merge preparation at ${timestamp}: ${merge_prep_output_single_line}"
      printf 'status=blocked\n'
      printf 'reason=merge_preparation_failed\n'
      printf 'ticket=%s\n' "$ticket_file"
      printf '%s\n' "$merge_prep_output"
      printf 'board_root=%s\n' "$BOARD_ROOT"
      printf 'project_root=%s\n' "$PROJECT_ROOT"
      exit 0
    }

    # Post-refactor: ticket stays in tickets/inprogress/ with Stage=ready_to_merge
    # until the inline merge call below moves it to tickets/done/. The
    # tickets/ready-to-merge/ folder is no longer used as a handoff queue.
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "ready_to_merge"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_id"
    replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
    replace_section_block "$ticket_file" "Next Action" "- Next: inline merge from finish-ticket-owner integrates the prepared worktree commit into PROJECT_ROOT and archives the ticket to tickets/done/."
    append_note "$ticket_file" "Impl AI ${display_id} marked verification pass at ${timestamp} and triggered inline merge."
    replace_section_block "$ticket_file" "Verification" "- Run file: \`$(board_relative_path "$run_file")\`
- Log file: pending inline merge
- Result: passed by ${display_id} at ${timestamp}"

    clear_active_ticket_context_record || true
    clear_runner_active_state

    # Inline merge: Impl AI (ticket-owner) directly invokes the merge runtime
    # right after pass. This collapses the legacy ready-to-merge handoff —
    # the ticket lands in tickets/done/ in the same tick, and update-wiki.sh
    # is triggered from inside merge-ready-ticket.sh on success.
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

    if [ "$inline_merge_exit" -eq 0 ] && [ "$inline_merge_status" = "done" ]; then
      printf 'status=done\n'
    elif [ "$inline_merge_status" = "blocked" ]; then
      printf 'status=blocked\n'
      [ -z "$inline_merge_reason" ] || printf 'reason=%s\n' "$inline_merge_reason"
    else
      printf 'status=ready_to_merge\n'
    fi
    printf 'outcome=pass\n'
    printf 'ticket=%s\n' "$ticket_file"
    printf 'ticket_id=%s\n' "$ticket_id"
    printf 'run=%s\n' "$run_file"
    printf '%s\n' "$merge_prep_output"
    printf 'inline_merge_exit=%s\n' "$inline_merge_exit"
    if [ -n "$inline_merge_output" ]; then
      printf 'inline_merge.output_begin\n%s\ninline_merge.output_end\n' "$inline_merge_output"
    fi
    if [ "$inline_merge_exit" -eq 0 ] && [ "$inline_merge_status" = "done" ]; then
      printf 'commit_status=committed_via_inline_merge\n'
      printf 'next_action=Inline merge completed. Impl AI may pick the next todo ticket on the next tick.\n'
    elif [ "$inline_merge_status" = "blocked" ]; then
      printf 'commit_status=inline_merge_blocked\n'
      printf 'next_action=Inline merge is blocked (%s). Resolve the blocker before claiming the next ticket.\n' "${inline_merge_reason:-unknown}"
    else
      printf 'commit_status=inline_merge_failed_check_output\n'
      printf 'next_action=Inline merge from finish-ticket-owner failed. Inspect inline_merge output before claiming the next ticket.\n'
    fi
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
