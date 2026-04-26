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

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

run_temp_runtime() {
  local board_dir="$1"
  shift

  (
    cd "$board_dir"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@"
  )
}

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Reject replans in same owner loop
- Status: populated

## Goal

Confirm reject is treated as retry input for the same owner loop.

## Core Scope

### In Scope

- Update `target.txt`.

### Out of Scope

- No other files.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] Reject history is reflected before retry.

## Verification

- Command: test -f target.txt

## Notes

- Reject replan same-loop smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set owner-1 "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec >/dev/null

start_output="${project_dir}/start.out"
fail_output="${project_dir}/fail.out"
run_output="${project_dir}/run.out"
fake_bin="${project_dir}/fake-bin"
fake_args="${project_dir}/codex-args.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_output"
require_line "$start_output" "status=ok"
require_line "$start_output" "ticket_id=001"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/finish-ticket-owner.sh 001 fail "retry with a clearer plan" >"$fail_output"
require_line "$fail_output" "status=rejected"
require_line "$fail_output" "outcome=fail"

mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
printf '%s\n' "\$@" > "${fake_args}"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" --runner owner-1 >"$run_output"
require_line "$run_output" "status=ok"
require_line "$run_output" "runner_status=idle"

ticket_file="${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
reject_file="${project_dir}/.autoflow/tickets/reject/reject_001.md"
if [ ! -f "$ticket_file" ] || [ -f "$reject_file" ]; then
  echo "Reject was not replanned and claimed in the same owner loop." >&2
  find "${project_dir}/.autoflow/tickets" -maxdepth 2 -type f | sort >&2
  exit 1
fi

require_pattern "$ticket_file" 'retry_count=1'
require_pattern "$ticket_file" 'reason=retry with a clearer plan'

expected_worktree="$(awk -F': ' '/^- Path:/ { gsub(/`/, "", $2); print $2; exit }' "$ticket_file")"
actual_worktree="$(awk 'previous == "-C" { print; exit } { previous = $0 }' "$fake_args")"

if [ -z "$expected_worktree" ] || [ ! -d "$expected_worktree" ]; then
  echo "Expected retry worktree was not recorded." >&2
  cat "$ticket_file" >&2
  exit 1
fi

if [ "$actual_worktree" != "$expected_worktree" ]; then
  echo "Codex adapter did not receive the replanned ticket worktree via -C." >&2
  echo "expected=$expected_worktree" >&2
  echo "actual=$actual_worktree" >&2
  cat "$fake_args" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
