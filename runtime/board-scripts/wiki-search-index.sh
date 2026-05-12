#!/usr/bin/env bash
# wiki-search-index.sh — Phase 1 sqlite FTS5 + BM25 (and optional vector cache) for wiki RAG.
#
# Indexes .autoflow/wiki/ + .autoflow/tickets/done/ markdown bodies into
# .autoflow/runners/state/wiki-search.db (gitignored). The query side in
# packages/cli/wiki-project.sh uses MATCH + bm25() when present; this script also
# can populate optional wiki_vectors for hybrid retrieval.
#
# Opt-in: only runs when AUTOFLOW_WIKI_FTS_INDEX=on (fail-safe default).
# Idempotent: skips files whose content sha is unchanged.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

INDEX_ENABLE="${AUTOFLOW_WIKI_FTS_INDEX:-}"
if [ "$INDEX_ENABLE" != "on" ]; then
  printf 'status=skipped\n'
  printf 'reason=opt_in_required\n'
  printf 'hint=set AUTOFLOW_WIKI_FTS_INDEX=on to build the index\n'
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  printf 'status=skipped\n'
  printf 'reason=sqlite3_missing\n'
  printf 'hint=install sqlite3 to enable wiki RAG FTS5 phase 1\n' >&2
  exit 0
fi

if ! sqlite3 :memory: "CREATE VIRTUAL TABLE t USING fts5(x);" >/dev/null 2>&1; then
  printf 'status=skipped\n'
  printf 'reason=fts5_unavailable\n'
  printf 'hint=rebuild sqlite with FTS5 to enable wiki RAG phase 1\n' >&2
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf 'status=skipped\n'
  printf 'reason=python3_missing\n'
  printf 'hint=python3 is required for chunking and optional vector indexing; install python3\n' >&2
  exit 0
fi

DB_PATH="${AUTOFLOW_FTS_DB_PATH:-${BOARD_ROOT}/runners/state/wiki-search.db}"
mkdir -p "$(dirname "$DB_PATH")"

WIKI_ROOT="${AUTOFLOW_FTS_WIKI_OVERRIDE:-${BOARD_ROOT}/wiki}"
TICKETS_DONE="${AUTOFLOW_FTS_DONE_OVERRIDE:-${BOARD_ROOT}/tickets/done}"

CHUNK_LEN="${AUTOFLOW_WIKI_FTS_CHUNK_CHARS:-1024}"
CHUNK_OVERLAP="${AUTOFLOW_WIKI_FTS_CHUNK_OVERLAP:-128}"
VECTOR_INDEX_ENABLE="${AUTOFLOW_WIKI_VECTOR_INDEX:-off}"
VECTOR_DIM="${AUTOFLOW_WIKI_VECTOR_DIM:-0}"

# Auto-detect embedding provider: if AUTOFLOW_WIKI_VECTOR_INDEX=on and no provider
# is set, use wiki-embed.ts (sentence-transformers all-MiniLM-L6-v2, 384-dim).
if [ "$VECTOR_INDEX_ENABLE" = "on" ] && [ -z "${AUTOFLOW_WIKI_EMBEDDING_PROVIDER:-}" ]; then
  _embed_ts="${SCRIPT_DIR}/wiki-embed.ts"
  if [ -f "$_embed_ts" ] && command -v npx >/dev/null 2>&1; then
    AUTOFLOW_WIKI_EMBEDDING_PROVIDER="npx tsx ${_embed_ts}"
    VECTOR_DIM=384
  fi
fi
VECTOR_PROVIDER="${AUTOFLOW_WIKI_EMBEDDING_PROVIDER:-}"

export AUTOFLOW_FTS_DB="$DB_PATH"
export AUTOFLOW_FTS_WIKI="$WIKI_ROOT"
export AUTOFLOW_FTS_DONE="$TICKETS_DONE"
export AUTOFLOW_FTS_CHUNK_LEN="$CHUNK_LEN"
export AUTOFLOW_FTS_CHUNK_OVERLAP="$CHUNK_OVERLAP"
export AUTOFLOW_WIKI_VECTOR_INDEX="$VECTOR_INDEX_ENABLE"
export AUTOFLOW_WIKI_EMBEDDING_PROVIDER="$VECTOR_PROVIDER"
export AUTOFLOW_WIKI_VECTOR_DIM="$VECTOR_DIM"

python3 - <<'PY'
import hashlib
import json
import os
import shlex
import sqlite3
import subprocess
import bisect


def parse_vector(raw):
    raw = (raw or '').strip()
    if not raw:
        return []
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return [float(x) for x in value]
    except Exception:
        pass
    try:
        parts = [p for p in raw.replace('\n', ' ').replace('|', ',').split(',') if p.strip()]
        return [float(p.strip()) for p in parts]
    except Exception:
        return []


