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
    sed -n '1,220p' "$file" >&2
    exit 1
  fi
}

require_absent_regex() {
  local file="$1"
  local pattern="$2"

  if grep -Eq -- "$pattern" "$file"; then
    echo "Unexpected pattern found: $pattern" >&2
    echo "--- matches in $file ---" >&2
    grep -En -- "$pattern" "$file" >&2
    exit 1
  fi
}

main_tsx="${REPO_ROOT}/apps/desktop/src/renderer/main.tsx"
styles_css="${REPO_ROOT}/apps/desktop/src/renderer/styles.css"
preload_js="${REPO_ROOT}/apps/desktop/src/preload.js"
main_js="${REPO_ROOT}/apps/desktop/src/main.js"
vite_env="${REPO_ROOT}/apps/desktop/src/renderer/vite-env.d.ts"

require_absent_regex "$main_tsx" 'from ["'\'']\./theme["'\'']|desktopTheme|ThemeProvider|CssBaseline'
require_absent_regex "$main_tsx" 'size="sm"|size="icon"'
require_contains "$styles_css" "button.af-button-xs"
require_contains "$styles_css" "button.af-button-icon-xs"
require_contains "$styles_css" "input.af-input-xs"

for api in chatLoad chatAppend chatPickImages chatAttachImages chatSend chatReset saveMemo saveSpec; do
  require_contains "$preload_js" "${api}:"
  require_contains "$vite_env" "${api}:"
done

for channel in \
  autoflow:chatLoad \
  autoflow:chatAppend \
  autoflow:chatPickImages \
  autoflow:chatAttachImages \
  autoflow:chatSend \
  autoflow:chatReset \
  autoflow:saveMemo \
  autoflow:saveSpec; do
  require_contains "$main_js" "ipcMain.handle(\"${channel}\""
done

echo "status=ok"
