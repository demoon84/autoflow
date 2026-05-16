-- Autoflow state ledger schema v1 (PRD 7, 2026-05-09)
--
-- This file is the single source of truth for `.autoflow/state.db`. The
-- schema is opt-in: nothing reads from sqlite unless `AUTOFLOW_STATE_DB=on`.
-- Existing markdown/jsonl write paths remain untouched.
--
-- Phase 1 (this scaffold): sqlite holds a periodically refreshed *snapshot*
-- of the markdown/state files. `state-db.js sync` rebuilds the snapshot;
-- `autoflow doctor` consumes it to report drift.
-- Phase 2 (future): write-time dual-write so that markdown/jsonl and sqlite
-- both record every event, with sqlite eventually becoming primary.

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_version (version, applied_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

CREATE TABLE IF NOT EXISTS runner_state (
  runner_id TEXT PRIMARY KEY,
  last_result TEXT,
  consecutive_timeout_count INTEGER,
  active_ticket_id TEXT,
  active_stage TEXT,
  mtime_epoch INTEGER,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fingerprint (
  path TEXT PRIMARY KEY,
  mtime_epoch INTEGER,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS board_count (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  measured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  runner_id TEXT,
  role TEXT,
  event TEXT,
  payload TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_ts ON runs(ts);
CREATE INDEX IF NOT EXISTS idx_runs_runner ON runs(runner_id);

-- ── PRD 9: Origin Ledger (2026-05-09) ───────────────────────────────────
-- Tracks the chain: Claude Code / Codex session → PRD/order → ticket → commit.

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,                  -- 'claude_code' | 'codex'
  source_path TEXT NOT NULL,             -- absolute jsonl path
  started_at TEXT,
  ended_at TEXT,
  message_count INTEGER DEFAULT 0,
  user_prompt_count INTEGER DEFAULT 0,
  ai_title TEXT,                         -- Claude Code 'ai-title' record value when present
  cwd TEXT,                              -- working directory if recorded
  git_branch TEXT,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source);

CREATE TABLE IF NOT EXISTS origin_chain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL,                  -- 'claude_code' | 'codex'
  trigger_kind TEXT NOT NULL,            -- 'autoflow' | 'order' | 'plan' | 'todo'
  trigger_ts TEXT NOT NULL,
  user_prompt_excerpt TEXT,              -- first 280 chars of the triggering user prompt
  prd_path TEXT,                         -- e.g. '.autoflow/tickets/done/prd_142/prd_142.md' or order/order_NNN.md
  prd_key TEXT,                          -- 'prd_142' | 'express_900' | 'order_88'
  ticket_id TEXT,                        -- normalized 3-digit id of the resulting Todo-NNN
  ticket_status TEXT,                    -- 'order' | 'prd' | 'todo' | 'inprogress' | 'done' | 'failed'
  commit_hash TEXT,
  commit_subject TEXT,
  done_at TEXT,
  synced_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_origin_session ON origin_chain(session_id);
CREATE INDEX IF NOT EXISTS idx_origin_ticket ON origin_chain(ticket_id);
CREATE INDEX IF NOT EXISTS idx_origin_prd ON origin_chain(prd_key);
CREATE INDEX IF NOT EXISTS idx_origin_status ON origin_chain(ticket_status);
CREATE INDEX IF NOT EXISTS idx_origin_trigger_ts ON origin_chain(trigger_ts);

CREATE TABLE IF NOT EXISTS ticket_lifecycle (
  ticket_id TEXT PRIMARY KEY,
  prd_key TEXT,
  title TEXT,
  change_type TEXT,
  created_at TEXT,
  inprogress_at TEXT,
  done_at TEXT,
  lead_seconds INTEGER,
  active_seconds INTEGER,
  tick_count INTEGER DEFAULT 0,
  status TEXT,
  commit_hash TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_status ON ticket_lifecycle(status);
CREATE INDEX IF NOT EXISTS idx_lifecycle_prd ON ticket_lifecycle(prd_key);

CREATE TABLE IF NOT EXISTS file_touches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  tool TEXT,                             -- 'Edit' | 'Write' | 'Read' | 'Bash' etc.
  file_path TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_touches_path ON file_touches(file_path);
CREATE INDEX IF NOT EXISTS idx_touches_session ON file_touches(session_id);
