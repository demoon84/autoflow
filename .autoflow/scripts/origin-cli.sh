#!/usr/bin/env bash
# origin-cli.sh — PRD 9 user-facing search/list/status over the origin ledger.
#
# Subcommands:
#   status              — counts of triggers / done / inprogress / inbox-only
#   list [--limit N]    — most recent chains, source/trigger/prd/ticket/status
#   search <keyword>    — match against user_prompt_excerpt, prd_path, ticket title
#   of-ticket <id>      — chain that produced the given ticket
#   of-commit <hash>    — chain whose commit_hash matches (full or prefix)
#
# Reads .autoflow/state.db. Make sure to run `state-db.js origin-sync` first
# (or rely on a future autoflow runner that calls it on tick).

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

cmd="${1:-status}"
shift || true

state_db="${BOARD_ROOT}/state.db"
if [ ! -f "$state_db" ]; then
  echo "state.db not found. Run state-db.js init && state-db.js origin-sync first." >&2
  exit 2
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 not found." >&2
  exit 2
fi

run_sql() {
  sqlite3 -separator $'\t' "$state_db" "$@"
}

cmd_status() {
  echo "=== Origin chain summary ==="
  sqlite3 -header -column "$state_db" "
SELECT
  COALESCE(ticket_status, 'unmatched') AS status,
  COUNT(*) AS chains
FROM origin_chain
GROUP BY status
ORDER BY chains DESC"

  echo ""
  echo "=== By trigger ==="
  sqlite3 -header -column "$state_db" "
SELECT trigger_kind AS trigger, source, COUNT(*) AS chains
FROM origin_chain
GROUP BY trigger_kind, source
ORDER BY chains DESC"

  echo ""
  echo "=== Recent activity (last 7d) ==="
  sqlite3 -header -column "$state_db" "
SELECT date(trigger_ts) AS day, COUNT(*) AS triggers
FROM origin_chain
WHERE trigger_ts >= date('now', '-7 day')
GROUP BY day
ORDER BY day DESC"

  echo ""
  echo "=== Average ticket lead time by status ==="
  sqlite3 -header -column "$state_db" "
SELECT status, COUNT(*) AS n,
       ROUND(AVG(lead_seconds)/60.0, 1) AS avg_lead_min,
       ROUND(AVG(active_seconds)/60.0, 1) AS avg_active_min,
       ROUND(AVG(tick_count), 1) AS avg_ticks
FROM ticket_lifecycle
GROUP BY status
ORDER BY n DESC"
}

cmd_list() {
  local limit=20
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --limit)
        limit="$2"
        shift 2
        ;;
      *)
        echo "unknown arg: $1" >&2
        exit 2
        ;;
    esac
  done

  echo "=== Most recent ${limit} chains ==="
  sqlite3 -header -column "$state_db" "
SELECT
  substr(trigger_ts, 1, 16) AS ts,
  source,
  trigger_kind AS trig,
  COALESCE(prd_key, '-') AS prd,
  COALESCE(ticket_id, '-') AS tid,
  COALESCE(ticket_status, '-') AS status,
  substr(user_prompt_excerpt, 1, 60) AS prompt
FROM origin_chain
ORDER BY trigger_ts DESC
LIMIT ${limit}"
}

cmd_search() {
  if [ $# -lt 1 ]; then
    echo "Usage: origin search <keyword>" >&2
    exit 2
  fi
  local keyword="$1"
  local kw_safe="${keyword//\'/\'\'}"
  echo "=== Chain matches for: ${keyword} ==="
  sqlite3 -header -column "$state_db" "
SELECT
  substr(o.trigger_ts, 1, 16) AS ts,
  o.source,
  o.trigger_kind AS trig,
  COALESCE(o.prd_key, '-') AS prd,
  COALESCE(o.ticket_id, '-') AS tid,
  COALESCE(o.ticket_status, '-') AS status,
  substr(COALESCE(o.user_prompt_excerpt, ''), 1, 80) AS prompt
FROM origin_chain o
LEFT JOIN ticket_lifecycle t ON t.ticket_id = o.ticket_id
WHERE o.user_prompt_excerpt LIKE '%${kw_safe}%'
   OR o.prd_path LIKE '%${kw_safe}%'
   OR t.title LIKE '%${kw_safe}%'
   OR o.commit_subject LIKE '%${kw_safe}%'
ORDER BY o.trigger_ts DESC"
}

cmd_of_ticket() {
  if [ $# -lt 1 ]; then
    echo "Usage: origin of-ticket <id>" >&2
    exit 2
  fi
  local id_raw="$1"
  local id_norm
  # accept Todo-205, todo-205, 205, ticket_205 → 205
  id_norm="$(printf '%s' "$id_raw" | sed -E 's/[^0-9]//g')"
  id_norm="$(printf '%03d' "${id_norm:-0}" 2>/dev/null || printf '%s' "$id_norm")"

  echo "=== Origin chain producing ticket ${id_norm} ==="
  sqlite3 -header -column "$state_db" "
SELECT
  substr(o.trigger_ts, 1, 19) AS ts,
  o.source, o.trigger_kind AS trig, o.session_id, o.prd_key, o.prd_path,
  o.ticket_status AS status, o.commit_hash, substr(o.user_prompt_excerpt, 1, 200) AS prompt
FROM origin_chain o
WHERE o.ticket_id = '${id_norm}'"

  echo ""
  echo "=== ticket_lifecycle row ==="
  sqlite3 -header -column "$state_db" "
SELECT * FROM ticket_lifecycle WHERE ticket_id = '${id_norm}'"
}

cmd_of_commit() {
  if [ $# -lt 1 ]; then
    echo "Usage: origin of-commit <hash>" >&2
    exit 2
  fi
  local hash_raw="$1"
  echo "=== Origin chain matching commit ${hash_raw} ==="
  sqlite3 -header -column "$state_db" "
SELECT
  substr(trigger_ts, 1, 19) AS ts,
  source, trigger_kind AS trig, prd_key, ticket_id, ticket_status,
  substr(commit_subject, 1, 80) AS subject,
  substr(user_prompt_excerpt, 1, 80) AS prompt
FROM origin_chain
WHERE commit_hash LIKE '${hash_raw}%'
ORDER BY trigger_ts DESC"
}

case "$cmd" in
  status) cmd_status "$@" ;;
  list) cmd_list "$@" ;;
  search) cmd_search "$@" ;;
  of-ticket) cmd_of_ticket "$@" ;;
  of-commit) cmd_of_commit "$@" ;;
  help|*)
    cat <<USAGE >&2
Usage: $(basename "$0") <subcommand>

  status              Counts of triggers / done / inprogress
  list [--limit N]    Most recent chains (default 20)
  search <keyword>    Search prompts / paths / titles / commit subjects
  of-ticket <id>      Show chain that produced this ticket id
  of-commit <hash>    Show chain whose completion commit matches
USAGE
    ;;
esac
