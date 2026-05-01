#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

require_line() {
  local file="$1"
  local expected="$2"

  if ! grep -Fqx -- "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Expected pattern not found: $pattern" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

for runtime_file in \
  "${REPO_ROOT}/.autoflow/scripts/finish-ticket-owner.sh" \
  "${REPO_ROOT}/runtime/board-scripts/finish-ticket-owner.sh" \
  "${REPO_ROOT}/.autoflow/scripts/merge-ready-ticket.sh" \
  "${REPO_ROOT}/runtime/board-scripts/merge-ready-ticket.sh"
do
  if rg -n '\$\("\$\{BOARD_ROOT\}/scripts/update-wiki\.sh"' "$runtime_file"; then
    echo "Ticket finalizers must not auto-call update-wiki.sh: $runtime_file" >&2
    exit 1
  fi
  if rg -n '\$\{BOARD_ROOT\}/wiki/\$\{wiki_file\}' "$runtime_file"; then
    echo "Ticket finalizers must not stage wiki files: $runtime_file" >&2
    exit 1
  fi
done

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"
: >"${project_dir}/baseline.txt"
git -C "$project_dir" add baseline.txt
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/done/prd_001"
cat >"${project_dir}/.autoflow/tickets/done/prd_001/tickets_001.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_001
- PRD Key: prd_001
- Title: Wiki baseline smoke
- Stage: done
- Last Updated: 2026-05-01T00:00:00Z

## Result

- Summary: Baseline smoke complete
TICKET

first_output="${project_dir}/wiki-first.out"
second_output="${project_dir}/wiki-second.out"
third_output="${project_dir}/wiki-third.out"

"${REPO_ROOT}/bin/autoflow" wiki update "$project_dir" >"$first_output"
require_line "$first_output" "status=updated"
require_line "$first_output" "changed_file_count=3"

git -C "$project_dir" add .autoflow baseline.txt
git -C "$project_dir" commit -m "baseline wiki" >/dev/null

"${REPO_ROOT}/bin/autoflow" wiki update "$project_dir" >"$second_output"
require_line "$second_output" "status=unchanged"
require_line "$second_output" "changed_file_count=0"
require_line "$second_output" "history_file=${project_dir}/.autoflow/runners/state/wiki-baseline.history"
require_line "${project_dir}/.autoflow/runners/state/wiki-baseline.history" "status=unchanged"

if git -C "$project_dir" status --porcelain -- .autoflow/wiki | grep -q .; then
  echo "Timestamp-only wiki check should not dirty committed wiki pages." >&2
  git -C "$project_dir" status --porcelain -- .autoflow/wiki >&2
  exit 1
fi

cat >"${project_dir}/.autoflow/tickets/done/prd_001/tickets_002.md" <<'TICKET'
# Ticket

## Ticket

- ID: tickets_002
- PRD Key: prd_001
- Title: Wiki material update smoke
- Stage: done
- Last Updated: 2026-05-01T01:00:00Z

## Result

- Summary: Material wiki source changed
TICKET

"${REPO_ROOT}/bin/autoflow" wiki update "$project_dir" >"$third_output"
require_line "$third_output" "status=updated"
require_line "$third_output" "changed_file_count=3"
require_line "${project_dir}/.autoflow/runners/state/wiki-baseline.history" "status=updated"
require_pattern "${project_dir}/.autoflow/wiki/index.md" 'tickets_002'

echo "status=ok"
echo "project_root=$project_dir"
