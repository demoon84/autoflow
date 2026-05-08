-- Autoflow state ledger schema v1 (PRD 7, 2026-05-09)
--
-- This file is the single source of truth for `.autoflow/state.db`. The
-- schema is opt-in: nothing reads from sqlite unless `AUTOFLOW_STATE_DB=on`.
-- Existing markdown/jsonl write paths remain untouched.
--
-- Phase 1 (this scaffold): sqlite holds a periodically refreshed *snapshot*
-- of the markdown/state files. `state-db.sh sync` rebuilds the snapshot;
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
