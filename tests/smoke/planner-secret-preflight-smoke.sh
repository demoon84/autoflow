#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

require_line() {
  local file="$1"
  local expected="$2"

  if ! grep -Fqx -- "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq -- "$expected" "$file"; then
    echo "Expected text not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

reject_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    echo "Unexpected text found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

run_plan() {
  local output_file="$1"
  shift

  env \
    "$@" \
    AUTOFLOW_ROLE=plan \
    AUTOFLOW_WORKER_ID=planner-smoke \
    AUTOFLOW_BOARD_ROOT="${project_dir}/.autoflow" \
    AUTOFLOW_PROJECT_ROOT="${project_dir}" \
    "${project_dir}/.autoflow/scripts/start-plan.sh" >"$output_file"
}

write_prd() {
  local id="$1"
  local requires="$2"
  local command="$3"
  local prose="${4:-}"
  local yaml_header="${5:-}"
  local prd_file="${project_dir}/.autoflow/tickets/backlog/prd_${id}.md"

  mkdir -p "$(dirname "$prd_file")"
  if [ -n "$yaml_header" ]; then
    printf '%s\n' "$yaml_header" >"$prd_file"
  fi
  cat >>"$prd_file" <<EOF
# Project PRD

## Project

- ID: prd_${id}
- Name: planner secret smoke ${id}
- Priority: normal
- Title: Planner secret smoke ${id}
- Goal: planner secret preflight smoke ${id}.
- AI: planner
- Status: generated
- Requires Secrets: ${requires}

## Core Scope

- Goal: Exercise planner secret preflight.
- In Scope: Temporary smoke fixture only.
- Out of Scope: Live provider calls.
${prose}

## Main Screens / Modules

- Module: smoke
  - Path: \`smoke/${id}.txt\`

## Allowed Paths

- \`smoke/${id}.txt\`

## Global Acceptance Criteria

- [ ] \`bash -n .autoflow/scripts/start-plan.sh\` exits \`0\`.
- [ ] \`smoke/${id}.txt\` remains inside Allowed Paths.
- [ ] Planner output includes a concrete \`source=\` line.

## Verification

- Command: \`${command}\`
- Notes: smoke only; do not call a provider.

## Conversation Handoff

- Source: smoke
- Summary: planner secret preflight smoke.

## Notes

- Fixture PRD.
EOF
}

count_todo() {
  find "${project_dir}/.autoflow/tickets/todo" -maxdepth 1 -type f -name 'tickets_*.md' | wc -l | tr -d '[:space:]'
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

missing_one="${project_dir}/missing-one.out"
missing_two="${project_dir}/missing-two.out"
secret_present="${project_dir}/secret-present.out"
prose_only="${project_dir}/prose-only.out"
explicit_missing="${project_dir}/explicit-missing.out"
explicit_present="${project_dir}/explicit-present.out"
yaml_missing="${project_dir}/yaml-missing.out"
yaml_present="${project_dir}/yaml-present.out"

write_prd "001" "[]" 'test -n "$ANTHROPIC_API_KEY"'
run_plan "$missing_one" -u ANTHROPIC_API_KEY -u OPENAI_API_KEY
require_line "$missing_one" "status=ok"
require_line "$missing_one" "source=needs-user-secret"
require_line "$missing_one" "missing_secrets=ANTHROPIC_API_KEY"
require_line "$missing_one" "recovery_state=needs_user"
if [ "$(count_todo)" != "0" ]; then
  echo "missing secret preflight should not create todo tickets" >&2
  find "${project_dir}/.autoflow/tickets/todo" -maxdepth 1 -type f -name 'tickets_*.md' >&2
  exit 1
fi
require_contains "${project_dir}/.autoflow/tickets/backlog/prd_001.md" "- Status: needs_user_secret"

run_plan "$missing_two" -u ANTHROPIC_API_KEY -u OPENAI_API_KEY
note_count="$(grep -F "Planner secret preflight: missing_secrets=ANTHROPIC_API_KEY; source=tickets/backlog/prd_001.md; status=needs_user_secret" "${project_dir}/.autoflow/tickets/backlog/prd_001.md" | wc -l | tr -d '[:space:]')"
if [ "$note_count" != "1" ]; then
  echo "Expected exactly one idempotent missing secret note, got ${note_count}" >&2
  cat "${project_dir}/.autoflow/tickets/backlog/prd_001.md" >&2
  exit 1
fi

run_plan "$secret_present" -u OPENAI_API_KEY ANTHROPIC_API_KEY=dummy
require_line "$secret_present" "status=ok"
require_line "$secret_present" "source=backlog-to-todo"
require_contains "${project_dir}/.autoflow/tickets/todo/tickets_001.md" '- Command: `test -n "$ANTHROPIC_API_KEY"`'

write_prd "002" "[]" "printf prose-only-ok" "- Context: This prose mentions ANTHROPIC_API_KEY but verification does not require it."
run_plan "$prose_only" -u ANTHROPIC_API_KEY -u OPENAI_API_KEY
require_line "$prose_only" "source=backlog-to-todo"
reject_contains "$prose_only" "needs-user-secret"

write_prd "003" "[OPENAI_API_KEY]" "printf explicit-ok"
run_plan "$explicit_missing" -u ANTHROPIC_API_KEY -u OPENAI_API_KEY
require_line "$explicit_missing" "source=needs-user-secret"
require_line "$explicit_missing" "missing_secrets=OPENAI_API_KEY"
run_plan "$explicit_present" -u ANTHROPIC_API_KEY OPENAI_API_KEY=dummy
require_line "$explicit_present" "source=backlog-to-todo"

write_prd "004" "[]" "printf yaml-ok" "" "---
requires_secrets: [OPENAI_API_KEY]
---"
run_plan "$yaml_missing" -u ANTHROPIC_API_KEY -u OPENAI_API_KEY
require_line "$yaml_missing" "source=needs-user-secret"
require_line "$yaml_missing" "missing_secrets=OPENAI_API_KEY"
run_plan "$yaml_present" -u ANTHROPIC_API_KEY OPENAI_API_KEY=dummy
require_line "$yaml_present" "source=backlog-to-todo"

echo "missing_secret_blocked=1"
echo "idempotent_notes=1"
echo "secret_present_promoted=1"
echo "prose_only_promoted=1"
echo "explicit_secret_promoted=1"