def generate_embedding(payload, provider_cmd, expected_dim):
    if not provider_cmd:
        return None
    try:
        args = shlex.split(provider_cmd)
        proc = subprocess.run(
            args,
            input=(payload or '').encode('utf-8'),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=90,
        )
    except Exception:
        return None
    if proc.returncode != 0:
        return None
    vector = parse_vector(proc.stdout.decode('utf-8', errors='replace'))
    if not vector:
        return None
    if expected_dim and len(vector) != expected_dim:
        return None
    return vector


def generate_embeddings_batch(texts, provider_cmd, expected_dim):
    """Batch embed multiple texts in a single provider call (--batch mode).
    Returns list of vectors (or None for failures). Falls back to per-text calls."""
    if not provider_cmd or not texts:
        return [None] * len(texts)
    args = shlex.split(provider_cmd) + ['--batch']
    try:
        timeout = max(90, len(texts) * 10)
        proc = subprocess.run(
            args,
            input=json.dumps(texts).encode('utf-8'),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=timeout,
        )
    except Exception:
        return [None] * len(texts)
    if proc.returncode != 0:
        return [None] * len(texts)
    raw = proc.stdout.decode('utf-8', errors='replace').strip()
    if not raw:
        return [None] * len(texts)
    try:
        vecs = json.loads(raw)
        if not isinstance(vecs, list):
            return [None] * len(texts)
        result = []
        for v in vecs:
            if isinstance(v, list) and (not expected_dim or len(v) == expected_dim):
                result.append([float(x) for x in v])
            else:
                result.append(None)
        # Pad if provider returned fewer results
        while len(result) < len(texts):
            result.append(None)
        return result
    except Exception:
        return [None] * len(texts)


def first_title(text):
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('#'):
            return s.lstrip('#').strip()[:200]
        if s:
            return s[:120]
    return ''


def chunkify(text, chunk_len, chunk_overlap):
    n = len(text)
    if n == 0:
        return
    step = chunk_len - chunk_overlap
    if step <= 0:
        step = chunk_len
    line_ends = [i for i, ch in enumerate(text) if ch == '\n']

    def line_of(offset):
        if offset >= n:
            offset = n - 1
        if offset < 0:
            offset = 0
        return bisect.bisect_left(line_ends, offset) + 1

    idx = 0
    start = 0
    while start < n:
        end = min(start + chunk_len, n)
        body = text[start:end]
        sline = line_of(start)
        eline = line_of(end - 1)
        idx += 1
        yield idx, sline, eline, body
        if end == n:
            break
        start += step


def collect_files(roots):
    out = []
    for root in roots:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirs, filenames in os.walk(root):
            for fn in filenames:
                if not fn.endswith('.md'):
                    continue
                if fn == 'README.md':
                    continue
                out.append(os.path.join(dirpath, fn))
    return out


db_path = os.environ['AUTOFLOW_FTS_DB']
wiki_root = os.environ['AUTOFLOW_FTS_WIKI']
done_root = os.environ['AUTOFLOW_FTS_DONE']
chunk_len = max(64, int(os.environ.get('AUTOFLOW_FTS_CHUNK_LEN', '1024')))
chunk_overlap = max(0, int(os.environ.get('AUTOFLOW_FTS_CHUNK_OVERLAP', '128')))
if chunk_overlap >= chunk_len:
    chunk_overlap = chunk_len // 4

vector_index_enable = (os.environ.get('AUTOFLOW_WIKI_VECTOR_INDEX', 'off') == 'on')
vector_provider = os.environ.get('AUTOFLOW_WIKI_EMBEDDING_PROVIDER', '').strip()
vector_dim = int(os.environ.get('AUTOFLOW_WIKI_VECTOR_DIM', '0') or 0)

