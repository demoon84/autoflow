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
    echo "Expected content not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

write_inbox_note() {
  local file="$1"
  local title="$2"

  cat >"$file" <<EOF
# Memo

## Memo

- ID: ${title}
- Status: inbox

## Request

${title}
EOF
}

write_todo_ticket() {
  local file="$1"

  cat >"$file" <<'EOF'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: Dynamic reasoning normal tick fixture
- Stage: todo

## Allowed Paths

- README.md

## Done When

- [ ] Dry-run reasoning fixture only.
EOF
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add planner-dynamic planner "$project_dir" .autoflow \
  agent=codex \
  model=gpt-5.4-mini \
  reasoning=high \
  mode=loop >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add ticket-dynamic ticket-owner "$project_dir" .autoflow \
  agent=codex \
  model=gpt-5.4-mini \
  reasoning=low \
  mode=loop >/dev/null

printf 'baseline\n' >"${project_dir}/README.md"
git -C "$project_dir" add README.md .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

planner_simple="${project_dir}/planner-simple.out"
planner_complex="${project_dir}/planner-complex.out"
planner_disabled="${project_dir}/planner-disabled.out"
ticket_normal="${project_dir}/ticket-normal.out"

AUTOFLOW_REASONING_DYNAMIC_ENABLED=1 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-dynamic --dry-run >"$planner_simple"
require_line "$planner_simple" "configured_reasoning=high"
require_line "$planner_simple" "effective_reasoning=low"
require_line "$planner_simple" "reasoning_source=dynamic_idle"
require_line "$planner_simple" "reasoning_complexity=simple"
require_line "$planner_simple" "reasoning_actionable_count=0"
require_contains "$planner_simple" "model_reasoning_effort=\\\"low\\\""
planner_simple_state="$(awk -F= '$1 == "state_path" { print $2; exit }' "$planner_simple")"
planner_simple_log="$(awk -F= '$1 == "log_path" { print $2; exit }' "$planner_simple")"
require_line "$planner_simple_state" "reasoning=low"
require_line "$planner_simple_state" "configured_reasoning=high"
require_contains "$planner_simple_log" "effective_reasoning=low"

mkdir -p "${project_dir}/.autoflow/tickets/inbox"
write_inbox_note "${project_dir}/.autoflow/tickets/inbox/memo_001.md" "first actionable note"
write_inbox_note "${project_dir}/.autoflow/tickets/inbox/memo_002.md" "second actionable note"

AUTOFLOW_REASONING_DYNAMIC_ENABLED=1 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-dynamic --dry-run >"$planner_complex"
require_line "$planner_complex" "configured_reasoning=high"
require_line "$planner_complex" "effective_reasoning=high"
require_line "$planner_complex" "reasoning_source=dynamic_multi_actionable"
require_line "$planner_complex" "reasoning_complexity=complex"
require_line "$planner_complex" "reasoning_actionable_count=2"
require_contains "$planner_complex" "model_reasoning_effort=\\\"high\\\""

mkdir -p "${project_dir}/.autoflow/tickets/todo"
write_todo_ticket "${project_dir}/.autoflow/tickets/todo/tickets_001.md"

AUTOFLOW_REASONING_DYNAMIC_ENABLED=1 \
  "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner ticket-dynamic --dry-run >"$ticket_normal"
require_line "$ticket_normal" "configured_reasoning=low"
require_line "$ticket_normal" "effective_reasoning=medium"
require_line "$ticket_normal" "reasoning_source=dynamic_single_actionable"
require_line "$ticket_normal" "reasoning_complexity=normal"
require_line "$ticket_normal" "reasoning_actionable_count=1"
require_contains "$ticket_normal" "model_reasoning_effort=\\\"medium\\\""
ticket_state="$(awk -F= '$1 == "state_path" { print $2; exit }' "$ticket_normal")"
require_line "$ticket_state" "reasoning=medium"
require_line "$ticket_state" "configured_reasoning=low"

AUTOFLOW_REASONING_DYNAMIC_ENABLED=0 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-dynamic --dry-run >"$planner_disabled"
require_line "$planner_disabled" "configured_reasoning=high"
require_line "$planner_disabled" "effective_reasoning=high"
require_line "$planner_disabled" "reasoning_source=configured"
require_line "$planner_disabled" "reasoning_complexity=configured"
require_contains "$planner_disabled" "model_reasoning_effort=\\\"high\\\""

echo "status=ok"
echo "project_root=$project_dir"
