#!/usr/bin/env bash

# Phase 1 (prd_162) Hermes-pattern skill infrastructure smoke.
# Exercises: scaffold, create (folder), list, view, validate (good + cap rejections),
# .usage.json atomic update + corruption recovery, archive (incl. pinned bypass).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUTOFLOW="${REPO_ROOT}/bin/autoflow"

project_dir="$(mktemp -d)"
cleanup() { rm -rf "$project_dir"; }
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
require_kv() {
  # require_kv <output> <key> <expected>
  local out="$1" key="$2" expected="$3"
  local val
  val="$(printf '%s\n' "$out" | awk -F '=' -v k="$key" '$1==k {sub(/^[^=]*=/,""); print; exit}')"
  if [ "$val" != "$expected" ]; then
    echo "$out" >&2
    fail "expected $key=$expected, got $key=$val"
  fi
}
get_kv() {
  printf '%s\n' "$1" | awk -F '=' -v k="$2" '$1==k {sub(/^[^=]*=/,""); print; exit}'
}

# 1. Scaffold a fresh project.
"${REPO_ROOT}/packages/cli/scaffold-project.sh" "$project_dir" >/dev/null
board="${project_dir}/.autoflow"
[ -d "${board}/wiki/skills" ] || fail "skills/ not scaffolded"
[ -d "${board}/wiki/skills-local" ] || fail "skills-local/ not scaffolded"

# 2. Seed a minimal todo ticket so `skill create --from-ticket` has source content.
mkdir -p "${board}/tickets/inprogress"
ticket_file="${board}/tickets/inprogress/tickets_900.md"
cat > "$ticket_file" <<'EOF'
# Ticket
## Ticket
- ID: tickets_900
- PRD Key: prd_900
- Title: phase1 skill infra smoke ticket
- Stage: executing

## Goal
- 이번 작업의 목표: smoke test 용 ticket 본문 — skill phase 1 인프라 검증.

## Allowed Paths
- `packages/cli/skill-project.sh`
- `bin/autoflow`

## Done When
- [ ] CLI 가 정상 동작한다.
- [ ] sidecar 가 atomic 으로 갱신된다.
EOF

# 3. create -> agent-created folder skill under skills-local/.
out="$("$AUTOFLOW" skill create "$project_dir" .autoflow --from-ticket tickets_900)"
require_kv "$out" "status" "ok"
skill_path="$(get_kv "$out" "skill_path")"
skill_key="$(get_kv "$out" "skill_id")"
[ -f "$skill_path" ] || fail "skill_path does not exist: $skill_path"
case "$skill_path" in
  *"/wiki/skills-local/ticket-completion/"*"/SKILL.md") ;;
  *) fail "skill_path not under skills-local/ticket-completion: $skill_path" ;;
esac
grep -q '^name: "phase1-skill-infra-smoke-ticket"' "$skill_path" || fail "frontmatter name missing"
grep -q '^pattern_type: ticket_completion' "$skill_path" || fail "pattern_type missing"
grep -q '^pinned: false' "$skill_path" || fail "pinned default missing"
grep -q '  prd: "prd_900"' "$skill_path" || fail "created_from.prd missing"
grep -q '  ticket: "tickets_900"' "$skill_path" || fail "created_from.ticket missing"

# 4. list shows new agent skill (and not crash on empty in-repo).
out="$("$AUTOFLOW" skill list "$project_dir" .autoflow)"
require_kv "$out" "status" "ok"
agent_count="$(get_kv "$out" "agent_created_count")"
[ "$agent_count" = "1" ] || { echo "$out"; fail "expected agent_created_count=1, got $agent_count"; }

# 5. view succeeds and bumps view_count via sidecar.
out="$("$AUTOFLOW" skill view "$project_dir" .autoflow "$skill_key")"
require_kv "$out" "status" "ok"
require_kv "$out" "key" "$skill_key"
view1="$(get_kv "$out" "view_count")"
[ "$view1" = "1" ] || { echo "$out"; fail "view_count expected 1, got $view1"; }
out="$("$AUTOFLOW" skill view "$project_dir" .autoflow "$skill_key")"
view2="$(get_kv "$out" "view_count")"
[ "$view2" = "2" ] || { echo "$out"; fail "view_count expected 2, got $view2"; }

usage_file="${board}/wiki/skills-local/.usage.json"
[ -f "$usage_file" ] || fail "usage.json not created"
python3 -c "import json; d=json.load(open('$usage_file')); assert d['$skill_key']['view_count']==2" \
  || fail "usage.json view_count mismatch"

# 6. corrupt the sidecar; CLI should still work and recover atomically.
echo 'this is not json' > "$usage_file"
out="$("$AUTOFLOW" skill view "$project_dir" .autoflow "$skill_key")"
require_kv "$out" "status" "ok"
python3 -c "import json; json.load(open('$usage_file'))" || fail "sidecar not recovered to valid JSON"

# 7. validate passes.
out="$("$AUTOFLOW" skill validate "$project_dir" .autoflow "$skill_key")"
require_kv "$out" "status" "ok"
require_kv "$out" "errors" "0"

