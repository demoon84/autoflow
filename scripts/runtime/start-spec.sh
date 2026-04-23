#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "spec"

requested_id="${1:-}"

spec_dir="${BOARD_ROOT}/tickets/backlog"
spec_template="${BOARD_ROOT}/reference/project-spec-template.md"

if [ ! -f "$spec_template" ]; then
  echo "Spec template not found: ${spec_template}" >&2
  exit 1
fi

is_spec_placeholder() {
  local file="$1"
  [ -f "$file" ] || return 1
  grep -qsF "Replace with your project name" "$file"
}

next_spec_id() {
  local max_id=0
  local path id
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    if is_spec_placeholder "$path"; then
      continue
    fi
    id="$(extract_numeric_id "$path" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    if [ "$((10#$id))" -gt "$max_id" ]; then
      max_id="$((10#$id))"
    fi
  done < <(find "${BOARD_ROOT}/tickets" -type f -name 'project_[0-9][0-9][0-9].md' | sort)
  printf '%03d' "$((max_id + 1))"
}

if [ -n "$requested_id" ]; then
  spec_id="$(normalize_id "$requested_id")"
else
  spec_id="$(next_spec_id)"
fi

spec_file="${spec_dir}/project_${spec_id}.md"

spec_is_placeholder="false"
if is_spec_placeholder "$spec_file"; then
  spec_is_placeholder="true"
fi

printf 'status=ready_for_input\n'
printf 'spec_id=%s\n' "$spec_id"
printf 'spec_file=%s\n' "$spec_file"
printf 'spec_template=%s\n' "$spec_template"
printf 'spec_created=false\n'
printf 'spec_is_placeholder=%s\n' "$spec_is_placeholder"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'next_action=1) Ask the user for the intent + scope + acceptance criteria. 2) Draft the full spec inside THIS conversation as a fenced markdown block — do NOT write to %s yet. 3) Ask "이 내용으로 저장할까요? (저장 / 바꿔 / 취소)" and iterate in chat until the user replies with an explicit confirmation phrase (저장, OK 저장, 확정, save, go). 4) Only after explicit confirmation, overwrite %s. 5) Never create or modify files under tickets/plan/; the planner heartbeat does that.\n' "$spec_file" "$spec_file"
printf 'confirmation_required=true\n'
printf 'confirmation_phrases=저장,OK 저장,확정,save,go,yes save,좋아 저장해\n'
