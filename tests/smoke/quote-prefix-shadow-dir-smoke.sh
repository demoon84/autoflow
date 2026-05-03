#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
quoted_project_dir="$(mktemp -d)"
hooks_tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir" "$quoted_project_dir" "$hooks_tmp_dir"
}
trap cleanup EXIT

assert_no_quote_prefix() {
  local root="$1"
  local label="$2"
  local matches

  matches="$( { find "$root" -maxdepth 2 -name '"*' 2>/dev/null || true; } | wc -l | tr -d ' ')"
  if [ "$matches" != "0" ]; then
    echo "FAIL [$label]: quote-prefix paths found under $root" >&2
    find "$root" -maxdepth 2 -name '"*' >&2
    exit 1
  fi
}

# 1. scaffold a fresh project from a normal path argument.
"${REPO_ROOT}/packages/cli/scaffold-project.sh" "$project_dir" >/dev/null
assert_no_quote_prefix "$project_dir" "scaffold-normal"

# Normal source-tree directories created by scaffold should still be present.
for expected in .claude .codex .autoflow; do
  if [ ! -d "${project_dir}/${expected}" ]; then
    echo "FAIL: expected directory missing after scaffold: ${project_dir}/${expected}" >&2
    exit 1
  fi
done

# 2. scaffold accepting a shell-quoted path argument must not create a
#    literal quote-prefix shadow directory next to the real target.
quoted_input="\"${quoted_project_dir}\""
"${REPO_ROOT}/packages/cli/scaffold-project.sh" "$quoted_input" >/dev/null
assert_no_quote_prefix "$quoted_project_dir" "scaffold-quoted-input"
parent_of_quoted="$(dirname "$quoted_project_dir")"
quoted_basename="$(basename "$quoted_project_dir")"
if [ -d "${parent_of_quoted}/\"${quoted_basename}" ]; then
  echo "FAIL: quote-prefix shadow created beside ${quoted_project_dir}" >&2
  exit 1
fi

# 3. upgrade flow on the same scaffolded project must keep the root clean.
"${REPO_ROOT}/packages/cli/upgrade-project.sh" "$project_dir" >/dev/null
assert_no_quote_prefix "$project_dir" "upgrade-normal"

# 4. stop-hook installer accepting a quoted manifest path must not create
#    a quote-prefix directory under the manifest parent.
manifest_path="${hooks_tmp_dir}/codex/hooks.json"
quoted_manifest="\"${manifest_path}\""
AUTOFLOW_CODEX_HOOKS_PATH="$quoted_manifest" \
  "${REPO_ROOT}/packages/cli/stop-hook-project.sh" install "$project_dir" >/dev/null
assert_no_quote_prefix "$hooks_tmp_dir" "install-stop-hook-quoted"
if [ ! -f "$manifest_path" ]; then
  echo "FAIL: install-stop-hook did not create manifest at $manifest_path" >&2
  exit 1
fi

# 5. stop-hook installer accepting a quoted project root must not create
#    a quote-prefix shadow alongside the project directory.
quoted_project_input="\"${project_dir}\""
AUTOFLOW_CODEX_HOOKS_PATH="$manifest_path" \
  "${REPO_ROOT}/packages/cli/stop-hook-project.sh" status "$quoted_project_input" >/dev/null
quoted_shadow="$(dirname "$project_dir")/\"$(basename "$project_dir")"
if [ -e "$quoted_shadow" ]; then
  echo "FAIL: quote-prefix shadow path created at $quoted_shadow" >&2
  exit 1
fi

# 6. final dogfood-level guard: the host repo root must stay clean.
assert_no_quote_prefix "$REPO_ROOT" "repo-root"

echo "ok"
