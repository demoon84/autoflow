#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "spec"

worker_id="$(owner_id)"
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

context_active_spec_file() {
  local context_role active_id active_path active_file

  context_role="$(context_effective_value "role" || true)"
  [ "$context_role" = "spec" ] || return 1

  active_id="$(context_effective_value "active_ticket_id" || true)"
  active_path="$(context_effective_value "active_ticket_path" || true)"
  [ -n "$active_id" ] || return 1

  if [ -n "$active_path" ]; then
    active_file="${BOARD_ROOT}/${active_path}"
  else
    active_file="${spec_dir}/prd_${active_id}.md"
  fi

  printf '%s' "$active_file"
}

active_spec_file="$(context_active_spec_file || true)"
if [ -n "$active_spec_file" ]; then
  active_spec_id="$(extract_numeric_id "$active_spec_file" 2>/dev/null || true)"
  requested_spec_id=""
  if [ -n "$requested_id" ]; then
    requested_spec_id="$(normalize_id "$requested_id")"
  fi

  if [ -n "$requested_spec_id" ] && [ "$requested_spec_id" != "$active_spec_id" ]; then
    printf 'status=blocked\n'
    printf 'reason=conversation_already_has_active_spec\n'
    printf 'active_spec_id=%s\n' "$active_spec_id"
    printf 'active_spec_file=%s\n' "$active_spec_file"
    printf 'requested_spec_id=%s\n' "$requested_spec_id"
    printf 'board_root=%s\n' "$BOARD_ROOT"
    printf 'project_root=%s\n' "$PROJECT_ROOT"
    printf 'next_action=Resume or finish the active PRD in this conversation before starting another. Use a new Codex conversation for parallel PRD authoring.\n'
    exit 0
  fi

  spec_is_placeholder="false"
  if is_spec_placeholder "$active_spec_file"; then
    spec_is_placeholder="true"
  fi

  set_thread_context_record "spec" "$worker_id" "$active_spec_id" "authoring" "$(board_relative_path "$active_spec_file")"
  printf 'status=resume\n'
  printf 'spec_id=%s\n' "$active_spec_id"
  printf 'spec_file=%s\n' "$active_spec_file"
  printf 'spec_template=%s\n' "$spec_template"
  printf 'spec_created=false\n'
  printf 'spec_is_placeholder=%s\n' "$spec_is_placeholder"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'next_action=Resume the active spec draft in this conversation; one Codex conversation authors one spec at a time.\n'
  printf 'confirmation_required=true\n'
  printf 'confirmation_phrases=저장,OK 저장,확정,save,go,yes save,좋아 저장해\n'
  exit 0
fi

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
  done < <(find "${BOARD_ROOT}/tickets" -type f -name 'prd_[0-9][0-9][0-9].md' | sort)
  printf '%03d' "$((max_id + 1))"
}

if [ -n "$requested_id" ]; then
  spec_id="$(normalize_id "$requested_id")"
else
  spec_id="$(next_spec_id)"
fi

spec_file="${spec_dir}/prd_${spec_id}.md"

spec_is_placeholder="false"
if is_spec_placeholder "$spec_file"; then
  spec_is_placeholder="true"
fi

set_thread_context_record "spec" "$worker_id" "$spec_id" "authoring" "$(board_relative_path "$spec_file")"

printf 'status=ready_for_input\n'
printf 'spec_id=%s\n' "$spec_id"
printf 'spec_file=%s\n' "$spec_file"
printf 'spec_template=%s\n' "$spec_template"
printf 'spec_created=false\n'
printf 'spec_is_placeholder=%s\n' "$spec_is_placeholder"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'next_action=1) Ask the user for the intent + scope + acceptance criteria. 2) Draft the full spec inside THIS conversation as a fenced markdown block — do NOT write to %s yet. 3) Ask "이 내용으로 저장할까요? (저장 / 바꿔 / 취소)" and iterate in chat until the user replies with an explicit confirmation phrase (저장, OK 저장, 확정, save, go). 4) Only after explicit confirmation, overwrite %s. 5) Never create or modify files under tickets/plan/; after save, Ticket Owner should consume the spec through autoflow run ticket or Desktop Owner execution.\n' "$spec_file" "$spec_file"
printf 'confirmation_required=true\n'
printf 'confirmation_phrases=저장,OK 저장,확정,save,go,yes save,좋아 저장해\n'
