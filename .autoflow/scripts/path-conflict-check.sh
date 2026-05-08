#!/usr/bin/env bash
# path-conflict-check.sh — Detect Allowed Paths overlap between two tickets.
#
# PRD 5 (2026-05-09): infrastructure for multi-worker dispatch. When more
# than one ticket-owner runner is enabled, the dispatcher uses this to refuse
# claiming a todo whose Allowed Paths overlap an already-inprogress ticket
# owned by a different worker. Single-worker topology (default) never trips
# this since inprogress is always 0 or 1.
#
# Usage:
#   path-conflict-check.sh <ticket-a.md> <ticket-b.md>
#
# Exit codes:
#   0 — no overlap
#   1 — overlap detected; stdout lists conflicting (a <-> b) pairs
#   2 — usage / argument error
#
# Conflict semantics: A and B conflict when any concrete path in A equals,
# is a prefix of, or is contained inside any concrete path in B (and vice
# versa). Empty Allowed Paths or non-concrete entries (e.g. "TODO: ...")
# are ignored — those tickets are not safe to dispatch in parallel anyway.

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

usage() {
  echo "Usage: $(basename "$0") <ticket-a.md> <ticket-b.md>" >&2
}

if [ $# -ne 2 ]; then
  usage
  exit 2
fi

a="$1"
b="$2"
[ -f "$a" ] || { echo "missing ticket file: $a" >&2; exit 2; }
[ -f "$b" ] || { echo "missing ticket file: $b" >&2; exit 2; }

a_paths_file="$(autoflow_mktemp)"
b_paths_file="$(autoflow_mktemp)"
trap 'rm -f "$a_paths_file" "$b_paths_file"' EXIT

ticket_concrete_allowed_paths "$a" > "$a_paths_file"
ticket_concrete_allowed_paths "$b" > "$b_paths_file"

# Empty Allowed Paths means we cannot reason about overlap; refuse to claim
# the offending pair safely by reporting a synthetic conflict.
if [ ! -s "$a_paths_file" ] || [ ! -s "$b_paths_file" ]; then
  printf 'unresolvable: at least one ticket has no concrete Allowed Paths\n'
  exit 1
fi

conflict=0
while IFS= read -r ap; do
  [ -n "$ap" ] || continue
  ap_norm="${ap%/}"
  while IFS= read -r bp; do
    [ -n "$bp" ] || continue
    bp_norm="${bp%/}"
    if [ "$ap_norm" = "$bp_norm" ]; then
      printf '%s <-> %s\n' "$ap" "$bp"
      conflict=1
      continue
    fi
    case "$ap_norm" in
      "$bp_norm"/*)
        printf '%s <-> %s\n' "$ap" "$bp"
        conflict=1
        ;;
    esac
    case "$bp_norm" in
      "$ap_norm"/*)
        printf '%s <-> %s\n' "$ap" "$bp"
        conflict=1
        ;;
    esac
  done < "$b_paths_file"
done < "$a_paths_file"

[ "$conflict" -eq 0 ] || exit 1
exit 0
