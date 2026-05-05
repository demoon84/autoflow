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

reject_line() {
  local file="$1"
  local unexpected="$2"

  if grep -Fqx -- "$unexpected" "$file"; then
    echo "Unexpected line found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_marker_count() {
  local expected="$1"
  local actual

  actual="$(grep -c '^invoked$' "${project_dir}/adapter.marker" 2>/dev/null || true)"
  [ -n "$actual" ] || actual=0
  if [ "$actual" != "$expected" ]; then
    echo "Expected adapter marker count ${expected}, got ${actual}" >&2
    cat "${project_dir}/adapter.marker" 2>/dev/null >&2 || true
    exit 1
  fi
}

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Idle skip mutation smoke
- Status: populated

## Goal

Confirm a relevant ticket input change wakes the ticket runner after idle skip.

## Core Scope

### In Scope

- Touch `target.txt`.

### Out of Scope

- No unrelated files.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] Ticket runner adapter is invoked after a todo ticket appears.

## Verification

- Command: test -f target.txt
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add planner-idle planner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add ticket-idle ticket-owner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add verifier-idle verifier "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

planner_first="${project_dir}/planner-first.out"
planner_second="${project_dir}/planner-second.out"
planner_dry_run="${project_dir}/planner-dry-run.out"
planner_changed="${project_dir}/planner-changed.out"
ticket_first="${project_dir}/ticket-first.out"
ticket_second="${project_dir}/ticket-second.out"
ticket_changed="${project_dir}/ticket-changed.out"
verifier_first="${project_dir}/verifier-first.out"
verifier_second="${project_dir}/verifier-second.out"
verifier_changed="${project_dir}/verifier-changed.out"

"${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-idle >"$planner_first"
require_line "$planner_first" "runtime_status=idle"
require_line "$planner_first" "reason=no_actionable_plan_input"
grep -Eq '^idle_inputs_fingerprint=.+' "$planner_first"
require_marker_count 0

"${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-idle >"$planner_second"
require_line "$planner_second" "runtime_status=idle"
require_line "$planner_second" "reason=planner_inputs_unchanged"
require_line "$planner_second" "runtime_reason=no_actionable_plan_input"
grep -Eq '^idle_inputs_fingerprint=.+' "$planner_second"
require_marker_count 0

"${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-idle --dry-run >"$planner_dry_run"
require_line "$planner_dry_run" "status=dry_run"
require_line "$planner_dry_run" "adapter_prompt_begin"
reject_line "$planner_dry_run" "reason=planner_inputs_unchanged"
require_marker_count 0

mkdir -p "${project_dir}/.autoflow/tickets/inbox"
"${REPO_ROOT}/bin/autoflow" order create "$project_dir" .autoflow \
  --title "planner wake" \
  --request "Planner should see this new order as actionable." >/dev/null

"${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-idle >"$planner_changed"
require_line "$planner_changed" "adapter_exit_code=0"
require_marker_count 1

rm -f "${project_dir}/adapter.marker"

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner ticket-idle >"$ticket_first"
require_line "$ticket_first" "runtime_status=idle"
require_line "$ticket_first" "reason=no_actionable_ticket"
grep -Eq '^idle_inputs_fingerprint=.+' "$ticket_first"
require_marker_count 0

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner ticket-idle >"$ticket_second"
require_line "$ticket_second" "runtime_status=idle"
require_line "$ticket_second" "reason=ticket_inputs_unchanged"
require_line "$ticket_second" "runtime_reason=no_actionable_ticket"
grep -Eq '^idle_inputs_fingerprint=.+' "$ticket_second"
require_marker_count 0

mkdir -p "${project_dir}/.autoflow/tickets/todo"
cat >"${project_dir}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: project_001
- Title: Idle skip wake fixture
- Stage: todo

## Allowed Paths

- target.txt

## Done When

- [ ] Ticket runner adapter is invoked after a todo ticket appears.
TICKET

"${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" .autoflow --runner ticket-idle >"$ticket_changed"
require_line "$ticket_changed" "adapter_exit_code=0"
require_marker_count 1

rm -f "${project_dir}/adapter.marker"

"${REPO_ROOT}/bin/autoflow" run verifier "$project_dir" .autoflow --runner verifier-idle >"$verifier_first"
require_line "$verifier_first" "runtime_status=idle"
require_line "$verifier_first" "reason=no_unblocked_verification_ticket"
grep -Eq '^idle_inputs_fingerprint=.+' "$verifier_first"
require_marker_count 0

"${REPO_ROOT}/bin/autoflow" run verifier "$project_dir" .autoflow --runner verifier-idle >"$verifier_second"
require_line "$verifier_second" "runtime_status=idle"
require_line "$verifier_second" "reason=verifier_inputs_unchanged"
require_line "$verifier_second" "runtime_reason=no_unblocked_verification_ticket"
grep -Eq '^idle_inputs_fingerprint=.+' "$verifier_second"
require_marker_count 0

mkdir -p "${project_dir}/.autoflow/tickets/verifier"
cat >"${project_dir}/.autoflow/tickets/verifier/tickets_002.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_002
- PRD Key: project_001
- Title: Verifier idle skip wake fixture
- Stage: verifying
- Verifier AI: unassigned

## Allowed Paths

- target.txt

## Done When

- [ ] Verifier runner adapter is invoked after a verifier ticket appears.
TICKET

"${REPO_ROOT}/bin/autoflow" run verifier "$project_dir" .autoflow --runner verifier-idle >"$verifier_changed"
require_line "$verifier_changed" "adapter_exit_code=0"
require_marker_count 1

echo "status=ok"
echo "project_root=$project_dir"
