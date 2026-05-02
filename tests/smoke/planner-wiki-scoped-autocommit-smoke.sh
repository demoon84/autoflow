#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
fake_bin="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir" "$fake_bin"
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

require_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq -- "$expected" "$file"; then
    echo "Expected text not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

require_clean_scope() {
  local scope="$1"
  local status

  status="$(git -C "$project_dir" status --porcelain -- "$scope")"
  if [ -n "$status" ]; then
    echo "Expected clean git scope: $scope" >&2
    printf '%s\n' "$status" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set planner "$project_dir" agent=codex model=gpt-5.4 reasoning=medium mode=one-shot >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set wiki "$project_dir" agent=codex model=gpt-5.4 reasoning=medium mode=one-shot >/dev/null

mkdir -p "${project_dir}/.autoflow/tickets/inbox"
cat >"${project_dir}/.autoflow/tickets/inbox/memo_777.md" <<'MEMO'
# Order

## Request

- Planner scoped autocommit smoke input.

## Notes

- The fake planner adapter will create a generated PRD.
MEMO

git -C "$project_dir" add .autoflow
git -C "$project_dir" commit -m "baseline board" >/dev/null

cat >"${fake_bin}/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
set -euo pipefail

case "${AUTOFLOW_SMOKE_ROLE:-}" in
  planner)
    mkdir -p "${AUTOFLOW_PROJECT_ROOT}/.autoflow/tickets/backlog"
    cat >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/tickets/backlog/prd_777.md" <<'PRD'
# Project PRD

## PRD

- Key: prd_777
- Title: Planner scoped autocommit smoke

## Goal

- Verify planner-owned board changes are committed by the runner harness.
PRD
    ;;
  wiki)
    mkdir -p "${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/sources" "${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki-raw"
    cat >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki/sources/prd-777-handoff.md" <<'WIKI'
# PRD 777 Handoff

Scoped autocommit wiki source smoke.
WIKI
    cat >"${AUTOFLOW_PROJECT_ROOT}/.autoflow/wiki-raw/prd-777-handoff.md" <<'RAW'
# PRD 777 Raw

Scoped autocommit wiki raw smoke.
RAW
    ;;
  *)
    echo "AUTOFLOW_SMOKE_ROLE is required" >&2
    exit 2
    ;;
esac
FAKE_CODEX
chmod +x "${fake_bin}/codex"

planner_output="${project_dir}/planner.out"
AUTOFLOW_CODEX_DISABLE_PTY=1 AUTOFLOW_SMOKE_ROLE=planner PATH="${fake_bin}:$PATH" \
  "${REPO_ROOT}/bin/autoflow" run planner "$project_dir" --runner planner >"$planner_output"

require_line "$planner_output" "status=ok"
require_line "$planner_output" "adapter=codex"
require_line "$planner_output" "adapter_exit_code=0"
require_line "$planner_output" "autocommit_role=planner"
require_line "$planner_output" "autocommit_status=committed"
require_line "$planner_output" "autocommit_message=[prd_777] planner board update"
require_clean_scope ".autoflow/tickets"
planner_subject="$(git -C "$project_dir" log -1 --pretty=%s)"
if [ "$planner_subject" != "[prd_777] planner board update" ]; then
  echo "Unexpected planner commit subject: $planner_subject" >&2
  exit 1
fi
git -C "$project_dir" show --name-only --pretty=oneline HEAD >"${project_dir}/planner-commit.txt"
require_contains "${project_dir}/planner-commit.txt" ".autoflow/tickets/backlog/prd_777.md"

wiki_output="${project_dir}/wiki.out"
AUTOFLOW_CODEX_DISABLE_PTY=1 AUTOFLOW_SMOKE_ROLE=wiki PATH="${fake_bin}:$PATH" \
  "${REPO_ROOT}/bin/autoflow" run wiki "$project_dir" --runner wiki >"$wiki_output"

require_line "$wiki_output" "status=ok"
require_line "$wiki_output" "adapter=codex"
require_line "$wiki_output" "adapter_exit_code=0"
require_line "$wiki_output" "autocommit_role=wiki"
require_line "$wiki_output" "autocommit_status=committed"
require_line "$wiki_output" "autocommit_message=[wiki] wiki knowledge update"
require_clean_scope ".autoflow/wiki"
require_clean_scope ".autoflow/wiki-raw"
wiki_subject="$(git -C "$project_dir" log -1 --pretty=%s)"
if [ "$wiki_subject" != "[wiki] wiki knowledge update" ]; then
  echo "Unexpected wiki commit subject: $wiki_subject" >&2
  exit 1
fi
git -C "$project_dir" show --name-only --pretty=oneline HEAD >"${project_dir}/wiki-commit.txt"
require_contains "${project_dir}/wiki-commit.txt" ".autoflow/wiki/sources/prd-777-handoff.md"
require_contains "${project_dir}/wiki-commit.txt" ".autoflow/wiki-raw/prd-777-handoff.md"

echo "status=ok"
echo "project_root=$project_dir"
