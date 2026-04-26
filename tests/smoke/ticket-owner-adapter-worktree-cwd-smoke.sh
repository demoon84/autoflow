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

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Adapter uses ticket worktree
- Status: populated

## Goal

Confirm the ticket-owner adapter runs against the ticket worktree from planning onward.

## Core Scope

### In Scope

- Touch `target.txt`.

### Out of Scope

- No other files.

## Main Screens / Modules

- `target.txt`

## Allowed Paths

- target.txt

## Global Acceptance Criteria

- [ ] Adapter receives the ticket worktree as its working root.

## Verification

- Command: test -f target.txt

## Notes

- Adapter worktree smoke spec.
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

fake_bin="${project_dir}/fake-bin"
fake_args="${project_dir}/codex-args.txt"
run_output="${project_dir}/run.out"
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
expected_worktree="$(awk -F': ' '/^- Path:/ { gsub(/`/, "", $2); print $2; exit }' "$ticket_file")"
actual_worktree="$(awk 'previous == "-C" { print; exit } { previous = $0 }' "$fake_args")"

if [ -z "$expected_worktree" ] || [ ! -d "$expected_worktree" ]; then
  echo "Expected ticket worktree was not recorded." >&2
  cat "$ticket_file" >&2
  exit 1
fi

if [ "$actual_worktree" != "$expected_worktree" ]; then
  echo "Codex adapter did not receive the ticket worktree via -C." >&2
  echo "expected=$expected_worktree" >&2
  echo "actual=$actual_worktree" >&2
  echo "--- args ---" >&2
  cat "$fake_args" >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
