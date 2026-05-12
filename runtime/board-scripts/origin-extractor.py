#!/usr/bin/env python3
"""
PRD 9 Origin Extractor (2026-05-09)

Reads Claude Code and Codex session jsonl files, identifies PRD/order
trigger records, and builds the origin_chain in .autoflow/state.db.

NOTE: uses `from __future__ import annotations` so the modern PEP 604 /
PEP 585 type annotations (e.g. `str | None`, `dict[str, str]`) parse cleanly
on Python 3.7+ as well.

Chain shape (one row per trigger event):

    session(jsonl) --(#autoflow|#order|/autoflow|/order)--> prd_path
                                                              ↓
                                                          ticket_id
                                                              ↓
                                                          commit_hash

Idempotent: running multiple times rebuilds the snapshot tables. Read-only
on Claude Code / Codex jsonl files; writes only to .autoflow/state.db.

Usage:
    origin-extractor.py [--board-root PATH]
                        [--claude-projects-dir PATH]
                        [--codex-archived-dir PATH]
                        [--limit-sessions N]
                        [--quiet]
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sqlite3
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Iterable

# PRD/order trigger detection.
#
# Real-world shapes observed in Claude Code & Codex jsonl:
#   1. Slash command (most common):
#        <command-name>/order</command-name>
#        <command-name>/autoflow</command-name>
#   2. Hash trigger in prose:           "#order ..."
#   3. Codex dollar trigger in prose:   "$order ..."
#
# A bare token "order/autoflow skill ..." (no leading # or /) is NOT a
# trigger — only the prefixed forms count.
TRIGGER_RE = re.compile(
    # 1. <command-name>/X</command-name> form
    r'<command-name>/?(?P<cmd>autoflow|order|plan|todo)</command-name>'
    # 2. word-boundary #X form
    r'|(?<![A-Za-z0-9_])#(?P<hash>autoflow|order|plan|todo)\b'
    # 3. word-boundary $X form (Codex)
    r'|(?<![A-Za-z0-9_])\$(?P<dollar>autoflow|order|plan|todo)\b',
    re.MULTILINE,
)

INBOX_REL_PATTERN = re.compile(r'tickets/inbox/order_\d{3}.*\.md$')
BACKLOG_REL_PATTERN = re.compile(r'tickets/backlog/(?:prd|project)_\d{3}\.md$')
PRD_KEY_PATTERN = re.compile(r'(?:^|/)((?:prd|project|express|order)_\d{3})')
TODO_NNN_PATTERN = re.compile(r'tickets/(?:todo|inprogress|done(?:/[^/]+)?)/Todo-(\d{3})\.md$')


def now_utc_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def safe_load_json(line: str):
    try:
        return json.loads(line)
    except (ValueError, json.JSONDecodeError):
        return None


# When the user invokes a slash command, the actual prompt body lives in
# <command-args>...</command-args>. Skill activation alone (no args) means the
# user did NOT issue a real PRD/order request — those are skipped.
ARGS_RE = re.compile(r'<command-args>(.*?)</command-args>', re.DOTALL)


def detect_trigger_with_args(text: str) -> tuple[str | None, str | None]:
    """Return (trigger_kind, args_body) only for *real* user-issued triggers.
    A real trigger is one that carries <command-args>...</command-args> with
    non-empty body. Without args, the trigger word almost always comes from
    the skill body itself being injected into user content (e.g. "Base
    directory for this skill: .../skills/order ... 1. Treat `#order`...")
    which is not an actionable invocation. Skipping those removes the
    skill-activation noise entirely.
    """
    if not text:
        return None, None

    args_match = ARGS_RE.search(text)
    if not args_match:
        return None, None
    body = args_match.group(1).strip()
    if not body:
        return None, None

    m = TRIGGER_RE.search(text)
    if not m:
        return None, None
    kind = m.group('cmd') or m.group('hash') or m.group('dollar')
    return kind, body


def detect_trigger(text: str) -> str | None:
    """Backwards-compatible wrapper used in places that only need the kind."""
    return detect_trigger_with_args(text)[0]


def excerpt(text: str, length: int = 280) -> str:
    if not text:
        return ""
    text = text.strip().replace('\n', ' ')
    if len(text) <= length:
        return text
    return text[:length - 1] + "…"


def relative_to_board(path: str, board_root: pathlib.Path) -> str | None:
    """Return 'tickets/...' if path is under board_root, else None."""
    if not path:
        return None
    try:
        p = pathlib.Path(path).resolve()
        rel = p.relative_to(board_root.resolve())
        return str(rel)
    except (ValueError, OSError):
        # Try string prefix match for non-resolvable virtual paths.
        board_str = str(board_root).rstrip('/')
        if path.startswith(board_str + '/'):
            return path[len(board_str) + 1:]
    return None


def prd_key_from_path(path: str | None) -> str | None:
    if not path:
        return None
    m = PRD_KEY_PATTERN.search(path)
    return m.group(1) if m else None


# ───────────────────────────────────────────────────────────────────────
# Claude Code jsonl reader
# ───────────────────────────────────────────────────────────────────────

def iter_claude_session(path: pathlib.Path):
    """Yield (record, parsed_text, parsed_tool_uses) from a Claude Code jsonl."""
    try:
        with path.open() as f:
            for line in f:
                rec = safe_load_json(line)
                if not rec:
                    continue
                yield rec
    except OSError:
        return


def claude_user_text(rec: dict) -> str:
    """Extract user-prompt text from a Claude Code 'user' record."""
    if rec.get('type') != 'user':
        return ""
    content = rec.get('content') or rec.get('message', {}).get('content')
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for chunk in content:
            if isinstance(chunk, dict):
                if chunk.get('type') == 'text':
                    parts.append(chunk.get('text', ''))
                elif chunk.get('type') == 'tool_result':
                    pass  # skip tool result echoes
            elif isinstance(chunk, str):
                parts.append(chunk)
        return ' '.join(parts)
    return ""


def claude_assistant_tool_uses(rec: dict):
    """Yield (tool_name, tool_input dict) for tool_use blocks in an assistant record."""
    if rec.get('type') != 'assistant':
        return
    msg = rec.get('message') or {}
    content = msg.get('content') or rec.get('content') or []
    if isinstance(content, list):
        for chunk in content:
            if not isinstance(chunk, dict):
                continue
            if chunk.get('type') == 'tool_use':
                yield chunk.get('name'), chunk.get('input') or {}


def claude_token_usage(rec: dict) -> tuple[int, int]:
    """Return (input_tokens, output_tokens) from an assistant record's usage block."""
    if rec.get('type') != 'assistant':
        return 0, 0
    usage = (rec.get('message') or {}).get('usage') or rec.get('usage') or {}
    return int(usage.get('input_tokens') or 0), int(usage.get('output_tokens') or 0)


# ───────────────────────────────────────────────────────────────────────
# Codex jsonl reader
# ───────────────────────────────────────────────────────────────────────

def iter_codex_session(path: pathlib.Path):
    try:
        with path.open() as f:
            for line in f:
                rec = safe_load_json(line)
                if not rec:
                    continue
                yield rec
    except OSError:
        return


def codex_user_text(rec: dict) -> str:
    """Extract user prompt from a Codex response_item record (role=user)."""
    if rec.get('type') != 'response_item':
        return ""
    payload = rec.get('payload') or {}
    if payload.get('role') != 'user' and payload.get('type') != 'message':
        return ""
    content = payload.get('content') or []
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for chunk in content:
            if isinstance(chunk, dict):
                txt = chunk.get('text') or chunk.get('input_text')
                if txt:
                    parts.append(txt)
            elif isinstance(chunk, str):
                parts.append(chunk)
        return ' '.join(parts)
    return ""


def codex_tool_calls(rec: dict):
    """Yield (tool_name, args_text) for Codex function_call records."""
    if rec.get('type') != 'response_item':
        return
    payload = rec.get('payload') or {}
    if payload.get('type') == 'function_call':
        name = payload.get('name')
        args_raw = payload.get('arguments')
        args_dict = {}
        if isinstance(args_raw, str):
            args_dict = safe_load_json(args_raw) or {}
        elif isinstance(args_raw, dict):
            args_dict = args_raw
        yield name, args_dict


# ───────────────────────────────────────────────────────────────────────
# DB layer
# ───────────────────────────────────────────────────────────────────────

def open_db(db_path: pathlib.Path, schema_path: pathlib.Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    fresh = not db_path.exists()
    conn = sqlite3.connect(str(db_path))
    conn.execute('PRAGMA foreign_keys = ON')
    if fresh and schema_path.exists():
        conn.executescript(schema_path.read_text())
    else:
        # Always re-apply schema so new CREATE TABLE statements take effect.
        conn.executescript(schema_path.read_text())
    return conn


def reset_origin_tables(conn: sqlite3.Connection):
    """Wipe the snapshot tables so we can rebuild from sources idempotently."""
    conn.execute('DELETE FROM origin_chain')
    conn.execute('DELETE FROM file_touches')
    conn.execute('DELETE FROM sessions')
    conn.execute('DELETE FROM ticket_lifecycle')
    conn.commit()


def upsert_session(conn, **kw):
    keys = list(kw.keys())
    sql = 'INSERT OR REPLACE INTO sessions ({cols}) VALUES ({ph})'.format(
        cols=','.join(keys),
        ph=','.join(['?'] * len(keys)),
    )
    conn.execute(sql, [kw[k] for k in keys])


def insert_origin(conn, **kw):
    keys = list(kw.keys())
    sql = 'INSERT INTO origin_chain ({cols}) VALUES ({ph})'.format(
        cols=','.join(keys),
        ph=','.join(['?'] * len(keys)),
    )
    conn.execute(sql, [kw[k] for k in keys])


def insert_touch(conn, session_id, ts, tool, file_path):
    conn.execute(
        'INSERT INTO file_touches (session_id, ts, tool, file_path) VALUES (?, ?, ?, ?)',
        (session_id, ts, tool, file_path),
    )


def upsert_lifecycle(conn, **kw):
    keys = list(kw.keys())
    sql = 'INSERT OR REPLACE INTO ticket_lifecycle ({cols}) VALUES ({ph})'.format(
        cols=','.join(keys),
        ph=','.join(['?'] * len(keys)),
    )
    conn.execute(sql, [kw[k] for k in keys])


# ───────────────────────────────────────────────────────────────────────
# Per-source extraction
# ───────────────────────────────────────────────────────────────────────

def session_id_from_claude_path(path: pathlib.Path) -> str:
    return path.stem  # uuid


def session_id_from_codex_path(path: pathlib.Path) -> str:
    # rollout-2026-05-08T21-54-12-019e07a7-1c33-7a61-9ec2-be29b96dd2b9.jsonl
    name = path.stem
    parts = name.split('-')
    # Last 5 dash-separated parts form the session uuid.
    if len(parts) >= 5:
        return '-'.join(parts[-5:])
    return name


def extract_claude_session(path: pathlib.Path, board_root: pathlib.Path,
                           conn: sqlite3.Connection, sync_ts: str):
    sid = session_id_from_claude_path(path)
    started_at = None
    ended_at = None
    msg_count = 0
    user_count = 0
    ai_title = None
    cwd = None
    git_branch = None
    total_in = 0
    total_out = 0

    pending_trigger = None  # dict: {ts, kind, prompt}
    triggers: list[dict] = []
    file_touches: list[tuple] = []  # (ts, tool, path)

    for rec in iter_claude_session(path):
        ts = rec.get('timestamp')
        if ts:
            if not started_at or ts < started_at:
                started_at = ts
            if not ended_at or ts > ended_at:
                ended_at = ts

        rec_type = rec.get('type')
        msg_count += 1

        if rec_type == 'ai-title' and not ai_title:
            ai_title = rec.get('content') or rec.get('title')
        if not cwd:
            cwd = rec.get('cwd')
        if not git_branch:
            git_branch = rec.get('gitBranch')

        if rec_type == 'user':
            text = claude_user_text(rec)
            if text:
                user_count += 1
            kind, body = detect_trigger_with_args(text)
            if kind:
                pending_trigger = {
                    'ts': ts or '',
                    'kind': kind,
                    'prompt': excerpt(body or text),
                }
                triggers.append(pending_trigger)
        elif rec_type == 'assistant':
            tin, tout = claude_token_usage(rec)
            total_in += tin
            total_out += tout
            for name, tool_input in claude_assistant_tool_uses(rec):
                if name in ('Write', 'Edit'):
                    fp = tool_input.get('file_path') or tool_input.get('filePath')
                    if fp:
                        file_touches.append((ts or '', name, fp))
                        # Match inbox/backlog creation back to the most recent trigger.
                        rel = relative_to_board(fp, board_root)
                        if rel and (INBOX_REL_PATTERN.search(rel) or BACKLOG_REL_PATTERN.search(rel)):
                            target = pending_trigger or (triggers[-1] if triggers else None)
                            if target and 'prd_path' not in target:
                                target['prd_path'] = rel
                                target['prd_key'] = prd_key_from_path(rel)
                elif name == 'Bash':
                    cmd = tool_input.get('command') or ''
                    file_touches.append((ts or '', 'Bash', cmd[:200]))

    upsert_session(
        conn,
        session_id=sid,
        source='claude_code',
        source_path=str(path),
        started_at=started_at,
        ended_at=ended_at,
        message_count=msg_count,
        user_prompt_count=user_count,
        ai_title=ai_title,
        cwd=cwd,
        git_branch=git_branch,
        total_input_tokens=total_in,
        total_output_tokens=total_out,
        synced_at=sync_ts,
    )
    for ts, tool, fp in file_touches[:500]:  # cap to avoid bloat
        insert_touch(conn, sid, ts, tool, fp)
    for trig in triggers:
        insert_origin(
            conn,
            session_id=sid,
            source='claude_code',
            trigger_kind=trig['kind'],
            trigger_ts=trig['ts'],
            user_prompt_excerpt=trig.get('prompt'),
            prd_path=trig.get('prd_path'),
            prd_key=trig.get('prd_key'),
            ticket_id=None,
            ticket_status=None,
            commit_hash=None,
            commit_subject=None,
            done_at=None,
            synced_at=sync_ts,
        )


def extract_codex_session(path: pathlib.Path, board_root: pathlib.Path,
                          conn: sqlite3.Connection, sync_ts: str):
    sid = session_id_from_codex_path(path)
    started_at = None
    ended_at = None
    msg_count = 0
    user_count = 0
    cwd = None
    git_branch = None

    pending_trigger = None
    triggers: list[dict] = []
    file_touches: list[tuple] = []

    for rec in iter_codex_session(path):
        ts = rec.get('timestamp')
        if ts:
            if not started_at or ts < started_at:
                started_at = ts
            if not ended_at or ts > ended_at:
                ended_at = ts
        rec_type = rec.get('type')
        msg_count += 1

        if rec_type == 'session_meta':
            payload = rec.get('payload') or {}
            cwd = cwd or payload.get('cwd')
            git_branch = git_branch or payload.get('git_branch')

        if rec_type == 'response_item':
            payload = rec.get('payload') or {}
            ptype = payload.get('type')
            if ptype == 'message' and payload.get('role') == 'user':
                text = codex_user_text(rec)
                if text:
                    user_count += 1
                kind, body = detect_trigger_with_args(text)
                if kind:
                    pending_trigger = {
                        'ts': ts or '',
                        'kind': kind,
                        'prompt': excerpt(body or text),
                    }
                    triggers.append(pending_trigger)
            elif ptype == 'function_call':
                for name, args in codex_tool_calls(rec):
                    if name in ('shell', 'apply_patch'):
                        cmd = args.get('command') or args.get('cmd') or ''
                        if isinstance(cmd, list):
                            cmd = ' '.join(cmd)
                        file_touches.append((ts or '', name, str(cmd)[:200]))
                        # Heuristic: if a 'cat > .autoflow/tickets/inbox/order_*.md' or write
                        # operation appears, attribute back to the recent trigger.
                        for m in INBOX_REL_PATTERN.finditer(cmd):
                            target = pending_trigger or (triggers[-1] if triggers else None)
                            if target and 'prd_path' not in target:
                                target['prd_path'] = m.group(0)
                                target['prd_key'] = prd_key_from_path(m.group(0))
                        for m in BACKLOG_REL_PATTERN.finditer(cmd):
                            target = pending_trigger or (triggers[-1] if triggers else None)
                            if target and 'prd_path' not in target:
                                target['prd_path'] = m.group(0)
                                target['prd_key'] = prd_key_from_path(m.group(0))

    upsert_session(
        conn,
        session_id=sid,
        source='codex',
        source_path=str(path),
        started_at=started_at,
        ended_at=ended_at,
        message_count=msg_count,
        user_prompt_count=user_count,
        ai_title=None,
        cwd=cwd,
        git_branch=git_branch,
        total_input_tokens=0,
        total_output_tokens=0,
        synced_at=sync_ts,
    )
    for ts, tool, fp in file_touches[:500]:
        insert_touch(conn, sid, ts, tool, fp)
    for trig in triggers:
        insert_origin(
            conn,
            session_id=sid,
            source='codex',
            trigger_kind=trig['kind'],
            trigger_ts=trig['ts'],
            user_prompt_excerpt=trig.get('prompt'),
            prd_path=trig.get('prd_path'),
            prd_key=trig.get('prd_key'),
            ticket_id=None,
            ticket_status=None,
            commit_hash=None,
            commit_subject=None,
            done_at=None,
            synced_at=sync_ts,
        )


# ───────────────────────────────────────────────────────────────────────
# Chain enrichment: PRD → ticket → commit
# ───────────────────────────────────────────────────────────────────────

def find_prd_files(board_root: pathlib.Path) -> dict[str, str]:
    """Return {prd_key: relative_path} for every PRD/order file currently
    in inbox/backlog/done. The same key may exist in multiple stages over
    time; this returns the latest one we can find."""
    out: dict[str, str] = {}
    candidates = []
    for sub in ['tickets/inbox', 'tickets/backlog']:
        d = board_root / sub
        if d.exists():
            candidates.extend(d.glob('*.md'))
    done = board_root / 'tickets/done'
    if done.exists():
        for sub in done.iterdir():
            if sub.is_dir():
                candidates.extend(sub.glob('*.md'))
    for cand in candidates:
        rel = str(cand.relative_to(board_root))
        key = prd_key_from_path(rel)
        if key:
            out[key] = rel
    return out


def list_tickets(board_root: pathlib.Path) -> list[tuple[str, str, str]]:
    """Return (ticket_id, status, rel_path) for every Todo-NNN.md found."""
    rows = []
    for stage in ['todo', 'inprogress']:
        d = board_root / 'tickets' / stage
        if d.exists():
            for tf in d.glob('Todo-*.md'):
                m = re.search(r'Todo-(\d{3})', tf.name)
                if m:
                    rows.append((m.group(1), stage, str(tf.relative_to(board_root))))
    done = board_root / 'tickets/done'
    if done.exists():
        for sub in done.iterdir():
            if sub.is_dir():
                for tf in sub.glob('Todo-*.md'):
                    m = re.search(r'Todo-(\d{3})', tf.name)
                    if m:
                        rows.append((m.group(1), 'done', str(tf.relative_to(board_root))))
    return rows


def parse_ticket_md(path: pathlib.Path) -> dict:
    """Light parser: pull Ticket fields + Goal Runtime + References."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    section = ''
    for line in path.read_text(errors='replace').splitlines():
        stripped = line.strip()
        if stripped.startswith('## '):
            heading = stripped[3:].strip().rstrip(':').lower()
            section = heading
            continue
        if not stripped.startswith('- '):
            continue
        if section == 'ticket':
            if stripped.startswith('- PRD Key:'):
                out['prd_key'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Title:'):
                out['title'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Change Type:'):
                out['change_type'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Last Updated:'):
                out['last_updated'] = stripped.split(':', 1)[1].strip()
        elif section == 'goal runtime':
            if stripped.startswith('- Tick Count:'):
                out['tick_count'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Time Used Seconds:'):
                out['time_used'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Started At:'):
                out['started_at'] = stripped.split(':', 1)[1].strip()
            elif stripped.startswith('- Updated At:'):
                out['updated_at'] = stripped.split(':', 1)[1].strip()
        elif section == 'references':
            for label in ('PRD', 'Order', 'Plan', 'Feature Spec', 'Plan Source'):
                prefix = f'- {label}:'
                if stripped.startswith(prefix):
                    val = stripped[len(prefix):].strip()
                    out[f'ref_{label.lower().replace(" ", "_")}'] = val
                    break
    return out


def fetch_ticket_commits(project_root: pathlib.Path) -> dict[str, tuple[str, str, str]]:
    """git log scan: return {ticket_id: (commit_hash, commit_ts_iso, subject)}.
    Matches commit subjects of the shape '[PRD_NNN][ticket_NNN] ...' or
    '[ticket_NNN] ...'. The latest commit per ticket wins.
    """
    out: dict[str, tuple[str, str, str]] = {}
    try:
        proc = subprocess.run(
            ['git', '-C', str(project_root), 'log', '--all',
             '--pretty=format:%H%x09%cI%x09%s'],
            check=False, capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return out
    if proc.returncode != 0:
        return out
    pat = re.compile(r'\[ticket_(\d{3})\]', re.IGNORECASE)
    for line in proc.stdout.splitlines():
        parts = line.split('\t', 2)
        if len(parts) != 3:
            continue
        commit_hash, ts, subject = parts
        for m in pat.finditer(subject):
            tid = m.group(1)
            # First match wins (newest commit due to git log default order).
            out.setdefault(tid, (commit_hash, ts, subject))
    return out


def enrich_chains(conn: sqlite3.Connection, board_root: pathlib.Path,
                  project_root: pathlib.Path, sync_ts: str):
    prd_files = find_prd_files(board_root)
    tickets = list_tickets(board_root)
    ticket_by_prd: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    ticket_by_origin_basename: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    ticket_meta: dict[str, dict] = {}
    for tid, status, rel in tickets:
        meta = parse_ticket_md(board_root / rel)
        ticket_meta[tid] = {**meta, 'status': status, 'rel': rel}
        prd_key = meta.get('prd_key')
        if prd_key:
            ticket_by_prd[prd_key].append((tid, status, rel))
        # Path-based reverse index: chain.prd_path basename → ticket.
        for ref_field in ('ref_prd', 'ref_order', 'ref_plan'):
            ref = meta.get(ref_field)
            if not ref:
                continue
            ref = ref.strip('`').strip()
            base = os.path.basename(ref)
            if base:
                ticket_by_origin_basename[base].append((tid, status, rel))
            # If reference points into tickets/done/<key>/..., archived order
            # files in the same directory should also map back to this ticket.
            if 'tickets/done/' in ref:
                done_dir = board_root / os.path.dirname(ref)
                if done_dir.exists():
                    for sibling in done_dir.glob('*.md'):
                        ticket_by_origin_basename[sibling.name].append((tid, status, rel))

    commits = fetch_ticket_commits(project_root)

    # ---- ticket_lifecycle ----
    for tid, info in ticket_meta.items():
        prd_key = info.get('prd_key')
        title = info.get('title')
        change_type = info.get('change_type', 'code')
        started_at = info.get('started_at') or info.get('last_updated')
        updated_at = info.get('updated_at') or info.get('last_updated')
        status = info.get('status', 'unknown')

        commit_hash = None
        commit_ts = None
        if tid in commits:
            commit_hash, commit_ts, _ = commits[tid]
            done_at = commit_ts if status == 'done' else updated_at
        else:
            done_at = updated_at if status == 'done' else None

        lead_seconds = None
        try:
            if started_at and done_at:
                a = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                b = datetime.fromisoformat(done_at.replace('Z', '+00:00'))
                lead_seconds = int((b - a).total_seconds())
        except (ValueError, TypeError):
            pass

        try:
            tick_count = int(info.get('tick_count') or 0)
        except (ValueError, TypeError):
            tick_count = 0
        try:
            active_seconds = int(info.get('time_used') or 0)
        except (ValueError, TypeError):
            active_seconds = 0

        upsert_lifecycle(
            conn,
            ticket_id=tid,
            prd_key=prd_key,
            title=title,
            change_type=change_type,
            created_at=started_at,
            inprogress_at=started_at if status in ('inprogress', 'done') else None,
            done_at=done_at if status == 'done' else None,
            lead_seconds=lead_seconds,
            active_seconds=active_seconds,
            tick_count=tick_count,
            status=status,
            commit_hash=commit_hash,
            synced_at=sync_ts,
        )

    # ---- enrich origin_chain rows with ticket + commit ----
    cur = conn.execute('SELECT id, prd_key, prd_path FROM origin_chain')
    rows = cur.fetchall()
    for oid, prd_key, prd_path in rows:
        if not prd_key and prd_path:
            prd_key = prd_key_from_path(prd_path)
        ticket_id = None
        ticket_status = None
        commit_hash = None
        commit_subject = None
        done_at = None

        # Match priority:
        # 1. prd_path basename appears in any ticket's References.PRD/Order/Plan
        # 2. chain.prd_key matches ticket.prd_key (e.g. backlog prd_142)
        candidates: list[tuple[str, str, str]] = []
        if prd_path:
            base = os.path.basename(prd_path)
            if base in ticket_by_origin_basename:
                candidates = ticket_by_origin_basename[base]
        if not candidates and prd_key and prd_key in ticket_by_prd:
            candidates = ticket_by_prd[prd_key]

        if candidates:
            ranked = sorted(
                candidates,
                key=lambda t: {'done': 0, 'inprogress': 1, 'todo': 2}.get(t[1], 3),
            )
            ticket_id, ticket_status, _ = ranked[0]
            if ticket_id and ticket_id in commits:
                commit_hash, ts, commit_subject = commits[ticket_id]
                if ticket_status == 'done':
                    done_at = ts

        # If the prd_path already shows tickets/done/<key>/... we can confirm done.
        if prd_path and 'tickets/done/' in prd_path and ticket_status is None:
            ticket_status = 'done'

        conn.execute(
            'UPDATE origin_chain SET prd_key=?, ticket_id=?, ticket_status=?, '
            'commit_hash=?, commit_subject=?, done_at=?, synced_at=? WHERE id=?',
            (prd_key, ticket_id, ticket_status, commit_hash, commit_subject,
             done_at, sync_ts, oid),
        )


# ───────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────

def encoded_project_dir(project_root: pathlib.Path) -> str:
    """Mirror Claude Code's encoding: replace '/' with '-' and prefix '-'."""
    abs_path = str(project_root.resolve())
    return abs_path.replace('/', '-')


def main(argv=None):
    ap = argparse.ArgumentParser(description='Autoflow PRD 9 origin extractor')
    ap.add_argument('--board-root', required=True)
    ap.add_argument('--project-root', required=True)
    ap.add_argument('--claude-projects-dir',
                    default=os.path.expanduser('~/.claude/projects'))
    ap.add_argument('--codex-archived-dir',
                    default=os.path.expanduser('~/.codex/archived_sessions'))
    ap.add_argument('--limit-sessions', type=int, default=0,
                    help='Limit number of sessions to process per source (0=all)')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args(argv)

    board_root = pathlib.Path(args.board_root).resolve()
    project_root = pathlib.Path(args.project_root).resolve()
    db_path = board_root / 'state.db'
    schema_path = board_root / 'state-schema/v1.sql'

    sync_ts = now_utc_iso()
    conn = open_db(db_path, schema_path)
    reset_origin_tables(conn)

    # Claude Code: only this project's encoded directory
    claude_dir = pathlib.Path(args.claude_projects_dir) / encoded_project_dir(project_root)
    claude_count = 0
    if claude_dir.exists():
        files = sorted(claude_dir.glob('*.jsonl'),
                       key=lambda p: p.stat().st_mtime, reverse=True)
        if args.limit_sessions > 0:
            files = files[:args.limit_sessions]
        for path in files:
            extract_claude_session(path, board_root, conn, sync_ts)
            claude_count += 1
    if not args.quiet:
        print(f'claude_sessions={claude_count}')

    # Codex: filter sessions by cwd referencing this project (best-effort)
    codex_dir = pathlib.Path(args.codex_archived_dir)
    codex_count = 0
    if codex_dir.exists():
        files = sorted(codex_dir.glob('rollout-*.jsonl'),
                       key=lambda p: p.stat().st_mtime, reverse=True)
        if args.limit_sessions > 0:
            files = files[:args.limit_sessions]
        proj_str = str(project_root)
        for path in files:
            # Quick scan: only ingest sessions whose session_meta cwd matches
            # this project, otherwise we'd pollute with unrelated projects.
            head = ''
            try:
                with path.open() as f:
                    for _ in range(5):
                        line = f.readline()
                        if not line:
                            break
                        head += line
            except OSError:
                continue
            if proj_str not in head:
                continue
            extract_codex_session(path, board_root, conn, sync_ts)
            codex_count += 1
    if not args.quiet:
        print(f'codex_sessions={codex_count}')

    enrich_chains(conn, board_root, project_root, sync_ts)
    conn.commit()

    cur = conn.execute('SELECT COUNT(*) FROM origin_chain')
    n_chains = cur.fetchone()[0]
    cur = conn.execute('SELECT COUNT(*) FROM ticket_lifecycle')
    n_lifecycle = cur.fetchone()[0]
    cur = conn.execute('SELECT COUNT(*) FROM file_touches')
    n_touches = cur.fetchone()[0]
    if not args.quiet:
        print(f'origin_chain={n_chains}')
        print(f'ticket_lifecycle={n_lifecycle}')
        print(f'file_touches={n_touches}')
        print(f'synced_at={sync_ts}')

    conn.close()


if __name__ == '__main__':
    main()
