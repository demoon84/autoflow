#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  spec-project.sh create [project-root] [board-dir-name] [--id NNN] [--title text] [--goal text] [--from-file path] [--raw] [--save-handoff] [--force]

Examples:
  echo "Build a runner dashboard" | spec-project.sh create /path/to/project --title "Runner dashboard"
  spec-project.sh create /path/to/project .autoflow --from-file handoff.md
EOF
}

normalize_project_id() {
  local raw="$1"

  raw="${raw#prd_}"
  raw="${raw#project_}"
  raw="${raw%.md}"
  case "$raw" in
    ''|*[!0-9]*)
      echo "Invalid PRD id: $1" >&2
      exit 1
      ;;
  esac

  printf '%03d' "$((10#$raw))"
}

next_project_id() {
  local board_root="$1"
  local max_id=0
  local file base id

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    base="$(basename "$file")"
    id="${base#prd_}"
    id="${id#project_}"
    id="${id%.md}"
    case "$id" in
      [0-9][0-9][0-9])
        if [ "$((10#$id))" -gt "$max_id" ]; then
          max_id="$((10#$id))"
        fi
        ;;
    esac
  done < <(find "${board_root}/tickets" -type f \( -name 'prd_[0-9][0-9][0-9].md' -o -name 'project_[0-9][0-9][0-9].md' \) 2>/dev/null | sort)

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
    echo "Unknown PRD action: ${action}" >&2
    usage
    exit 1
    ;;
esac

project_id=""
title=""
goal=""
from_file=""
raw="false"
save_handoff="false"
force="false"
positionals=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --id)
      shift || true
      project_id="${1:-}"
      [ -n "$project_id" ] || { echo "--id requires a value" >&2; exit 1; }
      ;;
    --id=*)
      project_id="${1#--id=}"
      ;;
    --title)
      shift || true
      title="${1:-}"
      [ -n "$title" ] || { echo "--title requires a value" >&2; exit 1; }
      ;;
    --title=*)
      title="${1#--title=}"
      ;;
    --goal)
      shift || true
      goal="${1:-}"
      [ -n "$goal" ] || { echo "--goal requires a value" >&2; exit 1; }
      ;;
    --goal=*)
      goal="${1#--goal=}"
      ;;
    --from-file)
      shift || true
      from_file="${1:-}"
      [ -n "$from_file" ] || { echo "--from-file requires a path" >&2; exit 1; }
      ;;
    --from-file=*)
      from_file="${1#--from-file=}"
      ;;
    --raw)
      raw="true"
      ;;
    --save-handoff|--save-conversation)
      save_handoff="true"
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

spec_dir="$(spec_root_path "$board_root")"
mkdir -p "$spec_dir"

if [ -n "$project_id" ]; then
  spec_id="$(normalize_project_id "$project_id")"
else
  spec_id="$(next_project_id "$board_root")"
fi

spec_file="${spec_dir}/prd_${spec_id}.md"
if [ -e "$spec_file" ] && [ "$force" != "true" ]; then
  printf 'status=blocked\n'
  printf 'reason=spec_already_exists\n'
  printf 'spec_id=%s\n' "$spec_id"
  printf 'spec_file=%s\n' "$spec_file"
  printf 'next_action=Use --force to overwrite, or choose another --id.\n'
  exit 0
fi

handoff=""
if [ -n "$from_file" ]; then
  if [ ! -f "$from_file" ]; then
    echo "Handoff file not found: ${from_file}" >&2
    exit 1
  fi
  handoff="$(cat "$from_file")"
elif [ ! -t 0 ]; then
  handoff="$(cat)"
fi

if [ "$raw" = "true" ] && [ -z "$handoff" ]; then
  echo "--raw requires stdin or --from-file content" >&2
  exit 1
fi

handoff_first_line="$(printf '%s\n' "$handoff" | first_nonempty_line || true)"
[ -n "$title" ] || title="$(basename "$project_root") prd_${spec_id}"
[ -n "$goal" ] || goal="${handoff_first_line:-Describe the shipped outcome in observable terms}"

tmp="$(autoflow_mktemp)"
if [ "$raw" = "true" ]; then
  printf '%s\n' "$handoff" > "$tmp"
else
  {
    printf '# Project PRD\n\n'
    printf '## Project\n\n'
    printf -- '- Name: %s\n' "$title"
    printf -- '- Goal: %s\n' "$goal"
    printf -- '- Owner:\n\n'
    printf '## Core Scope\n\n'
    printf -- '- In Scope:\n'
    printf -- '- Out of Scope:\n\n'
    printf '## Main Screens / Modules\n\n'
    printf -- '- ...\n\n'
    printf '## Global Rules\n\n'
    printf -- '- Board files live in `%s/`\n' "$board_dir_name"
    printf -- '- Allowed Paths are relative to the host project root\n'
    printf -- '- Verification commands run from the host project root unless a ticket says otherwise\n\n'
    printf '## Conversation Handoff\n\n'
    if [ -n "$handoff" ]; then
      printf '```text\n%s\n```\n\n' "$handoff"
    else
      printf -- '- None\n\n'
    fi
    printf '## Global Acceptance Criteria\n\n'
    printf -- '- [ ] ...\n\n'
    printf '## Verification\n\n'
    printf -- '- Command:\n'
    printf -- '- Manual check:\n'
  } > "$tmp"
fi

mv "$tmp" "$spec_file"

conversation_file=""
conversation_saved="false"
if [ "$save_handoff" = "true" ] && [ -n "$handoff" ]; then
  conversation_dir="${board_root}/conversations/prd_${spec_id}"
  conversation_file="${conversation_dir}/spec-handoff.md"
  mkdir -p "$conversation_dir"

  tmp="$(autoflow_mktemp)"
  {
    printf '# PRD Handoff\n\n'
    printf -- '- Project: project_%s\n' "$spec_id"
    printf -- '- Spec: tickets/backlog/prd_%s.md\n' "$spec_id"
    printf -- '- Source: autoflow spec create\n\n'
    printf '## Conversation Summary\n\n'
    printf '```text\n%s\n```\n' "$handoff"
  } > "$tmp"
  mv "$tmp" "$conversation_file"
  conversation_saved="true"
fi

printf 'status=created\n'
printf 'spec_id=%s\n' "$spec_id"
printf 'spec_file=%s\n' "$spec_file"
printf 'conversation_saved=%s\n' "$conversation_saved"
[ -z "$conversation_file" ] || printf 'conversation_file=%s\n' "$conversation_file"
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'board_dir_name=%s\n' "$board_dir_name"
printf 'raw=%s\n' "$raw"
printf 'next_action=Run autoflow run planner or use the planner runner to turn this PRD into tickets.\n'
