#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"
source "$(cd "$(dirname "$0")" && pwd)/runner-common.sh"

usage() {
  echo "Usage: $(basename "$0") [ticket-id-or-path]" >&2
}

if [ $# -gt 1 ]; then
  usage
  exit 1
fi

ensure_expected_role "merge"

ticket_ref="${1:-}"
worker_id="$(owner_id)"
display_id="$(display_worker_id "$worker_id")"
timestamp="$(now_iso)"

resolve_ready_ticket_file() {
  # Post-refactor: tickets/ready-to-merge/ is gone. Pass-tagged tickets
  # stay in tickets/inprogress/ with Stage=ready_to_merge until this script
  # picks them up. We still accept the legacy folder if it exists for
  # transitional boards that haven't migrated yet.
  local ref="${1:-}"
  local normalized_ref id candidate

  if [ -z "$ref" ]; then
    if [ -d "${BOARD_ROOT}/tickets/ready-to-merge" ]; then
      candidate="$(lowest_matching_file "${BOARD_ROOT}/tickets/ready-to-merge" 'tickets_*.md' || true)"
      [ -n "$candidate" ] && printf '%s' "$candidate" && return 0
    fi
    while IFS= read -r candidate; do
      [ -n "$candidate" ] || continue
      stage="$(ticket_stage "$candidate")"
      case "$stage" in
        ready_to_merge|ready-to-merge|merge_blocked|merge-blocked)
          printf '%s' "$candidate"
          return 0
          ;;
      esac
    done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')
    return 1
  fi

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

  candidate="$(ticket_path "inprogress" "$id")"
  [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
  candidate="$(ticket_path "ready-to-merge" "$id")"
  [ -f "$candidate" ] && printf '%s' "$candidate" && return 0

  return 1
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

ticket_diff_path_allowed() {
  local ticket_file="$1"
  local repo_rel_path="$2"
  local allowed_path

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_path="${allowed_path#./}"
    case "$allowed_path" in
      ".")
        return 0
        ;;
      *)
        case "$repo_rel_path" in
          "$allowed_path"|"$allowed_path"/*)
            return 0
            ;;
        esac
        ;;
    esac
  done < <(extract_ticket_allowed_paths "$ticket_file")

  return 1
}

git_operation_in_progress_reason() {
  local git_root="$1"
  local state_name state_path

  for state_name in MERGE_HEAD CHERRY_PICK_HEAD REBASE_HEAD REVERT_HEAD; do
    state_path="$(git -C "$git_root" rev-parse --git-path "$state_name" 2>/dev/null || true)"
    if [ -n "$state_path" ] && [ -e "$state_path" ]; then
      printf '%s_present' "$(printf '%s' "$state_name" | tr '[:upper:]' '[:lower:]')"
      return 0
    fi
  done

  return 1
}

merge_ticket_worktree() {
  local ticket_file="$1"
  local ticket_id worktree_path worktree_commit integration_status git_root op_reason
  local -a allowed_paths=()
  local -a conflict_paths=()
  local -a invalid_paths=()
  local allowed_path repo_rel_path cherry_pick_output

  ticket_id="$(extract_numeric_id "$ticket_file")"
  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  worktree_commit="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Worktree Commit")")"
  integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"

  git_root="$(git_root_path || true)"
  if [ -z "$git_root" ]; then
    printf 'status=no_git_repo\n'
    printf 'ticket_id=%s\n' "$ticket_id"
    return 0
  fi

  op_reason="$(git_operation_in_progress_reason "$git_root" || true)"
  if [ -n "$op_reason" ]; then
    printf 'status=blocked\n'
    printf 'reason=git_operation_in_progress\n'
    printf 'git_state=%s\n' "$op_reason"
    return 1
  fi

  case "$integration_status" in
    integrated)
      printf 'status=already_integrated\n'
      printf 'ticket_id=%s\n' "$ticket_id"
      [ -z "$worktree_commit" ] || printf 'worktree_commit=%s\n' "$worktree_commit"
      return 0
      ;;
    no_worktree|no_code_changes|already_in_project_root)
      printf 'status=%s\n' "$integration_status"
      printf 'ticket_id=%s\n' "$ticket_id"
      return 0
      ;;
  esac

  if [ -z "$worktree_commit" ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_missing_worktree_commit"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: ready-to-merge ticket did not record a Worktree Commit."
    printf 'status=blocked\n'
    printf 'reason=missing_worktree_commit\n'
    return 1
  fi

  if ! git -C "$git_root" cat-file -e "${worktree_commit}^{commit}" >/dev/null 2>&1; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_missing_worktree_commit"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: Worktree Commit was not reachable from PROJECT_ROOT git object database: ${worktree_commit}"
    printf 'status=blocked\n'
    printf 'reason=missing_worktree_commit\n'
    printf 'worktree_commit=%s\n' "$worktree_commit"
    return 1
  fi

  local project_root_head new_worktree_head rebase_log_file rebase_tail
  project_root_head="$(git_head_commit "$git_root" 2>/dev/null || true)"
  if [ -n "$project_root_head" ] && [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
    if ! git -C "$worktree_path" merge-base --is-ancestor "$project_root_head" "$worktree_commit" 2>/dev/null; then
      rebase_log_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-mergebot-rebase.XXXXXX")"
      if git -C "$worktree_path" rebase --autostash "$project_root_head" >"$rebase_log_file" 2>&1; then
        new_worktree_head="$(git -C "$worktree_path" rev-parse --verify HEAD 2>/dev/null || true)"
        if [ -n "$new_worktree_head" ] && [ "$new_worktree_head" != "$worktree_commit" ]; then
          replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$new_worktree_head"
          append_note "$ticket_file" "Coordinator rebased worktree onto PROJECT_ROOT HEAD ${project_root_head} at ${timestamp} (Worktree Commit: ${worktree_commit} -> ${new_worktree_head})."
          worktree_commit="$new_worktree_head"
        fi
        rm -f "$rebase_log_file"
      else
        git -C "$worktree_path" rebase --abort >/dev/null 2>&1 || true
        rebase_tail="$(tail -3 "$rebase_log_file" 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
        replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_rebase_conflict"
        append_note "$ticket_file" "Coordinator rebase onto PROJECT_ROOT HEAD ${project_root_head} failed at ${timestamp}; ticket-owner must resolve conflicts in ${worktree_path} (e.g. \`git -C ${worktree_path} rebase ${project_root_head}\`) before re-queuing. Tail: ${rebase_tail}"
        rm -f "$rebase_log_file"
        printf 'status=blocked\n'
        printf 'reason=rebase_conflict\n'
        printf 'project_root_head=%s\n' "$project_root_head"
        printf 'worktree_commit=%s\n' "$worktree_commit"
        return 1
      fi
    fi
  fi

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_paths+=("$allowed_path")
  done < <(extract_ticket_allowed_paths "$ticket_file")
  if [ "${#allowed_paths[@]}" -eq 0 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_missing_allowed_paths"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: Allowed Paths was empty."
    printf 'status=blocked\n'
    printf 'reason=missing_allowed_paths\n'
    return 1
  fi

  while IFS= read -r repo_rel_path; do
    [ -n "$repo_rel_path" ] || continue
    if ! ticket_diff_path_allowed "$ticket_file" "$repo_rel_path"; then
      invalid_paths+=("$repo_rel_path")
    fi
  done < <(git -C "$git_root" diff-tree --no-commit-id --name-only -r "$worktree_commit")
  if [ "${#invalid_paths[@]}" -gt 0 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_invalid_worktree_commit_scope"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: Worktree Commit touched paths outside Allowed Paths (${invalid_paths[*]})."
    printf 'status=blocked\n'
    printf 'reason=invalid_worktree_commit_scope\n'
    printf 'invalid_path=%s\n' "${invalid_paths[@]}"
    return 1
  fi

  conflict_paths=()
  while IFS= read -r repo_rel_path; do
    [ -n "$repo_rel_path" ] || continue
    if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
      ticket_path_has_dirty_project_root_conflict "$ticket_file" "$repo_rel_path" "$git_root" || continue
    elif ! git -C "$git_root" status --porcelain --untracked-files=all -- "$repo_rel_path" | grep -q .; then
      continue
    fi
    conflict_paths+=("$repo_rel_path")
  done < <(git -C "$git_root" diff-tree --no-commit-id --name-only -r "$worktree_commit")
  if [ "${#conflict_paths[@]}" -gt 0 ]; then
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_dirty_scope_conflict"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: PROJECT_ROOT has conflicting dirty changes in commit paths (${conflict_paths[*]})."
    printf 'status=blocked\n'
    printf 'reason=dirty_scope_conflict\n'
    printf 'conflicting_path=%s\n' "${conflict_paths[@]}"
    return 1
  fi

  set +e
  cherry_pick_output="$(git -C "$git_root" cherry-pick --no-commit "$worktree_commit" 2>&1)"
  if [ "$?" -ne 0 ]; then
    set -e
    git -C "$git_root" cherry-pick --abort >/dev/null 2>&1 || true
    replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_cherry_pick_conflict"
    append_note "$ticket_file" "Merge blocked at ${timestamp}: cherry-pick conflict for Worktree Commit ${worktree_commit}. Coordinator aborted the cherry-pick; resolve the ticket branch or rebase/recreate the worktree before retrying."
    printf 'status=blocked\n'
    printf 'reason=cherry_pick_conflict\n'
    printf 'worktree_commit=%s\n' "$worktree_commit"
    printf '%s\n' "$cherry_pick_output"
    return 1
  fi
  set -e

  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "integrated"
  append_note "$ticket_file" "Coordinator ${display_id} integrated worktree commit ${worktree_commit} into PROJECT_ROOT without committing at ${timestamp}."

  printf 'status=integrated\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  [ -z "$worktree_path" ] || printf 'worktree_path=%s\n' "$worktree_path"
  printf 'worktree_commit=%s\n' "$worktree_commit"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
}

move_run_file() {
  local source_run_file="$1"
  local target_run_file="$2"
  local timestamp_slug

  [ -f "$source_run_file" ] || return 0
  if [ "$source_run_file" = "$target_run_file" ]; then
    return 0
  fi

  mkdir -p "$(dirname "$target_run_file")"
  if [ -f "$target_run_file" ]; then
    if cmp -s "$source_run_file" "$target_run_file"; then
      rm -f "$source_run_file"
      return 0
    fi
    timestamp_slug="$(printf '%s' "$(now_iso)" | tr -d ':-')"
    target_run_file="${target_run_file%.md}.${timestamp_slug}.duplicate.md"
  fi

  mv "$source_run_file" "$target_run_file"
}

move_ticket_to_merge_blocked() {
  # Post-refactor: tickets/merge-blocked/ is gone. We mark the in-place
  # ticket with Stage=merge_blocked so the next merge tick can retry, while
  # keeping the run file alongside the ticket. The function name is kept
  # for call-site stability.
  local ticket_file="$1"
  local run_file="$2"
  local reason="$3"

  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "merge_blocked"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Next Action" "- Next: repair the merge blocker (${reason}). The ticket stays in tickets/inprogress/ with Stage=merge_blocked; the next merge invocation will retry."
  append_note "$ticket_file" "Impl AI ${display_id} flagged merge_blocked in place at ${timestamp}: ${reason}."

  printf '%s' "$ticket_file"
}

stage_ticket_commit_scope() {
  local git_root="$1"
  local ticket_file="$2"
  local run_file="$3"
  local allowed_path ticket_id project_key done_root

  ticket_id="$(extract_numeric_id "$ticket_file")"
  project_key="$(project_key_from_ticket_file "$ticket_file" 2>/dev/null || true)"

  stage_git_path_if_present "$git_root" "$ticket_file"
  if [ -n "${done_target:-}" ]; then
    stage_git_path_if_present "$git_root" "$done_target"
  fi
  stage_git_path_if_present "$git_root" "$run_file"

  if [ -n "$project_key" ]; then
    done_root="${BOARD_ROOT}/tickets/done/${project_key}"
    stage_git_path_if_present "$git_root" "$done_root"
  fi

  if [ -n "$ticket_id" ]; then
    while IFS= read -r log_file; do
      [ -n "$log_file" ] || continue
      stage_git_path_if_present "$git_root" "$log_file"
    done < <(find "${BOARD_ROOT}/logs" -maxdepth 1 -type f -name "verifier_${ticket_id}_*.md" 2>/dev/null)
  fi

  for wiki_file in index.md log.md project-overview.md; do
    stage_git_path_if_present "$git_root" "${BOARD_ROOT}/wiki/${wiki_file}"
  done

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

  if [ "${AUTOFLOW_MERGE_SKIP_COMMIT:-}" = "1" ]; then
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
  [ -n "$summary" ] || summary="complete merged ticket-owner work"
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

find_autoflow_cli_fast() {
  local path_entry candidate uname_value
  local path_entries=()

  uname_value="$(uname -r 2>/dev/null || true)"
  IFS=':' read -r -a path_entries <<< "${PATH:-}"
  for path_entry in "${path_entries[@]}"; do
    [ -n "$path_entry" ] || continue
    case "$uname_value:$path_entry" in
      *[Mm]icrosoft*:/mnt/[a-zA-Z]/*|*WSL*:/mnt/[a-zA-Z]/*)
        continue
        ;;
    esac
    candidate="${path_entry}/autoflow"
    if [ -x "$candidate" ] && [ ! -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
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
  local config_path runner_id runner_role runner_enabled fallback_runner_id allow_coordinator_fallback

  config_path="${BOARD_ROOT}/runners/config.toml"
  [ -f "$config_path" ] || return 1
  allow_coordinator_fallback="${AUTOFLOW_WIKI_MAINTAINER_COORDINATOR_FALLBACK:-on}"

  runner_id=""
  runner_role=""
  runner_enabled="true"

  consider_wiki_runner() {
    case "${runner_role:-}:${runner_enabled:-true}" in
      wiki-maintainer:true|wiki:true)
        if [ -n "$runner_id" ]; then
          printf '%s' "$runner_id"
          return 0
        fi
        ;;
      coordinator:true|coord:true|doctor:true|diagnose:true)
        if [ "$allow_coordinator_fallback" = "on" ] && [ -n "$runner_id" ] && [ -z "${fallback_runner_id:-}" ]; then
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
      id*)
        case "$line" in id*=*) ;; *) continue ;; esac
        runner_id="${line#*=}"
        runner_id="$(printf '%s' "$runner_id" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"
        ;;
      role*)
        case "$line" in role*=*) ;; *) continue ;; esac
        runner_role="${line#*=}"
        runner_role="$(printf '%s' "$runner_role" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"
        ;;
      enabled*)
        case "$line" in enabled*=*) ;; *) continue ;; esac
        runner_enabled="${line#*=}"
        runner_enabled="$(printf '%s' "$runner_enabled" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"
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

runner_role_from_config() {
  local target_runner_id="$1"
  local config_path="${BOARD_ROOT}/runners/config.toml"
  local runner_id="" runner_role="" line

  [ -f "$config_path" ] || return 1
  while IFS= read -r line; do
    case "$line" in
      "[[runners]]")
        if [ "$runner_id" = "$target_runner_id" ] && [ -n "$runner_role" ]; then
          printf '%s' "$runner_role"
          return 0
        fi
        runner_id=""
        runner_role=""
        ;;
      id*)
        case "$line" in id*=*) ;; *) continue ;; esac
        runner_id="${line#*=}"
        runner_id="$(printf '%s' "$runner_id" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"
        ;;
      role*)
        case "$line" in role*=*) ;; *) continue ;; esac
        runner_role="${line#*=}"
        runner_role="$(printf '%s' "$runner_role" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"
        ;;
    esac
  done < "$config_path"

  if [ "$runner_id" = "$target_runner_id" ] && [ -n "$runner_role" ]; then
    printf '%s' "$runner_role"
    return 0
  fi

  return 1
}

auto_run_wiki_maintainer() {
  local runner_id wiki_output wiki_exit board_dir_name runner_role

  if [ "${AUTOFLOW_WIKI_MAINTAINER_AUTO:-on}" = "off" ]; then
    printf 'wiki_maintainer.status=skipped_by_env\n'
    return 0
  fi

  runner_id="$(find_enabled_wiki_maintainer_runner || true)"
  if [ -z "$runner_id" ]; then
    printf 'wiki_maintainer.status=skipped_no_runner\n'
    return 0
  fi
  if [ "$runner_id" = "$worker_id" ]; then
    runner_role="$(runner_role_from_config "$runner_id" || true)"
    case "$runner_role:${AUTOFLOW_WIKI_MAINTAINER_ALLOW_CURRENT_COORDINATOR:-on}" in
      coordinator:on|coord:on|doctor:on|diagnose:on)
        ;;
      *)
        printf 'wiki_maintainer.status=skipped_current_runner\n'
        printf 'wiki_maintainer.runner_id=%s\n' "$runner_id"
        return 0
        ;;
    esac
  fi

  local autoflow_cli="${AUTOFLOW_CLI:-${PROJECT_ROOT}/bin/autoflow}"
  if [ ! -x "$autoflow_cli" ]; then
    autoflow_cli="$(find_autoflow_cli_fast || true)"
  fi
  if [ ! -x "$autoflow_cli" ]; then
    printf 'wiki_maintainer.status=failed\n'
    printf 'wiki_maintainer.reason=autoflow_cli_missing\n'
    return 0
  fi

  board_dir_name="$(basename "$BOARD_ROOT")"
  set +e
  wiki_output="$(AUTOFLOW_RUNNER_ALLOW_NON_ONESHOT=1 "$autoflow_cli" run wiki "$PROJECT_ROOT" "$board_dir_name" --runner "$runner_id" 2>&1)"
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

ticket_file="$(resolve_ready_ticket_file "$ticket_ref" || true)"
if [ -z "$ticket_file" ] || [ ! -f "$ticket_file" ]; then
  fail_or_idle "Ready-to-merge ticket not found: ${ticket_ref:-next}" "merge_ready_ticket_missing"
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
run_file="$(ready_to_merge_run_path_for_ticket_file "$ticket_file")"
if [ ! -f "$run_file" ]; then
  run_file="$(pending_run_path "$ticket_id")"
fi
if [ ! -f "$run_file" ]; then
  run_file="$(ensure_runs_file "$ticket_id")"
fi

merge_retry_state_file="${BOARD_ROOT}/runners/state/merge-retry-${ticket_id}.txt"
merge_retry_threshold="${AUTOFLOW_MERGE_BLOCKED_THRESHOLD:-5}"

merge_output="$(merge_ticket_worktree "$ticket_file" 2>&1)" || {
  merge_reason="$(printf '%s\n' "$merge_output" | awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' 2>/dev/null || true)"
  current_reason="${merge_reason:-unknown}"
  case "$merge_reason" in
    cherry_pick_conflict|invalid_worktree_commit_scope|missing_worktree_commit|missing_allowed_paths|rebase_conflict)
      ticket_file="$(move_ticket_to_merge_blocked "$ticket_file" "$run_file" "$current_reason")"
      rm -f "$merge_retry_state_file"
      ;;
    *)
      prior_reason=""
      prior_count=0
      if [ -f "$merge_retry_state_file" ]; then
        prior_reason="$(awk -F= '$1 == "reason" { sub(/^[^=]*=/, "", $0); print; exit }' "$merge_retry_state_file" 2>/dev/null || true)"
        prior_count="$(awk -F= '$1 == "count" { sub(/^[^=]*=/, "", $0); print; exit }' "$merge_retry_state_file" 2>/dev/null || true)"
        case "$prior_count" in *[!0-9]*|"") prior_count=0 ;; esac
      fi
      if [ "$current_reason" = "$prior_reason" ]; then
        retry_count=$((prior_count + 1))
      else
        retry_count=1
      fi
      mkdir -p "$(dirname "$merge_retry_state_file")"
      {
        printf 'reason=%s\n' "$current_reason"
        printf 'count=%d\n' "$retry_count"
        printf 'last=%s\n' "$timestamp"
      } >"$merge_retry_state_file"

      if [ "$retry_count" -ge "$merge_retry_threshold" ]; then
        escalated_reason="${current_reason}_persistent"
        ticket_file="$(move_ticket_to_merge_blocked "$ticket_file" "$run_file" "$escalated_reason")"
        append_note "$ticket_file" "Impl AI escalated to merge_blocked at ${timestamp}: ${current_reason} persisted for ${retry_count} consecutive attempts (threshold=${merge_retry_threshold})."
        rm -f "$merge_retry_state_file"
        merge_reason="$escalated_reason"
      else
        replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
        append_note "$ticket_file" "Coordinator ${display_id} blocked at ${timestamp}: ${current_reason} (attempt ${retry_count}/${merge_retry_threshold})."
      fi
      ;;
  esac
  printf 'status=blocked\n'
  printf 'reason=%s\n' "${merge_reason:-merge_failed}"
  printf 'ticket=%s\n' "$ticket_file"
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'run=%s\n' "$run_file"
  printf '%s\n' "$merge_output"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
}

rm -f "$merge_retry_state_file"

done_target="$(done_ticket_path_for_ticket_file "$ticket_file")"
mkdir -p "$(dirname "$done_target")"
replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "done"
replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
replace_section_block "$ticket_file" "Next Action" "- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit."
append_note "$ticket_file" "Coordinator ${display_id} finalized this verified ticket at ${timestamp}."
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

cleanup_worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
cleanup_branch="autoflow/tickets_${ticket_id}"
cleanup_git_root="$(git_root_path 2>/dev/null || true)"
cleanup_status_parts=()
if [ -n "$cleanup_git_root" ] && [ -n "$cleanup_worktree_path" ] && [ -d "$cleanup_worktree_path" ]; then
  if git -C "$cleanup_git_root" worktree remove --force "$cleanup_worktree_path" >/dev/null 2>&1; then
    cleanup_status_parts+=("removed_worktree=${cleanup_worktree_path}")
  else
    cleanup_status_parts+=("worktree_remove_failed=${cleanup_worktree_path}")
  fi
fi
if [ -n "$cleanup_git_root" ] && git -C "$cleanup_git_root" rev-parse --verify --quiet "refs/heads/${cleanup_branch}" >/dev/null 2>&1; then
  if git -C "$cleanup_git_root" branch -D "$cleanup_branch" >/dev/null 2>&1; then
    cleanup_status_parts+=("deleted_branch=${cleanup_branch}")
  else
    cleanup_status_parts+=("branch_delete_failed=${cleanup_branch}")
  fi
fi
if [ "${#cleanup_status_parts[@]}" -gt 0 ]; then
  cleanup_summary="${cleanup_status_parts[*]}"
  append_note "$ticket_file" "Coordinator post-merge cleanup at ${timestamp}: ${cleanup_summary}."
  runner_append_log "$worker_id" "post_merge_cleanup" \
    "ticket_id=${ticket_id}" \
    "${cleanup_status_parts[@]}" 2>/dev/null || true
fi

printf 'status=done\n'
printf 'outcome=pass\n'
printf 'ticket=%s\n' "$ticket_file"
printf 'ticket_id=%s\n' "$ticket_id"
printf 'run=%s\n' "$(done_run_path_for_ticket_file "$ticket_file")"
printf '%s\n' "$merge_output"
printf '%s\n' "$log_output"
printf '%s\n' "$wiki_output"
printf '%s\n' "$wiki_maintainer_output"
printf '%s\n' "$commit_output"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
