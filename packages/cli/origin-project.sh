#!/usr/bin/env bash
# origin-project.sh — `autoflow origin <sub>` thin wrapper.
# Resolves project_root + board_root the same way other autoflow CLI
# subcommands do, then delegates to the in-board scripts/origin-cli.sh.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

if [ "$#" -lt 1 ]; then
  cat <<USAGE >&2
Usage: autoflow origin <sub> [project-root] [board-dir-name] [args...]

Subcommands:
  status              Counts of triggers / done / inprogress
  list [--limit N]    Most recent chains (default 20)
  search <keyword>    Search prompts / paths / titles / commit subjects
  of-ticket <id>      Chain that produced a given ticket
  of-commit <hash>    Chain whose completion commit matches
  sync                Refresh origin_chain + ticket_lifecycle from sources
USAGE
  exit 2
fi

sub="$1"
shift

# project-root and board-dir-name may appear at the start or be omitted.
case "$sub" in
  status|sync)
    target_root="${1:-.}"
    board_dir_name="${2:-$(default_board_dir_name)}"
    [ "$#" -gt 0 ] && shift || true
    [ "$#" -gt 0 ] && shift || true
    ;;
  list|search|of-ticket|of-commit)
    # Allow `autoflow origin search "keyword" [project-root] [board-dir-name]`
    # OR `autoflow origin search [project-root] [board-dir-name] "keyword"`.
    # Heuristic: if $1 starts with `-` or is not a directory, treat the first
    # remaining args as sub-args and use defaults for paths.
    if [ "$#" -ge 1 ] && [ -d "$1" ]; then
      target_root="$1"; shift
      board_dir_name="${1:-$(default_board_dir_name)}"
      [ "$#" -gt 0 ] && shift || true
    else
      target_root="."
      board_dir_name="$(default_board_dir_name)"
    fi
    ;;
  *)
    echo "unknown subcommand: $sub" >&2
    exit 2
    ;;
esac

project_root="$(resolve_project_root_or_die "$target_root")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
origin_cli="${board_root}/scripts/origin-cli.sh"
state_db_script="${board_root}/scripts/state-db.sh"

if [ "$sub" = "sync" ]; then
  exec env AUTOFLOW_BOARD_ROOT="$board_root" \
    AUTOFLOW_PROJECT_ROOT="$project_root" \
    bash "$state_db_script" origin-sync "$@"
fi

if [ ! -x "$origin_cli" ]; then
  echo "origin-cli not found: $origin_cli" >&2
  exit 2
fi

exec env AUTOFLOW_BOARD_ROOT="$board_root" \
  AUTOFLOW_PROJECT_ROOT="$project_root" \
  bash "$origin_cli" "$sub" "$@"
