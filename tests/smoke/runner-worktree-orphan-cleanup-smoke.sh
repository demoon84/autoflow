#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/autoflow-runner-orphan.XXXXXX")"
PIDS=()

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
    kill -9 "$pid" 2>/dev/null || true
  done
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

source "${ROOT_DIR}/runtime/board-scripts/common.sh"

pid_running() {
  local pid="${1:-}"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

start_fixture_process() {
  local cwd="$1"

  (
    cd "$cwd"
    bash -c 'sleep 300 & wait' >/dev/null 2>&1 &
    printf '%s\n' "$!"
  )
}

count_bound_processes() {
  local path="$1"

  autoflow_worktree_bound_process_pids "$path" | wc -l | tr -d '[:space:]'
}

completed_cleanup_smoke() {
  local target other target_pid other_pid remaining

  target="${TMP_ROOT}/completed-worktree"
  other="${TMP_ROOT}/completed-worktree-other"
  mkdir -p "$target" "$other"

  target_pid="$(start_fixture_process "$target")"
  other_pid="$(start_fixture_process "$other")"
  PIDS+=("$target_pid" "$other_pid")
  sleep 0.3

  cleanup_worktree_bound_processes "$target" >/dev/null
  sleep 0.3
  remaining="$(count_bound_processes "$target")"

  if [ "$remaining" != "0" ]; then
    echo "completed cleanup left target-bound processes: $remaining" >&2
    return 1
  fi
  if ! pid_running "$other_pid"; then
    echo "completed cleanup killed sibling worktree fixture process" >&2
    return 1
  fi
  if ! grep -n 'cleanup_worktree_bound_processes "$cleanup_worktree_path"' "${ROOT_DIR}/runtime/board-scripts/merge-ready-ticket.sh" >/dev/null; then
    echo "completed cleanup path does not call worktree-bound process cleanup" >&2
    return 1
  fi

  printf 'completed_cleanup_orphans=%s\n' "$remaining"
}

self_preservation_smoke() {
  local target helper output

  target="${TMP_ROOT}/self-worktree"
  helper="${TMP_ROOT}/self-cleanup-helper.sh"
  mkdir -p "$target"

  cat >"$helper" <<'HELPER'
#!/usr/bin/env bash
set -euo pipefail
root_dir="$1"
target="$2"
source "${root_dir}/runtime/board-scripts/common.sh"
cleanup_worktree_bound_processes "$target" >/dev/null
printf 'self_cleanup_survived=1\n'
HELPER
  chmod +x "$helper"

  output="$(bash -c 'bash "$1" "$2" "$3"' "parent-${target}" "$helper" "$ROOT_DIR" "$target")"
  if ! printf '%s\n' "$output" | grep -Fq 'self_cleanup_survived=1'; then
    echo "cleanup killed or interrupted its own adapter ancestry" >&2
    printf '%s\n' "$output" >&2
    return 1
  fi

  printf 'self_cleanup_survived=1\n'
}

stale_cleanup_smoke() {
  local repo board ticket worktree other branch base_commit target_pid other_pid remaining

  repo="${TMP_ROOT}/stale-repo"
  board="${repo}/.autoflow"
  worktree="${TMP_ROOT}/stale-worktree"
  other="${TMP_ROOT}/stale-worktree-other"
  branch="autoflow/tickets_998"
  mkdir -p "$repo" "$board/tickets/todo" "$other"
  git -C "$repo" init -q
  git -C "$repo" config user.email "autoflow-smoke@example.invalid"
  git -C "$repo" config user.name "Autoflow Smoke"
  printf 'base\n' >"${repo}/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m "base"
  base_commit="$(git -C "$repo" rev-parse HEAD)"
  git -C "$repo" worktree add -q -b "$branch" "$worktree" "$base_commit"

  target_pid="$(start_fixture_process "$worktree")"
  other_pid="$(start_fixture_process "$other")"
  PIDS+=("$target_pid" "$other_pid")
  sleep 0.3

  ticket="${board}/tickets/todo/tickets_998.md"
  cat >"$ticket" <<EOF
# Ticket

## Ticket

- ID: tickets_998
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Worktree
- Path: \`${worktree}\`
- Branch: ${branch}
- Base Commit: ${base_commit}
- Worktree Commit:
- Integration Status: pending

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Next Action
- pending

## Notes
EOF

  BOARD_ROOT="$board" PROJECT_ROOT="$repo" cleanup_stale_todo_worktree_before_claim "$ticket" "$branch" "$worktree" "$repo" "$base_commit"
  sleep 0.3
  remaining="$(count_bound_processes "$worktree")"

  if [ "$remaining" != "0" ]; then
    echo "stale cleanup left target-bound processes: $remaining" >&2
    return 1
  fi
  if ! pid_running "$other_pid"; then
    echo "stale cleanup killed sibling worktree fixture process" >&2
    return 1
  fi
  if git -C "$repo" worktree list --porcelain | grep -F "worktree $worktree" >/dev/null; then
    echo "stale cleanup did not remove merged stale worktree" >&2
    return 1
  fi

  printf 'stale_cleanup_orphans=%s\n' "$remaining"
}

loop_runtime_missing_smoke() {
  local fixture runner state_file exit_code last_result

  fixture="${TMP_ROOT}/loop-runtime"
  mkdir -p "${fixture}/runtime/board-scripts" "${fixture}/packages/cli" "${fixture}/.autoflow/runners/state" "${fixture}/.autoflow/runners/logs"
  cp "${ROOT_DIR}/runtime/board-scripts/runners-project.sh" "${fixture}/runtime/board-scripts/runners-project.sh"
  cp "${ROOT_DIR}/runtime/board-scripts/runner-common.sh" "${fixture}/runtime/board-scripts/runner-common.sh"
  cp "${ROOT_DIR}/packages/cli/cli-common.sh" "${fixture}/packages/cli/cli-common.sh"
  chmod +x "${fixture}/runtime/board-scripts/runners-project.sh"
  cat >"${fixture}/.autoflow/runners/config.toml" <<'EOF'
[[runners]]
id = "fixture"
role = "planner"
agent = "manual"
model = ""
reasoning = ""
mode = "loop"
interval_seconds = 1
enabled = true
EOF

  set +e
  AUTOFLOW_REPO_ROOT="$fixture" AUTOFLOW_BOARD_ROOT="${fixture}/.autoflow" "${fixture}/runtime/board-scripts/runners-project.sh" loop-worker fixture "$fixture" .autoflow >/dev/null 2>&1
  exit_code="$?"
  set -e

  state_file="${fixture}/.autoflow/runners/state/fixture.state"
  last_result="$(awk -F= '$1 == "last_result" { print $2; exit }' "$state_file" 2>/dev/null || true)"

  if [ "$exit_code" != "0" ]; then
    echo "loop runtime missing smoke exited $exit_code" >&2
    return 1
  fi
  if [ "$last_result" != "loop_runtime_missing" ]; then
    echo "loop runtime missing smoke recorded last_result=${last_result:-missing}" >&2
    return 1
  fi

  printf 'loop_runtime_missing_exit=%s\n' "$exit_code"
}

completed_cleanup_smoke
self_preservation_smoke
stale_cleanup_smoke
loop_runtime_missing_smoke
