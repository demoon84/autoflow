#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
worktree_root="${project_dir}-worktrees"
cleanup() {
  rm -rf "$project_dir" "$worktree_root"
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

write_spec() {
  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<'SPEC'
# Project Spec

## Meta

- Project Key: project_001
- Title: Goal runtime smoke
- Status: populated

## Goal

Confirm the ticket-owner runner carries durable goal state into the adapter prompt.

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

- [ ] The owner adapter prompt includes a goal guardrail.
- [ ] A no-progress adapter turn marks continuation as suppressed.

## Verification

- Command: test -f target.txt

## Notes

- Goal runtime smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set worker "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

printf 'base\n' >"${project_dir}/target.txt"
git -C "$project_dir" add target.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec >/dev/null

AUTOFLOW_ROLE=plan \
  AUTOFLOW_WORKER_ID=planner-smoke \
  AUTOFLOW_BOARD_ROOT="${project_dir}/.autoflow" \
  AUTOFLOW_PROJECT_ROOT="$project_dir" \
  "${project_dir}/.autoflow/scripts/start-plan.sh" >/dev/null

fake_bin="${project_dir}/fake-bin"
prompt_capture="${project_dir}/captured-prompt.txt"
run_output="${project_dir}/run.out"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
cat > "${prompt_capture}"
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 AUTOFLOW_WORKTREE_ROOT="$worktree_root" PATH="${fake_bin}:$PATH" \
  "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" --runner worker >"$run_output"

require_line "$run_output" "status=ok"
require_line "$run_output" "runner_status=idle"

ticket_file="${project_dir}/.autoflow/tickets/inprogress/tickets_001.md"
if [ ! -f "$ticket_file" ]; then
  echo "Ticket was not claimed into inprogress." >&2
  cat "$run_output" >&2
  exit 1
fi

require_line "$ticket_file" "## Goal Runtime"
require_line "$ticket_file" "- Status: active"
require_line "$ticket_file" "- Tick Count: 1"
require_line "$ticket_file" "- Continuation Suppressed: true"
require_line "$ticket_file" "- Last Event: no_board_progress"
require_pattern "$ticket_file" '^- Goal runtime suppressed continuation '

require_line "$prompt_capture" "Goal guardrail:"
require_line "$prompt_capture" "Ticket goal runtime:"
require_line "$prompt_capture" "Completion audit before finish:"

echo "status=ok"
echo "project_root=$project_dir"