# 8. validate rejects oversize description.
big_desc_skill_dir="${board}/wiki/skills-local/test-cap/big-desc"
mkdir -p "$big_desc_skill_dir"
{
  printf -- '---\n'
  printf 'name: "big-desc"\n'
  printf 'description: "%s"\n' "$(python3 -c 'print("x"*1100)')"
  printf 'pattern_type: ticket_completion\n'
  printf 'applies_to:\n  module: "general"\n  keywords:\n    - "x"\n'
  printf 'pinned: false\n'
  printf 'created_from:\n  prd: null\n  ticket: null\n'
  printf 'created_at: "2026-05-03T00:00:00Z"\n'
  printf -- '---\n\n# big desc\nbody\n'
} > "${big_desc_skill_dir}/SKILL.md"
set +e
out="$("$AUTOFLOW" skill validate "$project_dir" .autoflow test-cap/big-desc 2>&1)"
rc=$?
set -e
[ "$rc" = "2" ] || { echo "$out"; fail "expected exit 2 for oversize description, got $rc"; }
case "$out" in
  *"description_too_long"*) ;;
  *) fail "expected description_too_long issue, got: $out" ;;
esac

# 9. validate rejects oversize name.
big_name_dir="${board}/wiki/skills-local/test-cap/x"
mkdir -p "$big_name_dir"
big_name="$(python3 -c 'print("a"*70)')"
{
  printf -- '---\n'
  printf 'name: "%s"\n' "$big_name"
  printf 'description: "ok"\n'
  printf 'pattern_type: ticket_completion\n'
  printf 'applies_to:\n  module: "general"\n  keywords:\n    - "x"\n'
  printf 'pinned: false\n'
  printf 'created_from:\n  prd: null\n  ticket: null\n'
  printf 'created_at: "2026-05-03T00:00:00Z"\n'
  printf -- '---\n\n# big name\nbody\n'
} > "${big_name_dir}/SKILL.md"
set +e
out="$("$AUTOFLOW" skill validate "$project_dir" .autoflow test-cap/x 2>&1)"
rc=$?
set -e
[ "$rc" = "2" ] || { echo "$out"; fail "expected exit 2 for oversize name, got $rc"; }
case "$out" in
  *"name_too_long"*) ;;
  *) fail "expected name_too_long issue: $out" ;;
esac

# 10. validate rejects oversize body (>100KB).
big_body_dir="${board}/wiki/skills-local/test-cap/big-body"
mkdir -p "$big_body_dir"
{
  printf -- '---\n'
  printf 'name: "big-body"\n'
  printf 'description: "ok"\n'
  printf 'pattern_type: ticket_completion\n'
  printf 'applies_to:\n  module: "general"\n  keywords:\n    - "x"\n'
  printf 'pinned: false\n'
  printf 'created_from:\n  prd: null\n  ticket: null\n'
  printf 'created_at: "2026-05-03T00:00:00Z"\n'
  printf -- '---\n\n# big body\n'
  python3 -c 'print("x"*110000)'
} > "${big_body_dir}/SKILL.md"
set +e
out="$("$AUTOFLOW" skill validate "$project_dir" .autoflow test-cap/big-body 2>&1)"
rc=$?
set -e
[ "$rc" = "2" ] || { echo "$out"; fail "expected exit 2 for oversize body, got $rc"; }
case "$out" in
  *"content_size_exceeds"*) ;;
  *) fail "expected content_size_exceeds issue: $out" ;;
esac

# 11. archive moves agent-created skill to .archive/.
out="$("$AUTOFLOW" skill archive "$project_dir" .autoflow "$skill_key")"
require_kv "$out" "status" "ok"
[ ! -f "$skill_path" ] || fail "skill_path still exists after archive: $skill_path"
archived_path="$(get_kv "$out" "archived_path")"
[ -f "$archived_path" ] || fail "archived_path missing: $archived_path"
case "$archived_path" in
  *"/skills-local/.archive/ticket-completion/"*"/SKILL.md") ;;
  *) fail "archived_path not under skills-local/.archive: $archived_path" ;;
esac

# 12. list still works after archive (archived bucket reported, no crash on view).
out="$("$AUTOFLOW" skill list "$project_dir" .autoflow)"
require_kv "$out" "status" "ok"
arch_count="$(get_kv "$out" "archived_count")"
[ "$arch_count" = "1" ] || { echo "$out"; fail "archived_count expected 1, got $arch_count"; }
out="$("$AUTOFLOW" skill view "$project_dir" .autoflow "$skill_key")"
require_kv "$out" "status" "ok"

# 13. pinned skill is refused by archive (lifecycle bypass).
pinned_dir="${board}/wiki/skills-local/test-pin/pinned-one"
mkdir -p "$pinned_dir"
{
  printf -- '---\n'
  printf 'name: "pinned-one"\n'
  printf 'description: "ok"\n'
  printf 'pattern_type: ticket_completion\n'
  printf 'applies_to:\n  module: "general"\n  keywords:\n    - "x"\n'
  printf 'pinned: true\n'
  printf 'created_from:\n  prd: null\n  ticket: null\n'
  printf 'created_at: "2026-05-03T00:00:00Z"\n'
  printf -- '---\n\n# pinned\nbody\n'
} > "${pinned_dir}/SKILL.md"
set +e
out="$("$AUTOFLOW" skill archive "$project_dir" .autoflow test-pin/pinned-one 2>&1)"
rc=$?
set -e
[ "$rc" = "4" ] || { echo "$out"; fail "expected exit 4 for pinned archive, got $rc"; }
case "$out" in
  *"pinned_skill_bypasses_lifecycle"*) ;;
  *) fail "expected pinned_skill_bypasses_lifecycle reason: $out" ;;
esac
[ -f "${pinned_dir}/SKILL.md" ] || fail "pinned skill should not have moved"

echo "ok"
