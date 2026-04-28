#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  memo-project.sh create [project-root] [board-dir-name] [--id NNN] [--title text] [--request text] [--from-file path] [--scope text] [--allowed-path path]... [--verification command] [--force]

Examples:
  echo "Increase body font size by 2px" | memo-project.sh create /path/to/project --title "Increase body font"
  memo-project.sh create /path/to/project --request "Make the success toast stay visible for 3 seconds" --allowed-path apps/desktop/src
EOF
}

normalize_memo_id() {
  local raw="$1"

  raw="${raw#memo_}"
  raw="${raw%.md}"
  case "$raw" in
    ''|*[!0-9]*)
      echo "Invalid memo id: $1" >&2
      exit 1
      ;;
  esac

  printf '%03d' "$((10#$raw))"
}

next_memo_id() {
  local board_root="$1"
  local max_id=0
  local file base id

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    base="$(basename "$file")"
    id="${base#memo_}"
    id="${id%.md}"
    case "$id" in
      [0-9][0-9][0-9])
        if [ "$((10#$id))" -gt "$max_id" ]; then
          max_id="$((10#$id))"
        fi
        ;;
    esac
  done < <(find "${board_root}/tickets" -type f -name 'memo_[0-9][0-9][0-9].md' 2>/dev/null | sort)

  printf '%03d' "$((max_id + 1))"
}

first_nonempty_line() {
  awk 'NF { print; exit }'
}

action="${1:-}"
if [ -z "$action" ]; then
  usage
  exit 1
fi
shift || true

case "$action" in
  create|new)
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown memo action: ${action}" >&2
    usage
    exit 1
    ;;
esac

memo_id=""
title=""
request_text=""
from_file=""
scope=""
verification_command=""
force="false"
allowed_paths=()
positionals=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --id)
      shift || true
      memo_id="${1:-}"
      [ -n "$memo_id" ] || { echo "--id requires a value" >&2; exit 1; }
      ;;
    --id=*)
      memo_id="${1#--id=}"
      ;;
    --title)
      shift || true
      title="${1:-}"
      [ -n "$title" ] || { echo "--title requires a value" >&2; exit 1; }
      ;;
    --title=*)
      title="${1#--title=}"
      ;;
    --request)
      shift || true
      request_text="${1:-}"
      [ -n "$request_text" ] || { echo "--request requires a value" >&2; exit 1; }
      ;;
    --request=*)
      request_text="${1#--request=}"
      ;;
    --from-file)
      shift || true
      from_file="${1:-}"
      [ -n "$from_file" ] || { echo "--from-file requires a path" >&2; exit 1; }
      ;;
    --from-file=*)
      from_file="${1#--from-file=}"
      ;;
    --scope)
      shift || true
      scope="${1:-}"
      [ -n "$scope" ] || { echo "--scope requires a value" >&2; exit 1; }
      ;;
    --scope=*)
      scope="${1#--scope=}"
      ;;
    --allowed-path)
      shift || true
      allowed_path="${1:-}"
      [ -n "$allowed_path" ] || { echo "--allowed-path requires a value" >&2; exit 1; }
      allowed_paths+=("$allowed_path")
      ;;
    --allowed-path=*)
      allowed_paths+=("${1#--allowed-path=}")
      ;;
    --verification)
      shift || true
      verification_command="${1:-}"
      [ -n "$verification_command" ] || { echo "--verification requires a value" >&2; exit 1; }
      ;;
    --verification=*)
      verification_command="${1#--verification=}"
      ;;
    --force)
      force="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      positionals+=("$1")
      ;;
  esac
  shift || true
done

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"

if ! board_is_initialized "$board_root"; then
  printf 'status=blocked\n'
  printf 'reason=board_not_initialized\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  exit 0
fi

memo_dir="${board_root}/tickets/inbox"
mkdir -p "$memo_dir"

if [ -n "$memo_id" ]; then
  memo_id="$(normalize_memo_id "$memo_id")"
else
  memo_id="$(next_memo_id "$board_root")"
fi

memo_file="${memo_dir}/memo_${memo_id}.md"
if [ -e "$memo_file" ] && [ "$force" != "true" ]; then
  printf 'status=blocked\n'
  printf 'reason=memo_already_exists\n'
  printf 'memo_id=%s\n' "$memo_id"
  printf 'memo_file=%s\n' "$memo_file"
  printf 'next_action=Use --force to overwrite, or choose another --id.\n'
  exit 0
fi

if [ -n "$from_file" ]; then
  if [ ! -f "$from_file" ]; then
    echo "Memo source file not found: ${from_file}" >&2
    exit 1
  fi
  request_text="$(cat "$from_file")"
elif [ -z "$request_text" ] && [ ! -t 0 ]; then
  request_text="$(cat)"
fi

if [ -z "$request_text" ] && [ -n "$title" ]; then
  request_text="$title"
fi
if [ -z "$request_text" ]; then
  echo "Memo request is required via stdin, --request, --from-file, or --title." >&2
  exit 1
fi

request_first_line="$(printf '%s\n' "$request_text" | first_nonempty_line || true)"
[ -n "$title" ] || title="${request_first_line:-memo_${memo_id}}"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
tmp="$(autoflow_mktemp)"

{
  printf '# Autoflow Memo\n\n'
  printf '## Memo\n\n'
  printf -- '- ID: memo_%s\n' "$memo_id"
  printf -- '- Title: %s\n' "$title"
  printf -- '- Status: inbox\n'
  printf -- '- Created At: %s\n' "$timestamp"
  printf -- '- Source: autoflow memo create\n\n'
  printf '## Request\n\n'
  printf '%s\n\n' "$request_text"
  printf '## Hints\n\n'
  printf '### Scope\n\n'
  if [ -n "$scope" ]; then
    printf -- '- %s\n\n' "$scope"
  else
    printf -- '- pending Plan AI inference\n\n'
  fi
  printf '### Allowed Paths\n\n'
  if [ "${#allowed_paths[@]}" -gt 0 ]; then
    for allowed_path in "${allowed_paths[@]}"; do
      printf -- '- `%s`\n' "$allowed_path"
    done
    printf '\n'
  else
    printf -- '- pending Plan AI inference\n\n'
  fi
  printf '### Verification\n\n'
  if [ -n "$verification_command" ]; then
    printf -- '- Command: %s\n\n' "$verification_command"
  else
    printf -- '- Command: pending Plan AI inference\n\n'
  fi
  printf '## Planner Contract\n\n'
  printf -- '- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.\n'
  printf -- '- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.\n'
} > "$tmp"

mv "$tmp" "$memo_file"

printf 'status=created\n'
printf 'memo_id=%s\n' "$memo_id"
printf 'memo_file=%s\n' "$memo_file"
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'next_action=Run autoflow run planner or let planner-1 promote this memo into a generated PRD and todo ticket.\n'
