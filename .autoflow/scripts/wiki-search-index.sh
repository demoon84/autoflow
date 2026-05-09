#!/usr/bin/env bash
# wiki-search-index.sh — Phase 1 sqlite FTS5 + BM25 indexer for wiki RAG.
#
# Indexes .autoflow/wiki/ + .autoflow/tickets/done/ markdown bodies into
# .autoflow/runners/state/wiki-search.db (gitignored). The query side in
# packages/cli/wiki-project.sh auto-detects the index and uses MATCH +
# bm25() ranking when present; otherwise falls back to chunk grep.
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
  printf 'hint=python3 is required for chunking; install python3\n' >&2
  exit 0
fi

DB_PATH="${BOARD_ROOT}/runners/state/wiki-search.db"
mkdir -p "$(dirname "$DB_PATH")"

WIKI_ROOT="${BOARD_ROOT}/wiki"
TICKETS_DONE="${BOARD_ROOT}/tickets/done"

CHUNK_LEN="${AUTOFLOW_WIKI_FTS_CHUNK_CHARS:-1024}"
CHUNK_OVERLAP="${AUTOFLOW_WIKI_FTS_CHUNK_OVERLAP:-128}"

export AUTOFLOW_FTS_DB="$DB_PATH"
export AUTOFLOW_FTS_WIKI="$WIKI_ROOT"
export AUTOFLOW_FTS_DONE="$TICKETS_DONE"
export AUTOFLOW_FTS_CHUNK_LEN="$CHUNK_LEN"
export AUTOFLOW_FTS_CHUNK_OVERLAP="$CHUNK_OVERLAP"

python3 - <<'PY'
import os
import sys
import bisect
import hashlib
import sqlite3

db_path = os.environ['AUTOFLOW_FTS_DB']
wiki_root = os.environ['AUTOFLOW_FTS_WIKI']
done_root = os.environ['AUTOFLOW_FTS_DONE']
chunk_len = max(64, int(os.environ.get('AUTOFLOW_FTS_CHUNK_LEN', '1024')))
chunk_overlap = max(0, int(os.environ.get('AUTOFLOW_FTS_CHUNK_OVERLAP', '128')))
if chunk_overlap >= chunk_len:
    chunk_overlap = chunk_len // 4

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
      body,
      tokenize="unicode61 remove_diacritics 2"
    );
    """
)
conn.commit()


def collect_files():
    out = []
    for root in (wiki_root, done_root):
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


def first_title(text):
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('#'):
            return s.lstrip('#').strip()[:200]
        if s:
            return s[:120]
    return ''


def chunkify(text):
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


inserted_chunks = 0
indexed_files = 0
skipped_files = 0
removed_files = 0

cur.execute("SELECT path FROM wiki_files")
known_paths = [row[0] for row in cur.fetchall()]
for p in known_paths:
    if not os.path.exists(p):
        cur.execute("DELETE FROM wiki_search WHERE path=?", (p,))
        cur.execute("DELETE FROM wiki_files WHERE path=?", (p,))
        removed_files += 1

for path in collect_files():
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
    title = first_title(text)
    for cidx, sline, eline, body in chunkify(text):
        chunk_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]
        cur.execute(
            "INSERT INTO wiki_search(path, chunk_idx, chunk_start_line, chunk_end_line, content_hash, title, body) VALUES(?,?,?,?,?,?,?)",
            (path, cidx, sline, eline, chunk_hash, title, body),
        )
        inserted_chunks += 1
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
PY
