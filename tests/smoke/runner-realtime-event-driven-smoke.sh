#!/usr/bin/env bash
#
# Smoke test for runner_realtime_* generic event-driven wakeup.
#
# Verifies:
#   1. AUTOFLOW_RUNNER_REALTIME_ENABLED=1 enables all 4 roles
#   2. Per-role AUTOFLOW_<ROLE>_REALTIME_ENABLED=1 enables just that role
#   3. Per-role watch paths return correct specs
#   4. Fingerprint generation works per-role and changes when inputs change
#
# Run from repo root:
#   bash tests/smoke/runner-realtime-event-driven-smoke.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f packages/cli/runners-project.sh ]; then
  echo "FAIL: cannot find packages/cli/runners-project.sh" >&2
  exit 1
fi

TMPDIR_BASE="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BASE"' EXIT

# Stub the helper functions that come from cli-common
project_root="$TMPDIR_BASE/proj"
board_root="$project_root/.autoflow"
mkdir -p "$board_root/runners/state" \
  "$board_root/tickets/inbox" "$board_root/tickets/backlog" "$board_root/tickets/reject" \
  "$board_root/tickets/todo" "$board_root/tickets/verifier" "$board_root/tickets/done" \
  "$board_root/wiki"

runner_state_dir() { printf '%s' "${board_root}/runners/state"; }
runner_ensure_dirs() { mkdir -p "$(runner_state_dir)"; }
runner_now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
runner_append_log() { return 0; }
export -f runner_state_dir runner_ensure_dirs runner_now_iso runner_append_log
export project_root board_root

# Source only the realtime function block from runners-project.sh.
# Extract from `runner_realtime_enabled()` start through the
# `runner_planner_realtime_consume_pending()` wrapper end (single closing brace).
start_line="$(grep -n '^runner_realtime_enabled()' packages/cli/runners-project.sh | head -1 | cut -d: -f1)"
end_anchor_line="$(grep -n '^runner_planner_realtime_consume_pending()' packages/cli/runners-project.sh | head -1 | cut -d: -f1)"
# The wrapper body is one statement + closing brace, so extend +2 lines past the anchor.
end_line=$((end_anchor_line + 2))
sed -n "${start_line},${end_line}p" packages/cli/runners-project.sh > "$TMPDIR_BASE/realtime_funcs.sh"

# shellcheck disable=SC1091
source "$TMPDIR_BASE/realtime_funcs.sh"

pass=0
fail=0

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label (expected=$expected got=$actual)"
    fail=$((fail + 1))
  fi
}

assert_true() {
  local label="$1"
  if "${@:2}" 2>/dev/null; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label"
    fail=$((fail + 1))
  fi
}

assert_false() {
  local label="$1"
  if "${@:2}" 2>/dev/null; then
    echo "FAIL: $label (expected to be false)"
    fail=$((fail + 1))
  else
    echo "PASS: $label"
    pass=$((pass + 1))
  fi
}

echo "=== Test 1: umbrella env enables all 4 roles ==="
export AUTOFLOW_RUNNER_REALTIME_ENABLED=1
unset AUTOFLOW_PLANNER_REALTIME_ENABLED AUTOFLOW_TICKET_REALTIME_ENABLED \
      AUTOFLOW_VERIFIER_REALTIME_ENABLED AUTOFLOW_WIKI_REALTIME_ENABLED || true
for role in planner ticket verifier wiki; do
  assert_true "umbrella enables ${role}" runner_realtime_enabled "$role" "loop"
done
assert_false "invalid role rejected" runner_realtime_enabled "invalid" "loop"
assert_false "non-loop mode rejected" runner_realtime_enabled "planner" "one-shot"

echo ""
echo "=== Test 2: per-role env only enables that role ==="
unset AUTOFLOW_RUNNER_REALTIME_ENABLED
export AUTOFLOW_TICKET_REALTIME_ENABLED=1
assert_false "planner disabled when only TICKET set" runner_realtime_enabled "planner" "loop"
assert_true  "ticket enabled when TICKET set" runner_realtime_enabled "ticket" "loop"
assert_false "verifier disabled when only TICKET set" runner_realtime_enabled "verifier" "loop"

