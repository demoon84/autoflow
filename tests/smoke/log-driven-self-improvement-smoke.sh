#!/usr/bin/env bash
#
# DEPRECATED: smoke test for the trial self-improve runner.
#
# `self-improve-1` ships with `enabled = false` in the default
# `runners/config.toml` and is not part of the 3-runner topology
# (planner-1 + owner-1 + wiki-1). The script under test
# (`start-self-improve.sh`) is a deterministic log scanner that does
# not invoke an AI; it is kept reachable as a manual trial only. This
# smoke test exercises the trial runner end-to-end and is not wired
# into CI (only `ticket-owner-smoke.sh` is exposed via package.json).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_root="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_root"
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

new_project() {
  local name="$1"
  local project_dir="${tmp_root}/${name}"

  mkdir -p "$project_dir"
  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"
  "${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
  cp "${REPO_ROOT}/runtime/board-scripts/start-self-improve.sh" "${project_dir}/.autoflow/scripts/start-self-improve.sh"
  chmod +x "${project_dir}/.autoflow/scripts/start-self-improve.sh"
  git -C "$project_dir" add .
  git -C "$project_dir" commit -q -m "initial"
  printf '%s' "$project_dir"
}

run_self_improve() {
  local project_dir="$1"
  local output="$2"
  shift 2

  (
    cd "${project_dir}/.autoflow"
    env -u AUTOFLOW_BOARD_ROOT -u AUTOFLOW_PROJECT_ROOT "$@" AUTOFLOW_ROLE=self-improve ./scripts/start-self-improve.sh >"$output"
  )
}

write_repeated_log() {
  local project_dir="$1"
  local text="$2"

  mkdir -p "${project_dir}/.autoflow/logs"
  {
    printf '%s\n' "$text"
    printf '%s\n' "$text"
    printf '%s\n' "$text"
  } >"${project_dir}/.autoflow/logs/owner-repeat.log"
  git -C "$project_dir" add .autoflow/logs/owner-repeat.log
  git -C "$project_dir" commit -q -m "add repeated log"
}

idle_project="$(new_project idle)"
idle_output="${tmp_root}/idle.out"
run_self_improve "$idle_project" "$idle_output"
require_line "$idle_output" "status=idle"
require_line "$idle_output" "reason=no_log_evidence"
require_pattern "$idle_output" '^log=.*/\.autoflow/logs/self-improve_[0-9TZ]+_001\.md$'

candidate_project="$(new_project candidate)"
candidate_output="${tmp_root}/candidate.out"
write_repeated_log "$candidate_project" "ERROR verifier failed command npm check"
run_self_improve "$candidate_project" "$candidate_output"
require_line "$candidate_output" "status=candidate_created"
require_line "$candidate_output" "reason=threshold_crossed"
require_pattern "$candidate_output" '^candidate=.*/\.autoflow/tickets/backlog/prd_001\.md$'
require_pattern "${candidate_project}/.autoflow/tickets/backlog/prd_001.md" 'Self Improve Fingerprint: [0-9a-f]+'
require_line "${candidate_project}/.autoflow/tickets/backlog/prd_001.md" "- Occurrence Count: 3"
require_line "${candidate_project}/.autoflow/tickets/backlog/prd_001.md" "- Risk Level: low"
require_line "${candidate_project}/.autoflow/tickets/backlog/prd_001.md" "- Command: \`bash tests/smoke/log-driven-self-improvement-smoke.sh\`"

git -C "$candidate_project" add .autoflow
git -C "$candidate_project" commit -q -m "record self-improve candidate"
dedupe_output="${tmp_root}/dedupe.out"
run_self_improve "$candidate_project" "$dedupe_output"
require_line "$dedupe_output" "status=deduped"
require_line "$dedupe_output" "reason=duplicate_candidate"

high_risk_project="$(new_project high-risk)"
high_risk_output="${tmp_root}/high-risk.out"
write_repeated_log "$high_risk_project" "ERROR merge conflict asks for git push and reset --hard"
run_self_improve "$high_risk_project" "$high_risk_output"
require_line "$high_risk_output" "status=recommend_only"
require_line "$high_risk_output" "reason=high_risk_candidate"
if compgen -G "${high_risk_project}/.autoflow/tickets/backlog/prd_*.md" >/dev/null; then
  echo "High-risk candidate should not create a PRD" >&2
  exit 1
fi

dirty_project="$(new_project dirty)"
dirty_output="${tmp_root}/dirty.out"
printf 'dirty\n' >"${dirty_project}/outside.txt"
run_self_improve "$dirty_project" "$dirty_output"
require_line "$dirty_output" "status=skipped"
require_line "$dirty_output" "reason=unsafe_dirty_state"

expired_project="$(new_project expired)"
expired_output="${tmp_root}/expired.out"
mkdir -p "${expired_project}/.autoflow/logs/self-improve-state"
{
  printf 'started_at_epoch=%s\n' "$(date -u +%s)"
  printf 'tick_count=1\n'
} >"${expired_project}/.autoflow/logs/self-improve-state/trial.env"
run_self_improve "$expired_project" "$expired_output" AUTOFLOW_SELF_IMPROVE_MAX_TICKS=1
require_line "$expired_output" "status=expired"
require_line "$expired_output" "reason=trial_expired"

route_project="$(new_project route)"
route_output="${tmp_root}/route.out"
"${REPO_ROOT}/bin/autoflow" runners set self-improve-1 "$route_project" enabled=true >"${tmp_root}/runner-set.out"
git -C "$route_project" add .autoflow/runners/config.toml
git -C "$route_project" commit -q -m "enable self-improve runner"
"${REPO_ROOT}/bin/autoflow" run self-improve "$route_project" --runner self-improve-1 >"$route_output"
require_line "$route_output" "status=ok"
require_line "$route_output" "role=self-improve"
require_line "$route_output" "runtime_status=idle"
