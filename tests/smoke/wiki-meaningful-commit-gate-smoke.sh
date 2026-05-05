#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_root="$(mktemp -d)"
fake_bin="${tmp_root}/bin"
mkdir -p "$fake_bin"
cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
set -euo pipefail

case "${AUTOFLOW_SMOKE_CASE:-}" in
  zero_weight)
    mkdir -p "${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki"
    printf '# Index\n\nGenerated only.\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/index.md"
    printf '# Log\n\nGenerated only.\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/log.md"
    printf 'manifest\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/wiki.manifest"
    printf 'history\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/wiki.history"
    printf 'fingerprint\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/wiki.fingerprint"
    ;;
  cosmetic)
    printf '# Cosmetic   \n\nsame text   \n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/answers/cosmetic.md"
    ;;
  low_weight)
    printf '# Source\n\none changed line\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/sources/one.md"
    ;;
  answer_add)
    mkdir -p "${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/answers"
    printf '# New Answer\n\nMaterial answer content.\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/answers/new-answer.md"
    ;;
  delete)
    rm -f "${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/decisions/delete-me.md"
    ;;
  override_low_weight)
    printf '# Source\n\none changed line\n' >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/sources/one.md"
    ;;
  *)
    echo "AUTOFLOW_SMOKE_CASE is required" >&2
    exit 2
    ;;
esac
FAKE_CODEX
chmod +x "${fake_bin}/codex"

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

new_project() {
  local name="$1"
  local project_dir="${tmp_root}/${name}"

  mkdir -p "$project_dir"
  git -C "$project_dir" init -q
  git -C "$project_dir" config user.email autoflow-smoke@example.test
  git -C "$project_dir" config user.name "Autoflow Smoke"
  "${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
  "${REPO_ROOT}/bin/autoflow" runners set wiki "$project_dir" agent=codex model=gpt-5.4 reasoning=medium mode=one-shot >/dev/null
  mkdir -p "${project_dir}/.autoflow/wiki/answers" "${project_dir}/.autoflow/wiki/sources" "${project_dir}/.autoflow/wiki/decisions" "${project_dir}/.autoflow/wiki-raw"
  printf '# Cosmetic\n\nsame text\n' >"${project_dir}/.autoflow/wiki/answers/cosmetic.md"
  printf '# Source\n\none line\n' >"${project_dir}/.autoflow/wiki/sources/one.md"
  printf '# Delete Me\n\nold decision\n' >"${project_dir}/.autoflow/wiki/decisions/delete-me.md"
  "${REPO_ROOT}/bin/autoflow" wiki summarize-telemetry "$project_dir" .autoflow --slug-set telemetry-default --window 7d >/dev/null
  git -C "$project_dir" add .autoflow
  git -C "$project_dir" commit -m "baseline board" >/dev/null
  printf '%s\n' "$project_dir"
}

run_wiki_case() {
  local project_dir="$1"
  local case_name="$2"
  shift 2
  AUTOFLOW_CODEX_DISABLE_PTY=1 AUTOFLOW_SMOKE_CASE="$case_name" PATH="${fake_bin}:$PATH" "$@" \
    "${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" --runner wiki
}

assert_no_commit_case() {
  local case_name="$1"
  local reason="$2"
  local project_dir output before after

  project_dir="$(new_project "$case_name")"
  output="${project_dir}/${case_name}.out"
  before="$(git -C "$project_dir" rev-parse HEAD)"
  run_wiki_case "$project_dir" "$case_name" >"$output"
  after="$(git -C "$project_dir" rev-parse HEAD)"

  require_line "$output" "status=ok"
  require_line "$output" "autocommit_role=wiki"
  require_line "$output" "autocommit_status=skipped_wiki_commit_gate"
  require_line "$output" "wiki_commit_gate_reason=${reason}"
  if [ "$before" != "$after" ]; then
    echo "Expected no commit for ${case_name}" >&2
    git -C "$project_dir" log --oneline -3 >&2
    exit 1
  fi
}

assert_commit_case() {
  local case_name="$1"
  local subject_category="$2"
  shift 2
  local project_dir output before after subject

  project_dir="$(new_project "$case_name")"
  output="${project_dir}/${case_name}.out"
  before="$(git -C "$project_dir" rev-parse HEAD)"
  run_wiki_case "$project_dir" "$case_name" "$@" >"$output"
  after="$(git -C "$project_dir" rev-parse HEAD)"
  subject="$(git -C "$project_dir" log -1 --pretty=%s)"

  require_line "$output" "status=ok"
  require_line "$output" "autocommit_role=wiki"
  require_line "$output" "autocommit_status=committed"
  require_contains "$output" "wiki_commit_weight="
  require_contains "$output" "wiki_commit_line_delta="
  require_contains "$output" "wiki_commit_primary_category=${subject_category}"
  require_contains "$output" "wiki_commit_gate_reason=meaningful_"
  if [ "$before" = "$after" ]; then
    echo "Expected commit for ${case_name}" >&2
    echo "--- $output ---" >&2
    cat "$output" >&2
    exit 1
  fi
  case "$subject" in
    "[wiki] update: ${subject_category} / "*' total, +'*'/-'*) ;;
    *)
      echo "Unexpected wiki commit subject: $subject" >&2
      exit 1
      ;;
  esac
}

assert_no_commit_case zero_weight zero_weight
assert_no_commit_case cosmetic cosmetic_only
assert_no_commit_case low_weight below_weight_threshold
assert_commit_case answer_add answers
answer_project="${tmp_root}/answer_add"
require_line "${answer_project}/answer_add.out" "wiki_commit_weight=5"
require_line "${answer_project}/answer_add.out" "wiki_commit_gate_reason=meaningful_add"
require_line "${answer_project}/answer_add.out" "autocommit_message=[wiki] update: answers / 1 total, +3/-0"
assert_commit_case delete decisions
delete_project="${tmp_root}/delete"
require_line "${delete_project}/delete.out" "wiki_commit_gate_reason=meaningful_delete"
require_line "${delete_project}/delete.out" "autocommit_message=[wiki] update: decisions / 1 total, +0/-3"
assert_commit_case override_low_weight sources env AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD=1 AUTOFLOW_WIKI_COMMIT_MIN_LINES=1
override_project="${tmp_root}/override_low_weight"
require_line "${override_project}/override_low_weight.out" "wiki_commit_weight=1"
require_line "${override_project}/override_low_weight.out" "wiki_commit_gate_reason=meaningful_update"

log_file="${override_project}/.autoflow/runners/logs/wiki.log"
require_contains "$log_file" "wiki_commit_weight="
require_contains "$log_file" "wiki_commit_line_delta="
require_contains "$log_file" "wiki_commit_primary_category="
require_contains "$log_file" "wiki_commit_gate_reason="

echo "status=ok"