echo ""
echo "=== Test 3: per-role watch specs ==="
specs="$(runner_realtime_inputs_specs planner | tr '\n' ',' | sed 's/,$//')"
assert_eq "planner watch specs" "tickets/inbox:order_*.md,tickets/backlog:prd_*.md,tickets/reject:reject_*.md" "$specs"

specs="$(runner_realtime_inputs_specs ticket | tr '\n' ',' | sed 's/,$//')"
assert_eq "ticket watch specs" "tickets/todo:tickets_*.md" "$specs"

specs="$(runner_realtime_inputs_specs verifier | tr '\n' ',' | sed 's/,$//')"
assert_eq "verifier watch specs" "tickets/verifier:*.md" "$specs"

specs="$(runner_realtime_inputs_specs wiki | tr '\n' ',' | sed 's/,$//')"
assert_eq "wiki watch specs" "tickets/done:*.md,wiki:*.md" "$specs"

echo ""
echo "=== Test 4: fingerprint changes when watched files change ==="
fp_before="$(runner_realtime_inputs_fingerprint planner)"
echo "test order" > "$board_root/tickets/inbox/order_999.md"
fp_after="$(runner_realtime_inputs_fingerprint planner)"
if [ "$fp_before" != "$fp_after" ]; then
  echo "PASS: planner fingerprint changes when inbox file added"
  pass=$((pass + 1))
else
  echo "FAIL: planner fingerprint did not change"
  fail=$((fail + 1))
fi

fp_t_before="$(runner_realtime_inputs_fingerprint ticket)"
echo "test ticket" > "$board_root/tickets/todo/tickets_999.md"
fp_t_after="$(runner_realtime_inputs_fingerprint ticket)"
if [ "$fp_t_before" != "$fp_t_after" ]; then
  echo "PASS: ticket fingerprint changes when todo file added"
  pass=$((pass + 1))
else
  echo "FAIL: ticket fingerprint did not change"
  fail=$((fail + 1))
fi

# Verify role isolation: adding a verifier file should not change planner fingerprint
fp_p_before="$(runner_realtime_inputs_fingerprint planner)"
echo "test verify" > "$board_root/tickets/verifier/verify_999.md"
fp_p_after="$(runner_realtime_inputs_fingerprint planner)"
assert_eq "planner fingerprint unchanged when only verifier file added" "$fp_p_before" "$fp_p_after"

echo ""
echo "=== Test 5: marker path / fingerprint path are per-role ==="
mp_planner="$(runner_realtime_marker_path "test-runner" "planner")"
mp_ticket="$(runner_realtime_marker_path "test-runner" "ticket")"
if [ "$mp_planner" != "$mp_ticket" ]; then
  echo "PASS: marker paths are role-specific"
  pass=$((pass + 1))
else
  echo "FAIL: marker paths collide between roles"
  fail=$((fail + 1))
fi

echo ""
echo "=== Test 6: backward compat planner_realtime_* wrappers ==="
export AUTOFLOW_PLANNER_REALTIME_ENABLED=1
unset AUTOFLOW_RUNNER_REALTIME_ENABLED AUTOFLOW_TICKET_REALTIME_ENABLED
assert_true "legacy planner_realtime_enabled wrapper works" runner_planner_realtime_enabled "planner" "loop"
fp_legacy="$(runner_planner_realtime_inputs_fingerprint)"
fp_new="$(runner_realtime_inputs_fingerprint planner)"
assert_eq "legacy fingerprint matches new generic" "$fp_new" "$fp_legacy"

echo ""
echo "=== Summary ==="
echo "Passed: $pass"
echo "Failed: $fail"
[ "$fail" -eq 0 ] || exit 1
