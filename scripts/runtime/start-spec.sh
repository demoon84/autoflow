#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_expected_role "spec"

requested_id="${1:-}"

spec_dir="${BOARD_ROOT}/rules/spec"
plan_dir="${BOARD_ROOT}/rules/plan"
spec_template="${spec_dir}/project-spec-template.md"
plan_template="${plan_dir}/plan_template.md"

if [ ! -f "$spec_template" ]; then
  echo "Spec template not found: ${spec_template}" >&2
  exit 1
fi

if [ ! -f "$plan_template" ]; then
  echo "Plan template not found: ${plan_template}" >&2
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
    id="$(extract_numeric_id "$path" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    if [ "$((10#$id))" -gt "$max_id" ]; then
      max_id="$((10#$id))"
    fi
  done < <(find "$spec_dir" -maxdepth 1 -type f -name 'project_[0-9][0-9][0-9].md' | sort)
  printf '%03d' "$((max_id + 1))"
}

if [ -n "$requested_id" ]; then
  spec_id="$(normalize_id "$requested_id")"
else
  if is_spec_placeholder "${spec_dir}/project_001.md"; then
    spec_id="001"
  else
    spec_id="$(next_spec_id)"
  fi
fi

spec_file="${spec_dir}/project_${spec_id}.md"
plan_file="${plan_dir}/plan_${spec_id}.md"

created_spec="false"
created_plan="false"

if [ ! -f "$spec_file" ]; then
  cp "$spec_template" "$spec_file"
  created_spec="true"
fi

if [ ! -f "$plan_file" ]; then
  cp "$plan_template" "$plan_file"
  replace_scalar_field_in_section "$plan_file" "## Plan" "Plan ID" "$spec_id"
  replace_scalar_field_in_section "$plan_file" "## Spec References" "Project Spec" "\`rules/spec/project_${spec_id}.md\`"
  created_plan="true"
fi

spec_is_placeholder="false"
if is_spec_placeholder "$spec_file"; then
  spec_is_placeholder="true"
fi

plan_status="$(extract_scalar_field_in_section "$plan_file" "Plan" "Status" | tr -d ' ')"
[ -n "$plan_status" ] || plan_status="draft"

printf 'status=ready_for_input\n'
printf 'spec_id=%s\n' "$spec_id"
printf 'spec_file=%s\n' "$spec_file"
printf 'plan_file=%s\n' "$plan_file"
printf 'spec_created=%s\n' "$created_spec"
printf 'plan_created=%s\n' "$created_plan"
printf 'spec_is_placeholder=%s\n' "$spec_is_placeholder"
printf 'plan_status=%s\n' "$plan_status"
printf 'board_root=%s\n' "$BOARD_ROOT"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'next_action=Describe the project or feature intent in this conversation. The spec-author agent will write it into %s and %s. Keep plan Status as draft; flip to ready only when the plan is actionable.\n' "$spec_file" "$plan_file"
