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
"${REPO_ROOT}/bin/autoflow" runners add wiki-skip wiki-maintainer "$project_dir" .autoflow \
  agent=codex \
  mode=loop \
  command='printf "invoked\n" >> "$AUTOFLOW_PROJECT_ROOT/adapter.marker"' >/dev/null

mkdir -p "${project_dir}/.autoflow/wiki"
cat > "${project_dir}/.autoflow/wiki/page.md" <<'WIKI'
# Page

Initial wiki input.
WIKI

first_output="${project_dir}/first.out"
second_output="${project_dir}/second.out"
third_output="${project_dir}/third.out"
query_output="${project_dir}/query.out"

"${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" .autoflow --runner wiki-skip > "$first_output"
require_line "$first_output" "adapter_exit_code=0"
require_marker_count 1

"${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" .autoflow --runner wiki-skip > "$second_output"
require_line "$second_output" "reason=wiki_inputs_unchanged"
require_marker_count 1

cat >> "${project_dir}/.autoflow/wiki/page.md" <<'WIKI'

Changed wiki input.
WIKI

"${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" .autoflow --runner wiki-skip > "$third_output"
require_line "$third_output" "adapter_exit_code=0"
require_marker_count 2

"${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
  --term "definitely-no-such-wiki-term" \
  --synth \
  --runner wiki-skip > "$query_output"
require_line "$query_output" "result_count=0"
require_line "$query_output" "synth_status=skipped_no_results"
require_marker_count 2

echo "status=ok"
echo "project_root=$project_dir"
