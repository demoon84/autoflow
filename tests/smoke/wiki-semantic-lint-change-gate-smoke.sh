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

require_marker_count() {
  local expected="$1"
  local actual

  actual="$(grep -c '^invoked$' "${project_dir}/adapter.marker" 2>/dev/null || true)"
  if [ "$actual" != "$expected" ]; then
    echo "Expected adapter marker count ${expected}, got ${actual}" >&2
    cat "${project_dir}/adapter.marker" 2>/dev/null >&2 || true
    exit 1
  fi
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners add wiki-semantic wiki-maintainer "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command="printf 'invoked\n' >> '${project_dir}/adapter.marker'; count=\"\$(wc -l < '${project_dir}/adapter.marker' | tr -d '[:space:]')\"; cp \"\$AUTOFLOW_PROMPT_FILE\" '${project_dir}/prompt.'\"\${count}\"'.txt'; printf 'semantic_finding.none=true\n'" >/dev/null

mkdir -p "${project_dir}/.autoflow/wiki/features"
{
  echo "# Semantic Page"
  echo
  line=1
  while [ "$line" -le 100 ]; do
    printf 'wiki semantic line %03d\n' "$line"
    line="$((line + 1))"
  done
} > "${project_dir}/.autoflow/wiki/features/semantic-page.md"

first_output="${project_dir}/first.out"
second_output="${project_dir}/second.out"
third_output="${project_dir}/third.out"

"${REPO_ROOT}/bin/autoflow" wiki lint "$project_dir" .autoflow --semantic --runner wiki-semantic > "$first_output"
require_line "$first_output" "semantic_status=ok"
require_line "$first_output" "semantic_runner=wiki-semantic"
require_line "$first_output" "semantic_finding.none=true"
require_marker_count 1
grep -Fq 'wiki semantic line 078' "${project_dir}/prompt.1.txt"
reject_contains "${project_dir}/prompt.1.txt" 'wiki semantic line 079'

"${REPO_ROOT}/bin/autoflow" wiki lint "$project_dir" .autoflow --semantic --runner wiki-semantic > "$second_output"
require_line "$second_output" "semantic_status=skipped_unchanged"
require_line "$second_output" "semantic_reason=wiki_inputs_unchanged"
require_marker_count 1

cat >> "${project_dir}/.autoflow/wiki/features/semantic-page.md" <<'WIKI'

Changed semantic lint input.
WIKI

"${REPO_ROOT}/bin/autoflow" wiki lint "$project_dir" .autoflow --semantic --runner wiki-semantic > "$third_output"
require_line "$third_output" "semantic_status=ok"
require_line "$third_output" "semantic_runner=wiki-semantic"
require_marker_count 2

echo "status=ok"
echo "project_root=$project_dir"
