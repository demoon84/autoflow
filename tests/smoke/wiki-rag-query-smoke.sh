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

require_absent() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    echo "Unexpected text found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p "${project_dir}/.autoflow/wiki/features"
cat > "${project_dir}/.autoflow/wiki/features/rag-page.md" <<'WIKI'
# RAG Retrieval Page
Intro line before the target.
RAG-needle maps order requests to chunk-level retrieval.
Closing line for first chunk.
Another first chunk line.
Last line in first chunk.
Second chunk has unrelated background.
More unrelated background.
Even more unrelated background.
Final unrelated background.
WIKI

rag_output="${project_dir}/rag.out"
file_output="${project_dir}/file.out"

AUTOFLOW_WIKI_RAG_CHUNK_LINES=6 \
AUTOFLOW_WIKI_RAG_CHUNK_OVERLAP=2 \
  "${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
    --term "rag-needle" \
    --rag \
    --limit 1 > "$rag_output"

require_line "$rag_output" "status=ok"
require_line "$rag_output" "retrieval_mode=rag"
require_line "$rag_output" "rag_chunk_lines=6"
require_line "$rag_output" "rag_chunk_overlap=2"
require_line "$rag_output" "result_count=1"
require_line "$rag_output" "result.1.path=wiki/features/rag-page.md"
require_line "$rag_output" "result.1.chunk_start_line=1"
require_line "$rag_output" "result.1.chunk_end_line=6"
grep -Fq "result.1.snippet.1.text=# RAG Retrieval Page Intro line before the target. RAG-needle maps order requests to chunk-level retrieval." "$rag_output"

"${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
  --term "rag-needle" \
  --limit 1 > "$file_output"

require_line "$file_output" "retrieval_mode=file"
require_line "$file_output" "result.1.path=wiki/features/rag-page.md"
require_absent "$file_output" "result.1.chunk_start_line="

echo "status=ok"
echo "project_root=$project_dir"
