#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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

require_not_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    echo "Unexpected text found: $unexpected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

for protocol in board-orchestration recovery owner-contract; do
  if ! diff -u \
    "${REPO_ROOT}/.autoflow/protocols/${protocol}.md" \
    "${REPO_ROOT}/scaffold/board/protocols/${protocol}.md" >/dev/null; then
    echo "Dogfood and scaffold protocol differ: ${protocol}.md" >&2
    diff -u \
      "${REPO_ROOT}/.autoflow/protocols/${protocol}.md" \
      "${REPO_ROOT}/scaffold/board/protocols/${protocol}.md" >&2 || true
    exit 1
  fi
done

if ! diff -u \
  "${REPO_ROOT}/.autoflow/runners/README.md" \
  "${REPO_ROOT}/scaffold/board/runners/README.md" >/dev/null; then
  echo "Dogfood and scaffold runner docs differ: runners/README.md" >&2
  diff -u \
    "${REPO_ROOT}/.autoflow/runners/README.md" \
    "${REPO_ROOT}/scaffold/board/runners/README.md" >&2 || true
  exit 1
fi

require_contains "${REPO_ROOT}/.autoflow/protocols/board-orchestration.md" "## Execution Boundary Matrix"
require_contains "${REPO_ROOT}/.autoflow/protocols/board-orchestration.md" "Safety-kernel responsibility"
require_contains "${REPO_ROOT}/.autoflow/protocols/board-orchestration.md" 'AI-owned decision'
require_contains "${REPO_ROOT}/.autoflow/protocols/board-orchestration.md" 'If a helper reports `blocked`, `needs_ai_merge`, `warning`, or `error`'
require_contains "${REPO_ROOT}/.autoflow/protocols/board-orchestration.md" 'manage runner or OS processes directly'
require_contains "${REPO_ROOT}/scaffold/board/protocols/board-orchestration.md" 'manage runner or OS processes directly'
require_contains "${REPO_ROOT}/.autoflow/agents/plan-to-ticket-agent.md" 'Do not manage runner or OS processes'
require_contains "${REPO_ROOT}/scaffold/board/agents/plan-to-ticket-agent.md" 'Do not manage runner or OS processes'
require_contains "${REPO_ROOT}/.autoflow/agents/plan-to-ticket-agent.md" 'Treat guard warnings as orchestration evidence'
require_contains "${REPO_ROOT}/scaffold/board/agents/plan-to-ticket-agent.md" 'Treat guard warnings as orchestration evidence'
require_contains "${REPO_ROOT}/.autoflow/agents/ticket-owner-agent.md" 'You are the Impl AI for exactly one ticket'
require_contains "${REPO_ROOT}/scaffold/board/agents/ticket-owner-agent.md" 'You are the Impl AI for exactly one ticket'
require_contains "${REPO_ROOT}/.autoflow/agents/wiki-maintainer-agent.md" 'You are the Wiki AI synthesis owner, not the board orchestrator'
require_contains "${REPO_ROOT}/scaffold/board/agents/wiki-maintainer-agent.md" 'You are the Wiki AI synthesis owner, not the board orchestrator'
require_not_contains "${REPO_ROOT}/.autoflow/agents/ticket-owner-agent.md" 'You are the orchestrator'
require_not_contains "${REPO_ROOT}/scaffold/board/agents/ticket-owner-agent.md" 'You are the orchestrator'
require_not_contains "${REPO_ROOT}/.autoflow/agents/wiki-maintainer-agent.md" 'You are the orchestrator'
require_not_contains "${REPO_ROOT}/scaffold/board/agents/wiki-maintainer-agent.md" 'You are the orchestrator'
require_contains "${REPO_ROOT}/.autoflow/runners/README.md" '`last_result` should preserve the most recent meaningful runtime or adapter result'
require_contains "${REPO_ROOT}/scaffold/board/runners/README.md" '`last_result` should preserve the most recent meaningful runtime or adapter result'
require_contains "${REPO_ROOT}/.autoflow/runners/README.md" 'derive a display `last_result` from recent runner log events'
require_contains "${REPO_ROOT}/scaffold/board/runners/README.md" 'derive a display `last_result` from recent runner log events'
require_contains "${REPO_ROOT}/.autoflow/runners/README.md" 'active_recovery_worktree_path'
require_contains "${REPO_ROOT}/scaffold/board/runners/README.md" 'active_recovery_worktree_path'
require_contains "${REPO_ROOT}/.autoflow/automations/README.md" 'leftover ticket worktrees for rejected/done tickets'
require_contains "${REPO_ROOT}/scaffold/board/automations/README.md" 'leftover ticket worktrees for rejected/done tickets'

echo "status=ok"
