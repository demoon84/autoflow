#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") <ticket-file>" >&2
}

if [ $# -ne 1 ]; then
  usage
  exit 1
fi

ticket_file="$(normalize_runtime_path "$1")"
case "$ticket_file" in
  /*) ;;
  *) ticket_file="${BOARD_ROOT}/${ticket_file}" ;;
esac

if [ ! -f "$ticket_file" ]; then
  echo "Ticket file not found: $ticket_file" >&2
  exit 1
fi

ticket_id="$(extract_numeric_id "$ticket_file")"
worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
worktree_commit="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Worktree Commit")")"
integration_status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
timestamp="$(now_iso)"

if [ "$integration_status" = "integrated" ] && [ -n "$worktree_commit" ]; then
  printf 'status=already_integrated\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'worktree_commit=%s\n' "$worktree_commit"
  exit 0
fi

if [ -z "$worktree_path" ]; then
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "no_worktree"
  append_note "$ticket_file" "No worktree path recorded at ${timestamp}; verifier will commit board-only changes from PROJECT_ROOT."
  printf 'status=no_worktree\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  exit 0
fi

if ! git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "worktree_missing"
  append_note "$ticket_file" "Worktree path was missing during integration at ${timestamp}: ${worktree_path}"
  echo "Worktree is not a git worktree: $worktree_path" >&2
  exit 1
fi

git_root="$(git_root_path || true)"
if [ -z "$git_root" ]; then
  echo "PROJECT_ROOT is not inside a git repository: $PROJECT_ROOT" >&2
  exit 1
fi

board_rel="$(realpath --relative-to="$git_root" "$BOARD_ROOT" 2>/dev/null || basename "$BOARD_ROOT")"
board_rel="${board_rel//\\//}"
board_rel="${board_rel%/}/"

dirty_outside_board=0
while IFS= read -r status_line; do
  [ -n "$status_line" ] || continue
  status_path="${status_line#???}"
  case "$status_path" in
    *" -> "*) status_path="${status_path##* -> }" ;;
  esac
  status_path="${status_path//\\//}"
  case "$status_path" in
    "$board_rel"*|"${board_rel%/}")
      ;;
    *)
      dirty_outside_board=1
      printf 'dirty_outside_board=%s\n' "$status_path" >&2
      ;;
  esac
done < <(git -C "$git_root" status --porcelain --untracked-files=all)

if [ "$dirty_outside_board" -ne 0 ]; then
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_dirty_project_root"
  append_note "$ticket_file" "Worktree integration blocked at ${timestamp}: PROJECT_ROOT has non-board dirty files. Commit/stash unrelated changes before integrating this ticket."
  echo "PROJECT_ROOT has dirty files outside ${board_rel}; refusing to mix another ticket into the final commit." >&2
  exit 1
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
  exit 1
fi

add_paths=()
for allowed_path in "${allowed_paths[@]}"; do
  if [ -e "${worktree_path}/${allowed_path}" ] || git -C "$worktree_path" ls-files --error-unmatch -- "$allowed_path" >/dev/null 2>&1; then
    add_paths+=("$allowed_path")
  else
    append_note "$ticket_file" "Allowed path was not present in worktree during integration at ${timestamp}, so it was skipped: ${allowed_path}"
  fi
done

if [ "${#add_paths[@]}" -gt 0 ]; then
  git -C "$worktree_path" add -A -- "${add_paths[@]}"
fi

if git -C "$worktree_path" diff --cached --quiet; then
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "no_code_changes"
  append_note "$ticket_file" "No staged code changes found in worktree during integration at ${timestamp}."
  printf 'status=no_code_changes\n'
  printf 'ticket_id=%s\n' "$ticket_id"
  printf 'worktree_path=%s\n' "$worktree_path"
  exit 0
fi

git -C "$worktree_path" commit -m "autoflow ticket ${ticket_id} code snapshot" >/dev/null
worktree_commit="$(git -C "$worktree_path" rev-parse --verify HEAD)"

if ! git -C "$git_root" cherry-pick --no-commit "$worktree_commit"; then
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$worktree_commit"
  replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "blocked_cherry_pick_conflict"
  append_note "$ticket_file" "Worktree integration hit a cherry-pick conflict at ${timestamp}: ${worktree_commit}. Resolve or abort the cherry-pick in PROJECT_ROOT before retrying."
  echo "Cherry-pick failed. Resolve or abort in PROJECT_ROOT before retrying." >&2
  exit 1
fi

replace_scalar_field_in_section "$ticket_file" "## Worktree" "Worktree Commit" "$worktree_commit"
replace_scalar_field_in_section "$ticket_file" "## Worktree" "Integration Status" "integrated"
append_note "$ticket_file" "Integrated worktree commit ${worktree_commit} into PROJECT_ROOT without committing at ${timestamp}; verifier should now include board + code changes in one local commit."

printf 'status=integrated\n'
printf 'ticket_id=%s\n' "$ticket_id"
printf 'worktree_path=%s\n' "$worktree_path"
printf 'worktree_commit=%s\n' "$worktree_commit"
printf 'project_root=%s\n' "$PROJECT_ROOT"
