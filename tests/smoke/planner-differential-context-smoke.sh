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

require_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq -- "$expected" "$file"; then
    echo "Expected text not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

reject_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    echo "Unexpected text found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

run_planner() {
  local output_file="$1"
  shift
  "$@" >"$output_file"
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add planner-diff planner "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='cat "$AUTOFLOW_PROMPT_FILE" > "$AUTOFLOW_PROJECT_ROOT/prompt.capture"; if [ -f "$AUTOFLOW_PROJECT_ROOT/request-full.marker" ]; then printf "전체 컨텍스트 필요\n"; fi' >/dev/null

"${REPO_ROOT}/bin/autoflow" order create "$project_dir" .autoflow \
  --title "planner differential wake" \
  --request "Planner prompt should include board context diff metadata." >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/done/project_000"
for idx in 1 2 3 4 5 6; do
  cat >"${project_dir}/.autoflow/tickets/done/project_000/tickets_10${idx}.md" <<EOF
# Ticket

## Ticket

- ID: tickets_10${idx}
- PRD Key: project_000
- Title: Historical context ${idx}
- Stage: done
EOF
done

git -C "$project_dir" add . >/dev/null
git -C "$project_dir" commit -m "baseline" >/dev/null

disabled_out="${project_dir}/disabled.out"
first_out="${project_dir}/first.out"
diff_out="${project_dir}/diff.out"
marker_out="${project_dir}/marker.out"
full_after_marker_out="${project_dir}/full-after-marker.out"
large_change_out="${project_dir}/large-change.out"
prompt_capture="${project_dir}/prompt.capture"
state_file="${project_dir}/.autoflow/runners/state/planner-diff.differential.state"
summary_file="${project_dir}/.autoflow/runners/state/planner-diff.differential.summary.md"

run_planner "$disabled_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=0 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff --dry-run
require_line "$disabled_out" "status=dry_run"
reject_contains "$disabled_out" "Planner board context:"
reject_contains "$disabled_out" "planner_prompt_context_mode="
if [ -e "$state_file" ]; then
  echo "Disabled run should not create planner differential state" >&2
  cat "$state_file" >&2
  exit 1
fi

run_planner "$first_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=1 \
  AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT=80 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff
require_contains "$prompt_capture" "Planner board context:"
require_contains "$prompt_capture" "- Mode: full"
require_contains "$prompt_capture" "- Reason: first_tick"
require_contains "$prompt_capture" "Current board context (full snapshot):"
require_contains "$prompt_capture" "tickets/inbox/order_001.md"
require_contains "$state_file" "fingerprint="
require_contains "$state_file" "force_full_next=false"
require_contains "$summary_file" "full:first_tick"

printf '\n- Request Hint: small diff\n' >>"${project_dir}/.autoflow/tickets/inbox/order_001.md"
run_planner "$diff_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=1 \
  AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT=80 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff
require_contains "$prompt_capture" "- Mode: diff"
require_contains "$prompt_capture" "- Reason: differential"
require_contains "$prompt_capture" "Previous tick summary:"
require_contains "$prompt_capture" "full:first_tick"
require_contains "$prompt_capture" "Changed file bodies:"
require_contains "$prompt_capture" "small diff"
require_contains "$prompt_capture" "Unchanged files (path/title only):"
require_contains "$prompt_capture" "tickets/done/project_000/tickets_101.md"

touch "${project_dir}/request-full.marker"
run_planner "$marker_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=1 \
  AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT=80 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff
rm -f "${project_dir}/request-full.marker"
require_contains "$state_file" "force_full_next=true"

run_planner "$full_after_marker_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=1 \
  AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT=80 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff
require_contains "$prompt_capture" "- Mode: full"
require_contains "$prompt_capture" "- Reason: adapter_requested_full_context"
require_contains "$state_file" "force_full_next=false"

printf '\nchanged a\n' >>"${project_dir}/.autoflow/tickets/done/project_000/tickets_101.md"
printf '\nchanged b\n' >>"${project_dir}/.autoflow/tickets/done/project_000/tickets_102.md"
printf '\nchanged c\n' >>"${project_dir}/.autoflow/tickets/done/project_000/tickets_103.md"
run_planner "$large_change_out" env \
  AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=1 \
  AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT=30 \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" .autoflow --runner planner-diff --dry-run
require_line "$large_change_out" "planner_prompt_context_mode=full"
require_line "$large_change_out" "planner_prompt_context_reason=change_ratio_exceeded"
require_contains "$large_change_out" "Current board context (full snapshot):"

echo "status=ok"
echo "project_root=$project_dir"
