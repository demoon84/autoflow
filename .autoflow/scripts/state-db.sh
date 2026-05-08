#!/usr/bin/env bash
# state-db.sh — Autoflow sqlite state ledger (PRD 7, 2026-05-09).
#
# Phase 1 scaffold: sqlite holds a snapshot of markdown/state files. Nothing
# reads from sqlite during normal runner ticks unless AUTOFLOW_STATE_DB=on.
# This script is idempotent and safe to call repeatedly; it never touches
# product code or wiki contents.
#
# Subcommands:
#   init                 — create .autoflow/state.db with schema v1.
#   sync                 — refresh snapshot tables from current state files.
#   drift-summary        — print key=value drift stats (used by `doctor`).
#   schema-version       — print the applied schema version.
#
# Storage location: .autoflow/state.db (gitignored under .autoflow/runners/state
# is too narrow; we drop it at .autoflow/state.db so future read paths can
# find it without env). The file is added to .gitignore by autoflow init.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

cmd="${1:-help}"

state_db_path() {
  printf '%s/state.db' "$BOARD_ROOT"
}

state_schema_path() {
  printf '%s/state-schema/v1.sql' "$BOARD_ROOT"
}

ensure_sqlite() {
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 binary not found; install it or skip PRD 7 ledger." >&2
    exit 2
  fi
}

now_iso_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

cmd_init() {
  ensure_sqlite
  local db schema
  db="$(state_db_path)"
  schema="$(state_schema_path)"
  [ -f "$schema" ] || { echo "schema not found: $schema" >&2; exit 2; }
  sqlite3 "$db" < "$schema"
  printf 'state_db=%s\n' "$db"
  printf 'status=initialized\n'
}

cmd_schema_version() {
  ensure_sqlite
  local db version
  db="$(state_db_path)"
  if [ ! -f "$db" ]; then
    printf 'state_db=%s\n' "$db"
    printf 'status=not_initialized\n'
    return 0
  fi
  version="$(sqlite3 "$db" 'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1' 2>/dev/null || true)"
  printf 'state_db=%s\n' "$db"
  printf 'schema_version=%s\n' "${version:-unknown}"
}

