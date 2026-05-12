#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir"
}
trap cleanup EXIT

json_get() {
  local file="$1"
  local expr="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const value=(${expr}); if (value == null) process.exit(1); process.stdout.write(String(value));" "$file"
}

require_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Expected file not found: $file" >&2
    exit 1
  fi
}

git -C "$project_dir" init -q
git -C "$project_dir" config user.email autoflow-smoke@example.test
git -C "$project_dir" config user.name "Autoflow Smoke"
printf 'baseline\n' >"${project_dir}/baseline.txt"
git -C "$project_dir" add baseline.txt
git -C "$project_dir" commit -m "baseline" >/dev/null

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
export AUTOFLOW_CLI="${REPO_ROOT}/bin/autoflow"

require_file "${project_dir}/.autoflow/scripts/runner-tool.js"
require_file "${project_dir}/.autoflow/scripts/runner-tool.ts"
require_file "${project_dir}/.autoflow/agents/wiki-maintainer-agent.md"

mkdir -p "${project_dir}/.autoflow/tickets/done/wiki_runner_tool_smoke" \
  "${project_dir}/.autoflow/logs" \
  "${project_dir}/.autoflow/conversations"

cat >"${project_dir}/.autoflow/tickets/done/wiki_runner_tool_smoke/Todo-001.md" <<'TICKET'
# Ticket

## Ticket

- ID: Todo-001
- PRD Key: wiki_runner_tool_smoke
- Title: Wiki runner-tool smoke source
- Stage: done

## Goal

- Wiki runner-tool smoke source should be visible to the Wiki AI snapshot.

## Done When

- [x] Source exists.
TICKET

printf '# Wiki runner-tool smoke log\n' >"${project_dir}/.autoflow/logs/wiki_runner_tool_smoke.md"
printf '# Wiki runner-tool smoke handoff\n' >"${project_dir}/.autoflow/conversations/wiki_runner_tool_smoke.md"
cat >"${project_dir}/wiki-page.md" <<'PAGE'
---
kind: answer
slug: wiki-runner-tool-smoke
---

# Wiki Runner Tool Smoke

## Symptom

The Wiki AI needs a small deterministic page-write tool.

## Cause

Large wiki commands should not decide page content for the runner.

## Fix

Call `node scripts/runner-tool.js wiki write-page`.

## Verification

Run `tests/smoke/wiki-runner-tool-smoke.sh`.
PAGE

snapshot_output="${project_dir}/snapshot.json"
update_output="${project_dir}/update.json"
telemetry_output="${project_dir}/telemetry.json"
write_output="${project_dir}/write.json"
query_output="${project_dir}/query.json"
lint_output="${project_dir}/lint.json"
diff_output="${project_dir}/diff.json"
wake_output="${project_dir}/wake.json"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki source-snapshot --runner wiki-smoke --max-items 5) >"$snapshot_output"
test "$(json_get "$snapshot_output" "data.tool")" = "wiki.source-snapshot"
test "$(json_get "$snapshot_output" "data.source_counts.done >= 1")" = "true"
test "$(json_get "$snapshot_output" "data.source_counts.logs >= 1")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki update-baseline --dry-run) >"$update_output"
test "$(json_get "$update_output" "data.tool")" = "wiki.update-baseline"
test "$(json_get "$update_output" "data.exit_code")" = "0"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki telemetry-summary --slug-set telemetry-default --window 7d --runner wiki-smoke) >"$telemetry_output"
test "$(json_get "$telemetry_output" "data.tool")" = "wiki.telemetry-summary"
test "$(json_get "$telemetry_output" "data.exit_code")" = "0"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki write-page --path wiki/answers/wiki-runner-tool-smoke.md --content-file ../wiki-page.md) >"$write_output"
test "$(json_get "$write_output" "data.tool")" = "wiki.write-page"
require_file "${project_dir}/.autoflow/wiki/answers/wiki-runner-tool-smoke.md"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki query --term "Wiki Runner Tool Smoke" --rag --limit 3 --runner wiki-smoke) >"$query_output"
test "$(json_get "$query_output" "data.tool")" = "wiki.query"
test "$(json_get "$query_output" "data.exit_code")" = "0"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki lint --runner wiki-smoke) >"$lint_output"
test "$(json_get "$lint_output" "data.tool")" = "wiki.lint"
test "$(json_get "$lint_output" "data.exit_code")" = "0"

git -C "$project_dir" add -f .autoflow/wiki/answers/wiki-runner-tool-smoke.md
(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki diff-snapshot) >"$diff_output"
test "$(json_get "$diff_output" "data.tool")" = "wiki.diff-snapshot"
test "$(json_get "$diff_output" "data.changed_files.some((item) => item.path === 'wiki/answers/wiki-runner-tool-smoke.md')")" = "true"
test "$(json_get "$diff_output" "data.meaningful_commit_candidate")" = "true"

(cd "${project_dir}/.autoflow" && node scripts/runner-tool.js wiki wake --runner wiki-smoke) >"$wake_output"
test "$(json_get "$wake_output" "data.wakeup")" = "triggered"
require_file "${project_dir}/.autoflow/runners/state/wiki-smoke.wiki-realtime-wakeup.pending"

echo "status=ok"
echo "project_root=$project_dir"