vector_provider_configured = bool(vector_provider)
vector_provider_missing = False
if vector_provider_configured:
    provider_path = shlex.split(vector_provider)[0] if vector_provider else ''
    if not provider_path:
        vector_provider_configured = False
    else:
        import shutil

        vector_provider_missing = shutil.which(provider_path) is None
        if vector_provider_missing:
            vector_provider_configured = False

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.executescript(
    """
    CREATE TABLE IF NOT EXISTS wiki_files (
      path TEXT PRIMARY KEY,
      content_sha TEXT NOT NULL,
      indexed_at INTEGER NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS wiki_search USING fts5(
      path UNINDEXED,
      chunk_idx UNINDEXED,
      chunk_start_line UNINDEXED,
      chunk_end_line UNINDEXED,
      content_hash UNINDEXED,
      title,
      body
    );
    CREATE TABLE IF NOT EXISTS wiki_vectors (
      path TEXT NOT NULL,
      chunk_idx INTEGER NOT NULL,
      vector_dim INTEGER NOT NULL,
      vector_hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      PRIMARY KEY (path, chunk_idx)
    );
    """
)
# Schema migration: if wiki_vectors lacks vector_hash/embedding columns (old schema),
# drop and recreate to match current spec. Existing vectors are re-generated on next run.
cur.execute("PRAGMA table_info(wiki_vectors)")
vec_cols = {row[1] for row in cur.fetchall()}
if vec_cols and ('vector_hash' not in vec_cols or 'embedding' not in vec_cols):
    cur.executescript("""
        DROP TABLE wiki_vectors;
        CREATE TABLE wiki_vectors (
          path TEXT NOT NULL,
          chunk_idx INTEGER NOT NULL,
          vector_dim INTEGER NOT NULL,
          vector_hash TEXT NOT NULL,
          embedding TEXT NOT NULL,
          PRIMARY KEY (path, chunk_idx)
        );
    """)
conn.commit()

inserted_chunks = 0
indexed_files = 0
skipped_files = 0
removed_files = 0
vector_chunks = 0
vector_skipped = 0
vector_provider_ready = vector_index_enable and vector_provider_configured and not vector_provider_missing

cur.execute("SELECT path FROM wiki_files")
known_paths = [row[0] for row in cur.fetchall()]
for p in known_paths:
    if not os.path.exists(p):
        cur.execute("DELETE FROM wiki_search WHERE path=?", (p,))
        cur.execute("DELETE FROM wiki_vectors WHERE path=?", (p,))
        cur.execute("DELETE FROM wiki_files WHERE path=?", (p,))
        removed_files += 1

for path in collect_files((wiki_root, done_root)):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            text = fh.read()
    except OSError:
        continue

    sha = hashlib.sha256(text.encode('utf-8')).hexdigest()
    cur.execute("SELECT content_sha FROM wiki_files WHERE path=?", (path,))
    row = cur.fetchone()
    if row and row[0] == sha:
        skipped_files += 1
        continue

    cur.execute("DELETE FROM wiki_search WHERE path=?", (path,))
    cur.execute("DELETE FROM wiki_vectors WHERE path=?", (path,))

    title = first_title(text)
    chunks = list(chunkify(text, chunk_len, chunk_overlap))

    # Batch embed all chunks of this file in one provider call
    batch_vectors = []
    if vector_provider_ready and chunks:
        batch_vectors = generate_embeddings_batch(
            [body for _, _, _, body in chunks], vector_provider, vector_dim
        )

    for i, (cidx, sline, eline, body) in enumerate(chunks):
        chunk_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]
        cur.execute(
            "INSERT INTO wiki_search(path, chunk_idx, chunk_start_line, chunk_end_line, content_hash, title, body) VALUES(?,?,?,?,?,?,?)",
            (path, cidx, sline, eline, chunk_hash, title, body),
        )
        inserted_chunks += 1

        if vector_provider_ready:
            vector = batch_vectors[i] if i < len(batch_vectors) else None
            if vector:
                vector_chunks += 1
                vdim = len(vector)
                vector_hash = hashlib.sha256(','.join(f"{v:.10f}" for v in vector).encode('utf-8')).hexdigest()[:16]
                cur.execute(
                    "INSERT OR REPLACE INTO wiki_vectors(path, chunk_idx, vector_dim, vector_hash, embedding) VALUES(?,?,?,?,?)",
                    (path, cidx, vdim, vector_hash, json.dumps(vector)),
                )
            else:
                vector_skipped += 1

    cur.execute(
        "INSERT OR REPLACE INTO wiki_files(path, content_sha, indexed_at) VALUES(?,?,strftime('%s','now'))",
        (path, sha),
    )
    indexed_files += 1

conn.commit()
conn.close()

print("status=ok")
print(f"db={db_path}")
print(f"chunk_len={chunk_len}")
print(f"chunk_overlap={chunk_overlap}")
print(f"indexed_files={indexed_files}")
print(f"skipped_files={skipped_files}")
print(f"removed_files={removed_files}")
print(f"inserted_chunks={inserted_chunks}")
print(f"vector_index_requested={str(vector_index_enable).lower()}")
print(f"vector_provider_configured={str(vector_provider_configured).lower()}")
print(f"vector_provider_missing={str(vector_provider_missing).lower()}")
print(f"vector_provider_ready={str(vector_provider_ready).lower()}")
print(f"vector_dim={vector_dim}")
print(f"vector_chunks={vector_chunks}")
print(f"vector_skipped={vector_skipped}")
PY
