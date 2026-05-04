#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLI="${ROOT}/packages/cli/skill-project.sh"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/autoflow-skill-curator.XXXXXX")"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

BOARD="$TMP_ROOT/.autoflow"
DONE="$BOARD/tickets/done/prd_001"
mkdir -p "$DONE"

cat > "$DONE/prd_001.md" <<'EOF'
# Project

- ID: prd_001
- Title: Curator smoke PRD

## Verification

- Command: `echo smoke`
EOF

cat > "$DONE/verify_001.md" <<'EOF'
# Verification

## Command

- Command: `echo smoke`
EOF

cat > "$DONE/tickets_001.md" <<'EOF'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: Curator smoke ticket
- Stage: done

## Goal

- 이번 작업의 목표: curator smoke extraction

## Allowed Paths

- `packages/cli/skill-project.sh`

## Done When

- [ ] smoke trigger creates a skill

## Result

- Summary: smoke complete
- Remaining risk: none
EOF

run_extract() {
  local pattern="$1"
  local category="$2"
  bash "$CLI" auto-extract "$TMP_ROOT" .autoflow --from-ticket "$DONE/tickets_001.md" --pattern-type "$pattern" --category "$category" | tee "$TMP_ROOT/${pattern}.out"
  grep -q '^status=ok$' "$TMP_ROOT/${pattern}.out"
  grep -q "^skill_id=${category}/" "$TMP_ROOT/${pattern}.out"
}

run_extract ticket_completion ticket-completion
run_extract reject_turnaround reject-turnaround
run_extract blocked_recovery blocked-recovery
run_extract orchestration_cleanup orchestration-cleanup
run_extract skill_nudge nudge

STALE_SKILL="$BOARD/wiki/skills-local/ticket-completion/curator-smoke-ticket/SKILL.md"
ARCHIVE_SKILL="$BOARD/wiki/skills-local/reject-turnaround/curator-smoke-ticket/SKILL.md"
PINNED_SKILL="$BOARD/wiki/skills-local/blocked-recovery/curator-smoke-ticket/SKILL.md"

python3 - "$BOARD/wiki/skills-local/.usage.json" <<'PY'
import json, sys
path = sys.argv[1]
data = {
    "ticket-completion/curator-smoke-ticket": {"last_used_at": "2026-03-21T00:00:00Z", "success_count": 0, "failure_count": 0, "view_count": 0},
    "reject-turnaround/curator-smoke-ticket": {"last_used_at": "2026-01-01T00:00:00Z", "success_count": 0, "failure_count": 0, "view_count": 0},
    "blocked-recovery/curator-smoke-ticket": {"last_used_at": "2026-01-01T00:00:00Z", "success_count": 0, "failure_count": 0, "view_count": 0},
}
with open(path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY

sed -i.bak 's/^pinned: false$/pinned: true/' "$PINNED_SKILL"
rm -f "$PINNED_SKILL.bak"

bash "$CLI" curator-run "$TMP_ROOT" .autoflow --once --now 2026-05-05T00:00:00Z | tee "$TMP_ROOT/curator.out"
grep -q '^status=ok$' "$TMP_ROOT/curator.out"
grep -q '^stale_marked_count=1$' "$TMP_ROOT/curator.out"
grep -q '^archived_count=1$' "$TMP_ROOT/curator.out"
grep -q '^pinned_skipped_count=1$' "$TMP_ROOT/curator.out"
grep -q '^reviewed_count=5$' "$TMP_ROOT/curator.out"
grep -q '^auxiliary_client=true$' "$TMP_ROOT/curator.out"
grep -q '^main_prompt_cache_touched=false$' "$TMP_ROOT/curator.out"
grep -q '^state: stale$' "$STALE_SKILL"
test -f "$BOARD/wiki/skills-local/.archive/reject-turnaround/curator-smoke-ticket/SKILL.md"
test -f "$PINNED_SKILL"

AUTOFLOW_CURATOR_ENABLED=0 bash "$CLI" curator-run "$TMP_ROOT" .autoflow --once | tee "$TMP_ROOT/disabled.out"
grep -q '^status=skipped$' "$TMP_ROOT/disabled.out"
grep -q '^reason=disabled_by_env$' "$TMP_ROOT/disabled.out"

bash "$CLI" curator-status "$TMP_ROOT" .autoflow | tee "$TMP_ROOT/status.out"
grep -q '^status=ok$' "$TMP_ROOT/status.out"
grep -q '^archived_count=1$' "$TMP_ROOT/status.out"

echo "skill-curator-auto-extract-smoke: ok"
