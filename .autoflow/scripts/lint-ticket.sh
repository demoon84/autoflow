#!/usr/bin/env bash

# Done When / Global Acceptance Criteria vagueness linter.
#
# Purpose: catch vague Completion Promises (Ralph loop pattern (a)) before they
# enter the ticket flow. The runtime is a thin tool — the planner orchestrator
# AI decides what to do with the result. We only emit parser-friendly key=value
# output and a non-zero exit code when the score crosses the block threshold.
#
# Usage:
#   lint-ticket.sh <ticket-or-prd-markdown-path>
#
# Exit codes:
#   0 — lint_status=ok or lint_status=warn (callers may treat warn as advisory).
#   1 — lint_status=block, or input error (file missing / unreadable).
#
# Output keys (one per line):
#   lint_status, vagueness_score, criteria_count, concrete_signal_count,
#   vague_terms (comma-separated), lint_target (ticket|prd), lint_path.
#
# Heuristics:
#   1. criteria_count < 3                      -> score += 2
#   2. vague-term match in checklist body      -> score += 1 per match (capped at 5)
#   3. concrete_signal_count == 0              -> score += 2
#
# Threshold (override via AUTOFLOW_LINT_BLOCK_THRESHOLD, default 3):
#   score == 0          -> ok
#   1 <= score < block  -> warn (exit 0)
#   score >= block      -> block (exit 1)
#
# Disable with AUTOFLOW_LINT_TICKET=off (caller skips invocation entirely; this
# script does not check the env var itself so direct invocations always run).

set -euo pipefail

ticket_path="${1:-}"

if [ -z "$ticket_path" ]; then
  printf 'lint_status=block\n' >&2
  printf 'reason=missing_argument\n' >&2
  printf 'usage=lint-ticket.sh <ticket-or-prd-markdown-path>\n' >&2
  exit 1
fi

if [ ! -f "$ticket_path" ]; then
  printf 'lint_status=block\n'
  printf 'reason=file_not_found\n'
  printf 'lint_path=%s\n' "$ticket_path"
  exit 1
fi

# Determine target type by inspecting the first heading and known PRD markers.
lint_target="ticket"
if grep -Eq '^# (Project )?PRD' "$ticket_path" 2>/dev/null; then
  lint_target="prd"
fi

# Extract checklist items from the relevant section.
# Tickets carry "## Done When"; PRDs carry "## Global Acceptance Criteria".
# Some hybrid PRDs also include "## Done When" — try both, prefer the one with
# more items so we lint the most specific Completion Promise the author wrote.
extract_checklist() {
  local file="$1"
  local heading="$2"

  awk -v heading="$heading" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && /^[[:space:]]*-[[:space:]]*\[[ xX]\]/ { print }
  ' "$file"
}

done_when_items="$(extract_checklist "$ticket_path" "Done When" || true)"
gac_items="$(extract_checklist "$ticket_path" "Global Acceptance Criteria" || true)"

count_lines() {
  local input="$1"
  if [ -z "$input" ]; then
    printf '0'
    return 0
  fi
  printf '%s\n' "$input" | wc -l | tr -d ' '
}

done_count="$(count_lines "$done_when_items")"
gac_count="$(count_lines "$gac_items")"

if [ "$gac_count" -gt "$done_count" ]; then
  checklist_body="$gac_items"
  criteria_count="$gac_count"
  selected_section="Global Acceptance Criteria"
else
  checklist_body="$done_when_items"
  criteria_count="$done_count"
  selected_section="Done When"
fi

# --- Heuristic 1: criteria count ---------------------------------------------
score=0
if [ "$criteria_count" -lt 3 ]; then
  score=$((score + 2))
fi

# --- Heuristic 2: vague term matches -----------------------------------------
# Korean and English non-measurable phrases. Each match adds 1, capped at 5 so a
# single repeated word cannot dominate the score.
#
# English patterns are intentionally narrow — we only flag standalone hand-wave
# phrases ("works correctly", "as expected") and avoid generic adjectives like
# "properly" alone, which appear legitimately in measurable phrases (e.g.
# "all variables are properly typed by `tsc --noEmit`"). Korean patterns stay
# inclusive because the language has fewer ambiguity-prone collocations here.
vague_pattern='잘 동작|정상 작동|정상 동작|올바르게|제대로|works correctly|works properly|as expected\b'
vague_match_count=0
vague_terms_csv=""

if [ -n "$checklist_body" ]; then
  # Drop lines that contain negation markers in either Korean (않/못/없) or
  # English (not/n't/never/no) so that phrases like "잘 동작하지 않는다" or
  # "is not as expected; reject with code 2" — which describe measurable
  # failure branches, not vague pass conditions — don't inflate the score.
  vague_matches="$(printf '%s\n' "$checklist_body" \
    | grep -v -E "않|못|없|\\bnot\\b|n't|\\bnever\\b|\\bno\\b" \
    | grep -Eo "$vague_pattern" \
    || true)"
  vague_match_count="$(count_lines "$vague_matches")"
  if [ "$vague_match_count" -gt 0 ]; then
    vague_terms_csv="$(printf '%s\n' "$vague_matches" | sort -u | paste -sd ',' -)"
  fi
fi

if [ "$vague_match_count" -gt 0 ]; then
  capped_vague="$vague_match_count"
  if [ "$capped_vague" -gt 5 ]; then
    capped_vague=5
  fi
  score=$((score + capped_vague))
fi

# --- Heuristic 3: concrete signal count --------------------------------------
# A concrete signal is any of:
#   - backtick-wrapped command/path
#   - explicit "exit N" wording
#   - file extension .md/.sh/.ts/.tsx/.js/.jsx/.py/.json/.toml/.yaml/.yml
#   - numeric metric paired with comparison (>=, <=, ==, !=)
#   - Korean numeric metric units: 개, 회, 건, ms, s, %
concrete_signal_count=0
if [ -n "$checklist_body" ]; then
  concrete_matches="$(printf '%s\n' "$checklist_body" \
    | grep -Eo '`[^`]+`|exit [0-9]+|\.(md|sh|ts|tsx|js|jsx|py|json|toml|yaml|yml)\b|(>=|<=|==|!=) ?[0-9]+|[0-9]+(개|회|건|ms|s|%)' \
    || true)"
  concrete_signal_count="$(count_lines "$concrete_matches")"
fi

if [ "$concrete_signal_count" -eq 0 ]; then
  score=$((score + 2))
fi

# --- Threshold decision -------------------------------------------------------
block_threshold="${AUTOFLOW_LINT_BLOCK_THRESHOLD:-3}"
case "$block_threshold" in
  ''|*[!0-9]*)
    block_threshold=3
    ;;
esac

if [ "$score" -eq 0 ]; then
  lint_status="ok"
  exit_code=0
elif [ "$score" -lt "$block_threshold" ]; then
  lint_status="warn"
  exit_code=0
else
  lint_status="block"
  exit_code=1
fi

# --- Emit ---------------------------------------------------------------------
printf 'lint_status=%s\n' "$lint_status"
printf 'vagueness_score=%s\n' "$score"
printf 'criteria_count=%s\n' "$criteria_count"
printf 'concrete_signal_count=%s\n' "$concrete_signal_count"
printf 'vague_terms=%s\n' "$vague_terms_csv"
printf 'lint_target=%s\n' "$lint_target"
printf 'lint_path=%s\n' "$ticket_path"
printf 'lint_section=%s\n' "$selected_section"
printf 'lint_block_threshold=%s\n' "$block_threshold"

exit "$exit_code"
