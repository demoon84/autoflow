#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
disabled_project_dir="$(mktemp -d)"
worktree_root="${project_dir}-worktrees"
disabled_worktree_root="${disabled_project_dir}-worktrees"

cleanup() {
  "${REPO_ROOT}/bin/autoflow" runners stop worker "$project_dir" >/dev/null 2>&1 || true
  "${REPO_ROOT}/bin/autoflow" runners stop worker "$disabled_project_dir" >/dev/null 2>&1 || true
  rm -rf "$project_dir" "$disabled_project_dir" "$worktree_root" "$disabled_worktree_root"
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

wait_for_line() {
  local file="$1"
  local expected="$2"
  local attempts="${3:-20}"

  for _ in $(seq 1 "$attempts"); do
    if grep -Fqx -- "$expected" "$file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for line: $expected" >&2
  echo "--- $file ---" >&2
  cat "$file" >&2
  exit 1
}

wait_for_marker_count() {
  local file="$1"
  local expected="$2"
  local attempts="${3:-10}"
  local count

  for _ in $(seq 1 "$attempts"); do
    count="$(grep -c '^invoked$' "$file" 2>/dev/null || true)"
    [ -n "$count" ] || count=0
    if [ "$count" = "$expected" ]; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for marker count $expected in $file" >&2
  cat "$file" 2>/dev/null >&2 || true
  exit 1
}

write_todo_ticket() {
  local target_project="$1"

  mkdir -p "${target_project}/.autoflow/tickets/todo"
  cat >"${target_project}/.autoflow/tickets/todo/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Plan Candidate: smoke
- Title: Tick backoff wake-up smoke
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- Worker loop should wake early once new actionable input appears.

## References

- PRD:
- Feature Spec:
- Plan:

## Reference Notes

- Project Note: [[prd_001]]
- Plan Note:
- Ticket Note: [[tickets_001]]

## Allowed Paths

- target.txt

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] The loop wakes before the extended interval fully elapses.

## Next Action

- Claim the todo ticket.

## Resume Context

- Current state: todo smoke fixture.
- Last completed action: fixture created.
- First thing to inspect on resume: tickets/todo/tickets_001.md

## Notes

- Smoke fixture.

## Verification

- Command: test -f target.txt
- Run file:
- Result:

## Result

- Summary:
TICKET
}

prepare_repo() {
  local target_project="$1"

  git -C "$target_project" init -q
  git -C "$target_project" config user.email autoflow-smoke@example.test
  git -C "$target_project" config user.name "Autoflow Smoke"

  "${REPO_ROOT}/bin/autoflow" init "$target_project" >/dev/null
  "${REPO_ROOT}/bin/autoflow" runners set worker "$target_project" agent=codex model=gpt-5.4 reasoning=medium mode=loop interval_seconds=2 >/dev/null

  printf 'base\n' >"${target_project}/target.txt"
  git -C "$target_project" add target.txt .autoflow .claude .codex
  git -C "$target_project" commit -m "baseline" >/dev/null
}

fake_bin="${project_dir}/fake-bin"
mkdir -p "$fake_bin"
cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
printf 'invoked\n' >> "${AUTOFLOW_PROJECT_ROOT}/adapter.marker"
cat >/dev/null
exit 0
FAKE_CODEX
chmod +x "${fake_bin}/codex"

prepare_repo "$project_dir"

AUTOFLOW_CODEX_DISABLE_PTY=1 \
AUTOFLOW_WORKTREE_ROOT="$worktree_root" \
AUTOFLOW_TICK_BACKOFF_THRESHOLD_IDLE_TICKS=1 \
AUTOFLOW_TICK_BACKOFF_MAX_INTERVAL_SECONDS=5 \
PATH="${fake_bin}:$PATH" \
  "${REPO_ROOT}/bin/autoflow" runners start worker "$project_dir" >/dev/null

state_file="${project_dir}/.autoflow/runners/state/worker.state"
wait_for_line "$state_file" "current_interval_seconds=4" 20
wait_for_line "$state_file" "idle_streak_count=1" 20

list_output="${project_dir}/runners.out"
"${REPO_ROOT}/bin/autoflow" runners list "$project_dir" >"$list_output"
worker_index="$(awk -F'[.=]' '$0 ~ /^runner\.[0-9]+\.id=worker$/ { print $2; exit }' "$list_output")"
if [ -z "$worker_index" ]; then
  echo "Worker runner index not found." >&2
  cat "$list_output" >&2
  exit 1
fi
require_line "$list_output" "runner.${worker_index}.interval_effective_seconds=4"
require_line "$list_output" "runner.${worker_index}.idle_streak_count=1"

rm -f "${project_dir}/adapter.marker"
started_epoch="$(date +%s)"
write_todo_ticket "$project_dir"

wait_for_marker_count "${project_dir}/adapter.marker" 1 6
ended_epoch="$(date +%s)"
elapsed_seconds=$((ended_epoch - started_epoch))
if [ "$elapsed_seconds" -ge 5 ]; then
  echo "Expected early wake-up before 5 seconds, got ${elapsed_seconds}s" >&2
  cat "$state_file" >&2
  exit 1
fi

wait_for_line "$state_file" "current_interval_seconds=2" 6
wait_for_line "$state_file" "idle_streak_count=0" 6

prepare_repo "$disabled_project_dir"
disabled_fake_bin="${disabled_project_dir}/fake-bin"
mkdir -p "$disabled_fake_bin"
cp "${fake_bin}/codex" "${disabled_fake_bin}/codex"

AUTOFLOW_CODEX_DISABLE_PTY=1 \
AUTOFLOW_WORKTREE_ROOT="$disabled_worktree_root" \
AUTOFLOW_TICK_BACKOFF_ENABLED=0 \
AUTOFLOW_TICK_BACKOFF_THRESHOLD_IDLE_TICKS=1 \
AUTOFLOW_TICK_BACKOFF_MAX_INTERVAL_SECONDS=5 \
PATH="${disabled_fake_bin}:$PATH" \
  "${REPO_ROOT}/bin/autoflow" runners start worker "$disabled_project_dir" >/dev/null

disabled_state_file="${disabled_project_dir}/.autoflow/runners/state/worker.state"
wait_for_line "$disabled_state_file" "current_interval_seconds=2" 6
wait_for_line "$disabled_state_file" "idle_streak_count=0" 6

baseline_calls=$((86400 / 60))
capped_calls=$((86400 / 300))
if [ "$capped_calls" -ge $((baseline_calls * 70 / 100)) ]; then
  echo "Expected capped 24h call volume to reduce by at least 30%." >&2
  exit 1
fi

echo "status=ok"
echo "project_root=$project_dir"
