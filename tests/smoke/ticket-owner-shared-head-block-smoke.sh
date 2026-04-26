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
  local project_key="$1"
  local title="$2"
  local target="$3"

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Touch ${target}.

## Core Scope

### In Scope

- Update \`${target}\`.

### Out of Scope

- No other files.

## Main Screens / Modules

- \`${target}\`

## Allowed Paths

- ${target}

## Global Acceptance Criteria

- [ ] \`${target}\` exists.

## Verification

- Command: test -f ${target}

## Notes

- Shared non-base HEAD smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

printf 'a\n' >"${project_dir}/a.txt"
printf 'b\n' >"${project_dir}/b.txt"
git -C "$project_dir" add a.txt b.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null

write_spec "project_001" "Shared head first ticket" "a.txt" >/dev/null
write_spec "project_002" "Shared head second ticket" "b.txt" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
resume_two_output="${project_dir}/resume-two.out"
runner_block_output="${project_dir}/runner-block.out"
fake_bin="${project_dir}/fake-bin"
fake_codex_marker="${project_dir}/codex-called"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"
require_line "$start_one_output" "worktree_status=ready"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=ok"
require_line "$start_two_output" "ticket_id=002"
require_line "$start_two_output" "worktree_status=ready"

printf 'first change\n' >"${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_001/a.txt"
git -C "${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_001" add a.txt
git -C "${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_001" commit -m "first ticket change" >/dev/null
shared_head="$(git -C "${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_001" rev-parse --verify HEAD)"
git -C "${project_dir}/../.autoflow-worktrees/$(basename "$project_dir")/tickets_002" reset --hard "$shared_head" >/dev/null

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$resume_two_output"
require_line "$resume_two_output" "status=blocked"
require_line "$resume_two_output" "reason=shared_nonbase_head_conflict"
require_pattern "$resume_two_output" "blockers=tickets_001:${shared_head}"
require_pattern "${project_dir}/.autoflow/tickets/inprogress/tickets_002.md" 'Runtime auto-blocked: shared_nonbase_head_conflict'

mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
touch "${fake_codex_marker}"
echo "unexpected codex adapter invocation" >&2
exit 42
FAKE_CODEX
chmod +x "${fake_bin}/codex"

PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" --runner owner-2 >"$runner_block_output"
require_line "$runner_block_output" "status=blocked"
require_line "$runner_block_output" "runner_status=blocked"
require_line "$runner_block_output" "runtime_status=blocked"
require_line "$runner_block_output" "reason=ticket_stage_blocked"
if [ -e "$fake_codex_marker" ]; then
  echo "Codex adapter was invoked even though runtime preflight was blocked." >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