cmd_sync() {
  ensure_sqlite
  local db state_dir now state_file base runner_id field value mtime
  db="$(state_db_path)"
  if [ ! -f "$db" ]; then
    cmd_init >/dev/null
  fi
  now="$(now_iso_utc)"
  state_dir="${BOARD_ROOT}/runners/state"

  sqlite3 "$db" <<SQL
DELETE FROM runner_state;
DELETE FROM fingerprint;
DELETE FROM board_count;
SQL

  local synced_runners=0
  if [ -d "$state_dir" ]; then
    while IFS= read -r state_file; do
      [ -f "$state_file" ] || continue
      base="$(basename "$state_file")"
      runner_id="${base%.state}"
      [ "$runner_id" != "$base" ] || continue

      local last_result="" timeout_count="" active_id="" active_stage=""
      last_result="$(awk -F= '$1 == "last_result" { sub(/^[^=]*=/, ""); print; exit }' "$state_file" 2>/dev/null || true)"
      timeout_count="$(awk -F= '$1 == "consecutive_timeout_count" { sub(/^[^=]*=/, ""); print; exit }' "$state_file" 2>/dev/null || true)"
      active_id="$(awk -F= '$1 == "active_ticket_id" { sub(/^[^=]*=/, ""); print; exit }' "$state_file" 2>/dev/null || true)"
      active_stage="$(awk -F= '$1 == "active_stage" { sub(/^[^=]*=/, ""); print; exit }' "$state_file" 2>/dev/null || true)"
      mtime="$(stat -f '%m' "$state_file" 2>/dev/null || stat -c '%Y' "$state_file" 2>/dev/null || echo 0)"

      sqlite3 "$db" <<SQL
INSERT OR REPLACE INTO runner_state
(runner_id, last_result, consecutive_timeout_count, active_ticket_id, active_stage, mtime_epoch, synced_at)
VALUES ('$(printf '%s' "$runner_id" | sed "s/'/''/g")',
        '$(printf '%s' "$last_result" | sed "s/'/''/g")',
        ${timeout_count:-NULL},
        '$(printf '%s' "$active_id" | sed "s/'/''/g")',
        '$(printf '%s' "$active_stage" | sed "s/'/''/g")',
        ${mtime:-0},
        '$now');
SQL
      synced_runners=$((synced_runners + 1))
    done < <(find "$state_dir" -maxdepth 1 -name '*.state' -type f 2>/dev/null | sort)
  fi

  local synced_fingerprints=0
  if [ -d "$state_dir" ]; then
    while IFS= read -r fp_file; do
      [ -f "$fp_file" ] || continue
      mtime="$(stat -f '%m' "$fp_file" 2>/dev/null || stat -c '%Y' "$fp_file" 2>/dev/null || echo 0)"
      local fp_rel
      fp_rel="${fp_file#${BOARD_ROOT}/}"
      sqlite3 "$db" <<SQL
INSERT OR REPLACE INTO fingerprint (path, mtime_epoch, synced_at)
VALUES ('$(printf '%s' "$fp_rel" | sed "s/'/''/g")', ${mtime:-0}, '$now');
SQL
      synced_fingerprints=$((synced_fingerprints + 1))
    done < <(find "$state_dir" -maxdepth 2 -name '*.fingerprint' -type f 2>/dev/null)
  fi

  local bucket count
  for bucket in inbox backlog todo inprogress; do
    count="$(find "${BOARD_ROOT}/tickets/${bucket}" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    sqlite3 "$db" "INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('$bucket', ${count:-0}, '$now');"
  done
  count="$(find "${BOARD_ROOT}/tickets/done" -mindepth 2 -maxdepth 2 -type f -name 'Todo-*.md' 2>/dev/null | wc -l | tr -d ' ')"
  sqlite3 "$db" "INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('done_tickets', ${count:-0}, '$now');"
  count="$(find "${BOARD_ROOT}/tickets/done" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  sqlite3 "$db" "INSERT OR REPLACE INTO board_count (bucket, count, measured_at) VALUES ('done_projects', ${count:-0}, '$now');"

  printf 'status=synced\n'
  printf 'synced_runners=%s\n' "$synced_runners"
  printf 'synced_fingerprints=%s\n' "$synced_fingerprints"
  printf 'synced_at=%s\n' "$now"
}

cmd_drift_summary() {
  ensure_sqlite
  local db
  db="$(state_db_path)"
  if [ ! -f "$db" ]; then
    printf 'status=not_initialized\n'
    return 0
  fi

  local sqlite_runners fs_runners sqlite_fp fs_fp
  sqlite_runners="$(sqlite3 "$db" 'SELECT COUNT(*) FROM runner_state' 2>/dev/null || echo 0)"
  fs_runners="$(find "${BOARD_ROOT}/runners/state" -maxdepth 1 -name '*.state' -type f 2>/dev/null | wc -l | tr -d ' ')"
  sqlite_fp="$(sqlite3 "$db" 'SELECT COUNT(*) FROM fingerprint' 2>/dev/null || echo 0)"
  fs_fp="$(find "${BOARD_ROOT}/runners/state" -maxdepth 2 -name '*.fingerprint' -type f 2>/dev/null | wc -l | tr -d ' ')"

  local drift=0
  [ "${sqlite_runners:-0}" = "${fs_runners:-0}" ] || drift=$((drift + 1))
  [ "${sqlite_fp:-0}" = "${fs_fp:-0}" ] || drift=$((drift + 1))

  printf 'state_db=%s\n' "$db"
  printf 'sqlite_runners=%s fs_runners=%s\n' "${sqlite_runners:-0}" "${fs_runners:-0}"
  printf 'sqlite_fingerprints=%s fs_fingerprints=%s\n' "${sqlite_fp:-0}" "${fs_fp:-0}"
  printf 'drift_count=%s\n' "$drift"
}

case "$cmd" in
  init) shift; cmd_init ;;
  sync) shift; cmd_sync ;;
  drift-summary) shift; cmd_drift_summary ;;
  schema-version) shift; cmd_schema_version ;;
  help|*)
    cat <<USAGE >&2
Usage: $(basename "$0") <init|sync|drift-summary|schema-version>

Phase 1 scaffold (PRD 7). Set AUTOFLOW_STATE_DB=on to enable read-side
consumers in the future. Until then, this is informational only.
USAGE
    exit "${cmd:+1}"
    ;;
esac
