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
cat > "${project_dir}/.autoflow/wiki/features/semantic-target.md" <<'WIKI'
# Semantic Target
Architecture decisions in this page are documented here.
Hybrid retrieval should pick this path for semantic intent.
WIKI
cat > "${project_dir}/.autoflow/wiki/features/keyword-page.md" <<'WIKI'
# Keyword Match
This page is useful for basic lexical matching.
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

provider="${project_dir}/wiki-vector-provider.sh"
cat > "$provider" <<'PY'
#!/usr/bin/env python3
import json
import sys

text = (sys.stdin.read() or "").strip()
if "semantic" in text or "architecture" in text or "hybrid" in text:
  print(json.dumps([1.0, 0.0, 0.0, 0.0]))
elif "keyword" in text:
  print(json.dumps([0.8, 0.1, 0.1, 0.0]))
else:
  print(json.dumps([0.1, 0.2, 0.3, 0.4]))
PY
chmod +x "$provider"
export AUTOFLOW_BOARD_ROOT="${project_dir}/.autoflow"
export AUTOFLOW_PROJECT_ROOT="$project_dir"

AUTOFLOW_WIKI_FTS_INDEX=on \
AUTOFLOW_WIKI_VECTOR_INDEX=on \
AUTOFLOW_WIKI_EMBEDDING_PROVIDER="$provider" \
AUTOFLOW_WIKI_VECTOR_DIM=4 \
  /bin/bash "${REPO_ROOT}/.autoflow/scripts/wiki-search-index.sh"

hybrid_output="${project_dir}/rag-hybrid.out"
AUTOFLOW_WIKI_VECTOR_INDEX=on \
AUTOFLOW_WIKI_EMBEDDING_PROVIDER="$provider" \
AUTOFLOW_WIKI_VECTOR_DIM=4 \
AUTOFLOW_WIKI_RAG_CHUNK_LINES=6 \
AUTOFLOW_WIKI_RAG_CHUNK_OVERLAP=2 \
  "${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
    --term "architecture" \
    --rag \
    --limit 1 > "$hybrid_output"

require_line "$hybrid_output" "rag_backend=hybrid"
require_line "$hybrid_output" "result.1.path=wiki/features/semantic-target.md"
grep -Fq "result.1.bm25_score=" "$hybrid_output"
require_line "$hybrid_output" "result.1.vector_score=1.000000"

fallback_output="${project_dir}/rag-fallback.out"
AUTOFLOW_WIKI_VECTOR_INDEX=on \
AUTOFLOW_WIKI_EMBEDDING_PROVIDER="/nonexistent/vector-provider" \
  "${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
    --term "architecture" \
    --rag \
    --limit 1 > "$fallback_output"

require_line "$fallback_output" "rag_backend=fts5_bm25"

echo "status=ok"
echo "project_root=$project_dir"
