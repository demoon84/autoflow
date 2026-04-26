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

  "${REPO_ROOT}/bin/autoflow" spec create "$project_dir" --raw <<SPEC
# Project Spec

## Meta

- Project Key: ${project_key}
- Title: ${title}
- Status: populated

## Goal

Touch the shared file.

## Core Scope

### In Scope

- Update \`shared.txt\`.

### Out of Scope

- No other files.

## Main Screens / Modules

- \`shared.txt\`

## Allowed Paths

- shared.txt

## Global Acceptance Criteria

- [ ] \`shared.txt\` exists.

## Verification

- Command: test -f shared.txt

## Notes

- Shared path serialization smoke spec.
SPEC
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add owner-2 ticket-owner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null

printf 'base\n' >"${project_dir}/shared.txt"
git -C "$project_dir" add shared.txt .autoflow .claude .codex
git -C "$project_dir" commit -m "baseline" >/dev/null
printf 'dirty\n' >"${project_dir}/shared.txt"

write_spec "project_001" "Shared path first ticket" >/dev/null
write_spec "project_002" "Shared path second ticket" >/dev/null

start_one_output="${project_dir}/start-one.out"
start_two_output="${project_dir}/start-two.out"
finish_one_output="${project_dir}/finish-one.out"
merge_one_output="${project_dir}/merge-one.out"
resume_two_output="${project_dir}/resume-two.out"
finish_two_block_output="${project_dir}/finish-two-block.out"
runner_block_output="${project_dir}/runner-block.out"
fake_bin="${project_dir}/fake-bin"
fake_codex_marker="${project_dir}/codex-called"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/start-ticket-owner.sh >"$start_one_output"
require_line "$start_one_output" "status=ok"
require_line "$start_one_output" "ticket_id=001"
require_line "$start_one_output" "worktree_status=project_root_fallback"
require_line "$start_one_output" "worktree_fallback_reason=dirty_allowed_path:shared.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$start_two_output"
require_line "$start_two_output" "status=blocked"
require_line "$start_two_output" "reason=shared_allowed_path_conflict"
require_line "$start_two_output" "ticket_id=002"
require_line "$start_two_output" "blockers=tickets_001:shared.txt"
require_pattern "${project_dir}/.autoflow/tickets/inprogress/tickets_002.md" 'Runtime auto-blocked: shared_allowed_path_conflict'

mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<FAKE_CODEX
#!/usr/bin/env bash
touch "${fake_codex_marker}"
echo "unexpected codex adapter invocation" >&2
exit 42
FAKE_CODEX
chmod +x "${fake_bin}/codex"

"${REPO_ROOT}/bin/autoflow" runners set owner-2 "$project_dir" agent=codex model=gpt-5.4 reasoning=medium >/dev/null
AUTOFLOW_WORKTREE_MODE=project-root-on-dirty PATH="${fake_bin}:$PATH" "${REPO_ROOT}/bin/autoflow" run ticket "$project_dir" --runner owner-2 >"$runner_block_output"
require_line "$runner_block_output" "status=blocked"
require_line "$runner_block_output" "runner_status=blocked"
require_line "$runner_block_output" "runtime_status=blocked"
require_line "$runner_block_output" "reason=shared_allowed_path_conflict"
if [ -e "$fake_codex_marker" ]; then
  echo "Codex adapter was invoked even though runtime preflight was blocked." >&2
  exit 1
fi

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/finish-ticket-owner.sh 002 pass "should wait" >"$finish_two_block_output"
require_line "$finish_two_block_output" "status=blocked"
require_line "$finish_two_block_output" "reason=shared_allowed_path_conflict"
require_line "$finish_two_block_output" "blockers=tickets_001:shared.txt"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-1 ./scripts/finish-ticket-owner.sh 001 pass "first ticket complete" >"$finish_one_output"
require_line "$finish_one_output" "status=ready_to_merge"
require_line "$finish_one_output" "outcome=pass"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=merge AUTOFLOW_WORKER_ID=merge-1 ./scripts/merge-ready-ticket.sh 001 >"$merge_one_output"
require_line "$merge_one_output" "status=done"
require_line "$merge_one_output" "outcome=pass"

run_temp_runtime "${project_dir}/.autoflow" AUTOFLOW_WORKTREE_MODE=project-root-on-dirty AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=owner-2 ./scripts/start-ticket-owner.sh >"$resume_two_output"
require_line "$resume_two_output" "status=resume"
require_line "$resume_two_output" "ticket_id=002"
require_line "$resume_two_output" "stage=executing"
require_pattern "${project_dir}/.autoflow/tickets/inprogress/tickets_002.md" 'shared Allowed Path blockers cleared'

echo "status=ok"
echo "project_root=$project_dir"
