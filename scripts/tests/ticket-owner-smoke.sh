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

  if ! grep -Fqx "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

if [ ! -d "${project_dir}/.autoflow" ]; then
  echo "Expected default board directory at ${project_dir}/.autoflow" >&2
  exit 1
fi

if [ -e "${project_dir}/autoflow" ]; then
  echo "Unexpected legacy default board directory at ${project_dir}/autoflow" >&2
  exit 1
fi

spec_output="${project_dir}/spec.out"
start_output="${project_dir}/start.out"
verify_output="${project_dir}/verify.out"
finish_output="${project_dir}/finish.out"
status_output="${project_dir}/status.out"

"${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC' >"$spec_output"
# Project Spec

## Meta

- Project Key: project_001
- Title: Owner smoke project
- Status: populated

## Goal

Create a tiny owner-mode smoke artifact.

## Core Scope

### In Scope

- Create `owner-done.txt` in the project root.

### Out of Scope

- No app code changes.

## Main Screens / Modules

- `owner-done.txt`

## Global Acceptance Criteria

- `owner-done.txt` exists.

## Verification

- Command: test -f owner-done.txt

## Notes

- Temporary runtime smoke spec.
SPEC

require_line "$spec_output" "status=created"

(
  cd "${project_dir}/.autoflow"
  AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/start-ticket-owner.sh
) >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"
require_line "$start_output" "stage=planning"

: >"${project_dir}/owner-done.txt"

(
  cd "${project_dir}/.autoflow"
  AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/verify-ticket-owner.sh 001
) >"$verify_output"
require_line "$verify_output" "status=pass"
require_line "$verify_output" "ticket_id=001"
require_line "$verify_output" "exit_code=0"

(
  cd "${project_dir}/.autoflow"
  AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-smoke ./scripts/finish-ticket-owner.sh 001 pass "owner smoke artifact verified"
) >"$finish_output"
require_line "$finish_output" "status=done"
require_line "$finish_output" "outcome=pass"
require_line "$finish_output" "commit_status=committed"
require_pattern "$finish_output" '^commit_hash=[0-9a-f]{40}$'

"${REPO_ROOT}/bin/autoflow" status "$project_dir" >"$status_output"
require_line "$status_output" "status=initialized"
require_line "$status_output" "ticket_inprogress_count=0"
require_line "$status_output" "ticket_done_count=1"
require_line "$status_output" "ticket_owner_active_count=0"

echo "status=ok"
echo "project_root=$project_dir"
echo "commit_hash=$(git -C "$project_dir" rev-parse --verify HEAD)"
